// 通用工具：周次计算、枚举元数据、业务判断

export function pad(n) { return String(n).padStart(2, '0') }

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function fmtDate(input) {
  const d = input instanceof Date ? input : new Date(input)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function todayStr() { return fmtDate(new Date()) }

/** 周一为一周起点 */
export function startOfWeek(input) {
  const d = input instanceof Date ? new Date(input) : new Date(input)
  const day = (d.getDay() + 6) % 7
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - day)
  return d
}

export function endOfWeek(input) {
  const s = startOfWeek(input)
  const e = new Date(s)
  e.setDate(s.getDate() + 6)
  return e
}

export function isoWeek(input) {
  const d = input instanceof Date ? new Date(input) : new Date(input)
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((t - yearStart) / 86400000 + 1) / 7)
  return { year: t.getUTCFullYear(), week }
}

export function weekKey(input) {
  const { year, week } = isoWeek(input)
  return `${year}-W${pad(week)}`
}

export function weekLabel(input) {
  const { year, week } = isoWeek(input)
  const s = startOfWeek(input)
  const e = endOfWeek(input)
  return `${year}年第${week}周（${s.getMonth() + 1}/${s.getDate()}–${e.getMonth() + 1}/${e.getDate()}）`
}

export function weekShort(key) {
  const m = /W(\d+)$/.exec(key || '')
  return m ? 'W' + Number(m[1]) : (key || '')
}

export function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000)
}

export function timeAgo(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d} 天前`
  return fmtDate(iso)
}

// ---------- 枚举元数据 ----------

export const PRIORITIES = [
  { value: 'urgent', label: '紧急', color: '#d93026' },
  { value: 'high', label: '高', color: '#ff8f1f' },
  { value: 'medium', label: '中', color: '#e8b339' },
  { value: 'low', label: '低', color: '#2bb673' }
]
export const priorityMap = Object.fromEntries(PRIORITIES.map(p => [p.value, p]))

export const STATUSES = [
  { value: 'not_started', label: '未开始', color: '#8a919f', type: 'info' },
  { value: 'doing', label: '进行中', color: '#2f6bff', type: 'primary' },
  { value: 'done', label: '已完成', color: '#2bb673', type: 'success' },
  { value: 'paused', label: '已暂停', color: '#f0a020', type: 'warning' }
]
export const statusMap = Object.fromEntries(STATUSES.map(s => [s.value, s]))

export const ROLE_LABEL = { member: '成员', leader: '领导', admin: '管理员' }

/** 显示职务（如 主任 / 副主任 / 管理员），无职务时回退角色名 */
export function userTitle(u) {
  if (!u) return ''
  return u.title || ROLE_LABEL[u.role] || ''
}

// ---------- 业务判断 ----------

/** 逾期：已启动（进行中 / 已暂停）但超过终止时间未完成 */
export function isOverdue(task) {
  return !!task && task.status !== 'done' && task.status !== 'not_started' && !!task.endDate && task.endDate < todayStr()
}

/** 已过期但还未启动 */
export function isExpiredNotStarted(task) {
  return !!task && task.status === 'not_started' && !!task.endDate && task.endDate < todayStr()
}

export function isNearDue(task, days = 3) {
  if (!task || task.status === 'done' || !task.endDate) return false
  const t = todayStr()
  const diff = daysBetween(t, task.endDate)
  return task.endDate >= t && diff <= days
}

/** 取某任务最新一条周进度记录 */
export function latestProgressOf(progressList, taskId) {
  const arr = progressList
    .filter(p => p.taskId === taskId)
    .sort((a, b) => (a.weekKey < b.weekKey ? -1 : a.weekKey > b.weekKey ? 1 : 0))
  return arr.length ? arr[arr.length - 1] : null
}

export function taskStateText(task) {
  if (isOverdue(task)) return '已逾期'
  if (isExpiredNotStarted(task)) return '未启动 · 已过期'
  if (isNearDue(task)) return '临近截止'
  return statusMap[task.status]?.label || ''
}

export const PRIORITY_RANK = { urgent: 0, high: 1, medium: 2, low: 3 }

/** 通用排序：mode = end(按截止时间) | priority(按优先级) | updated(按最近更新)；starFirst = 重点★置顶 */
export function sortTasks(list, mode = 'end', starFirst = true) {
  const arr = [...list]
  const starRank = (t) => (starFirst && String(t.content || '').includes('★') ? 0 : 1)
  arr.sort((a, b) => {
    if (starRank(a) !== starRank(b)) return starRank(a) - starRank(b)
    if (mode === 'priority') {
      const d = (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9)
      if (d) return d
      return a.endDate < b.endDate ? -1 : a.endDate > b.endDate ? 1 : 0
    }
    if (mode === 'updated') {
      const x = a.updatedAt || ''
      const y = b.updatedAt || ''
      return x < y ? 1 : x > y ? -1 : 0
    }
    return a.endDate < b.endDate ? -1 : a.endDate > b.endDate ? 1 : 0
  })
  return arr
}

export function nameColor(name) {
  const palette = ['#2f6bff', '#7a5af8', '#0aa2c0', '#2bb673', '#e8871e', '#e05252', '#8a6d3b', '#4b6cb7']
  let h = 0
  for (const ch of String(name || '用户')) h = (h * 31 + ch.charCodeAt(0)) % 997
  return palette[h % palette.length]
}
