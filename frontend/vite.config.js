import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 数据源切换：
// - 默认使用脱敏演示数据 seed-data.demo.json（适合 GitHub 公开演示）
// - 本地使用真实数据时，在 frontend/.env.local 中设置 VITE_SEED=real（该文件不提交）
function seedDataPlugin(env) {
  const which = env.VITE_SEED === 'real' ? 'real' : 'demo'
  const virtualId = 'virtual:seed-data'
  const resolvedId = '\0' + virtualId
  return {
    name: 'seed-data-virtual',
    resolveId(id) {
      if (id === virtualId) return resolvedId
      return undefined
    },
    load(id) {
      if (id !== resolvedId) return undefined
      const file = path.join(__dirname, 'src', 'utils', `seed-data.${which}.json`)
      if (!fs.existsSync(file)) {
        throw new Error(`未找到数据文件：${file}（当前 VITE_SEED=${env.VITE_SEED || '(未设置，使用 demo)'}）`)
      }
      return `export default ${fs.readFileSync(file, 'utf8')}`
    }
  }
}

// base 使用相对路径，方便部署到 GitHub Pages / 云服务器任意子路径
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '')
  return {
    plugins: [vue(), seedDataPlugin(env)],
    base: './'
  }
})
