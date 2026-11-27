<template>
  <div v-show="visible !== false" class="thermal-evolution-panel">
    <div class="panel-header">
      <span class="title">热异常时空演化分析</span>
    </div>
    <div class="panel-content">
      <div class="control-item">
        <span class="label">开始日期:</span>
        <mars-date-picker v-model:value="startTime" format="YYYY-MM-DD" :allowClear="false" />
      </div>
      <div class="control-item">
        <span class="label">结束日期:</span>
        <mars-date-picker v-model:value="endTime" format="YYYY-MM-DD" :allowClear="false" />
      </div>
      <div class="control-item">
        <span class="label">演化进度:</span>
        <div class="timeline-wrapper">
          <mars-icon
            :icon="isPlaying ? 'pause-one' : 'play'"
            class="play-btn"
            width="20"
            color="#fff"
            @click="togglePlay"
          />
          <mars-slider
            v-model:value="progress"
            :min="0"
            :max="maxFrameIndex"
            :step="1"
            class="timeline-slider"
          />
          <span class="progress-text">{{ currentDate || "无观测数据" }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onUnmounted, watch } from "vue"
import dayjs from "dayjs"
import * as mapWork from "./thermal-map"
import useLifecycle from "@mars/common/uses/use-lifecycle"

defineProps<{
  visible?: boolean
}>()

useLifecycle(mapWork)

const startTime = ref(dayjs("2021-05-01"))
const endTime = ref(dayjs("2026-12-31"))
const progress = ref(0)
const dates = ref<string[]>([])
const isPlaying = ref(false)
let timer: any = null

const maxFrameIndex = computed(() => Math.max(0, dates.value.length - 1))

watch(
  [startTime, endTime],
  async () => {
    try {
      await mapWork.loadRealThermalData(
        dayjs(startTime.value).format("YYYY-MM-DD"),
        dayjs(endTime.value).format("YYYY-MM-DD")
      )
      dates.value = mapWork.getThermalDates()
      progress.value = 0
      mapWork.updateThermalLayer(0)
    } catch (err) {
      console.error("Failed to load real thermal evolution data", err)
    }
  },
  { immediate: true }
)

const currentDate = computed(() => {
  if (!dates.value.length) {
    return ""
  }
  const idx = Math.max(0, Math.min(Math.floor(progress.value), dates.value.length - 1))
  return dates.value[idx] || ""
})

watch(progress, (val) => {
  mapWork.updateThermalLayer(Math.floor(val))
})

const togglePlay = () => {
  isPlaying.value = !isPlaying.value
  if (isPlaying.value) {
    startAnimation()
  } else {
    stopAnimation()
  }
}

const startAnimation = () => {
  stopAnimation()
  const step = () => {
    if (!isPlaying.value) {
      return
    }
    if (progress.value >= maxFrameIndex.value) {
      progress.value = 0
    } else {
      progress.value = progress.value + 1
    }
    timer = setTimeout(step, 500)
  }
  timer = setTimeout(step, 500)
}

const stopAnimation = () => {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
}

onUnmounted(() => {
  stopAnimation()
})
</script>

<style lang="less" scoped>
.thermal-evolution-panel {
  position: absolute;
  bottom: 50px;
  left: 20%;
  right: 20%;
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  padding: 10px 20px;
  color: #fff;
  z-index: 999;
}

.panel-header {
  margin-bottom: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 5px;
  .title {
    font-size: 16px;
    font-weight: bold;
  }
}

.panel-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.control-item {
  display: flex;
  align-items: center;
  gap: 10px;

  .label {
    min-width: 70px;
  }
}

.timeline-wrapper {
  display: flex;
  align-items: center;
  flex: 1;
  gap: 10px;

  .play-btn {
    cursor: pointer;
    &:hover {
      opacity: 0.8;
    }
  }

  .timeline-slider {
    flex: 1;
  }

  .progress-text {
    min-width: 100px;
    text-align: right;
    font-family: monospace;
  }
}
</style>
