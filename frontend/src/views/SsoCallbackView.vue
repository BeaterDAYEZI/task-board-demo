<template>
  <div class="login-wrap">
    <div class="login-card sso-card">
      <div class="sso-inner">
        <template v-if="state === 'loading'">
          <el-icon class="sso-icon spin" :size="30"><Loading /></el-icon>
          <h1>正在完成公司统一账号登录…</h1>
          <p class="muted fs12">正在校验授权信息并匹配系统账号，请稍候</p>
        </template>

        <template v-else-if="state === 'success'">
          <el-icon class="sso-icon" :size="30" style="color: #2bb673"><CircleCheckFilled /></el-icon>
          <h1>登录成功，正在进入系统…</h1>
        </template>

        <template v-else>
          <el-icon class="sso-icon" :size="30" style="color: #d93026"><CircleCloseFilled /></el-icon>
          <h1>单点登录未完成</h1>
          <p class="muted fs12" style="max-width: 420px; line-height: 1.8">{{ message }}</p>
          <div class="sso-actions">
            <el-button type="primary" @click="router.replace('/login')">返回登录页</el-button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { CircleCheckFilled, CircleCloseFilled, Loading } from '@element-plus/icons-vue'
import { useAppStore } from '../stores/app'
import { checkSsoState, exchangeSsoCode, mapSsoUser } from '../utils/sso'

const route = useRoute()
const router = useRouter()
const store = useAppStore()

const state = ref('loading')
const message = ref('')

function q(name) {
  // 兼容两种回调形式：#/sso-callback?code=…（hash 内）与 /?code=…#/sso-callback（hash 前）
  const fromHash = route.query[name]
  const fromSearch = new URLSearchParams(window.location.search).get(name)
  return String(fromHash ?? fromSearch ?? '')
}

onMounted(async () => {
  const code = q('code')
  const st = q('state')
  if (!code) {
    state.value = 'error'
    message.value = '未收到授权码（code）。请从登录页点击「公司统一账号单点登录」发起，或联系管理员检查回调地址配置。'
    return
  }
  if (!checkSsoState(st)) {
    state.value = 'error'
    message.value = 'state 校验失败（可能是过期或跨站的授权请求），为安全起见已中止本次登录，请重新发起。'
    return
  }
  try {
    let user = null
    if (code.startsWith('mock:')) {
      const uid = code.slice(5)
      user = store.users.find(u => u.id === uid && u.active) || null
    } else {
      const info = await exchangeSsoCode(code)
      user = mapSsoUser(info, store.users)
    }
    if (!user) {
      state.value = 'error'
      message.value = '未找到与E办账号匹配的系统用户。请确认已在「设置 → 人员管理」中维护该账号（账号字段与E办一致），或联系管理员绑定。'
      return
    }
    store.login(user.id)
    state.value = 'success'
    ElMessage.success(`欢迎，${user.name}`)
    setTimeout(() => {
      router.replace(user.role === 'leader' ? '/board' : '/workbench')
    }, 600)
  } catch (e) {
    state.value = 'error'
    message.value = `换取用户信息失败：${e.message || e}（请检查「设置 → 单点登录」中的用户信息接口，或联系管理员）`
  }
})
</script>

<style scoped>
.login-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(160deg, #eef3ff 0%, #f7f9fc 40%, #eaf6f0 100%); padding: 24px; }
.login-card { width: 560px; max-width: 96vw; background: #fff; border-radius: 14px; border: 1px solid var(--app-border); box-shadow: 0 18px 50px rgba(30, 60, 130, 0.1); padding: 34px 28px; }
.sso-inner { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; }
.sso-icon { margin-bottom: 4px; color: var(--app-primary); }
h1 { font-size: 18px; margin: 0; }
.sso-actions { margin-top: 14px; }
.spin { animation: spin 1.2s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
</style>
