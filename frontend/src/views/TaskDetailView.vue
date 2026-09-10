<template>
  <div v-if="task" class="page">
    <div class="head-row">
      <div class="dh-left">
        <div class="crumb">
          <el-button text size="small" @click="router.back()">← 返回</el-button>
        </div>
        <h2 class="page-title">{{ task.content }}</h2>
        <div class="tag-row">
          <span class="p-tag" :style="pStyle(task.priority)">
            <i class="p-dot" :style="{ background: priorityMap[task.priority]?.color }" />优先级：{{ priorityMap[task.priority]?.label }}
          </span>
          <el-tag size="small" :type="statusMap[task.status]?.type || 'info'" effect="plain">{{ statusMap[task.status]?.label }}</el-tag>
          <el-tag v-if="isOverdue(task)" size="small" type="danger" effect="dark">已逾期</el-tag>
          <el-tag v-else-if="isExpiredNotStarted(task)" size="small" type="info">未启动 · 已过期</el-tag>
          <el-tag v-else-if="isNearDue(task)" size="small" type="warning">临近截止</el-tag>
        </div>
      </div>
      <div class="dh-right">
        <el-button v-if="store.canFillProgress(task) && task.status !== 'done'" type="primary" @click="openFill">{{ currentRecord ? '更新本周进度' : '填报本周进度' }}</el-button>
        <el-button v-if="store.canEditTask(task)" @click="editVisible = true">编辑任务</el-button>
        <el-button v-if="store.canDeleteTask(task)" type="danger" plain @click="removeTask">删除</el-button>
      </div>
    </div>

    <div class="grid2">
      <div class="card card-pad">
        <div class="sec-head"><span class="sec-title">任务信息</span></div>
        <el-descriptions :column="2" border>
          <el-descriptions-item label="任务来源">{{ task.source }}</el-descriptions-item>
          <el-descriptions-item label="优先级">{{ priorityMap[task.priority]?.label }}</el-descriptions-item>
          <el-descriptions-item label="执行人">{{ store.userName(task.executorId) }}</el-descriptions-item>
          <el-descriptions-item label="负责人">{{ store.userName(task.ownerId) }}</el-descriptions-item>
          <el-descriptions-item label="起始时间">{{ task.startDate }}</el-descriptions-item>
          <el-descriptions-item label="终止时间">{{ task.endDate }}</el-descriptions-item>
          <el-descriptions-item label="创建人">{{ store.userName(task.createdBy) }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ dateText(task.createdAt) }}</el-descriptions-item>
        </el-descriptions>

        <div style="margin-top: 16px">
          <div class="sec-title" style="margin-bottom: 8px">进度趋势（按周）</div>
          <VChart v-if="trendOption" :option="trendOption" :height="210" />
          <el-empty v-else description="暂无周进度记录" :image-size="60" />
        </div>
      </div>

      <div class="card card-pad">
        <div class="sec-head">
          <span class="sec-title">周进度记录（{{ records.length }}）</span>
          <span class="muted fs12">历史周记录不可修改，如需更正请联系管理员</span>
        </div>
        <el-empty v-if="!records.length" description="还没有进度记录，请先填报本周进度" :image-size="60" />
        <el-timeline v-else>
          <el-timeline-item
            v-for="r in records"
            :key="r.id"
            :timestamp="`${r.weekLabel || r.weekKey} · ${store.userName(r.reporterId)} · ${dateText(r.updatedAt)}`"
            placement="top"
            :color="r.percent >= 100 ? '#2bb673' : '#2f6bff'"
          >
            <div class="rec-head">
              <el-progress :percentage="r.percent" :stroke-width="8" style="width: 170px" />
              <el-tag size="small" :type="statusMap[r.status]?.type || 'info'" effect="plain">{{ statusMap[r.status]?.label }}</el-tag>
              <span style="flex: 1" />
              <el-button v-if="store.canEditRecord(r)" size="small" text type="primary" @click="openEdit(r)">编辑</el-button>
              <el-button v-if="store.canDeleteRecord()" size="small" text type="danger" @click="removeRecord(r)">删除</el-button>
            </div>
            <div class="timeline-note">{{ r.note }}</div>
            <div v-if="r.risk" class="timeline-block"><span class="timeline-lbl">问题与风险：</span><span class="warn-text">{{ r.risk }}</span></div>
            <div v-if="r.nextPlan" class="timeline-block"><span class="timeline-lbl">下周计划：</span>{{ r.nextPlan }}</div>
          </el-timeline-item>
        </el-timeline>
      </div>
    </div>

    <div class="grid2" style="margin-top: 16px">
      <div class="card card-pad">
        <div class="sec-head"><span class="sec-title">评论与协作记录（{{ taskComments.length }}）</span></div>
        <div class="cmt-list">
          <el-empty v-if="!taskComments.length" description="暂无评论" :image-size="50" />
          <div v-for="c in taskComments" :key="c.id" class="cmt-item">
            <el-avatar :size="30" :style="{ background: nameColor(store.userName(c.userId)) }">{{ store.userName(c.userId)[0] }}</el-avatar>
            <div class="cmt-body">
              <div class="cmt-top">
                <span class="cmt-name">{{ store.userName(c.userId) }}</span>
                <span class="muted fs12">{{ timeAgo(c.createdAt) }}</span>
              </div>
              <div class="cmt-text">{{ c.content }}</div>
            </div>
          </div>
        </div>
        <div style="margin-top: 10px">
          <el-input v-model="commentText" type="textarea" :rows="2" maxlength="300" placeholder="添加评论或协作记录…" />
          <div style="text-align: right; margin-top: 8px">
            <el-button type="primary" size="small" @click="sendComment">发送</el-button>
          </div>
        </div>
      </div>

      <div class="card card-pad">
        <div class="sec-head">
          <span class="sec-title">附件（{{ taskAttachments.length }}）</span>
          <el-button size="small" type="primary" plain @click="pickFile">上传附件</el-button>
          <input ref="fileInput" type="file" style="display: none" @change="onFile" />
        </div>
        <el-empty v-if="!taskAttachments.length" description="暂无附件（演示版单个文件限 1MB）" :image-size="50" />
        <div v-for="a in taskAttachments" :key="a.id" class="att-item">
          <div class="att-main">
            <el-icon :size="18" class="muted"><Document /></el-icon>
            <div style="min-width: 0">
              <div class="att-name ellipsis">{{ a.name }}</div>
              <div class="fs12 muted">{{ formatSize(a.size) }} · {{ store.userName(a.uploaderId) }} · {{ timeAgo(a.createdAt) }}</div>
            </div>
          </div>
          <div>
            <el-button size="small" text type="primary" @click="downloadAtt(a)">下载</el-button>
            <el-button v-if="a.uploaderId === store.currentUser?.id || store.isAdmin" size="small" text type="danger" @click="removeAtt(a)">删除</el-button>
          </div>
        </div>
      </div>
    </div>

    <ProgressDialog v-model="fillVisible" :task="task" :record="editingRecord" />
    <TaskFormDialog v-model="editVisible" :task="task" />
  </div>

  <div v-else class="page">
    <el-empty description="任务不存在或已删除">
      <el-button type="primary" @click="router.push('/tasks')">返回任务列表</el-button>
    </el-empty>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Document } from '@element-plus/icons-vue'
import { useAppStore } from '../stores/app'
import { priorityMap, statusMap, isOverdue, isExpiredNotStarted, isNearDue, weekShort, nameColor, timeAgo } from '../utils/core'
import VChart from '../components/VChart.vue'
import ProgressDialog from '../components/ProgressDialog.vue'
import TaskFormDialog from '../components/TaskFormDialog.vue'

const route = useRoute()
const router = useRouter()
const store = useAppStore()

const taskId = computed(() => route.params.id)
const task = computed(() => store.tasks.find(t => t.id === taskId.value && !t.deleted) || null)

const records = computed(() =>
  store.progress
    .filter(p => p.taskId === taskId.value)
    .sort((a, b) => (a.weekKey < b.weekKey ? 1 : -1))
)
const ascRecords = computed(() => [...records.value].reverse())

const trendOption = computed(() => {
  if (!ascRecords.value.length) return null
  return {
    grid: { left: 46, right: 18, top: 26, bottom: 30 },
    tooltip: { trigger: 'axis', valueFormatter: (v) => v + '%' },
    xAxis: { type: 'category', data: ascRecords.value.map(r => weekShort(r.weekKey)) },
    yAxis: { type: 'value', min: 0, max: 100, axisLabel: { formatter: '{value}%' } },
    series: [{
      name: '进度',
      type: 'line',
      smooth: true,
      symbolSize: 7,
      data: ascRecords.value.map(r => r.percent),
      itemStyle: { color: '#2f6bff' },
      lineStyle: { width: 2.5 },
      areaStyle: { opacity: 0.1 }
    }]
  }
})

const currentRecord = computed(() => store.currentWeekRecord(taskId.value))

const fillVisible = ref(false)
const editingRecord = ref(null)
function openFill() {
  editingRecord.value = currentRecord.value
  fillVisible.value = true
}
function openEdit(r) {
  editingRecord.value = r
  fillVisible.value = true
}
function removeRecord(r) {
  ElMessageBox.confirm(`确定删除 ${r.weekKey}（${r.percent}%）的进度记录吗？此操作仅管理员可执行。`, '删除历史记录', { type: 'warning' })
    .then(() => {
      store.deleteProgress(r.id)
      ElMessage.success('记录已删除')
    })
    .catch(() => {})
}

const taskComments = computed(() =>
  store.comments
    .filter(c => c.taskId === taskId.value)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
)
const commentText = ref('')
function sendComment() {
  const text = commentText.value.trim()
  if (!text) {
    ElMessage.warning('请输入评论内容')
    return
  }
  store.addComment(taskId.value, text)
  commentText.value = ''
}

const taskAttachments = computed(() => store.attachments.filter(a => a.taskId === taskId.value))
const fileInput = ref(null)
function pickFile() {
  fileInput.value?.click()
}
function onFile(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  if (file.size > 1024 * 1024) {
    ElMessage.warning('演示版单个附件限 1MB 以内（正式版将存储到服务器）')
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    store.addAttachment(taskId.value, { name: file.name, size: file.size, type: file.type, dataUrl: reader.result })
    ElMessage.success('附件已上传（演示版保存在浏览器本地）')
  }
  reader.readAsDataURL(file)
}
function downloadAtt(a) {
  const link = document.createElement('a')
  link.href = a.dataUrl
  link.download = a.name
  document.body.appendChild(link)
  link.click()
  link.remove()
}
function removeAtt(a) {
  ElMessageBox.confirm(`确定删除附件「${a.name}」吗？`, '删除附件', { type: 'warning' })
    .then(() => {
      store.removeAttachment(a.id)
      ElMessage.success('附件已删除')
    })
    .catch(() => {})
}

function removeTask() {
  ElMessageBox.confirm(`确定删除任务「${task.value.content}」吗？删除后不再展示（软删除）。`, '删除任务', { type: 'warning' })
    .then(() => {
      store.removeTask(task.value.id)
      ElMessage.success('任务已删除')
      router.push('/tasks')
    })
    .catch(() => {})
}

const editVisible = ref(false)

function pStyle(value) {
  const c = priorityMap[value]?.color || '#8a919f'
  return { background: c + '1f', color: c, borderColor: c + '66' }
}
function dateText(iso) {
  return iso ? iso.slice(0, 16).replace('T', ' ') : ''
}
function formatSize(n) {
  if (!n && n !== 0) return ''
  return n > 1024 * 1024 ? (n / 1048576).toFixed(2) + ' MB' : (n / 1024).toFixed(1) + ' KB'
}
</script>

<style scoped>
.head-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.crumb { margin-bottom: 2px; }
.dh-left { min-width: 0; }
.dh-right { display: flex; gap: 8px; flex-shrink: 0; }
.tag-row { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
.rec-head { display: flex; align-items: center; gap: 10px; }
.cmt-list { display: flex; flex-direction: column; gap: 12px; max-height: 300px; overflow: auto; }
.cmt-item { display: flex; gap: 10px; }
.cmt-body { flex: 1; min-width: 0; }
.cmt-top { display: flex; align-items: center; gap: 8px; }
.cmt-name { font-weight: 600; font-size: 13px; }
.cmt-text { font-size: 13px; margin-top: 3px; line-height: 1.6; white-space: pre-wrap; }
.att-item { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 9px 2px; border-bottom: 1px dashed var(--app-border); }
.att-item:last-child { border-bottom: none; }
.att-main { display: flex; align-items: center; gap: 10px; min-width: 0; }
.att-name { font-size: 13px; font-weight: 500; max-width: 320px; }
</style>
