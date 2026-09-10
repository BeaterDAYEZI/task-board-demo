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
        <template #title>演示版：点选身份即可进入；正式版将使用账号登录并接入公司统一账号单点登录</template>
      </el-alert>

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
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import { ROLE_LABEL, nameColor } from '../utils/core'

const store = useAppStore()
const router = useRouter()

function enter(u) {
  store.login(u.id)
  router.replace(u.role === 'leader' ? '/board' : '/workbench')
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
</style>
