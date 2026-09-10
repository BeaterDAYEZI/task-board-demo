// 种子数据入口：由 vite.config.js 的 virtual:seed-data 虚拟模块提供
// - 默认使用脱敏演示数据 seed-data.demo.json（用于 GitHub 公开演示）
// - 本地使用真实数据时，在 frontend/.env.local 中设置 VITE_SEED=real（该文件不提交）
import seedData from 'virtual:seed-data'

/** 生成示例传阅文件（领导下发 → 指定人阅读），用于演示阅读提醒功能 */
function sampleDocuments(users) {
  const leader = users.find(u => u.role === 'leader') || users[0]
  const members = users.filter(u => u.role === 'member')
  if (!leader || !members.length) return []
  const day = 24 * 3600 * 1000
  const toFile = (name, text) => ({
    fileName: name,
    fileSize: new Blob([text]).size,
    fileType: 'text/plain',
    dataUrl: 'data:text/plain;charset=utf-8,' + encodeURIComponent(text)
  })
  const d = (offset) => new Date(Date.now() + offset * day).toISOString().slice(0, 10)
  const txt1 = [
    '关于做好秋冬季安全生产工作的通知',
    '',
    '各部门、班组：',
    '临近秋冬季节，请认真组织学习本通知要求，落实与本岗位相关的安全措施，并于月底前反馈落实情况。',
    '',
    '（本文件为演示附件，用于演示文件传阅、下载与阅读提醒功能。）'
  ].join('\n')
  const txt2 = [
    '部门月度重点工作安排（传阅）',
    '',
    '请对照月度重点工作安排梳理本岗位任务，及时更新任务进度，确保按期完成。',
    '',
    '（本文件为演示附件。）'
  ].join('\n')
  return [
    {
      id: 'doc1',
      title: '关于做好秋冬季安全生产工作的通知',
      note: '请认真学习文件内容，落实与本岗位相关的工作要求，月底前反馈落实情况。',
      targetIds: members.slice(0, 5).map(u => u.id),
      dueDate: d(7),
      ...toFile('关于做好秋冬季安全生产工作的通知（演示）.txt', txt1),
      issuerId: leader.id,
      readBy: [],
      createdAt: new Date(Date.now() - 2 * day).toISOString()
    },
    {
      id: 'doc2',
      title: '部门月度重点工作安排（传阅）',
      note: '对照月度重点工作安排梳理本岗位任务，及时更新进度。',
      targetIds: members.slice(2, 8).map(u => u.id),
      dueDate: d(3),
      ...toFile('部门月度重点工作安排（演示）.txt', txt2),
      issuerId: leader.id,
      readBy: members.length > 2 ? [{ userId: members[2].id, at: new Date(Date.now() - 1 * day).toISOString() }] : [],
      createdAt: new Date(Date.now() - 3 * day).toISOString()
    }
  ]
}

export function buildSeed() {
  // 深拷贝，避免直接修改导入的 JSON 对象
  const data = JSON.parse(JSON.stringify(seedData))
  if (!data.documents || !data.documents.length) {
    data.documents = sampleDocuments(data.users || [])
  }
  return data
}
