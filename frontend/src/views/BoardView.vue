<template>
  <div class="page">
    <div class="head-row">
      <div>
        <h2 class="page-title">总览看板</h2>
        <p class="page-sub">{{ weekText }} ｜ 点击卡片或行可查看任务详情（关联任务内容与周进度记录）</p>
      </div>
      <div>
        <el-button @click="onExport">导出 Excel</el-button>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat-card"><div class="num">{{ store.activeTasks.length }}</div><div class="lbl">任务总数</div></div>
      <div class="stat-card"><div class="num" style="color: #2f6bff">{{ doingCount }}</div><div class="lbl">进行中</div></div>
      <div class="stat-card"><div class="num" style="color: #2bb673">{{ doneCount }}</div><div class="lbl">已完成</div></div>
      <div class="stat-card"><div class="num" :style="{ color: overdueCount ? '#d93026' : '#303133' }">{{ overdueCount }}</div><div class="lbl">逾期未完成</div></div>
      <div class="stat-card"><div class="num" :style="{ color: expiredCount ? '#8a919f' : '#303133' }">{{ expiredCount }}</div><div class="lbl">未启动 · 已过期</div></div>
      <div class="stat-card">
        <div class="num" :style="{ color: fillRate >= 100 ? '#2bb673' : '#e8871e' }">{{ fillRate }}%</div>
        <div class="lbl">本周填报率（{{ filledCount }}/{{ reportableCount }}）</div>
      </div>
    </div>

    <div class="card card-pad" style="margin-bottom: 16px">
      <div class="filter-row">
        <el-select v-model="executorId" placeholder="执行人" clearable style="width: 124px">
          <el-option v-for="u in store.activeUsers" :key="u.id" :label="u.name" :value="u.id" />
        </el-select>
        <el-select v-model="source" placeholder="任务来源" clearable style="width: 168px">
          <el-option v-for="s in store.activeSources" :key="s.id" :label="s.name" :value="s.name" />
        </el-select>
        <el-select v-model="priority" placeholder="优先级" clearable style="width: 110px">
          <el-option v-for="p in PRIORITIES" :key="p.value" :label="p.label" :value="p.value" />
        </el-select>
        <el-select v-model="state" style="width: 150px">
          <el-option label="全部状态" value="" />
          <el-option label="逾期未完成" value="overdue" />
          <el-option label="未启动 · 已过期" value="expired" />
          <el-option label="临近截止" value="near" />
          <el-option v-for="s in STATUSES" :key="s.value" :label="s.label" :value="s.value" />
        </el-select>
        <el-select v-model="sortMode" style="width: 152px">
          <el-option label="按截止时间排序" value="end" />
          <el-option label="按优先级排序" value="priority" />
          <el-option label="按最近更新排序" value="updated" />
        </el-select>
        <el-checkbox v-model="starFirst">重点 ★ 置顶</el-checkbox>
        <el-checkbox v-model="hideDone">隐藏已完成</el-checkbox>
        <span style="flex: 1" />
        <el-radio-group v-model="viewMode" size="small">
          <el-radio-button value="card">卡片视图</el-radio-button>
          <el-radio-button value="table">表格视图</el-radio-button>
          <el-radio-button value="person">按人分组</el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <div v-if="viewMode === 'card'" class="board-grid">
      <el-empty v-if="!displayed.length" description="暂无符合条件的任务" style="grid-column: 1 / -1" />
      <div
        v-for="t in displayed"
        :key="t.id"
        class="task-card"
        :class="{ 'is-overdue': isOverdue(t) }"
        :style="{ borderLeftColor: priorityMap[t.priority]?.color }"
        @click="goDetail(t)"
      >
        <div class="tc-top">
          <span class="p-tag" :style="pStyle(t.priority)">
            <i class="p-dot" :style="{ background: priorityMap[t.priority]?.color }" />{{ priorityMap[t.priority]?.label }}
          </span>
          <el-tag v-if="isOverdue(t)" size="small" type="danger" effect="dark">逾期</el-tag>
          <el-tag v-else-if="isExpiredNotStarted(t)" size="small" type="info" effect="plain">未启动 · 已过期</el-tag>
          <el-tag v-else-if="isNearDue(t)" size="small" type="warning">临期</el-tag>
          <span style="flex: 1" />
          <span class="fs12 muted">截止 {{ t.endDate }}</span>
        </div>
        <div class="tc-title">{{ t.content }}</div>
        <div class="tc-meta">
          <span>{{ t.source }}</span>
          <span>执行：{{ store.userName(t.executorId) }}</span>
          <span>负责：{{ store.userName(t.ownerId) }}</span>
        </div>
        <div class="ratio-bar">
          <i :style="{ width: percentOf(t) + '%', background: isOverdue(t) ? '#d93026' : isExpiredNotStarted(t) ? '#b9bfcb' : '#2f6bff' }" />
        </div>
        <div class="tc-bottom">
          <span class="fs12 muted">最新进度 {{ percentOf(t) }}%（{{ lastWeekOf(t) }}）</span>
          <el-tag size="small" :type="statusMap[t.status]?.type || 'info'" effect="plain">{{ statusMap[t.status]?.label }}</el-tag>
        </div>
      </div>
    </div>

    <div v-else-if="viewMode === 'table'" class="card">
      <el-table :data="displayed" style="width: 100%" @row-click="goDetail">
        <el-table-column label="任务内容" min-width="260">
          <template #default="{ row }">
            <div class="ellipsis" style="font-weight: 500">{{ row.content }}</div>
            <div class="fs12 muted">{{ row.source }}</div>
          </template>
        </el-table-column>
        <el-table-column label="执行人" width="90">
          <template #default="{ row }">{{ store.userName(row.executorId) }}</template>
        </el-table-column>
        <el-table-column label="负责人" width="90">
          <template #default="{ row }">{{ store.userName(row.ownerId) }}</template>
        </el-table-column>
        <el-table-column label="终止时间" width="112" prop="endDate" />
        <el-table-column label="优先级" width="92">
          <template #default="{ row }">
            <span class="p-tag" :style="pStyle(row.priority)">{{ priorityMap[row.priority]?.label }}</span>
          </template>
        </el-table-column>
        <el-table-column label="最新进度" width="160">
          <template #default="{ row }">
            <el-progress :percentage="percentOf(row)" :stroke-width="6" :show-text="false" />
            <span class="fs12 muted">{{ percentOf(row) }}%</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="128">
          <template #default="{ row }">
            <el-tag size="small" :type="stateType(row)" :effect="isOverdue(row) ? 'dark' : 'light'">{{ stateText(row) }}</el-tag>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div v-else class="person-groups">
      <el-empty v-if="!byPerson.length" description="暂无符合条件的任务" />
      <div v-for="g in byPerson" :key="g.user.id" class="card card-pad">
        <div class="pg-head">
          <el-avatar :size="26" :style="{ background: nameColor(g.user.name) }">{{ g.user.name[0] }}</el-avatar>
          <span class="pg-name">{{ g.user.name }}</span>
          <span class="fs12 muted">共 {{ g.tasks.length }} 项 ｜ 逾期 {{ g.overdue }} 项 ｜ 平均进度 {{ g.avg }}%</span>
        </div>
        <div class="pg-list">
          <div v-for="t in g.tasks" :key="t.id" class="pg-item" @click="goDetail(t)">
            <span class="pg-title ellipsis">{{ t.content }}</span>
            <span class="p-tag" :style="pStyle(t.priority)">{{ priorityMap[t.priority]?.label }}</span>
            <el-progress :percentage="percentOf(t)" :stroke-width="5" :show-text="false" style="width: 90px" />
            <span class="fs12 muted" style="width: 44px; text-align: right">{{ percentOf(t) }}%</span>
            <el-tag size="small" :type="stateType(t)" :effect="isOverdue(t) ? 'dark' : 'light'" style="width: 108px; justify-content: center">{{ stateText(t) }}</el-tag>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAppStore } from '../stores/app'
import {
  PRIORITIES, STATUSES, priorityMap, statusMap, nameColor,
  isOverdue, isExpiredNotStarted, isNearDue, latestProgressOf, sortTasks, weekKey, weekLabel, weekShort
} from '../utils/core'
import { exportTasksWorkbook } from '../utils/excel'

const store = useAppStore()
const router = useRouter()

const weekText = computed(() => weekLabel(new Date()))

const executorId = ref('')
const source = ref('')
const priority = ref('')
const state = ref('')
const sortMode = ref('end')
const starFirst = ref(true)
const hideDone = ref(true)
const viewMode = ref('card')

const displayed = computed(() => {
  const list = store.activeTasks.filter(t => {
    if (hideDone.value && t.status === 'done') return false
    if (executorId.value && t.executorId !== executorId.value) return false
    if (source.value && t.source !== source.value) return false
    if (priority.value && t.priority !== priority.value) return false
    if (state.value === 'overdue' && !isOverdue(t)) return false
    if (state.value === 'expired' && !isExpiredNotStarted(t)) return false
    if (state.value === 'near' && !isNearDue(t)) return false
    if (state.value && !['overdue', 'expired', 'near'].includes(state.value) && t.status !== state.value) return false
    return true
  })
  return sortTasks(list, sortMode.value, starFirst.value)
})

const doingCount = computed(() => store.activeTasks.filter(t => t.status === 'doing').length)
const doneCount = computed(() => store.activeTasks.filter(t => t.status === 'done').length)
const overdueCount = computed(() => store.activeTasks.filter(isOverdue).length)
const expiredCount = computed(() => store.activeTasks.filter(isExpiredNotStarted).length)

const reportableCount = computed(() => store.activeTasks.filter(t => t.status === 'doing' || t.status === 'paused').length)
const filledCount = computed(() => {
  const k = weekKey(new Date())
  return store.activeTasks
    .filter(t => t.status === 'doing' || t.status === 'paused')
    .filter(t => store.progress.some(p => p.taskId === t.id && p.weekKey === k)).length
})
const fillRate = computed(() => (reportableCount.value ? Math.round((filledCount.value / reportableCount.value) * 100) : 100))

const byPerson = computed(() =>
  store.activeUsers
    .map(u => {
      const tasks = displayed.value.filter(t => t.executorId === u.id)
      if (!tasks.length) return null
      const overdue = tasks.filter(isOverdue).length
      const avg = Math.round(tasks.reduce((sum, t) => sum + percentOf(t), 0) / tasks.length)
      return { user: u, tasks, overdue, avg }
    })
    .filter(Boolean)
    .sort((a, b) => b.tasks.length - a.tasks.length)
)

function percentOf(t) {
  return latestProgressOf(store.progress, t.id)?.percent ?? 0
}
function lastWeekOf(t) {
  const last = latestProgressOf(store.progress, t.id)
  return last ? weekShort(last.weekKey) : '未填报'
}
function stateText(t) {
  if (isOverdue(t)) return '已逾期'
  if (isExpiredNotStarted(t)) return '未启动 · 已过期'
  if (isNearDue(t)) return '临近截止'
  return statusMap[t.status]?.label || ''
}
function stateType(t) {
  if (isOverdue(t)) return 'danger'
  if (isExpiredNotStarted(t)) return 'info'
  if (isNearDue(t)) return 'warning'
  return statusMap[t.status]?.type || 'info'
}
function pStyle(value) {
  const c = priorityMap[value]?.color || '#8a919f'
  return { background: c + '1f', color: c, borderColor: c + '66' }
}

function goDetail(row) {
  router.push(`/tasks/${row.id}`)
}

function onExport() {
  exportTasksWorkbook({
    tasks: displayed.value,
    progress: store.progress,
    users: store.users,
    filename: `看板任务_${new Date().toISOString().slice(0, 10)}.xlsx`
  })
  ElMessage.success('已生成 Excel 文件')
}
</script>

<style scoped>
.head-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.filter-row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.tc-top { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.tc-bottom { display: flex; align-items: center; justify-content: space-between; margin-top: 8px; }
:deep(.el-table__row) { cursor: pointer; }
.person-groups { display: flex; flex-direction: column; gap: 14px; }
.pg-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.pg-name { font-weight: 600; }
.pg-list { display: flex; flex-direction: column; }
.pg-item { display: flex; align-items: center; gap: 12px; padding: 8px 2px; border-bottom: 1px dashed var(--app-border); cursor: pointer; }
.pg-item:last-child { border-bottom: none; }
.pg-item:hover { background: #f8faff; }
.pg-title { flex: 1; min-width: 0; font-size: 13px; }
</style>
