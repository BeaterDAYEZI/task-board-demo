<template>
  <div class="page">
    <div class="head-row">
      <div>
        <h2 class="page-title">文件传阅</h2>
        <p class="page-sub">领导下发文件并指定阅读人；阅读完成后可标记「已读」，未读人员可一键提醒</p>
      </div>
      <div>
        <el-button v-if="canIssue" type="primary" @click="openCreate">下发文件</el-button>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat-card">
        <div class="num" :style="{ color: store.myUnreadDocs.length ? '#e8871e' : '#303133' }">{{ store.myUnreadDocs.length }}</div>
        <div class="lbl">待我阅读</div>
      </div>
      <div class="stat-card"><div class="num">{{ myIssued.length }}</div><div class="lbl">我下发的</div></div>
      <div class="stat-card"><div class="num">{{ readRate }}%</div><div class="lbl">已读率（我下发）</div></div>
    </div>

    <div class="card card-pad" style="margin-bottom: 16px">
      <div class="filter-row">
        <el-radio-group v-model="scope" size="small">
          <el-radio-button value="mine">待我阅读</el-radio-button>
          <el-radio-button value="all">全部文件</el-radio-button>
          <el-radio-button v-if="canIssue" value="issued">我下发的</el-radio-button>
        </el-radio-group>
        <span style="flex: 1" />
        <el-input v-model="keyword" placeholder="搜索标题" clearable style="width: 180px" />
      </div>
    </div>

    <el-empty v-if="!list.length" description="暂无文件" />
    <div v-else class="doc-list">
      <div v-for="d in list" :key="d.id" class="card card-pad doc-item" :class="{ 'is-unread': isTarget(d) && !myRead(d) }">
        <div class="doc-head">
          <div class="doc-title">
            <el-icon><Document /></el-icon>
            <span style="font-weight: 600">{{ d.title }}</span>
            <el-tag v-if="isTarget(d) && myRead(d)" size="small" type="success" effect="plain">已读</el-tag>
            <el-tag v-else-if="isTarget(d)" size="small" type="danger" effect="plain">待阅读</el-tag>
          </div>
          <div class="fs12 muted">
            下发：{{ store.userName(d.issuerId) }} · {{ (d.createdAt || '').slice(0, 10) }}
            <span v-if="d.dueDate"> · 要求 {{ d.dueDate }} 前阅完</span>
          </div>
        </div>

        <div v-if="d.note" class="doc-note">{{ d.note }}</div>

        <div class="doc-file">
          <el-icon class="muted"><Paperclip /></el-icon>
          <span class="ellipsis" style="max-width: 420px">{{ d.fileName }}</span>
          <span class="fs12 muted">{{ formatSize(d.fileSize) }}</span>
          <el-button size="small" text type="primary" @click="downloadDoc(d)">下载</el-button>
          <el-button v-if="isTarget(d) && !myRead(d)" size="small" type="primary" plain @click="markRead(d)">标记已读</el-button>
          <span v-if="myRead(d)" class="fs12 muted">你已于 {{ (myRead(d).at || '').slice(0, 16).replace('T', ' ') }} 阅读</span>
        </div>

        <div v-if="canManage(d)" class="doc-reads">
          <span class="fs12 muted">阅读情况：{{ readCount(d) }}/{{ (d.targetIds || []).length }} 已读</span>
          <el-tag v-for="u in unreadUsers(d)" :key="u.id" size="small" type="warning" effect="plain">{{ u.name }} 未读</el-tag>
          <el-button v-if="unreadUsers(d).length" size="small" text type="danger" @click="remind(d)">提醒未读人员</el-button>
        </div>
      </div>
    </div>

    <el-dialog v-model="createVisible" title="下发文件" width="560px" destroy-on-close>
      <el-form :model="form" label-width="88px">
        <el-form-item label="文件标题" required>
          <el-input v-model="form.title" maxlength="60" placeholder="例如：关于……的通知" />
        </el-form-item>
        <el-form-item label="事由说明">
          <el-input v-model="form.note" type="textarea" :rows="2" maxlength="200" placeholder="说明需要阅读人落实的工作（可留空）" />
        </el-form-item>
        <el-form-item label="指定阅读人" required>
          <el-select v-model="form.targetIds" multiple filterable style="width: 100%" placeholder="选择需要阅读文件的人员">
            <el-option
              v-for="u in store.activeUsers"
              :key="u.id"
              :label="`${u.name}（${u.title || ROLE_LABEL[u.role]}）`"
              :value="u.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="阅读时限">
          <el-date-picker v-model="form.dueDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="文件" required>
          <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap">
            <el-button size="small" @click="pickFile">选择文件</el-button>
            <span v-if="form.fileName" class="fs12">{{ form.fileName }}（{{ formatSize(form.fileSize) }}）</span>
            <span v-else class="fs12 muted">演示版单个文件限 1MB（正式版存储到服务器）</span>
            <input ref="fileInput" type="file" style="display: none" @change="onFile" />
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" @click="submit">下发</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Document, Paperclip } from '@element-plus/icons-vue'
import { useAppStore } from '../stores/app'
import { ROLE_LABEL } from '../utils/core'

const store = useAppStore()
const keyword = ref('')
const scope = ref('mine')

const canIssue = computed(() => ['leader', 'admin'].includes(store.currentUser?.role))

const isTarget = (d) => (d.targetIds || []).includes(store.currentUser?.id)
const myRead = (d) => (d.readBy || []).find(r => r.userId === store.currentUser?.id) || null
const canManage = (d) => store.isAdmin || store.isLeader || d.issuerId === store.currentUser?.id

const myIssued = computed(() => store.documents.filter(d => d.issuerId === store.currentUser?.id))
const readRate = computed(() => {
  const docs = myIssued.value
  if (!docs.length) return 100
  let total = 0
  let read = 0
  docs.forEach(d => {
    total += (d.targetIds || []).length
    read += (d.readBy || []).length
  })
  return total ? Math.round((read / total) * 100) : 100
})

const list = computed(() => {
  let arr = store.documents
  if (scope.value === 'mine') arr = arr.filter(isTarget)
  else if (scope.value === 'issued') arr = arr.filter(d => d.issuerId === store.currentUser?.id)
  if (keyword.value.trim()) arr = arr.filter(d => d.title.includes(keyword.value.trim()))
  return [...arr].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
})

function readCount(d) {
  return (d.readBy || []).length
}
function unreadUsers(d) {
  return (d.targetIds || [])
    .filter(id => !(d.readBy || []).some(r => r.userId === id))
    .map(id => store.users.find(u => u.id === id))
    .filter(Boolean)
}
function formatSize(n) {
  if (!n && n !== 0) return ''
  return n > 1024 * 1024 ? (n / 1048576).toFixed(2) + ' MB' : (n / 1024).toFixed(1) + ' KB'
}
function downloadDoc(d) {
  const link = document.createElement('a')
  link.href = d.dataUrl
  link.download = d.fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
}
function markRead(d) {
  store.markDocRead(d.id)
  ElMessage.success('已标记为已读')
}
function remind(d) {
  const names = unreadUsers(d).map(u => u.name).join('、')
  ElMessage.success(`已提醒：${names}（演示提示，正式版将通过蓝信 / 邮件推送）`)
}

// ---------- 下发文件 ----------
const createVisible = ref(false)
const fileInput = ref(null)
const form = reactive({ title: '', note: '', targetIds: [], dueDate: '', fileName: '', fileSize: 0, fileType: '', dataUrl: '' })

function openCreate() {
  Object.assign(form, { title: '', note: '', targetIds: [], dueDate: '', fileName: '', fileSize: 0, fileType: '', dataUrl: '' })
  createVisible.value = true
}
function pickFile() {
  fileInput.value?.click()
}
function onFile(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  if (file.size > 1024 * 1024) {
    ElMessage.warning('演示版单个文件限 1MB 以内（正式版将存储到服务器）')
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    form.fileName = file.name
    form.fileSize = file.size
    form.fileType = file.type
    form.dataUrl = reader.result
    ElMessage.success('文件已选择')
  }
  reader.readAsDataURL(file)
}
function submit() {
  if (!form.title.trim()) {
    ElMessage.warning('请填写文件标题')
    return
  }
  if (!form.targetIds.length) {
    ElMessage.warning('请选择阅读人')
    return
  }
  if (!form.dataUrl) {
    ElMessage.warning('请选择要下发的文件')
    return
  }
  store.addDocument({ ...form, title: form.title.trim(), note: form.note.trim() })
  createVisible.value = false
  ElMessage.success(`文件已下发（指定 ${form.targetIds.length} 人阅读）`)
}
</script>

<style scoped>
.head-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.filter-row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.doc-list { display: flex; flex-direction: column; gap: 12px; }
.doc-item.is-unread { border-color: #f0c36d; background: linear-gradient(0deg, #fffdf5, #fffdf5); }
.doc-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.doc-title { display: flex; align-items: center; gap: 8px; font-size: 15px; }
.doc-note { margin-top: 8px; font-size: 13px; color: var(--app-text-2); line-height: 1.6; }
.doc-file { margin-top: 10px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.doc-reads { margin-top: 10px; padding-top: 8px; border-top: 1px dashed var(--app-border); display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
</style>
