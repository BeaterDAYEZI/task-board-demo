<template>
  <div class="page">
    <h2 class="page-title">设置</h2>
    <p class="page-sub">管理员功能：人员管理、任务来源字典、Excel 导入、数据备份</p>

    <div class="card" style="padding: 6px 16px 16px">
      <el-tabs v-model="tab">
        <el-tab-pane label="人员管理" name="users">
          <div style="margin-bottom: 10px">
            <el-button type="primary" size="small" @click="openUser()">新增人员</el-button>
          </div>
          <el-table :data="store.users" size="small">
            <el-table-column prop="name" label="姓名" width="110" />
            <el-table-column prop="account" label="账号" width="140" />
            <el-table-column prop="dept" label="部门" width="140" />
            <el-table-column label="职务 / 角色" width="110">
              <template #default="{ row }">
                <el-tag size="small" effect="plain">{{ row.title || ROLE_LABEL[row.role] }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="90">
              <template #default="{ row }">
                <el-tag size="small" :type="row.active ? 'success' : 'info'" effect="plain">{{ row.active ? '启用' : '停用' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作">
              <template #default="{ row }">
                <el-button size="small" text type="primary" @click="openUser(row)">编辑</el-button>
                <el-button size="small" text :type="row.active ? 'danger' : 'success'" @click="toggleUser(row)">
                  {{ row.active ? '停用' : '启用' }}
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="任务来源" name="sources">
          <div style="margin-bottom: 10px; display: flex; gap: 8px; max-width: 480px">
            <el-input v-model="newSource" placeholder="新增任务来源名称（成员填报时也可直接新增）" @keyup.enter="addSource" />
            <el-button type="primary" @click="addSource">添加</el-button>
          </div>
          <el-table :data="store.sources" size="small">
            <el-table-column prop="name" label="名称" min-width="220" />
            <el-table-column label="类型" width="100">
              <template #default="{ row }">
                <el-tag size="small" effect="plain" :type="row.builtin ? 'info' : 'success'">{{ row.builtin ? '固定' : '自定义' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="90">
              <template #default="{ row }">
                <el-tag size="small" :type="row.active ? 'success' : 'info'" effect="plain">{{ row.active ? '启用' : '停用' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="200">
              <template #default="{ row }">
                <el-button size="small" text type="primary" @click="renameSource(row)">改名</el-button>
                <el-button size="small" text :type="row.active ? 'danger' : 'success'" @click="store.updateSource(row.id, { active: !row.active })">
                  {{ row.active ? '停用' : '启用' }}
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="数据管理" name="data">
          <div class="sec-title" style="margin-bottom: 8px">Excel 导入任务清单</div>
          <el-alert type="info" :closable="false" show-icon style="margin-bottom: 12px; max-width: 860px">
            <template #title>
              支持《部门重点工作任务清单》格式：需包含「任务事项、任务来源、执行人、责任人、开始时间、完成时限、进展状态」列，以及「X月第X周」进展列。
              同名任务自动更新，新任务自动添加，已有周记录不会重复导入。
            </template>
          </el-alert>
          <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 12px">
            <el-button type="primary" @click="pickExcel">选择 Excel 文件导入</el-button>
            <input ref="excelInput" type="file" accept=".xlsx,.xls" style="display: none" @change="onExcel" />
          </div>
          <el-descriptions v-if="importResult" :column="2" border size="small" style="max-width: 640px; margin-bottom: 12px">
            <el-descriptions-item label="新增任务">{{ importResult.added }}</el-descriptions-item>
            <el-descriptions-item label="更新任务">{{ importResult.updated }}</el-descriptions-item>
            <el-descriptions-item label="新增周进展">{{ importResult.records }}</el-descriptions-item>
            <el-descriptions-item label="未匹配人员">
              {{ importResult.unmatchedNames.length ? importResult.unmatchedNames.join('、') : '无' }}
            </el-descriptions-item>
          </el-descriptions>
          <el-alert
            v-if="importResult && importResult.unmatchedNames.length"
            type="warning"
            :closable="false"
            show-icon
            style="margin-bottom: 12px; max-width: 860px"
            title="部分人员未在系统中找到，相关任务已默认归到负责人 / 主任名下；可先在「人员管理」中添加人员后重新导入。"
          />

          <el-divider />

          <div class="sec-title" style="margin-bottom: 8px">数据备份（JSON）</div>
          <el-alert
            type="warning"
            :closable="false"
            show-icon
            title="演示版数据保存在浏览器本地。导入会覆盖本机数据，建议先导出备份。"
            style="margin-bottom: 14px; max-width: 860px"
          />
          <div style="display: flex; gap: 10px; flex-wrap: wrap">
            <el-button @click="exportJSON">导出 JSON 备份</el-button>
            <el-button @click="pickImport">导入 JSON</el-button>
            <input ref="importInput" type="file" accept=".json,application/json" style="display: none" @change="onImport" />
            <el-button type="danger" plain @click="reset">重置演示数据</el-button>
          </div>
        </el-tab-pane>

        <el-tab-pane label="单点登录" name="sso">
          <el-alert type="info" :closable="false" show-icon style="margin-bottom: 14px; max-width: 860px">
            <template #title>
              公司统一账号单点登录（OAuth2 授权码模式）：配置好后，登录页「公司统一账号单点登录」按钮将跳转 E办 授权页，认证完成免密回到本系统。
              演示版参数保存在本机浏览器；正式版请由后端保管密钥并完成「code → 用户信息」交换（详见 docs/SSO接入说明.md）。
            </template>
          </el-alert>
          <el-form :model="ssoForm" label-width="140px" style="max-width: 660px">
            <el-form-item label="授权地址 authUrl">
              <el-input v-model="ssoForm.authUrl" placeholder="https://sso.example.com/oauth2/authorize" />
            </el-form-item>
            <el-form-item label="应用 ID clientId">
              <el-input v-model="ssoForm.clientId" placeholder="由 E办 开放平台分配" />
            </el-form-item>
            <el-form-item label="用户信息接口">
              <el-input v-model="ssoForm.userInfoUrl" placeholder="后端接口，如 /api/sso/userinfo（用 code 换取用户信息）" />
            </el-form-item>
            <el-form-item label="回调地址">
              <el-input v-model="ssoForm.redirectUri" />
            </el-form-item>
            <el-form-item label="账号字段名">
              <el-input v-model="ssoForm.accountField" placeholder="用户信息接口返回的账号字段（默认 account）" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="saveSso">保存配置</el-button>
              <el-button @click="resetSso">清除本地配置</el-button>
              <el-button :disabled="!ssoConfigured" @click="testSso">测试跳转</el-button>
            </el-form-item>
          </el-form>
          <div class="fs12 muted">
            当前状态：{{ ssoConfigured ? '已配置（登录页将跳转真实授权页）' : '演示模式（登录页模拟授权回调）' }}
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <el-dialog v-model="userVisible" :title="userForm.id ? '编辑人员' : '新增人员'" width="460px">
      <el-form :model="userForm" label-width="70px">
        <el-form-item label="姓名"><el-input v-model="userForm.name" /></el-form-item>
        <el-form-item label="职务"><el-input v-model="userForm.title" placeholder="如：主任 / 副主任 / 管理员（可留空）" /></el-form-item>
        <el-form-item label="账号"><el-input v-model="userForm.account" /></el-form-item>
        <el-form-item label="部门"><el-input v-model="userForm.dept" /></el-form-item>
        <el-form-item label="角色">
          <el-select v-model="userForm.role" style="width: 100%">
            <el-option label="成员" value="member" />
            <el-option label="领导" value="leader" />
            <el-option label="管理员" value="admin" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="userForm.active" active-text="启用" inactive-text="停用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="userVisible = false">取消</el-button>
        <el-button type="primary" @click="saveUser">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '../stores/app'
import { ROLE_LABEL } from '../utils/core'
import { parseTaskWorkbook } from '../utils/importer'
import { beginSsoLogin, clearSsoConfig, isSsoConfigured, loadSsoConfig, saveSsoConfig } from '../utils/sso'

const store = useAppStore()
const router = useRouter()
const tab = ref('users')

// ---------- 人员 ----------
const userVisible = ref(false)
const userForm = ref({ id: '', name: '', title: '', account: '', dept: '生产技术部', role: 'member', active: true })

function openUser(row) {
  userForm.value = row
    ? { ...row }
    : { id: '', name: '', title: '', account: '', dept: '生产技术部', role: 'member', active: true }
  userVisible.value = true
}

function saveUser() {
  if (!userForm.value.name.trim()) {
    ElMessage.warning('请填写姓名')
    return
  }
  store.saveUser({ ...userForm.value })
  userVisible.value = false
  ElMessage.success('已保存')
}

function toggleUser(row) {
  store.saveUser({ id: row.id, active: !row.active })
}

// ---------- 任务来源 ----------
const newSource = ref('')
function addSource() {
  const name = newSource.value.trim()
  if (!name) return
  if (!store.addSource(name)) {
    ElMessage.warning('该来源已存在')
    return
  }
  newSource.value = ''
  ElMessage.success('已添加')
}

function renameSource(row) {
  ElMessageBox.prompt('请输入新的来源名称', '修改来源', {
    inputValue: row.name,
    inputValidator: (v) => (v && v.trim() ? true : '名称不能为空')
  })
    .then(({ value }) => {
      store.updateSource(row.id, { name: value.trim() })
      ElMessage.success('已修改')
    })
    .catch(() => {})
}

// ---------- Excel 导入 ----------
const excelInput = ref(null)
const importResult = ref(null)

function pickExcel() {
  excelInput.value?.click()
}

function onExcel(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const { sheetName, items } = parseTaskWorkbook(reader.result)
      if (!items.length) {
        ElMessage.warning(`工作表「${sheetName}」中没有可导入的任务行`)
        return
      }
      const result = store.importTasks(items)
      importResult.value = result
      ElMessage.success(`导入完成：新增 ${result.added}，更新 ${result.updated}，新增周进展 ${result.records}`)
    } catch (err) {
      ElMessage.error('导入失败：' + err.message)
    }
  }
  reader.readAsArrayBuffer(file)
}

// ---------- JSON 备份 ----------
const importInput = ref(null)

function exportJSON() {
  const blob = new Blob([store.exportJSON()], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `任务看板备份_${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function pickImport() {
  importInput.value?.click()
}

function onImport(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      store.importJSON(reader.result)
      ElMessage.success('导入成功，请重新登录')
      router.replace('/login')
    } catch (err) {
      ElMessage.error('导入失败：' + err.message)
    }
  }
  reader.readAsText(file)
}

function reset() {
  ElMessageBox.confirm('确定重置为演示数据吗？将清除本机所有演示修改。', '重置演示数据', { type: 'warning' })
    .then(() => {
      store.resetDemo()
      ElMessage.success('已重置')
      router.replace('/login')
    })
    .catch(() => {})
}

// ---------- 单点登录（公司统一账号） ----------
const ssoForm = ref(loadSsoConfig())
const ssoConfigured = computed(() => isSsoConfigured(ssoForm.value))

function saveSso() {
  saveSsoConfig({ ...ssoForm.value })
  ssoForm.value = loadSsoConfig()
  ElMessage.success('已保存（仅本机浏览器生效）')
}

function resetSso() {
  clearSsoConfig()
  ssoForm.value = loadSsoConfig()
  ElMessage.success('已清除本地配置')
}

function testSso() {
  if (!beginSsoLogin(ssoForm.value)) ElMessage.warning('请先填写授权地址与应用 ID')
}
</script>
