<template>
  <div class="login-wrap">
    <div class="login-card">
      <div class="login-head">
        <div class="logo">任</div>
        <div>
          <h1>部门工作任务看板</h1>
          <p class="muted">任务填报 · 周进度更新 · 领导总览看板</p>
        </div>
      </div>

      <el-alert type="info" :closable="false" show-icon>
        <template #title>演示版：点选身份即可进入；也可体验「公司统一账号单点登录」流程（当前为演示模式）</template>
      </el-alert>

      <div class="sso-row">
        <el-button type="primary" size="large" @click="onSso">
          <el-icon style="margin-right: 6px"><OfficeBuilding /></el-icon>公司统一账号单点登录
        </el-button>
        <el-tag size="small" effect="plain" :type="ssoReady ? 'success' : 'info'">
          {{ ssoReady ? '已配置 · 跳转E办授权页' : '演示模式 · 模拟授权流程' }}
        </el-tag>
      </div>
      <el-divider><span class="fs12 muted">或选择演示身份（点选即进入）</span></el-divider>

      <div class="user-grid">
        <div v-for="u in store.activeUsers" :key="u.id" class="user-tile" @click="enter(u)">
          <el-avatar :size="40" :style="{ background: nameColor(u.name) }">{{ u.name[0] }}</el-avatar>
          <div class="ut-info">
            <div class="ut-name">{{ u.name }}</div>
            <div class="fs12 muted">{{ u.account ? '@' + u.account : '' }}</div>
          </div>
          <el-tag size="small" effect="plain" :type="u.role === 'leader' ? 'warning' : u.role === 'admin' ? 'danger' : 'info'">
            {{ u.title || ROLE_LABEL[u.role] }}
          </el-tag>
        </div>
      </div>

      <div class="login-foot fs12 muted">
        领导账号登录后默认进入「总览看板」；演示数据保存在浏览器本地，可在「设置 → 数据管理」中重置
      </div>

      <el-dialog v-model="ssoDemo" title="公司统一账号单点登录（演示模式）" width="480px">
        <p class="fs12 muted" style="line-height: 1.8; margin-bottom: 12px">
          正式环境将自动跳转到公司统一账号授权页：在E办完成身份认证后免密回到本系统（OAuth2 授权码模式）。
          当前未配置 E办 接入参数（可在「设置 → 单点登录」中配置），这里模拟一次「授权回调」，请选择要模拟登录的E办身份：
        </p>
        <el-select v-model="mockUid" style="width: 100%" placeholder="选择身份">
          <el-option
            v-for="u in store.activeUsers"
            :key="u.id"
            :label="`${u.name}（${u.title || ROLE_LABEL[u.role]}${u.account ? ' · ' + u.account : ''}）`"
            :value="u.id"
          />
        </el-select>
        <template #footer>
          <el-button @click="ssoDemo = false">取消</el-button>
          <el-button type="primary" @click="simulateSso">模拟授权并登录</el-button>
        </template>
      </el-dialog>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { OfficeBuilding } from '@element-plus/icons-vue'
import { useAppStore } from '../stores/app'
import { ROLE_LABEL, nameColor } from '../utils/core'
import { beginSsoLogin, isSsoConfigured } from '../utils/sso'

const store = useAppStore()
const router = useRouter()

const ssoReady = isSsoConfigured()
const ssoDemo = ref(false)
const mockUid = ref('')

function enter(u) {
  store.login(u.id)
  router.replace(u.role === 'leader' ? '/board' : '/workbench')
}

function onSso() {
  if (ssoReady) {
    beginSsoLogin()
    return
  }
  mockUid.value = store.activeUsers[0]?.id || ''
  ssoDemo.value = true
}

function simulateSso() {
  if (!mockUid.value) return
  ssoDemo.value = false
  router.push(`/sso-callback?code=mock:${mockUid.value}`)
}
</script>

<style scoped>
.login-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(160deg, #eef3ff 0%, #f7f9fc 40%, #eaf6f0 100%); padding: 24px; }
.login-card { width: 720px; max-width: 96vw; background: #fff; border-radius: 14px; border: 1px solid var(--app-border); box-shadow: 0 18px 50px rgba(30, 60, 130, 0.1); padding: 26px 28px; }
.login-head { display: flex; align-items: center; gap: 14px; margin-bottom: 16px; }
.logo { width: 46px; height: 46px; border-radius: 12px; background: var(--app-primary); color: #fff; font-weight: 700; display: flex; align-items: center; justify-content: center; font-size: 22px; }
h1 { font-size: 20px; margin: 0; }
.login-head p { margin: 4px 0 0; font-size: 13px; }
.user-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 10px; margin: 18px 0; }
.user-tile { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid var(--app-border); border-radius: 10px; cursor: pointer; transition: all 0.15s; }
.user-tile:hover { border-color: var(--app-primary); box-shadow: 0 6px 16px rgba(47, 107, 255, 0.12); transform: translateY(-1px); }
.ut-info { flex: 1; min-width: 0; }
.ut-name { font-weight: 600; font-size: 14px; }
.login-foot { margin-top: 6px; line-height: 1.6; }
.sso-row { display: flex; align-items: center; gap: 10px; margin-top: 16px; }
:deep(.el-divider__text) { background: #fff; }
</style>
