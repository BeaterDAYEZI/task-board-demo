<template>
  <el-dialog
    :model-value="modelValue"
    :title="title"
    width="620px"
    destroy-on-close
    @update:model-value="v => emit('update:modelValue', v)"
    @open="onOpen"
  >
    <el-form :model="form" label-width="96px">
      <el-form-item label="周次">
        <el-tag effect="plain">{{ weekText }}</el-tag>
        <span v-if="isEdit && !isCurrentWeek" class="muted fs12" style="margin-left: 8px">管理员模式：正在修改历史周记录</span>
      </el-form-item>

      <el-form-item v-if="!isEdit && lastRecord" label="上周参考">
        <div class="ref-box">
          <div class="ref-line">
            <span class="ref-label">{{ lastRecord.weekLabel || lastRecord.weekKey }} 进展：</span>{{ lastRecord.note || '—' }}
          </div>
          <div v-if="lastRecord.nextPlan" class="ref-line">
            <span class="ref-label">当时的下周计划：</span>{{ lastRecord.nextPlan }}
          </div>
          <div class="ref-actions">
            <el-button size="small" text type="primary" @click="copyFromLast('note')">沿用上周进展</el-button>
            <el-button v-if="lastRecord.nextPlan" size="small" text type="primary" @click="copyFromLast('nextPlan')">沿用上周计划</el-button>
          </div>
        </div>
      </el-form-item>

      <el-form-item label="进度" required>
        <div style="display: flex; align-items: center; gap: 14px; width: 100%">
          <el-slider v-model="form.percent" :step="5" style="flex: 1" />
          <el-input-number v-model="form.percent" :min="0" :max="100" :step="5" size="small" />
        </div>
      </el-form-item>

      <el-form-item label="任务状态" required>
        <el-radio-group v-model="form.status">
          <el-radio-button v-for="s in STATUSES" :key="s.value" :value="s.value">{{ s.label }}</el-radio-button>
        </el-radio-group>
      </el-form-item>

      <el-form-item label="本周进展" required>
        <el-input v-model="form.note" type="textarea" :rows="3" maxlength="300" show-word-limit placeholder="简述本周完成的工作" />
      </el-form-item>

      <el-form-item label="问题与风险">
        <el-input v-model="form.risk" type="textarea" :rows="2" maxlength="200" placeholder="可留空" />
      </el-form-item>

      <el-form-item label="下周计划">
        <el-input v-model="form.nextPlan" type="textarea" :rows="2" maxlength="200" placeholder="可留空" />
      </el-form-item>
    </el-form>

    <template #footer>
      <span class="muted fs12" style="float: left; line-height: 32px">提交后本周记录可随时修改；历史周记录修改请联系管理员</span>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" @click="submit">提交</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { useAppStore } from '../stores/app'
import { STATUSES, weekKey, weekLabel, latestProgressOf } from '../utils/core'

const props = defineProps({
  modelValue: Boolean,
  task: { type: Object, default: null },
  record: { type: Object, default: null }
})
const emit = defineEmits(['update:modelValue', 'saved'])
const store = useAppStore()

const isEdit = computed(() => !!props.record)
const isCurrentWeek = computed(() => !props.record || props.record.weekKey === weekKey(new Date()))
const weekText = computed(() => (props.record ? props.record.weekLabel || props.record.weekKey : weekLabel(new Date())))
const title = computed(() => `${isEdit.value ? '编辑周进度' : '填报本周进度'} · ${weekText.value}`)

/** 目标周之前最近的一条记录，用于填报参考 */
const lastRecord = computed(() => {
  if (!props.task) return null
  const targetKey = props.record ? props.record.weekKey : weekKey(new Date())
  const recs = store.progress
    .filter(p => p.taskId === props.task.id && p.weekKey < targetKey)
    .sort((a, b) => (a.weekKey < b.weekKey ? -1 : 1))
  return recs.length ? recs[recs.length - 1] : null
})

const form = reactive({ percent: 0, status: 'doing', note: '', risk: '', nextPlan: '' })

function onOpen() {
  if (props.record) {
    Object.assign(form, {
      percent: props.record.percent,
      status: props.record.status,
      note: props.record.note || '',
      risk: props.record.risk || '',
      nextPlan: props.record.nextPlan || ''
    })
  } else {
    const last = latestProgressOf(store.progress, props.task?.id)
    Object.assign(form, {
      percent: last ? last.percent : 0,
      status: props.task?.status === 'done' ? 'done' : 'doing',
      note: '',
      risk: '',
      nextPlan: last && last.nextPlan ? last.nextPlan : ''
    })
  }
}

function copyFromLast(field) {
  if (!lastRecord.value) return
  if (field === 'note') form.note = lastRecord.value.note || ''
  if (field === 'nextPlan') form.nextPlan = lastRecord.value.nextPlan || ''
}

function submit() {
  if (!form.note.trim()) {
    ElMessage.warning('请填写本周进展')
    return
  }
  if (!props.task) {
    ElMessage.error('任务不存在')
    return
  }
  const k = props.record ? props.record.weekKey : weekKey(new Date())
  const l = props.record ? (props.record.weekLabel || props.record.weekKey) : weekLabel(new Date())
  store.saveProgress({
    taskId: props.task.id,
    recordId: props.record?.id || null,
    weekKeyValue: k,
    weekLabelValue: l,
    percent: form.percent,
    status: form.status,
    note: form.note.trim(),
    risk: form.risk.trim(),
    nextPlan: form.nextPlan.trim()
  })
  ElMessage.success(isEdit.value ? '进度已更新' : '本周进度已提交')
  emit('saved')
  emit('update:modelValue', false)
}
</script>

<style scoped>
.ref-box { background: #f7f9fc; border: 1px solid var(--app-border); border-radius: 8px; padding: 10px 12px; width: 100%; }
.ref-line { font-size: 13px; line-height: 1.6; }
.ref-label { color: var(--app-text-2); }
.ref-actions { margin-top: 4px; }
</style>
