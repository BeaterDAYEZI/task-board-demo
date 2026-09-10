<template>
  <el-container class="layout">
    <el-aside v-if="!isMobile" width="212px" class="aside">
      <div class="brand">
        <div class="logo">任</div>
        <div>
          <div class="brand-name">部门任务看板</div>
          <div class="brand-sub">演示版 · 数据存本机</div>
        </div>
      </div>
      <el-menu :default-active="activeMenu" router class="menu">
        <el-menu-item v-for="m in menuItems" :key="m.path" :index="m.path">
          <el-icon><component :is="m.icon" /></el-icon><span>{{ m.label }}</span>
        </el-menu-item>
      </el-menu>
      <div class="aside-foot">
        <div class="muted fs12">进度按周更新，历史自动留存</div>
        <div class="muted fs12">正式版将部署至服务器</div>
      </div>
    </el-aside>

    <el-container>
      <el-header class="header">
        <div class="header-left">
          <el-button v-if="isMobile" text class="menu-btn" @click="drawer = true">
            <el-icon :size="20"><Menu /></el-icon>
          </el-button>
          <span class="page-now">{{ pageTitle }}</span>
          <el-tag v-if="!isMobile" size="small" effect="plain" type="info">{{ weekText }}</el-tag>
        </div>
        <div class="header-right">
          <el-tooltip content="每周一 09:00 领导提醒（正式版通过蓝信 / 邮件推送）" placement="bottom">
            <el-badge :is-dot="store.isLeader" class="bell">
              <el-button text circle @click="onBell">
                <el-icon :size="17"><Bell /></el-icon>
              </el-button>
            </el-badge>
          </el-tooltip>
          <el-dropdown trigger="click" @command="onCmd">
            <span class="user-chip">
              <el-avatar :size="26" :style="{ background: nameColor(store.currentUser?.name) }">
                {{ store.currentUser?.name?.[0] }}
              </el-avatar>
              <span v-if="!isMobile" class="user-name">{{ store.currentUser?.name }}</span>
              <el-tag v-if="!isMobile" size="small" effect="plain">{{ roleLabel }}</el-tag>
              <el-icon class="muted"><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="switch">切换身份（演示）</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>
      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>

    <el-drawer v-model="drawer" direction="ltr" :size="238" :with-header="false" class="mobile-drawer">
      <div class="brand">
        <div class="logo">任</div>
        <div>
          <div class="brand-name">部门任务看板</div>
          <div class="brand-sub">演示版 · 数据存本机</div>
        </div>
      </div>
      <el-menu :default-active="activeMenu" router class="menu" @select="drawer = false">
        <el-menu-item v-for="m in menuItems" :key="m.path" :index="m.path">
          <el-icon><component :is="m.icon" /></el-icon><span>{{ m.label }}</span>
        </el-menu-item>
      </el-menu>
    </el-drawer>
  </el-container>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, ElNotification } from 'element-plus'
import { ArrowDown, Bell, DataBoard, HomeFilled, List, Menu, Setting, TrendCharts } from '@element-plus/icons-vue'
import { useAppStore } from '../stores/app'
import { userTitle, nameColor, weekLabel } from '../utils/core'

const store = useAppStore()
const route = useRoute()
const router = useRouter()

const isMobile = ref(window.matchMedia('(max-width: 820px)').matches)
const drawer = ref(false)

function onResize() {
  isMobile.value = window.matchMedia('(max-width: 820px)').matches
  if (!isMobile.value) drawer.value = false
}
onMounted(() => window.addEventListener('resize', onResize))
onBeforeUnmount(() => window.removeEventListener('resize', onResize))

const activeMenu = computed(() => (route.path.startsWith('/tasks') ? '/tasks' : route.path))
const pageTitle = computed(() => route.meta?.title || '部门任务看板')
const weekText = computed(() => weekLabel(new Date()))
const roleLabel = computed(() => userTitle(store.currentUser))

const menuItems = computed(() => {
  const items = [
    { path: '/workbench', label: '我的工作台', icon: HomeFilled },
    { path: '/tasks', label: '任务列表', icon: List },
    { path: '/board', label: '总览看板', icon: DataBoard },
    { path: '/report', label: '统计报表', icon: TrendCharts }
  ]
  if (store.isAdmin) items.push({ path: '/settings', label: '设置', icon: Setting })
  return items
})

function onCmd(cmd) {
  if (cmd === 'switch') {
    store.logout()
    router.replace('/login')
  }
}

function onBell() {
  if (store.isLeader) {
    ElMessageBox.confirm(
      '演示：正式版会在每周一 09:00 通过蓝信 / 邮件向领导账号推送提醒，点击提醒直接进入总览看板。现在要打开看板吗？',
      '模拟提醒 · 每周一 09:00',
      { confirmButtonText: '打开总览看板', cancelButtonText: '稍后', type: 'info' }
    ).then(() => router.push('/board')).catch(() => {})
  } else {
    ElMessage.info('提醒面向领导账号推送，请记得及时填报本周进度')
  }
}

onMounted(() => {
  // 模拟：周一首次打开时为领导弹出提醒（正式版由后端定时推送）
  if (store.isLeader && new Date().getDay() === 1 && !sessionStorage.getItem('mondayNotice')) {
    sessionStorage.setItem('mondayNotice', '1')
    ElNotification({
      title: '【模拟】每周一 09:00 提醒',
      message: '请查看本周任务总览看板，点击可直达。',
      type: 'info',
      duration: 6000,
      onClick: () => router.push('/board')
    })
  }
})
</script>

<style scoped>
.layout { height: 100vh; }
.aside { background: #fff; border-right: 1px solid var(--app-border); display: flex; flex-direction: column; }
.brand { display: flex; align-items: center; gap: 10px; padding: 18px 16px 14px; }
.logo { width: 36px; height: 36px; border-radius: 10px; background: var(--app-primary); color: #fff; font-weight: 700; display: flex; align-items: center; justify-content: center; font-size: 18px; }
.brand-name { font-weight: 700; font-size: 15px; }
.brand-sub { font-size: 12px; color: var(--app-text-2); margin-top: 2px; }
.menu { border-right: none; flex: 1; }
.aside-foot { padding: 12px 16px 16px; border-top: 1px solid var(--app-border); }
.header { background: #fff; border-bottom: 1px solid var(--app-border); display: flex; align-items: center; justify-content: space-between; height: 56px; }
.header-left { display: flex; align-items: center; gap: 10px; min-width: 0; }
.page-now { font-weight: 600; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.header-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.user-chip { display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 4px 6px; border-radius: 8px; }
.user-chip:hover { background: #f5f7fb; }
.user-name { font-weight: 600; font-size: 13px; }
.main { padding: 0; overflow: auto; background: var(--app-bg); }
.bell :deep(.el-badge__content.is-dot) { top: 8px; right: 8px; }
.menu-btn { padding: 6px; }

@media (max-width: 820px) {
  .header { height: 50px; padding: 0 8px; }
  .page-now { font-size: 14px; }
}
</style>

<style>
.mobile-drawer .el-drawer__body { padding: 0; }
.mobile-drawer .brand { display: flex; align-items: center; gap: 10px; padding: 18px 16px 14px; }
.mobile-drawer .logo { width: 36px; height: 36px; border-radius: 10px; background: #2f6bff; color: #fff; font-weight: 700; display: flex; align-items: center; justify-content: center; font-size: 18px; }
.mobile-drawer .brand-name { font-weight: 700; font-size: 15px; }
.mobile-drawer .brand-sub { font-size: 12px; color: #6b7280; margin-top: 2px; }
.mobile-drawer .menu { border-right: none; }
</style>
