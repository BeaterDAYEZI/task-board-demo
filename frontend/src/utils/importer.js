// 在线 Excel 导入：解析任务清单工作簿，返回可合并的标准结构
import * as XLSX from 'xlsx'

const pad = (n) => String(n).padStart(2, '0')
const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

function isoWeekKey(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((t - yearStart) / 86400000 + 1) / 7)
  return { year: t.getUTCFullYear(), week, key: `${t.getUTCFullYear()}-W${pad(week)}` }
}

function weekLabelOf(d) {
  const { year, week } = isoWeekKey(d)
  const monday = new Date(d)
  const day = (monday.getDay() + 6) % 7
  monday.setDate(monday.getDate() - day)
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)
  return `${year}年第${week}周（${monday.getMonth() + 1}/${monday.getDate()}–${sunday.getMonth() + 1}/${sunday.getDate()}）`
}

/** 支持 2026年2月10日 / 2026-02-10 / 2026/2/10 / 2026.2.10 */
function parseDate(s) {
  const t = String(s ?? '').trim()
  let m = /^(\d{4})\s*[年\-/.]\s*(\d{1,2})\s*[月\-/.]\s*(\d{1,2})\s*日?$/.exec(t)
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`
  m = /^(\d{4})\s*年\s*(\d{1,2})\s*月$/.exec(t)
  if (m) {
    const d = new Date(+m[1], +m[2], 0)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }
  m = /^(\d{4})\s*年$/.exec(t)
  if (m) return `${m[1]}-12-31`
  return ''
}

/** 中文数字转阿拉伯数字（一到十二） */
function cnToNum(s) {
  const map = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 }
  const t = String(s ?? '').trim()
  if (!t) return 0
  if (map[t]) return map[t]
  if (t.startsWith('十')) return 10 + (map[t.slice(1)] || 0)
  if (t.includes('十')) {
    const [a, b] = t.split('十')
    return (map[a] || 1) * 10 + (map[b] || 0)
  }
  return Number(t) || 0
}

/**
 * 解析任务清单工作簿（第一个工作表）
 * 返回 { sheetName, items }，item 结构：
 * { content, source, executorName, ownerName, startDate, endDate, statusRaw, priority, weekly: [{ weekKey, label, text, date, createdAt }] }
 */
export function parseTaskWorkbook(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array' })
  if (!wb.SheetNames.length) throw new Error('工作簿中没有工作表')
  const sheetName = wb.SheetNames[0]
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' })
  if (!rows.length) throw new Error('表格内容为空')

  const contentKeys = ['任务事项', '工作内容', '任务内容', '重点工作']
  let headerIdx = -1
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i].map(x => String(x ?? '').trim())
    if (row.some(c => contentKeys.includes(c))) {
      headerIdx = i
      break
    }
  }
  if (headerIdx < 0) throw new Error('未找到表头（需要包含「任务事项」或「工作内容」列）')
  const header = rows[headerIdx].map(x => String(x ?? '').trim())

  const idxOf = (...names) => {
    for (const n of names) {
      const i = header.indexOf(n)
      if (i >= 0) return i
    }
    return -1
  }
  const I = {
    content: idxOf('任务事项', '工作内容', '任务内容', '重点工作'),
    source: idxOf('任务来源', '来源'),
    executor: idxOf('执行人'),
    owner: idxOf('责任人', '负责人'),
    start: idxOf('开始时间', '起始时间', '开始日期'),
    end: idxOf('完成时限', '截止时间', '结束时间', '完成时间'),
    status: idxOf('进展状态', '状态')
  }

  const weekCols = []
  header.forEach((h, i) => {
    const m = /^(\d{1,2})\s*月\s*第([一二三四五六七八九十]+)周$/.exec(h)
    if (m) {
      const week = cnToNum(m[2])
      if (week) weekCols.push({ index: i, month: Number(m[1]), week, label: h })
    }
  })

  const items = []
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r]
    const val = (i) => (i >= 0 ? String(row[i] ?? '').trim() : '')
    const content = val(I.content)
    if (!content || content === '/') continue

    let startDate = parseDate(val(I.start))
    let endDate = parseDate(val(I.end))
    const yearHint = startDate ? Number(startDate.slice(0, 4)) : new Date().getFullYear()

    const weekly = []
    weekCols.forEach(wc => {
      const text = val(wc.index)
      if (!text || text === '/' || text === '-' || text === '—') return
      const d = new Date(yearHint, wc.month - 1, 1 + (wc.week - 1) * 7)
      const friday = new Date(d)
      friday.setDate(friday.getDate() + 4)
      friday.setHours(17, 30, 0, 0)
      weekly.push({
        weekKey: isoWeekKey(d).key,
        label: weekLabelOf(d),
        text,
        date: toDateStr(d),
        createdAt: new Date(Math.min(friday.getTime(), Date.now())).toISOString()
      })
    })

    if (!startDate && weekly.length) startDate = weekly[0].date
    if (!endDate) {
      if (weekly.length) {
        const e = new Date(weekly[weekly.length - 1].date)
        e.setDate(e.getDate() + 30)
        endDate = toDateStr(e)
      } else {
        const e = new Date()
        e.setDate(e.getDate() + 90)
        endDate = toDateStr(e)
      }
    }
    if (startDate && endDate && startDate > endDate) endDate = startDate

    items.push({
      content,
      source: val(I.source) || '其他',
      executorName: val(I.executor),
      ownerName: val(I.owner),
      startDate,
      endDate,
      statusRaw: val(I.status),
      priority: content.includes('★') ? 'high' : 'medium',
      weekly
    })
  }

  return { sheetName, items }
}
