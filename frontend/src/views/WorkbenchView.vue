<template>
  <div class="page">
    <h2 class="page-title">你好，{{ store.currentUser?.name }}</h2>
    <p class="page-sub">当前 {{ weekText }} ｜ 任务进度按周更新，填报后自动形成历史趋势</p>

    <div class="stat-grid">
      <div class="stat-card"><div class="num">{{ myTasks.length }}</div><div class="lbl">我的任务</div></div>
      <div class="stat-card"><div class="num" style="color: #2f6bff">{{ doingCount }}</div><div class="lbl">进行中</div></div>
      <div class="stat-card"><div class="num" style="color: #2bb673">{{ doneCount }}</div><div class="lbl">已完成</div></div>
      <div class="stat-card"><div class="num" :style="{ color: overdueCount ? '#d93026' : '#303133' }">{{ overdueCount }}</div><div class="lbl">已逾期</div></div>
      <div class="stat-card"><div class="num" :style="{ color: pending.length ? '#e8871e' : '#303133' }">{{ pending.length }}</div><div class="lbl">本周待填报</div></div>
    </div>

    <div v-if="store.myUnreadDocs.length" class="card card-pad" style="margin-bottom: 16px; border-color: #f0c36d">
      <div class="sec-head">
        <span class="sec-title">📄 待阅读文件（{{ store.myUnreadDocs.length }}）</span>
        <el-button text type="primary" size="small" @click="router.push('/files')">全部文件 →</el-button>
      </div>
      <div v-for="d in store.myUnreadDocs" :key="d.id" class="pending-item">
        <div class="pi-main">
          <div class="pi-title" @click="router.push('/files')">{{ d.title }}</div>
          <div class="muted fs12">
            下发：{{ store.userName(d.issuerId) }} · {{ (d.createdAt || '').slice(0, 10) }}
            <span v-if="d.dueDate"> · 要求 {{ d.dueDate }} 前阅完</span>
          </div>
        </div>
        <el-button size="small" type="warning" plain @click="router.push('/files')">去阅读</el-button>
      </div>
    </div>

    <div class="grid2">
      <div class="card card-pad">
        <div class="sec-head">
          <span class="sec-title">本周待填报</span>
          <el-tag v-if="!pending.length" type="success" size="small" effect="plain">本周已全部填报</el-tag>
          <span v-else class="muted fs12">共 {{ pending.length }} 项待更新</span>
        </div>
        <el-empty v-if="!pending.length" description="本周没有待填报的任务" :image-size="70" />
        <div v-else class="pending-list">
          <div v-for="t in pending" :key="t.id" class="pending-item">
            <div class="pi-main">
              <div class="pi-title" @click="goTask(t)">{{ t.content }}</div>
              <div class="muted fs12">
                {{ t.source }} · 执行人 {{ store.userName(t.executorId) }} · 截止 {{ t.endDate }}
                <span v-if="isNearDue(t)" class="warn-text">（临近截止）</span>
                <span v-if="isOverdue(t)" class="overdue-text">（已逾期）</span>
              </div>
            </div>
            <el-button size="small" type="primary" plain @click="openFill(t)">填报本周进度</el-button>
          </div>
        </div>
      </div>

      <div class="card card-pad">
        <div class="sec-head">
          <span class="sec-title">我的任务</span>
          <el-button text type="primary" size="small" @click="router.push('/tasks')">全部任务 →</el-button>
        </div>
        <el-table :data="myTasks" size="small" height="330" style="cursor: pointer" @row-click="goTask">
          <el-table-column label="任务内容" min-width="170">
            <template #default="{ row }">
              <span class="ellipsis" style="display: block">{{ row.content }}</span>
            </template>
          </el-table-column>
          <el-table-column label="进度" width="120">
            <template #default="{ row }">
              <el-progress :percentage="percentOf(row)" :stroke-width="6" :show-text="false" />
              <span class="fs12 muted">{{ percentOf(row) }}%</span>
            </template>
          </el-table-column>
          <el-table-column label="截止" width="104" prop="endDate" />
        </el-table>
      </div>
    </div>

    <ProgressDialog v-model="fillVisible" :task="fillTask" />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import { isNearDue, isOverdue, latestProgressOf, todayStr, weekKey, weekLabel } from '../utils/core'
import ProgressDialog from '../components/ProgressDialog.vue'

const store = useAppStore()
const router = useRouter()

const weekText = computed(() => weekLabel(new Date()))
const myTasks = computed(() =>
  store.activeTasks.filter(t => t.executorId === store.currentUser?.id || t.ownerId === store.currentUser?.id)
)
const doingCount = computed(() => myTasks.value.filter(t => t.status !== 'done').length)
const doneCount = computed(() => myTasks.value.filter(t => t.status === 'done').length)
const overdueCount = computed(() => myTasks.value.filter(isOverdue).length)

const pending = computed(() => {
  const k = weekKey(new Date())
  return myTasks.value
    .filter(t => (t.status === 'doing' || t.status === 'paused') && t.startDate <= todayStr())
    .filter(t => !store.progress.find(p => p.taskId === t.id && p.weekKey === k))
})

const fillVisible = ref(false)
const fillTask = ref(null)

function percentOf(t) {
  return latestProgressOf(store.progress, t.id)?.percent ?? 0
}
function goTask(t) {
  router.push(`/tasks/${t.id}`)
}
function openFill(t) {
  fillTask.value = t
  fillVisible.value = true
}
</script>

<style scoped>
.pending-item { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 2px; border-bottom: 1px dashed var(--app-border); }
.pending-item:last-child { border-bottom: none; }
.pi-main { min-width: 0; }
.pi-title { font-weight: 600; font-size: 13px; cursor: pointer; }
.pi-title:hover { color: var(--app-primary); }
</style>
