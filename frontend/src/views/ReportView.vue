<template>
  <div class="page">
    <div class="head-row">
      <div>
        <h2 class="page-title">统计报表</h2>
        <p class="page-sub">部门任务完成情况、进度趋势与分布（演示数据）</p>
      </div>
      <el-button @click="onExport">导出 Excel</el-button>
    </div>

    <div class="grid2">
      <div class="card card-pad">
        <div class="sec-title" style="margin-bottom: 8px">每人任务数量与完成率</div>
        <VChart :option="perUserOption" :height="300" />
      </div>
      <div class="card card-pad">
        <div class="sec-title" style="margin-bottom: 8px">部门整体进度趋势（按周）</div>
        <VChart :option="trendOption" :height="300" />
      </div>
    </div>

    <div class="grid2" style="margin-top: 16px">
      <div class="card card-pad">
        <div class="sec-title" style="margin-bottom: 8px">任务来源分布</div>
        <VChart :option="sourceOption" :height="300" />
      </div>
      <div class="card card-pad">
        <div class="sec-title" style="margin-bottom: 8px">优先级分布</div>
        <VChart :option="priorityOption" :height="300" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useAppStore } from '../stores/app'
import { PRIORITIES, weekKey, weekShort, fmtDate, endOfWeek } from '../utils/core'
import { exportTasksWorkbook } from '../utils/excel'
import VChart from '../components/VChart.vue'

const store = useAppStore()

const perUserOption = computed(() => {
  const names = []
  const totals = []
  const rates = []
  store.activeUsers
    .filter(u => u.role !== 'leader')
    .forEach(u => {
      const ts = store.activeTasks.filter(t => t.executorId === u.id)
      if (!ts.length) return
      names.push(u.name)
      totals.push(ts.length)
      const done = ts.filter(t => t.status === 'done').length
      rates.push(Math.round((done / ts.length) * 100))
    })
  return {
    tooltip: { trigger: 'axis' },
    legend: { top: 0, data: ['任务数', '完成率'] },
    grid: { left: 42, right: 50, top: 36, bottom: 28 },
    xAxis: { type: 'category', data: names },
    yAxis: [
      { type: 'value', name: '任务数', minInterval: 1 },
      { type: 'value', name: '完成率', max: 100, axisLabel: { formatter: '{value}%' } }
    ],
    series: [
      {
        name: '任务数',
        type: 'bar',
        barWidth: 18,
        data: totals,
        itemStyle: { color: '#2f6bff', borderRadius: [4, 4, 0, 0] }
      },
      {
        name: '完成率',
        type: 'line',
        yAxisIndex: 1,
        data: rates,
        symbolSize: 7,
        itemStyle: { color: '#2bb673' },
        lineStyle: { width: 2 }
      }
    ]
  }
})

const trendOption = computed(() => {
  const weeks = []
  for (let w = -5; w <= 0; w++) {
    const d = new Date()
    d.setDate(d.getDate() + w * 7)
    weeks.push({ key: weekKey(d), label: weekShort(weekKey(d)), end: fmtDate(endOfWeek(d)) })
  }
  const rates = weeks.map(({ key, end }) => {
    const eligible = store.activeTasks.filter(t => t.startDate <= end)
    if (!eligible.length) return 0
    const sum = eligible.reduce((acc, t) => {
      const recs = store.progress
        .filter(p => p.taskId === t.id && p.weekKey <= key)
        .sort((a, b) => (a.weekKey < b.weekKey ? -1 : 1))
      const last = recs.length ? recs[recs.length - 1] : null
      return acc + (last ? last.percent : 0)
    }, 0)
    return Math.round(sum / eligible.length)
  })
  return {
    tooltip: { trigger: 'axis', valueFormatter: v => v + '%' },
    grid: { left: 46, right: 20, top: 26, bottom: 30 },
    xAxis: { type: 'category', data: weeks.map(w => w.label) },
    yAxis: { type: 'value', min: 0, max: 100, axisLabel: { formatter: '{value}%' } },
    series: [
      {
        name: '平均进度',
        type: 'line',
        smooth: true,
        symbolSize: 7,
        data: rates,
        itemStyle: { color: '#2f6bff' },
        lineStyle: { width: 2.5 },
        areaStyle: { opacity: 0.1 }
      }
    ]
  }
})

const sourceOption = computed(() => {
  const map = {}
  store.activeTasks.forEach(t => { map[t.source] = (map[t.source] || 0) + 1 })
  const data = Object.entries(map).map(([name, value]) => ({ name, value }))
  return {
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, type: 'scroll' },
    series: [
      {
        type: 'pie',
        radius: ['38%', '62%'],
        center: ['50%', '42%'],
        data,
        label: { formatter: '{b}：{c}' },
        itemStyle: { borderColor: '#fff', borderWidth: 2 }
      }
    ]
  }
})

const priorityOption = computed(() => {
  const data = PRIORITIES.map(p => ({
    name: p.label,
    value: store.activeTasks.filter(t => t.priority === p.value).length,
    itemStyle: { color: p.color }
  }))
  return {
    tooltip: { trigger: 'item' },
    legend: { bottom: 0 },
    series: [
      {
        type: 'pie',
        roseType: 'radius',
        radius: ['30%', '62%'],
        center: ['50%', '42%'],
        data,
        label: { formatter: '{b}：{c}' },
        itemStyle: { borderColor: '#fff', borderWidth: 2 }
      }
    ]
  }
})

function onExport() {
  exportTasksWorkbook({
    tasks: store.activeTasks,
    progress: store.progress,
    users: store.users,
    filename: `统计报表_${new Date().toISOString().slice(0, 10)}.xlsx`
  })
  ElMessage.success('已生成 Excel 文件')
}
</script>

<style scoped>
.head-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
</style>
