<template>
  <el-dialog
    :model-value="modelValue"
    :title="isEdit ? '编辑任务' : '新建任务'"
    width="640px"
    destroy-on-close
    @update:model-value="v => emit('update:modelValue', v)"
    @open="onOpen"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="88px">
      <el-form-item label="任务内容" prop="content">
        <el-input v-model="form.content" type="textarea" :rows="3" maxlength="200" show-word-limit placeholder="请填写任务内容" />
      </el-form-item>

      <el-form-item label="任务来源" prop="source">
        <el-select v-model="form.source" filterable allow-create default-first-option placeholder="选择或输入新来源（回车确认）" style="width: 100%">
          <el-option v-for="s in store.activeSources" :key="s.id" :label="s.name" :value="s.name" />
        </el-select>
      </el-form-item>

      <el-row :gutter="12">
        <el-col :span="12">
          <el-form-item label="执行人" prop="executorId">
            <el-select v-model="form.executorId" style="width: 100%">
              <el-option v-for="u in members" :key="u.id" :label="u.name" :value="u.id" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="负责人" prop="ownerId">
            <el-select v-model="form.ownerId" style="width: 100%">
              <el-option v-for="u in members" :key="u.id" :label="u.name" :value="u.id" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="12">
        <el-col :span="12">
          <el-form-item label="起始时间" prop="startDate">
            <el-date-picker v-model="form.startDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="终止时间" prop="endDate">
            <el-date-picker v-model="form.endDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item label="优先级" prop="priority">
        <el-radio-group v-model="form.priority">
          <el-radio-button v-for="p in PRIORITIES" :key="p.value" :value="p.value">
            <span class="p-dot" :style="{ background: p.color, marginRight: '5px' }" />{{ p.label }}
          </el-radio-button>
        </el-radio-group>
      </el-form-item>

      <el-form-item label="任务状态" prop="status">
        <el-select v-model="form.status" style="width: 100%">
          <el-option v-for="s in STATUSES" :key="s.value" :label="s.label" :value="s.value" />
        </el-select>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" @click="submit">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useAppStore } from '../stores/app'
import { PRIORITIES, STATUSES, todayStr } from '../utils/core'

const props = defineProps({
  modelValue: Boolean,
  task: { type: Object, default: null }
})
const emit = defineEmits(['update:modelValue', 'saved'])
const store = useAppStore()
const formRef = ref(null)
const isEdit = computed(() => !!props.task)
const members = computed(() => store.activeUsers)

function empty() {
  return {
    content: '', source: '', executorId: '', ownerId: '',
    startDate: todayStr(), endDate: '', priority: 'medium', status: 'not_started'
  }
}
const form = reactive(empty())

const rules = {
  content: [{ required: true, message: '请填写任务内容', trigger: 'blur' }],
  source: [{ required: true, message: '请选择任务来源', trigger: 'change' }],
  executorId: [{ required: true, message: '请选择执行人', trigger: 'change' }],
  ownerId: [{ required: true, message: '请选择负责人', trigger: 'change' }],
  startDate: [{ required: true, message: '请选择起始时间', trigger: 'change' }],
  endDate: [{ required: true, message: '请选择终止时间', trigger: 'change' }]
}

function onOpen() {
  const base = empty()
  if (props.task) {
    Object.assign(base, {
      content: props.task.content,
      source: props.task.source,
      executorId: props.task.executorId,
      ownerId: props.task.ownerId,
      startDate: props.task.startDate,
      endDate: props.task.endDate,
      priority: props.task.priority,
      status: props.task.status
    })
  }
  Object.assign(form, base)
  formRef.value?.clearValidate()
}

function submit() {
  formRef.value?.validate(valid => {
    if (!valid) return
    if (form.endDate < form.startDate) {
      ElMessage.warning('终止时间不能早于起始时间')
      return
    }
    if (isEdit.value) {
      store.updateTask(props.task.id, { ...form })
      ElMessage.success('任务已更新')
    } else {
      store.createTask({ ...form })
      ElMessage.success('任务已创建')
    }
    emit('saved')
    emit('update:modelValue', false)
  })
}
</script>
