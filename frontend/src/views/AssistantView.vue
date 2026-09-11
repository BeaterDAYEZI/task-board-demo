<template>
  <div class="page">
    <div class="head-row">
      <div>
        <h2 class="page-title">智能助手</h2>
        <p class="page-sub">用自然语言提问，自动检索部门任务数据并生成图表分析；演示版为本地解析，正式版可接入大模型</p>
      </div>
      <el-button @click="clear">清空对话</el-button>
    </div>

    <div class="card chat-card">
      <div ref="bodyEl" class="chat-body">
        <div v-for="(m, i) in messages" :key="i" class="msg" :class="m.role">
          <div class="avatar">
            <template v-if="m.role === 'user'">{{ store.currentUser?.name?.[0] || '我' }}</template>
            <el-icon v-else><MagicStick /></el-icon>
          </div>
          <div class="bubble">
            <template v-if="m.loading">
              <span class="thinking">正在检索任务数据，生成分析…</span>
            </template>
            <template v-else-if="m.role === 'user'">{{ m.text }}</template>
            <template v-else>
              <div class="a-title">{{ m.answer.title }}</div>
              <div class="a-summary">{{ m.answer.summary }}</div>
              <div v-if="m.answer.chart" class="a-chart">
                <VChart :option="m.answer.chart" :height="m.answer.chartHeight || 260" />
              </div>
              <div v-if="m.answer.table" class="a-table">
                <el-table :data="m.answer.table.rows" size="small" style="width: 100%">
                  <el-table-column
                    v-for="col in m.answer.table.columns"
                    :key="col.key"
                    :prop="col.key"
                    :label="col.label"
                    :width="col.width"
                    :min-width="col.minWidth"
                    show-overflow-tooltip
                  />
                </el-table>
                <div v-if="m.answer.table.note" class="fs12 muted" style="margin-top: 6px">{{ m.answer.table.note }}</div>
              </div>
              <div v-if="m.answer.followups && m.answer.followups.length" class="chips">
                <span class="fs12 muted">继续追问：</span>
                <el-tag v-for="fq in m.answer.followups" :key="fq" class="chip" effect="plain" @click="send(fq)">{{ fq }}</el-tag>
              </div>
            </template>
          </div>
        </div>
      </div>

      <div class="chat-input">
        <el-input
          v-model="input"
          size="large"
          placeholder="输入问题，例如：这个月开始的任务还有多少没有完成？"
          clearable
          @keyup.enter="send()"
        />
        <el-button type="primary" size="large" :disabled="!input.trim()" @click="send()">发送</el-button>
      </div>
      <div class="quick">
        <template v-if="!input.trim()">
          <span class="fs12 muted">试试：</span>
          <el-tag v-for="q in quicks" :key="q" class="chip" @click="send(q)">{{ q }}</el-tag>
        </template>
        <template v-else-if="suggestions.length">
          <span class="fs12 muted">猜你想问：</span>
          <el-tag
            v-for="s in suggestions"
            :key="s.text"
            class="chip sugg"
            effect="plain"
            @click="send(s.text)"
          >
            <span v-if="s.mid">{{ s.before }}<em>{{ s.mid }}</em>{{ s.after }}</span>
            <span v-else>{{ s.text }}</span>
          </el-tag>
        </template>
        <span v-else class="fs12 muted">没有匹配到提示，按回车直接发送即可</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import { MagicStick } from '@element-plus/icons-vue'
import { useAppStore } from '../stores/app'
import { ask, matchSuggestions, suggestQuestions } from '../utils/qa'
import VChart from '../components/VChart.vue'

const store = useAppStore()
const input = ref('')
const messages = ref([])
const bodyEl = ref(null)

const quicks = computed(() => {
  const sample = store.activeUsers.find(u => u.role === 'member')?.name
  const arr = [
    '这个月开始的任务还有多少没有完成？',
    '目前逾期未完成的任务有哪些？',
    '每个人的任务数量和完成情况',
    '近 8 周的任务填报趋势'
  ]
  if (sample) arr.push(`${sample}的任务进展如何？`)
  return arr
})

// 实时联想：根据当前数据生成词库，随输入逐字过滤
const pool = computed(() => suggestQuestions({
  users: store.activeUsers,
  sources: store.activeSources,
  tasks: store.activeTasks,
  now: new Date()
}))

const suggestions = computed(() => {
  const t = input.value.trim()
  return matchSuggestions(input.value, pool.value, 6).map(text => {
    const i = t ? text.indexOf(t) : -1
    return i >= 0
      ? { text, before: text.slice(0, i), mid: text.slice(i, i + t.length), after: text.slice(i + t.length) }
      : { text, before: text, mid: '', after: '' }
  })
})

function askStore(question) {
  return ask({
    question,
    tasks: store.tasks,
    progress: store.progress,
    users: store.users,
    sources: store.sources
  })
}

function scrollBottom() {
  nextTick(() => {
    if (bodyEl.value) bodyEl.value.scrollTop = bodyEl.value.scrollHeight
  })
}

function send(preset) {
  const text = (typeof preset === 'string' ? preset : input.value).trim()
  if (!text) return
  input.value = ''
  messages.value.push({ role: 'user', text })
  const loadingMsg = { role: 'assistant', loading: true }
  messages.value.push(loadingMsg)
  scrollBottom()
  setTimeout(() => {
    const idx = messages.value.indexOf(loadingMsg)
    if (idx >= 0) messages.value[idx] = { role: 'assistant', answer: askStore(text) }
    scrollBottom()
  }, 420)
}

function clear() {
  messages.value = []
  welcome()
}

function welcome() {
  messages.value.push({ role: 'assistant', answer: askStore('你好') })
}

onMounted(() => welcome())
</script>

<style scoped>
.head-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.chat-card {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 196px);
  min-height: 460px;
  padding: 0;
  overflow: hidden;
}
.chat-body {
  flex: 1;
  overflow-y: auto;
  padding: 18px 18px 6px;
  background: linear-gradient(180deg, #f6f8fd 0%, #ffffff 60%);
}
.msg { display: flex; gap: 10px; margin-bottom: 16px; }
.msg.user { flex-direction: row-reverse; }
.avatar {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: #fff;
  background: #2f6bff;
  flex: none;
}
.msg.assistant .avatar { background: linear-gradient(135deg, #2f6bff, #7c5cff); }
.bubble {
  max-width: 80%;
  min-width: 260px;
  background: #fff;
  border: 1px solid var(--app-border);
  border-radius: 10px;
  padding: 12px 14px;
  box-shadow: 0 2px 10px rgba(31, 56, 110, 0.05);
}
.msg.user .bubble {
  min-width: 0;
  background: #2f6bff;
  border-color: #2f6bff;
  color: #fff;
  box-shadow: none;
}
.a-title { font-weight: 600; margin-bottom: 6px; }
.a-summary { font-size: 13px; line-height: 1.75; color: var(--app-text-2); }
.a-chart { margin-top: 10px; border: 1px solid var(--app-border); border-radius: 8px; padding: 8px 4px 2px; }
.a-table { margin-top: 10px; }
.chips { margin-top: 10px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.chip { cursor: pointer; }
.chat-input { display: flex; gap: 10px; padding: 12px 16px; border-top: 1px solid var(--app-border); }
.quick { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; padding: 0 16px 14px; min-height: 40px; }
.chip.sugg { border-style: dashed; }
.chip.sugg em { font-style: normal; color: #e8871e; font-weight: 700; }
.thinking { font-size: 13px; color: var(--app-text-2); }
@media (max-width: 820px) {
  .chat-card { height: calc(100vh - 230px); }
  .bubble { max-width: 92%; }
}
</style>
