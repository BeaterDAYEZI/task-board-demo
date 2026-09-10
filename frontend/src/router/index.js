import { createRouter, createWebHashHistory } from 'vue-router'
import { useAppStore } from '../stores/app'

const routes = [
  { path: '/login', component: () => import('../views/LoginView.vue') },
  {
    path: '/',
    component: () => import('../layouts/MainLayout.vue'),
    redirect: '/workbench',
    children: [
      { path: 'workbench', component: () => import('../views/WorkbenchView.vue'), meta: { title: '我的工作台' } },
      { path: 'tasks', component: () => import('../views/TaskListView.vue'), meta: { title: '任务列表' } },
      { path: 'tasks/:id', component: () => import('../views/TaskDetailView.vue'), meta: { title: '任务详情' } },
      { path: 'board', component: () => import('../views/BoardView.vue'), meta: { title: '总览看板' } },
      { path: 'report', component: () => import('../views/ReportView.vue'), meta: { title: '统计报表' } },
      { path: 'settings', component: () => import('../views/SettingsView.vue'), meta: { title: '设置', admin: true } }
    ]
  },
  { path: '/:pathMatch(.*)*', redirect: '/workbench' }
]

const router = createRouter({
  // 使用 hash 模式，部署到 GitHub Pages 无需额外配置
  history: createWebHashHistory(),
  routes
})

router.beforeEach((to) => {
  const store = useAppStore()
  store.init()
  if (to.path === '/login') return true
  if (!store.currentUser) return '/login'
  if (to.meta.admin && !store.isAdmin) return '/workbench'
  return true
})

export default router
