<template>
  <div class="page">
    <div class="head-row">
      <div>
        <h2 class="page-title">任务列表</h2>
        <p class="page-sub">共 {{ filtered.length }} 条任务 ｜ 点击行查看任务详情与周进度</p>
      </div>
      <div>
        <el-button @click="onExport">导出 Excel</el-button>
        <el-button type="primary" @click="openCreate">新建任务</el-button>
      </div>
    </div>

    <div class="card card-pad" style="margin-bottom: 16px">
      <div class="filter-row">
        <el-input v-model="filters.keyword" placeholder="搜索任务内容" clearable style="width: 200px" />
        <el-select v-model="filters.executorId" placeholder="执行人" clearable style="width: 118px">
          <el-option v-for="u in store.activeUsers" :key="u.id" :label="u.name" :value="u.id" />
        </el-select>
        <el-select v-model="filters.ownerId" placeholder="负责人" clearable style="width: 118px">
          <el-option v-for="u in store.activeUsers" :key="u.id" :label="u.name" :value="u.id" />
        </el-select>
        <el-select v-model="filters.source" placeholder="任务来源" clearable style="width: 160px">
          <el-option v-for="s in store.activeSources" :key="s.id" :label="s.name" :value="s.name" />
        </el-select>
        <el-select v-model="filters.priority" placeholder="优先级" clearable style="width: 104px">
          <el-option v-for="p in PRIORITIES" :key="p.value" :label="p.label" :value="p.value" />
        </el-select>
        <el-select v-model="filters.status" placeholder="状态" clearable style="width: 136px">
          <el-option v-for="s in STATUSES" :key="s.value" :label="s.label" :value="s.value" />
          <el-option label="逾期未完成" value="overdue" />
          <el-option label="未启动 · 已过期" value="expired" />
        </el-select>
        <el-date-picker v-model="filters.dateRange" type="daterange" start-placeholder="开始日期" end-placeholder="结束日期" value-format="YYYY-MM-DD" style="width: 240px" />
        <el-select v-model="sortMode" style="width: 148px">
          <el-option label="按截止时间排序" value="end" />
          <el-option label="按优先级排序" value="priority" />
          <el-option label="按最近更新排序" value="updated" />
        </el-select>
        <el-checkbox v-model="starFirst">重点 ★ 置顶</el-checkbox>
        <el-button text @click="resetFilters">重置</el-button>
      </div>
    </div>

    <div class="card">
      <el-table :data="paged" style="width: 100%" @row-click="goDetail">
        <el-table-column label="任务内容" min-width="240">
          <template #default="{ row }">
            <div class="ellipsis" style="font-weight: 500">{{ row.content }}</div>
            <div class="fs12 muted">
              {{ row.source }}
              <span v-if="attCount(row)"> · 📎 {{ attCount(row) }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="执行人" width="86">
          <template #default="{ row }">{{ store.userName(row.executorId) }}</template>
        </el-table-column>
        <el-table-column label="负责人" width="86">
          <template #default="{ row }">{{ store.userName(row.ownerId) }}</template>
        </el-table-column>
        <el-table-column label="起止时间" width="186">
          <template #default="{ row }">
            <span class="fs12">{{ row.startDate }} 至 {{ row.endDate }}</span>
          </template>
        </el-table-column>
        <el-table-column label="优先级" width="88">
          <template #default="{ row }">
            <span class="p-tag" :style="pStyle(row.priority)">
              <i class="p-dot" :style="{ background: priorityMap[row.priority]?.color }" />{{ priorityMap[row.priority]?.label }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="最新进度" width="150">
          <template #default="{ row }">
            <el-progress :percentage="percentOf(row)" :stroke-width="6" :show-text="false" />
            <span class="fs12 muted">{{ percentOf(row) }}% ｜ {{ lastWeekOf(row) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="128">
          <template #default="{ row }">
            <el-tag size="small" :type="stateType(row)" :effect="isOverdue(row) ? 'dark' : 'light'">{{ stateText(row) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="132" fixed="right">
          <template #default="{ row }">
            <el-button size="small" text type="primary" @click.stop="goDetail(row)">查看</el-button>
            <el-button v-if="store.canEditTask(row)" size="small" text type="primary" @click.stop="openEdit(row)">编辑</el-button>
            <el-button v-if="store.canDeleteTask(row)" size="small" text type="danger" @click.stop="removeTask(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pager">
        <el-pagination v-model:current-page="page" :page-size="pageSize" layout="total, prev, pager, next" :total="filtered.length" />
      </div>
    </div>

    <TaskFormDialog v-model="formVisible" :task="editingTask" />
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '../stores/app'
import {
  PRIORITIES, STATUSES, priorityMap, statusMap,
  isOverdue, isExpiredNotStarted, isNearDue, latestProgressOf, sortTasks, weekShort
} from '../utils/core'
import { exportTasksWorkbook } from '../utils/excel'
import TaskFormDialog from '../components/TaskFormDialog.vue'

const store = useAppStore()
const router = useRouter()

const filters = reactive({
  keyword: '', executorId: '', ownerId: '', source: '', priority: '', status: '', dateRange: []
})
const sortMode = ref('end')
const starFirst = ref(true)

const filtered = computed(() => {
  const f = filters
  return store.activeTasks.filter(t => {
    if (f.keyword && !t.content.includes(f.keyword.trim())) return false
    if (f.executorId && t.executorId !== f.executorId) return false
    if (f.ownerId && t.ownerId !== f.ownerId) return false
    if (f.source && t.source !== f.source) return false
    if (f.priority && t.priority !== f.priority) return false
    if (f.status === 'overdue') {
      if (!isOverdue(t)) return false
    } else if (f.status === 'expired') {
      if (!isExpiredNotStarted(t)) return false
    } else if (f.status && t.status !== f.status) return false
    if (f.dateRange && f.dateRange.length === 2) {
      const [from, to] = f.dateRange
      if (t.endDate < from || t.startDate > to) return false
    }
    return true
  })
})

const sorted = computed(() => sortTasks(filtered.value, sortMode.value, starFirst.value))

const page = ref(1)
const pageSize = 10
const paged = computed(() => sorted.value.slice((page.value - 1) * pageSize, page.value * pageSize))

watch(filters, () => { page.value = 1 }, { deep: true })
watch([sortMode, starFirst], () => { page.value = 1 })

function resetFilters() {
  Object.assign(filters, { keyword: '', executorId: '', ownerId: '', source: '', priority: '', status: '', dateRange: [] })
}

function percentOf(t) {
  return latestProgressOf(store.progress, t.id)?.percent ?? 0
}
function attCount(t) {
  return store.attachments.filter(a => a.taskId === t.id).length
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

const formVisible = ref(false)
const editingTask = ref(null)
function openCreate() {
  editingTask.value = null
  formVisible.value = true
}
function openEdit(row) {
  editingTask.value = row
  formVisible.value = true
}

function removeTask(row) {
  ElMessageBox.confirm(`确定删除任务「${row.content}」吗？删除后不再展示（软删除）。`, '删除任务', { type: 'warning' })
    .then(() => {
      store.removeTask(row.id)
      ElMessage.success('任务已删除')
    })
    .catch(() => {})
}

function onExport() {
  exportTasksWorkbook({
    tasks: sorted.value,
    progress: store.progress,
    users: store.users,
    filename: `任务列表_${new Date().toISOString().slice(0, 10)}.xlsx`
  })
  ElMessage.success('已生成 Excel 文件')
}
</script>

<style scoped>
.head-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.filter-row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.pager { display: flex; justify-content: flex-end; padding: 12px 16px; }
:deep(.el-table__row) { cursor: pointer; }
</style>
