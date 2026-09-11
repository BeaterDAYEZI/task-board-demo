// 公司统一账号（SSO）接入适配层（演示版）
// ---------------------------------------------------------------
// 演示模式：未配置 authUrl / clientId 时，登录页模拟「授权回调」完成登录
// 真实模式：配置好参数后，登录页跳转 E办 授权页（OAuth2 授权码模式），回调页用 code 换用户信息
// 安全说明：clientSecret 等敏感信息不能放前端；正式版由后端完成 code→token→用户信息 的交换，
//           前端只负责跳转与携带会话（见 docs/SSO接入说明.md）
const LS_KEY = 'yxny-sso-config'
const env = import.meta.env || {}

/** 生成默认回调地址（hash 路由，兼容 GitHub Pages / 任意部署路径） */
export function defaultRedirect() {
  const { origin, pathname } = window.location
  return `${origin}${pathname}#/sso-callback`
}

/** 读取配置：本机浏览器配置 > 构建环境变量 > 默认值 */
export function loadSsoConfig() {
  let local = {}
  try {
    local = JSON.parse(localStorage.getItem(LS_KEY) || '{}')
  } catch {
    local = {}
  }
  return {
    authUrl: local.authUrl ?? env.VITE_SSO_AUTH_URL ?? '',
    clientId: local.clientId ?? env.VITE_SSO_CLIENT_ID ?? '',
    userInfoUrl: local.userInfoUrl ?? env.VITE_SSO_USERINFO_URL ?? '',
    redirectUri: local.redirectUri ?? env.VITE_SSO_REDIRECT_URI ?? defaultRedirect(),
    scope: local.scope ?? env.VITE_SSO_SCOPE ?? '',
    accountField: local.accountField ?? env.VITE_SSO_ACCOUNT_FIELD ?? 'account'
  }
}

export function saveSsoConfig(patch) {
  const merged = { ...loadSsoConfig(), ...patch }
  localStorage.setItem(LS_KEY, JSON.stringify(merged))
  return merged
}

export function clearSsoConfig() {
  localStorage.removeItem(LS_KEY)
}

/** 是否已具备真实跳转条件（缺少授权地址或应用 ID 时走演示模式） */
export function isSsoConfigured(cfg = loadSsoConfig()) {
  return !!(cfg.authUrl && cfg.clientId)
}

/** 跳转到 E办 授权页（OAuth2 授权码模式），state 存 sessionStorage 用于回调校验 */
export function beginSsoLogin(cfg = loadSsoConfig()) {
  if (!isSsoConfigured(cfg)) return false
  const state = Math.random().toString(36).slice(2) + Date.now().toString(36)
  sessionStorage.setItem('yxny-sso-state', state)
  const url = new URL(cfg.authUrl)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', cfg.clientId)
  url.searchParams.set('redirect_uri', cfg.redirectUri)
  url.searchParams.set('state', state)
  if (cfg.scope) url.searchParams.set('scope', cfg.scope)
  window.location.href = url.toString()
  return true
}

/** 回调 state 校验（演示模式的 mock 回调无 state，放行） */
export function checkSsoState(state) {
  const saved = sessionStorage.getItem('yxny-sso-state')
  sessionStorage.removeItem('yxny-sso-state')
  if (!saved && !state) return true
  return !!saved && saved === state
}

/** 用 code 换取用户信息：真实模式走后端接口（如 /api/sso/userinfo?code=xxx） */
export async function exchangeSsoCode(code, cfg = loadSsoConfig()) {
  if (!cfg.userInfoUrl || !code || code.startsWith('mock:')) return null
  const sep = cfg.userInfoUrl.includes('?') ? '&' : '?'
  const res = await fetch(`${cfg.userInfoUrl}${sep}code=${encodeURIComponent(code)}`, { credentials: 'include' })
  if (!res.ok) throw new Error(`用户信息接口返回 ${res.status}`)
  return res.json()
}

/** 将 E办 用户信息映射到系统内用户：优先账号（account / 工号），其次姓名 */
export function mapSsoUser(info, users, cfg = loadSsoConfig()) {
  if (!info) return null
  const raw = info[cfg.accountField] ?? info.account ?? info.loginName ?? info.employeeNo ?? info.jobNumber ?? ''
  const account = String(raw || '').toLowerCase()
  const name = String(info.name || info.userName || info.displayName || '')
  if (account) {
    const hit = users.find(u => u.active && (String(u.account || '').toLowerCase() === account || String(u.id) === account))
    if (hit) return hit
  }
  if (name) {
    const hit = users.find(u => u.active && u.name === name)
    if (hit) return hit
  }
  return null
}
