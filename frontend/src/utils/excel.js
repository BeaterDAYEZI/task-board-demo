// Excel 导出（纯前端生成，无需服务器）
import * as XLSX from 'xlsx'
import { priorityMap, statusMap, latestProgressOf } from './core'

export function exportTasksWorkbook({ tasks, progress, users, filename }) {
  const nameOf = (id) => users.find(u => u.id === id)?.name || ''

  const taskRows = tasks.map((t, i) => {
    const last = latestProgressOf(progress, t.id)
    return {
      '序号': i + 1,
      '任务内容': t.content,
      '任务来源': t.source,
      '执行人': nameOf(t.executorId),
      '负责人': nameOf(t.ownerId),
      '起始时间': t.startDate,
      '终止时间': t.endDate,
      '优先级': priorityMap[t.priority]?.label || '',
      '任务状态': statusMap[t.status]?.label || '',
      '最新进度(%)': last ? last.percent : 0,
      '最新周次': last ? last.weekKey : '',
      '最近更新': t.updatedAt ? t.updatedAt.slice(0, 10) : ''
    }
  })

  const progressRows = [...progress]
    .sort((a, b) => (a.weekKey < b.weekKey ? -1 : 1))
    .map(p => {
      const t = tasks.find(x => x.id === p.taskId)
      return {
        '任务内容': t ? t.content : '(任务已删除)',
        '周次': p.weekKey,
        '进度(%)': p.percent,
        '状态': statusMap[p.status]?.label || '',
        '本周进展': p.note || '',
        '问题与风险': p.risk || '',
        '下周计划': p.nextPlan || '',
        '填报人': nameOf(p.reporterId),
        '填报时间': p.updatedAt ? p.updatedAt.slice(0, 16).replace('T', ' ') : ''
      }
    })

  const wb = XLSX.utils.book_new()
  const ws1 = XLSX.utils.json_to_sheet(taskRows)
  ws1['!cols'] = [
    { wch: 6 }, { wch: 44 }, { wch: 16 }, { wch: 10 }, { wch: 10 },
    { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }
  ]
  const ws2 = XLSX.utils.json_to_sheet(progressRows)
  ws2['!cols'] = [
    { wch: 44 }, { wch: 10 }, { wch: 10 }, { wch: 8 },
    { wch: 40 }, { wch: 30 }, { wch: 30 }, { wch: 10 }, { wch: 18 }
  ]
  XLSX.utils.book_append_sheet(wb, ws1, '任务清单')
  XLSX.utils.book_append_sheet(wb, ws2, '周进度明细')

  const name = filename || `任务总览_${new Date().toISOString().slice(0, 10)}.xlsx`
  XLSX.writeFile(wb, name)
}
