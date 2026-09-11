// 智能问答引擎（演示版：本地规则解析 + 数据检索 + 图表生成）
// 输入：中文问题 + 任务数据 → 输出：结论文字 + ECharts 配置 + 明细表格
// 说明：正式版可平滑替换为大模型 / 后端问答接口，保持相同的输出结构即可
import {
  pad, startOfWeek, isOverdue, isExpiredNotStarted, isNearDue, latestProgressOf,
  weekKey, weekShort, taskStateText, sortTasks, STATUSES
} from './core'

const COLORS = { blue: '#2f6bff', green: '#2bb673', orange: '#e8871e', red: '#d93026', gray: '#b9bfcb' }

function ymd(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function monthRange(y, m) {
  const start = `${y}-${pad(m + 1)}-01`
  const end = `${y}-${pad(m + 1)}-${pad(new Date(y, m + 1, 0).getDate())}`
  return { start, end }
}
function weekRange(input) {
  const s = startOfWeek(input)
  const e = new Date(s)
  e.setDate(e.getDate() + 6)
  return { start: ymd(s), end: ymd(e) }
}
function cut(s, n) {
  s = String(s || '')
  return s.length > n ? s.slice(0, n) + '…' : s
}

// ---------- 问题解析 ----------

/** 绝对月份解析：「2026年7月」「去年7月」「7月」；返回候选年份（当年优先，候选按顺序消歧） */
function monthCandidates(q, y, m) {
  const ym = /(20\d{2})\s*年\s*(\d{1,2})\s*月/.exec(q)
  if (ym) {
    const mm = Number(ym[2]) - 1
    if (mm < 0 || mm > 11) return null
    return { years: [Number(ym[1])], mm, label: `${ym[1]}年${mm + 1}月` }
  }
  const ly = /去年\s*(\d{1,2})\s*月/.exec(q)
  if (ly) {
    const mm = Number(ly[1]) - 1
    if (mm < 0 || mm > 11) return null
    return { years: [y - 1], mm, label: `去年${mm + 1}月` }
  }
  const mn = /(?:^|[^\d])(\d{1,2})\s*月(?!\d)/.exec(q)
  if (mn) {
    const mm = Number(mn[1]) - 1
    if (mm < 0 || mm > 11) return null
    const years = [y]
    if (mm > m) years.push(y - 1)
    if (mm < m) years.push(y + 1)
    return { years, mm, label: `${mm + 1}月` }
  }
  return null
}

/** 时间范围：绝对月份 / 这个月 / 上个月 / 本季度 / 今年 / 本周 / 上周 / 今天 */
function parseRange(q, now) {
  const y = now.getFullYear()
  const m = now.getMonth()
  const abs = monthCandidates(q, y, m)
  if (abs) {
    const primary = monthRange(abs.years[0], abs.mm)
    const alt = abs.years.slice(1).map(yr => ({ ...monthRange(yr, abs.mm), label: `${yr}年${abs.mm + 1}月` }))
    return { ...primary, label: abs.label, alt: alt.length ? alt : undefined }
  }
  if (/上个月|上月/.test(q)) {
    const t = m === 0 ? 11 : m - 1
    const ty = m === 0 ? y - 1 : y
    return { ...monthRange(ty, t), label: `${t + 1}月` }
  }
  if (/这个月|本月|当月|这月/.test(q)) return { ...monthRange(y, m), label: `${m + 1}月` }
  if (/本季度|这个季度|这季度/.test(q)) {
    const qs = Math.floor(m / 3) * 3
    return { start: `${y}-${pad(qs + 1)}-01`, end: monthRange(y, qs + 2).end, label: '本季度' }
  }
  if (/今年|本年|年度/.test(q)) return { start: `${y}-01-01`, end: `${y}-12-31`, label: '今年' }
  if (/上周/.test(q)) {
    const d = new Date(now)
    d.setDate(d.getDate() - 7)
    return { ...weekRange(d), label: '上周' }
  }
  if (/本周|这周|这星期/.test(q)) return { ...weekRange(now), label: '本周' }
  if (/今天|今日/.test(q)) return { start: ymd(now), end: ymd(now), label: '今天' }
  return null
}

/** 时间锚点：开始时间 / 截止时间 / 任意命中 */
function parseAnchor(q) {
  if (/开始|新增|新下达|新任务|启动|开展/.test(q)) return 'start'
  if (/截止|到期|结束|交付/.test(q)) return 'end'
  return 'any'
}

/** 状态条件：未完成 / 已完成 / 进行中 / 已暂停 / 未开始 / 逾期 / 临近 */
function parseFilters(q) {
  const f = {}
  if (/没有完成|没完成|未完成|还没完成|尚未完成|待完成|没做完/.test(q)) f.notDone = true
  else if (/已完成|完成了|完成数|做完了/.test(q)) f.done = true
  if (/进行中|正在做|正在执行/.test(q)) f.doing = true
  if (/已暂停|暂停的/.test(q)) f.paused = true
  if (/逾期|超期|拖期/.test(q)) f.overdue = true
  if (/未启动|没启动|还没有开始|未开始/.test(q)) f.notStarted = true
  if (/临期|快到期|临近截止/.test(q)) f.near = true
  return f
}

/** 问题意图：count(数量) / list(明细) / rate(完成率) / rank(按人排行) / trend(趋势) / overview(总览) */
function parseWant(q) {
  if (/谁|排行|排名|最多|最少|最忙|每人|每个人|各人|每个成员/.test(q)) return 'rank'
  if (/趋势|走势|每周|近\s*\d+\s*周|最近几周|变化情况/.test(q)) return 'trend'
  if (/完成率|比例|百分比|进度如何|进展如何|进展怎样|怎么样了|怎么样|情况如何|完成情况/.test(q)) return 'rate'
  if (/哪些|列出|清单|有什么|看看|显示|明细|具体/.test(q)) return 'list'
  if (/多少|几个|几项|几件|数量|总数|个数/.test(q)) return 'count'
  return 'overview'
}

/** 人员识别（全名 / 职务），职务优先匹配更长的称呼（如「副主任」优先于「主任」） */
function findPerson(q, users) {
  const byName = users.find(u => u.name && q.includes(u.name))
  if (byName) return byName
  const byTitle = [...users]
    .filter(u => u.title)
    .sort((a, b) => b.title.length - a.title.length)
    .find(u => q.includes(u.title))
  return byTitle || null
}

/** 任务来源识别 */
function findSource(q, sources) {
  return [...sources]
    .filter(s => s.name)
    .sort((a, b) => b.name.length - a.name.length)
    .find(s => q.includes(s.name)) || null
}

// ---------- 数据检索 ----------

function matchTasks({ tasks, ctx }) {
  let list = tasks.filter(t => !t.deleted)
  if (ctx.person) list = list.filter(t => t.executorId === ctx.person.id || t.ownerId === ctx.person.id)
  if (ctx.source) list = list.filter(t => t.source === ctx.source.name)
  if (ctx.range) {
    const { start, end } = ctx.range
    list = list.filter(t => {
      const s = t.startDate || ''
      const e = t.endDate || ''
      if (ctx.anchor === 'start') return s >= start && s <= end
      if (ctx.anchor === 'end') return e >= start && e <= end
      return (s >= start && s <= end) || (e >= start && e <= end)
    })
  }
  const f = ctx.f
  if (f.overdue) list = list.filter(isOverdue)
  if (f.notStarted) list = list.filter(t => t.status === 'not_started')
  if (f.near) list = list.filter(t => isNearDue(t))
  if (f.notDone) list = list.filter(t => t.status !== 'done')
  else if (f.done) list = list.filter(t => t.status === 'done')
  if (f.doing) list = list.filter(t => t.status === 'doing')
  if (f.paused) list = list.filter(t => t.status === 'paused')
  return sortTasks(list, 'end', true)
}

function breakdown(list) {
  const n = (fn) => list.filter(fn).length
  return {
    total: list.length,
    done: n(t => t.status === 'done'),
    doing: n(t => t.status === 'doing'),
    paused: n(t => t.status === 'paused'),
    notStarted: n(t => t.status === 'not_started'),
    overdue: n(isOverdue),
    expired: n(isExpiredNotStarted),
    near: n(t => isNearDue(t))
  }
}

function headLabel(ctx) {
  let head = '当前部门'
  if (ctx.range) {
    head = ctx.range.label
    if (ctx.anchor === 'start') head += '开始'
    else if (ctx.anchor === 'end') head += '截止'
  }
  const extra = []
  if (ctx.person) extra.push(ctx.person.name)
  if (ctx.source) extra.push(`来源「${ctx.source.name}」`)
  if (extra.length) head += '·' + extra.join('·')
  return head
}

function summaryFor(list, head, f = {}) {
  const c = breakdown(list)
  if (!c.total) {
    return `${head}的任务：没有找到符合条件的任务。可以换个时间范围（如「本月」「上周」）或换个问法再试。`
  }
  if (f.overdue) {
    const inner0 = []
    if (c.doing) inner0.push(`进行中 ${c.doing}`)
    if (c.paused) inner0.push(`已暂停 ${c.paused}`)
    if (c.notStarted) inner0.push(`未开始 ${c.notStarted}`)
    return `${head}逾期未完成的任务共 ${c.total} 项（${inner0.join('、') || '—'}）。建议结合优先级与终止时间逐项跟进、尽快闭环。`
  }
  const segs = [`共 ${c.total} 项`]
  const undone = c.total - c.done
  if (undone > 0) {
    const inner = []
    if (c.doing) inner.push(`进行中 ${c.doing}`)
    if (c.notStarted) inner.push(`未开始 ${c.notStarted}`)
    if (c.paused) inner.push(`已暂停 ${c.paused}`)
    segs.push(`未完成 ${undone} 项（${inner.join('、') || '—'}）`)
  }
  if (c.done) segs.push(`已完成 ${c.done} 项`)
  segs.push(`完成率 ${Math.round((c.done / c.total) * 100)}%`)
  if (c.overdue) segs.push(`逾期未完成 ${c.overdue} 项`)
  if (c.expired) segs.push(`未启动且已过期 ${c.expired} 项`)
  let tail = ''
  if (c.overdue) tail = '建议优先跟进逾期任务。'
  else if (c.near) tail = `有 ${c.near} 项临近截止，请注意及时推进。`
  return `${head}的任务${segs.join('，')}。${tail}`
}

// ---------- 图表构建（纯 ECharts option） ----------

function statusPie(list) {
  const data = STATUSES
    .map(s => ({ name: s.label, value: list.filter(t => t.status === s.value).length, itemStyle: { color: s.color } }))
    .filter(d => d.value > 0)
  if (!data.length) return null
  return {
    tooltip: { trigger: 'item', formatter: '{b}：{c} 项（{d}%）' },
    legend: { bottom: 0, icon: 'circle', itemWidth: 9, itemHeight: 9, textStyle: { fontSize: 11 } },
    series: [{
      type: 'pie',
      radius: ['44%', '68%'],
      center: ['50%', '43%'],
      itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
      label: { show: true, fontSize: 11, formatter: '{b} {c}' },
      data
    }]
  }
}

function ringChart(percent, text = '完成率') {
  const v = Math.max(0, Math.min(100, Math.round(percent)))
  return {
    series: [{
      type: 'pie',
      radius: ['64%', '82%'],
      silent: true,
      label: { show: false },
      data: [
        { value: v, itemStyle: { color: COLORS.blue } },
        { value: Math.max(0.0001, 100 - v), itemStyle: { color: '#e8edf6' } }
      ]
    }],
    title: {
      text: v + '%',
      subtext: text,
      left: 'center',
      top: '40%',
      textStyle: { fontSize: 30, fontWeight: 700, color: '#213152' },
      subtextStyle: { fontSize: 12, color: '#8a919f' }
    }
  }
}

function rankBar(items) {
  return {
    grid: { left: 8, right: 36, top: 8, bottom: 8, containLabel: true },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: { type: 'value', minInterval: 1, splitLine: { lineStyle: { color: '#eef1f6' } } },
    yAxis: { type: 'category', data: items.map(x => x.name).reverse(), axisTick: { show: false }, axisLine: { show: false } },
    series: [{
      type: 'bar',
      barWidth: 13,
      data: items.map(x => x.value).reverse(),
      itemStyle: { borderRadius: [0, 6, 6, 0], color: COLORS.blue },
      label: { show: true, position: 'right', fontSize: 11, color: '#5b6472' }
    }]
  }
}

function hBarItems(items) {
  return {
    grid: { left: 8, right: 40, top: 8, bottom: 8, containLabel: true },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v) => v + '%' },
    xAxis: { type: 'value', max: 100, splitLine: { lineStyle: { color: '#eef1f6' } } },
    yAxis: { type: 'category', data: items.map(x => x.name).reverse(), axisTick: { show: false }, axisLine: { show: false }, axisLabel: { fontSize: 11 } },
    series: [{
      type: 'bar',
      barWidth: 12,
      data: items.map(x => x.value).reverse(),
      itemStyle: { borderRadius: [0, 6, 6, 0], color: COLORS.blue },
      label: { show: true, position: 'right', fontSize: 11, formatter: '{c}%', color: '#5b6472' }
    }]
  }
}

function multiLine(labels, series) {
  return {
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0, icon: 'circle', itemWidth: 9, itemHeight: 9, textStyle: { fontSize: 11 } },
    grid: { left: 8, right: 18, top: 16, bottom: 30, containLabel: true },
    xAxis: { type: 'category', data: labels, boundaryGap: false, axisTick: { show: false } },
    yAxis: { type: 'value', minInterval: 1, splitLine: { lineStyle: { color: '#eef1f6' } } },
    series: series.map(s => ({
      name: s.name,
      type: 'line',
      smooth: true,
      symbolSize: 6,
      data: s.data,
      itemStyle: { color: s.color },
      areaStyle: { opacity: 0.1 }
    }))
  }
}

// ---------- 回答构建 ----------

function tableOf(list, progress, nameOf, max = 10) {
  const rows = list.slice(0, max).map(t => ({
    content: t.content,
    executor: nameOf(t.executorId),
    end: t.endDate || '—',
    state: taskStateText(t),
    percent: (latestProgressOf(progress, t.id)?.percent ?? 0) + '%'
  }))
  return {
    note: list.length > max ? `共 ${list.length} 项，仅展示前 ${max} 项` : '',
    columns: [
      { key: 'content', label: '任务内容', minWidth: 220 },
      { key: 'executor', label: '执行人', width: 84 },
      { key: 'end', label: '截止时间', width: 104 },
      { key: 'state', label: '状态', width: 116 },
      { key: 'percent', label: '进度', width: 70 }
    ],
    rows
  }
}

function followups(ctx) {
  const out = []
  if (ctx.f.overdue) out.push('近 8 周的任务填报趋势')
  else out.push('目前逾期未完成的任务有哪些？')
  out.push('每个人的任务数量和完成情况')
  out.push('近 8 周的任务填报趋势')
  return [...new Set(out)].slice(0, 3)
}

function countAnswer({ ctx, list, progress, nameOf }) {
  const head = headLabel(ctx)
  const c = breakdown(list)
  let title = '任务总览'
  if (ctx.want === 'count') title = ctx.f.notDone ? '未完成任务统计' : '任务数量统计'
  else if (ctx.want === 'list') title = '任务明细'
  if (ctx.person) title = `${ctx.person.name} · ${title}`
  return {
    title,
    summary: summaryFor(list, head, ctx.f),
    chart: c.total ? statusPie(list) : null,
    chartHeight: 260,
    table: list.length ? tableOf(list, progress, nameOf, 12) : null,
    followups: followups(ctx)
  }
}

function rateAnswer({ ctx, list, progress, nameOf }) {
  const head = headLabel(ctx)
  const c = breakdown(list)
  if (!c.total) {
    return emptyAnswer(`${head}没有找到符合条件的任务，无法计算完成率。试试换个时间范围，或问「当前部门的任务完成率是多少？」`)
  }
  const rate = Math.round((c.done / c.total) * 100)
  if (ctx.person) {
    const items = sortTasks(list, 'end', false).slice(0, 10).map(t => ({
      name: cut(t.content, 16),
      value: latestProgressOf(progress, t.id)?.percent ?? 0
    }))
    const avg = Math.round(list.reduce((s, t) => s + (latestProgressOf(progress, t.id)?.percent ?? 0), 0) / list.length)
    return {
      title: `${ctx.person.name} · 任务进展`,
      summary: `${ctx.person.name} 名下共 ${c.total} 项任务：已完成 ${c.done} 项、进行中 ${c.doing} 项、未开始 ${c.notStarted} 项${c.overdue ? `，其中逾期未完成 ${c.overdue} 项` : ''}；整体完成率 ${rate}%，平均进度 ${avg}%。`,
      chart: hBarItems(items),
      chartHeight: 300,
      table: tableOf(list, progress, nameOf, 10),
      followups: followups(ctx)
    }
  }
  const inner = []
  if (c.doing) inner.push(`进行中 ${c.doing}`)
  if (c.notStarted) inner.push(`未开始 ${c.notStarted}`)
  if (c.paused) inner.push(`已暂停 ${c.paused}`)
  return {
    title: '完成率分析',
    summary: `${head}的任务共 ${c.total} 项：已完成 ${c.done} 项，未完成 ${c.total - c.done} 项（${inner.join('、') || '—'}）；整体完成率 ${rate}%${c.overdue ? `，逾期未完成 ${c.overdue} 项` : ''}。`,
    chart: ringChart(rate),
    chartHeight: 260,
    table: null,
    followups: followups(ctx)
  }
}

function rankAnswer({ ctx, tasks, users, progress }) {
  const base = tasks.filter(t => !t.deleted)
  const metric = ctx.f.notDone ? 'undone' : 'total'
  const rows = users
    .filter(u => u.active)
    .map(u => {
      const list = base.filter(t => t.executorId === u.id)
      const c = breakdown(list)
      const avg = list.length
        ? Math.round(list.reduce((s, t) => s + (latestProgressOf(progress, t.id)?.percent ?? 0), 0) / list.length)
        : 0
      return { name: u.name, total: c.total, undone: c.total - c.done, done: c.done, overdue: c.overdue, avg: avg + '%' }
    })
    .filter(r => r.total > 0)
  if (!rows.length) return emptyAnswer('暂无人员任务数据。')
  rows.sort((a, b) => (parseInt(b[metric]) || 0) - (parseInt(a[metric]) || 0))
  const label = metric === 'undone' ? '未完成任务数' : '任务数'
  const top = rows.slice(0, 10)
  const top3 = top.slice(0, 3).map(r => `${r.name}（${r[metric]} 项）`).join('、')
  return {
    title: `按执行人 · ${label}`,
    summary: `共 ${rows.length} 人承担任务，${label}前三位：${top3}。全部门共 ${base.length} 项任务，其中逾期未完成 ${base.filter(isOverdue).length} 项。`,
    chart: rankBar(top.map(r => ({ name: r.name, value: r[metric] }))),
    chartHeight: 320,
    table: {
      note: '',
      columns: [
        { key: 'name', label: '执行人', width: 90 },
        { key: 'total', label: '任务数', width: 80 },
        { key: 'undone', label: '未完成', width: 80 },
        { key: 'done', label: '已完成', width: 80 },
        { key: 'overdue', label: '逾期', width: 70 },
        { key: 'avg', label: '平均进度', width: 90 }
      ],
      rows
    },
    followups: followups(ctx)
  }
}

function trendAnswer({ tasks, progress, ctx, now }) {
  const weeks = []
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * 7)
    const k = weekKey(d)
    weeks.push({ key: k, label: weekShort(k) })
  }
  const newTasks = weeks.map(w => tasks.filter(t => !t.deleted && t.startDate && weekKey(new Date(t.startDate)) === w.key).length)
  const fills = weeks.map(w => progress.filter(p => p.weekKey === w.key).length)
  const nTotal = newTasks.reduce((a, b) => a + b, 0)
  const fTotal = fills.reduce((a, b) => a + b, 0)
  const lastW = weeks[weeks.length - 1]
  return {
    title: '近 8 周任务走势',
    summary: `近 8 周共新增任务 ${nTotal} 项、进度填报 ${fTotal} 次；最近一周（${lastW.label}）新增 ${newTasks[7]} 项、填报 ${fills[7]} 次。`,
    chart: multiLine(weeks.map(w => w.label), [
      { name: '新增任务', data: newTasks, color: COLORS.blue },
      { name: '填报次数', data: fills, color: COLORS.green }
    ]),
    chartHeight: 280,
    table: {
      note: '',
      columns: [
        { key: 'label', label: '周次', width: 80 },
        { key: 'n', label: '新增任务', width: 100 },
        { key: 'f', label: '填报次数', width: 100 }
      ],
      rows: weeks.map((w, i) => ({ label: w.label, n: newTasks[i], f: fills[i] }))
    },
    followups: followups(ctx)
  }
}

function helpAnswer() {
  return {
    title: '你好，我是智能助手',
    summary: '你可以直接用一句话问我部门任务情况，例如：①「这个月开始的任务还有多少没有完成？」②「目前逾期未完成的任务有哪些？」③「每个人的任务数量和完成情况」④「主任负责的任务进展如何？」⑤「近 8 周的任务填报趋势」。我会自动检索任务数据并生成图表与明细。（演示版为本地规则解析，正式版可接入大模型问答）',
    chart: null,
    chartHeight: 0,
    table: null,
    followups: ['这个月开始的任务还有多少没有完成？', '目前逾期未完成的任务有哪些？', '近 8 周的任务填报趋势']
  }
}

function emptyAnswer(text) {
  return {
    title: '没查到相关数据',
    summary: text,
    chart: null,
    chartHeight: 0,
    table: null,
    followups: ['目前逾期未完成的任务有哪些？', '每个人的任务数量和完成情况', '这个月开始的任务还有多少没有完成？']
  }
}

// ---------- 入口 ----------

/** 智能回退：问「本月开始」却没有新任务时，改用「本月截止」再检索一次 */
function relaxedRetry({ tasks, ctx }) {
  if (!ctx.range || ctx.anchor !== 'start') return null
  const ctx2 = { ...ctx, anchor: 'end' }
  const list2 = matchTasks({ tasks, ctx: ctx2 })
  return list2.length ? { ctx: ctx2, list: list2 } : null
}

export function ask({ question, tasks = [], progress = [], users = [], sources = [], now = new Date() }) {
  const q = String(question || '').trim()
  const nameOf = (id) => users.find(u => u.id === id)?.name || '—'
  if (!q) return emptyAnswer('请先输入问题再发送，例如：这个月开始的任务还有多少没有完成？')
  if (/^你好|您好|嗨|help|帮助|能做什么|可以做什么|怎么用|使用说明/i.test(q)) return helpAnswer()

  const ctx = {
    range: parseRange(q, now),
    anchor: parseAnchor(q),
    f: parseFilters(q),
    person: findPerson(q, users),
    source: findSource(q, sources),
    want: parseWant(q)
  }

  if (ctx.want === 'trend') return trendAnswer({ tasks, progress, ctx, now })
  if (ctx.want === 'rank') return rankAnswer({ ctx, tasks, users, progress })

  let list = matchTasks({ tasks, ctx })
  // 绝对月份年份消歧：如「7月」优先当年；当年无结果时尝试备选年份（去年或明年）
  if (!list.length && ctx.range && ctx.range.alt) {
    for (const altRange of ctx.range.alt) {
      const altList = matchTasks({ tasks, ctx: { ...ctx, range: altRange } })
      if (altList.length) {
        ctx.range = altRange
        list = altList
        break
      }
    }
  }
  if (!list.length && ctx.want !== 'rate') {
    const alt = relaxedRetry({ tasks, ctx })
    if (alt) {
      const c = breakdown(alt.list)
      const undone = c.total - c.done
      const inner = []
      if (c.doing) inner.push(`进行中 ${c.doing}`)
      if (c.notStarted) inner.push(`未开始 ${c.notStarted}`)
      if (c.paused) inner.push(`已暂停 ${c.paused}`)
      return {
        title: '任务数量统计',
        summary: `${headLabel(ctx)}的任务暂未检索到符合条件的记录；换个角度看，${headLabel(alt.ctx)}的任务共 ${c.total} 项，其中未完成 ${undone} 项（${inner.join('、') || '—'}）${c.done ? `，已完成 ${c.done} 项` : ''}${c.overdue ? `，已逾期 ${c.overdue} 项` : ''}。`,
        chart: statusPie(alt.list),
        chartHeight: 260,
        table: tableOf(alt.list, progress, nameOf, 12),
        followups: followups(ctx)
      }
    }
  }
  if (ctx.want === 'rate') return rateAnswer({ ctx, list, progress, nameOf })
  return countAnswer({ ctx, list, progress, nameOf })
}

// ---------- 输入联想 ----------

/** 生成联想问题词库（根据当前数据动态生成：月份 / 人员 / 来源） */
export function suggestQuestions({ users = [], sources = [], tasks = [], now = new Date() } = {}) {
  const out = []
  const push = (s) => {
    if (s && !out.includes(s)) out.push(s)
  }
  // 高频通用问题
  push('这个月开始的任务还有多少没有完成？')
  push('目前逾期未完成的任务有哪些？')
  push('当前部门的任务完成率是多少？')
  push('每个人的任务数量和完成情况')
  push('近 8 周的任务填报趋势')
  push('最近快到期的任务有哪些？')
  push('还没开始的任务有哪些？')
  // 数据中出现过的月份（距当前月份由近到远）
  const nowM = now.getMonth() + 1
  const dist = (m) => Math.abs(m - nowM)
  const monthsOf = (field) => [...new Set(
    tasks.filter(t => !t.deleted && t[field] && String(t[field]).length >= 7).map(t => Number(String(t[field]).slice(5, 7)))
  )].filter(m => m >= 1 && m <= 12)
  const startMonths = monthsOf('startDate').sort((a, b) => dist(a) - dist(b) || b - a).slice(0, 4)
  startMonths.forEach(m => push(`${m}月开始的任务还有多少没有完成？`))
  const endMonths = monthsOf('endDate').sort((a, b) => dist(a) - dist(b) || b - a).slice(0, 3)
  endMonths.forEach(m => push(`${m}月截止的任务有哪些？`))
  // 人员 / 来源
  users.filter(u => u.active).forEach(u => push(`${u.name}的任务进展如何？`))
  sources.filter(s => s.active).forEach(s => push(`来源「${s.name}」的任务有多少没完成？`))
  return out
}

/** 实时联想：整句包含 > 分词全含 > 字符顺序模糊匹配；按命中位置与长度排序 */
export function matchSuggestions(input, pool, limit = 6) {
  const q = String(input || '').trim()
  if (!q) return []
  const tokens = q.split(/[\s,，。？?、]+/).filter(Boolean)
  const scored = []
  for (const cand of pool) {
    let score = 0
    if (cand.includes(q)) {
      score = 100 - cand.indexOf(q)
    } else if (tokens.length && tokens.every(t => cand.includes(t))) {
      score = 60 - Math.min(20, cand.indexOf(tokens[0]))
    } else {
      // 子序列匹配：输入的每个字符按顺序出现（适配中文逐字输入）
      let pos = 0
      let ok = true
      for (const ch of q) {
        const idx = cand.indexOf(ch, pos)
        if (idx < 0) { ok = false; break }
        pos = idx + 1
      }
      if (ok) score = 30 - Math.min(20, pos - q.length)
    }
    if (score > 0) scored.push({ cand, score })
  }
  scored.sort((a, b) => b.score - a.score || a.cand.length - b.cand.length)
  return scored.slice(0, limit).map(x => x.cand)
}

export { statusPie, ringChart, rankBar, multiLine, COLORS }
