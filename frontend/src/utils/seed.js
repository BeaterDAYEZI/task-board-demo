// 种子数据入口：由 vite.config.js 的 virtual:seed-data 虚拟模块提供
// - 默认使用脱敏演示数据 seed-data.demo.json（用于 GitHub 公开演示）
// - 本地使用真实数据时，在 frontend/.env.local 中设置 VITE_SEED=real（该文件不提交）
import seedData from 'virtual:seed-data'

export function buildSeed() {
  // 深拷贝，避免直接修改导入的 JSON 对象
  return JSON.parse(JSON.stringify(seedData))
}
