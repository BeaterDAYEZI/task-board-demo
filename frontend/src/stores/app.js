import { defineStore } from 'pinia'
import { uid, weekKey } from '../utils/core'
import { buildSeed } from '../utils/seed'

// v2：切换为《部门重点工作任务清单》导入数据
const LS_KEY = 'yxny-task-board-v2'

function readStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export const useAppStore = defineStore('app', {
  state: () => ({
    inited: false,
    currentUserId: null,
    users: [],
    tasks: [],
    progress: [],
    comments: [],
    attachments: [],
    sources: []
  }),

  getters: {
    currentUser: (s) => s.users.find(u => u.id === s.currentUserId) || null,
    isAdmin: (s) => s.users.find(u => u.id === s.currentUserId)?.role === 'admin',
    isLeader: (s) => s.users.find(u => u.id === s.currentUserId)?.role === 'leader',
    activeUsers: (s) => s.users.filter(u => u.active),
    activeSources: (s) => s.sources.filter(x => x.active),
    activeTasks: (s) => s.tasks.filter(t => !t.deleted)
  },

  actions: {
    init() {
      if (this.inited) return
      const saved = readStorage()
      const data = saved && Array.isArray(saved.users) ? saved : buildSeed()
      this.users = data.users || []
      this.tasks = data.tasks || []
      this.progress = data.progress || []
      this.comments = data.comments || []
      this.attachments = data.attachments || []
      this.sources = data.sources || []
      this.currentUserId = saved ? (saved.currentUserId || null) : null
      this.inited = true
      if (!saved) this.persist()
    },

    persist() {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify({
          currentUserId: this.currentUserId,
          users: this.users,
          tasks: this.tasks,
          progress: this.progress,
          comments: this.comments,
          attachments: this.attachments,
          sources: this.sources
        }))
      } catch (e) {
        console.warn('本地存储写入失败（可能超出容量限制）', e)
      }
    },

    userName(id) {
      return this.users.find(u => u.id === id)?.name || '—'
    },

    login(id) {
      this.currentUserId = id
      this.persist()
    },

    logout() {
      this.currentUserId = null
      this.persist()
    },

    // ---------- 任务 ----------
    createTask(data) {
      const now = new Date().toISOString()
      const task = {
        id: uid(), ...data,
        createdBy: this.currentUserId, createdAt: now, updatedAt: now, deleted: false
      }
      this.tasks.push(task)
      this.ensureSource(data.source)
      this.persist()
      return task
    },

    updateTask(id, patch) {
      const t = this.tasks.find(x => x.id === id)
      if (!t) return
      Object.assign(t, patch, { updatedAt: new Date().toISOString() })
      if (patch.source) this.ensureSource(patch.source)
      this.persist()
    },

    removeTask(id) {
      const t = this.tasks.find(x => x.id === id)
      if (!t) return
      t.deleted = true
      t.updatedAt = new Date().toISOString()
      this.persist()
    },

    // ---------- 周进度 ----------
    saveProgress({ taskId, recordId, weekKeyValue, weekLabelValue, percent, status, note, risk, nextPlan }) {
      const now = new Date().toISOString()
      if (recordId) {
        const r = this.progress.find(p => p.id === recordId)
        if (r) Object.assign(r, { percent, status, note, risk, nextPlan, updatedAt: now })
      } else {
        this.progress.push({
          id: uid(), taskId,
          weekKey: weekKeyValue, weekLabel: weekLabelValue,
          percent, status, note, risk, nextPlan,
          reporterId: this.currentUserId, createdAt: now, updatedAt: now
        })
      }
      if (status === 'done') {
        const t = this.tasks.find(x => x.id === taskId)
        if (t) {
          t.status = 'done'
          t.updatedAt = now
        }
      }
      this.persist()
    },

    deleteProgress(recordId) {
      this.progress = this.progress.filter(p => p.id !== recordId)
      this.persist()
    },

    currentWeekRecord(taskId) {
      const k = weekKey(new Date())
      return this.progress.find(p => p.taskId === taskId && p.weekKey === k) || null
    },

    // ---------- 评论 / 附件 ----------
    addComment(taskId, content) {
      this.comments.push({
        id: uid(), taskId, userId: this.currentUserId,
        content, createdAt: new Date().toISOString()
      })
      this.persist()
    },

    addAttachment(taskId, file) {
      this.attachments.push({
        id: uid(), taskId, ...file,
        uploaderId: this.currentUserId, createdAt: new Date().toISOString()
      })
      this.persist()
    },

    removeAttachment(id) {
      this.attachments = this.attachments.filter(a => a.id !== id)
      this.persist()
    },

    // ---------- 任务来源字典 ----------
    ensureSource(name) {
      if (!name) return
      if (!this.sources.find(s => s.name === name)) {
        this.sources.push({ id: uid(), name, builtin: false, active: true })
        this.persist()
      }
    },

    addSource(name) {
      if (!name || this.sources.find(s => s.name === name)) return false
      this.sources.push({ id: uid(), name, builtin: false, active: true })
      this.persist()
      return true
    },

    updateSource(id, patch) {
      const s = this.sources.find(x => x.id === id)
      if (s) {
        Object.assign(s, patch)
        this.persist()
      }
    },

    // ---------- 人员 ----------
    saveUser(user) {
      if (user.id) {
        const u = this.users.find(x => x.id === user.id)
        if (u) Object.assign(u, user)
      } else {
        this.users.push({ ...user, id: uid() })
      }
      this.persist()
    },

    // ---------- 数据管理（演示版） ----------
    exportJSON() {
      return JSON.stringify({
        exportedAt: new Date().toISOString(),
        users: this.users,
        tasks: this.tasks,
        progress: this.progress,
        comments: this.comments,
        attachments: this.attachments,
        sources: this.sources
      }, null, 2)
    },

    importJSON(text) {
      const data = JSON.parse(text)
      if (!data || !Array.isArray(data.users) || !Array.isArray(data.tasks)) {
        throw new Error('数据格式不正确')
      }
      this.users = data.users
      this.tasks = data.tasks
      this.progress = data.progress || []
      this.comments = data.comments || []
      this.attachments = data.attachments || []
      this.sources = data.sources || []
      this.currentUserId = null
      this.persist()
    },

    resetDemo() {
      const seed = buildSeed()
      this.users = seed.users
      this.tasks = seed.tasks
      this.progress = seed.progress
      this.comments = seed.comments
      this.attachments = seed.attachments
      this.sources = seed.sources
      this.currentUserId = null
      this.persist()
    },

    // ---------- Excel 导入（合并：同名任务更新，新任务添加） ----------
    importTasks(items) {
      const STATUS_IMPORT = { 未开展: 'not_started', 未开始: 'not_started', 进行中: 'doing', 已完成: 'done', 已暂停: 'paused', 暂停: 'paused' }
      const result = { added: 0, updated: 0, records: 0, unmatchedNames: [] }
      const now = new Date().toISOString()
      const findUser = (n) => this.users.find(u => u.name === n) || null
      const splitNames = (s) => String(s || '').split(/[,，、;；/|\s]+/).filter(Boolean)
      const defaultId = () => (this.users.find(u => u.role === 'leader' && u.active) || this.users[0] || {}).id || 'u1'

      items.forEach(item => {
        const names = splitNames(item.executorName)
        const execs = names.map(n => findUser(n)).filter(Boolean)
        const coExecs = execs.slice(1)
        names.filter(n => n && !findUser(n)).forEach(n => {
          if (!result.unmatchedNames.includes(n)) result.unmatchedNames.push(n)
        })
        const ownerUser = findUser(item.ownerName)
        if (item.ownerName && !ownerUser && !result.unmatchedNames.includes(item.ownerName)) {
          result.unmatchedNames.push(item.ownerName)
        }

        let status = STATUS_IMPORT[item.statusRaw] || ''
        if (!status) status = item.weekly.length ? 'doing' : 'not_started'
        if (status === 'not_started' && item.weekly.length) status = 'doing'

        const executorId = execs[0] ? execs[0].id : ownerUser ? ownerUser.id : defaultId()
        const ownerId = ownerUser ? ownerUser.id : execs[0] ? execs[0].id : defaultId()

        const existing = this.tasks.find(t => !t.deleted && t.content === item.content)
        let taskId
        if (existing) {
          existing.source = item.source || existing.source
          existing.executorId = executorId
          existing.ownerId = ownerId
          if (item.startDate) existing.startDate = item.startDate
          if (item.endDate) existing.endDate = item.endDate
          if (item.priority === 'high') existing.priority = 'high'
          if (status === 'done') existing.status = 'done'
          else if (existing.status !== 'done') existing.status = status
          existing.updatedAt = now
          taskId = existing.id
          result.updated++
        } else {
          taskId = uid()
          this.tasks.push({
            id: taskId,
            content: item.content,
            source: item.source || '其他',
            executorId,
            ownerId,
            startDate: item.startDate,
            endDate: item.endDate,
            priority: item.priority || 'medium',
            status,
            createdBy: this.currentUserId,
            createdAt: now,
            updatedAt: now,
            deleted: false
          })
          result.added++
        }
        this.ensureSource(item.source)

        const existingRecords = this.progress.filter(p => p.taskId === taskId)
        const existingWeeks = new Set(existingRecords.map(p => p.weekKey))
        const newNotes = item.weekly.filter(w => !existingWeeks.has(w.weekKey))
        if (newNotes.length) {
          const total = existingRecords.length + newNotes.length
          const cap = status === 'done' ? 100 : status === 'doing' ? 80 : status === 'paused' ? 40 : 30
          let idx = existingRecords.length
          newNotes.forEach(w => {
            idx++
            const percent = Math.max(5, Math.round((idx / total) * cap))
            this.progress.push({
              id: uid(),
              taskId,
              weekKey: w.weekKey,
              weekLabel: w.label,
              percent,
              status: status === 'done' && idx === total ? 'done' : status === 'not_started' ? 'doing' : status,
              note: w.text,
              risk: '',
              nextPlan: '',
              reporterId: executorId,
              createdAt: w.createdAt || now,
              updatedAt: w.createdAt || now
            })
            result.records++
          })
        }

        if (coExecs.length) {
          const text = '协同执行：' + coExecs.map(u => u.name).join('、')
          const has = this.comments.some(c => c.taskId === taskId && c.content === text)
          if (!has) this.comments.push({ id: uid(), taskId, userId: ownerId, content: text, createdAt: now })
        }
      })

      this.persist()
      return result
    },

    // ---------- 权限判断 ----------
    canEditTask(t) {
      const u = this.currentUser
      if (!u || !t) return false
      if (u.role === 'admin' || u.role === 'leader') return true
      return t.createdBy === u.id || t.executorId === u.id || t.ownerId === u.id
    },

    canDeleteTask(t) {
      const u = this.currentUser
      if (!u || !t) return false
      return u.role === 'admin' || t.createdBy === u.id
    },

    canFillProgress(t) {
      const u = this.currentUser
      if (!u || !t) return false
      return u.role === 'admin' || t.executorId === u.id || t.ownerId === u.id
    },

    /** 非管理员：仅能修改本人填报的本周记录；历史记录修改需联系管理员 */
    canEditRecord(r) {
      const u = this.currentUser
      if (!u || !r) return false
      if (u.role === 'admin') return true
      return r.reporterId === u.id && r.weekKey === weekKey(new Date())
    },

    canDeleteRecord() {
      return this.isAdmin
    }
  }
})
