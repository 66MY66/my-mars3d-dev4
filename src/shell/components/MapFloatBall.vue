<template>
  <teleport to="body">
    <button
      ref="ballRef"
      type="button"
      class="map-float-ball"
      :class="{ 'is-dragging': dragging, 'is-open': drawerOpen, 'has-running-tasks': activeCount > 0 }"
      :style="ballStyle"
      :aria-expanded="drawerOpen"
      aria-controls="task-center-drawer"
      aria-label="任务中心气泡"
      title="任务中心"
      @pointerdown="onPointerDown"
    >
      <span class="ball-core" aria-hidden="true">
        <span class="ball-core__ring"></span>
        <span class="ball-core__bars"></span>
      </span>
      <span v-if="activeCount" class="map-float-ball__badge" aria-hidden="true">{{ activeCount }}</span>
      <span class="sr-only">{{ activeCount ? `${activeCount} 个任务进行中` : "当前无运行任务" }}</span>
    </button>

    <div v-if="bubbleNotice" class="map-float-ball__notice" :style="noticeStyle" role="status">
      <strong>{{ bubbleNotice.title }}</strong>
      <span>{{ bubbleNotice.message }}</span>
    </div>

    <aside
      v-if="drawerOpen"
      id="task-center-drawer"
      class="task-center-drawer"
      :style="drawerStyle"
      aria-label="任务中心"
    >
      <header class="task-center-drawer__header">
        <div class="task-center-drawer__heading">
          <p class="task-center-drawer__eyebrow">Task Center</p>
          <h3>任务中心</h3>
        </div>
        <button type="button" class="task-center-drawer__close" aria-label="关闭任务中心" @click="drawerOpen = false">×</button>
      </header>
      <div class="task-center-summary">
        <div class="task-center-summary__signal" aria-hidden="true">
          <span></span><span></span><span></span>
        </div>
        <div>
          <strong>{{ runningTasks.length }} 个任务进行中</strong>
          <p>{{ queuedTasks.length }} 个排队 · {{ failedCount }} 个需要关注</p>
        </div>
        <span class="task-center-summary__updated">{{ updatedLabel }}</span>
      </div>

      <div class="task-center-drawer__body">
        <section v-if="runningTasks.length" class="task-section" aria-labelledby="running-task-title">
          <div class="task-section__title-row">
            <h4 id="running-task-title"><span class="status-dot is-running"></span>正在运行</h4>
            <span>{{ runningTasks.length }}</span>
          </div>

          <article v-for="task in runningTasks" :key="task.id" class="task-running-card">
            <div class="task-running-card__top">
              <span class="task-kind" :class="`is-${task.kind}`">{{ task.kindLabel }}</span>
              <span class="task-running-card__time">{{ task.startedAt }}</span>
            </div>
            <h5>{{ task.name }}</h5>
            <div class="task-running-card__stage">
              <span>{{ task.stage }}</span>
              <strong>{{ task.progress }}%</strong>
            </div>
            <div
              class="task-progress-track"
              role="progressbar"
              :aria-label="`${task.name}进度`"
              :aria-valuenow="task.progress"
              aria-valuemin="0"
              aria-valuemax="100"
            >
              <span :style="{ width: `${task.progress}%` }"></span>
            </div>
            <div class="task-running-card__footer">
              <span class="live-indicator"><i></i>状态更新中</span>
              <span>{{ task.id }}</span>
            </div>
          </article>
        </section>

        <section v-if="queuedTasks.length" class="task-section task-queued" aria-labelledby="queued-task-title">
          <div class="task-section__title-row">
            <h4 id="queued-task-title"><span class="status-dot is-queued"></span>{{ queuedTasks.length }} 个任务排队中</h4>
          </div>
          <div v-for="task in queuedTasks" :key="task.id" class="queued-task-row">
            <span class="task-kind" :class="`is-${task.kind}`">{{ task.kindLabel }}</span>
            <span class="queued-task-row__name">{{ task.name }}</span>
            <span class="queued-task-row__status">{{ task.stage || "已受理" }}</span>
          </div>
        </section>

        <section class="task-section" aria-labelledby="recent-task-title">
          <div class="task-section__title-row">
            <h4 id="recent-task-title">最近任务</h4>
            <span>共 {{ recentTasks.length }} 条</span>
          </div>
          <div v-if="recentTasks.length" class="recent-task-list">
            <div v-for="task in recentTasks" :key="task.id" class="recent-task-row">
              <span class="recent-task-row__icon" :class="`is-${task.status}`" aria-hidden="true">
                {{ task.status === "success" ? "✓" : task.status === "failed" ? "!" : "·" }}
              </span>
              <div class="recent-task-row__content">
                <strong>{{ task.name }}</strong>
                <span>{{ task.kindLabel }} · {{ task.stage }}</span>
                <div v-if="task.downloadUrl || task.previewUrl" class="recent-task-row__links">
                  <a v-if="task.previewUrl" :href="task.previewUrl" target="_blank" rel="noopener noreferrer">预览</a>
                  <a v-if="task.downloadUrl" :href="task.downloadUrl" target="_blank" rel="noopener noreferrer" :download="task.fileName || `${task.id}`">下载成果</a>
                </div>
              </div>
              <time>{{ task.finishedAt }}</time>
            </div>
          </div>
          <div v-else class="recent-task-empty">暂无任务记录，可在 CUI 对话中发起「生成报告」或「做专题图」</div>
        </section>
      </div>
      <footer class="task-center-drawer__footer">
        <span class="placeholder-dot" :class="{ 'is-live': serviceReady }"></span>
        {{ tasks.length ? `已接入实时任务服务 · 共 ${tasks.length} 条任务` : "实时任务服务已就绪 · 暂无任务" }}
      </footer>
    </aside>
  </teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue"

type FloatTaskItem = {
  id: string
  kind: "generate" | "publish" | "export"
  kindLabel: string
  name: string
  rawStatus: string
  status: "running" | "queued" | "success" | "failed" | "cancelled"
  stage: string
  progress: number
  startedAt: string
  finishedAt: string
  downloadUrl?: string
  previewUrl?: string
  fileName?: string
  updatedAtMs: number
}

const SIZE = 52
const MARGIN = 16
const STORAGE_KEY = "map_float_ball_pos_v1"

const ballRef = ref<HTMLButtonElement | null>(null)
const viewport = ref({ w: window.innerWidth, h: window.innerHeight })
const pos = ref(getStoredPos())
const dragging = ref(false)
const drawerOpen = ref(false)
const tasks = ref<FloatTaskItem[]>([])
const serviceReady = ref(false)
const updatedLabel = ref("实时同步中")
const bubbleNotice = ref<{ title: string; message: string } | null>(null)
let noticeTimer: number | undefined
let pollTimer: number | undefined

const runningTasks = computed(() => tasks.value.filter((t) => t.status === "running"))
const queuedTasks = computed(() => tasks.value.filter((t) => t.status === "queued"))
const recentTasks = computed(() =>
  tasks.value.filter((t) => t.status === "success" || t.status === "failed" || t.status === "cancelled").slice(0, 12)
)
const activeCount = computed(() => runningTasks.value.length + queuedTasks.value.length)
const failedCount = computed(() => tasks.value.filter((t) => t.status === "failed").length)

function classifyKind(taskType: string, name: string): { kind: FloatTaskItem["kind"]; kindLabel: string } {
  const txt = `${taskType} ${name}`.toLowerCase()
  if (txt.includes("report") || txt.includes("报告") || txt.includes("export")) {
    return { kind: "export", kindLabel: "报告任务" }
  }
  if (txt.includes("publish") || txt.includes("发布")) {
    return { kind: "publish", kindLabel: "发布任务" }
  }
  return { kind: "generate", kindLabel: "制图任务" }
}

function mapStatus(raw: string): FloatTaskItem["status"] {
  const s = String(raw || "").toLowerCase()
  if (s === "accepted" || s === "queued" || s === "pending") {
    return "queued"
  }
  if (s === "running" || s === "processing" || s === "in_progress") {
    return "running"
  }
  if (s === "succeeded" || s === "completed" || s === "done" || s === "success") {
    return "success"
  }
  if (s === "cancelled" || s === "canceled") {
    return "cancelled"
  }
  return "failed"
}

function resolveDefaultStage(mapped: FloatTaskItem["status"]): string {
  if (mapped === "queued") {
    return "已受理排队中"
  }
  if (mapped === "running") {
    return "正在执行"
  }
  if (mapped === "success") {
    return "已完成"
  }
  if (mapped === "cancelled") {
    return "已取消"
  }
  return "执行失败"
}

function resolveDefaultProgress(mapped: FloatTaskItem["status"]): number {
  if (mapped === "success") {
    return 100
  }
  if (mapped === "running") {
    return 60
  }
  return 20
}

function pickStr(raw: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const val = raw[k]
    if (typeof val === "string" && val) {
      return val
    }
  }
  return undefined
}

function normalizeTaskPayload(raw: Record<string, unknown>): FloatTaskItem | null {
  const id = String(raw.taskId || raw.task_id || raw.id || "").trim()
  if (!id) {
    return null
  }
  const rawStatus = String(raw.status || "accepted")
  const mappedStatus = mapStatus(rawStatus)
  const name = String(raw.title || raw.name || raw.target_name || id).trim()
  const taskType = String(raw.taskType || raw.task_type || "")
  const { kind, kindLabel } = classifyKind(taskType, name)
  const defaultStage = resolveDefaultStage(mappedStatus)
  const stage = String(raw.stage || raw.current_step || defaultStage).trim() || defaultStage
  const rawProgress = Number(raw.progress)
  const progress = Number.isFinite(rawProgress)
    ? Math.max(0, Math.min(100, rawProgress))
    : resolveDefaultProgress(mappedStatus)
  const finishedRaw = String(raw.completedAt || raw.completed_at || raw.finishedAt || "")
  const finishedAt = finishedRaw.slice(11, 19) || finishedRaw || "刚刚"
  const startedAt = String(raw.startedAt || raw.started_at || "").slice(11, 19) || "刚刚开始"
  const downloadUrl = mappedStatus === "success" ? pickStr(raw, "downloadUrl", "download_url") : undefined
  const previewUrl = mappedStatus === "success" ? pickStr(raw, "previewUrl", "preview_url") : undefined
  const fileName = pickStr(raw, "fileName", "file_name")
  return {
    id,
    kind,
    kindLabel,
    name,
    rawStatus,
    status: mappedStatus,
    stage,
    progress,
    startedAt,
    finishedAt,
    downloadUrl,
    previewUrl,
    fileName,
    updatedAtMs: Date.now()
  }
}

function showNotice(title: string, message: string) {
  bubbleNotice.value = { title, message }
  if (noticeTimer) {
    window.clearTimeout(noticeTimer)
  }
  noticeTimer = window.setTimeout(() => {
    bubbleNotice.value = null
  }, 4000)
}

function upsertTask(item: FloatTaskItem, notify = false) {
  const idx = tasks.value.findIndex((t) => t.id === item.id)
  const prev = idx >= 0 ? tasks.value[idx] : null
  if (idx >= 0) {
    tasks.value.splice(idx, 1, { ...prev, ...item })
  } else {
    tasks.value.unshift(item)
  }
  if (notify && (!prev || prev.status !== item.status)) {
    if (item.status === "queued" || item.status === "running") {
      showNotice("耗时任务已启动", `${item.name}（${item.id}）`)
    } else if (item.status === "success") {
      showNotice("任务已完成", `${item.name} 已生成，可查看或下载`)
    } else if (item.status === "failed") {
      showNotice("任务执行失败", item.name)
    }
  }
}

function onTaskStatusEvent(event: Event) {
  const detail = (event as CustomEvent<Record<string, unknown>>).detail
  if (!detail || typeof detail !== "object") {
    return
  }
  const item = normalizeTaskPayload(detail)
  if (!item) {
    return
  }
  serviceReady.value = true
  updatedLabel.value = "刚刚更新"
  upsertTask(item, true)
}

async function fetchTasks() {
  if (typeof fetch !== "function") {
    return
  }
  const base = String(import.meta.env.VITE_HERMES_WEB_UI_URL || "http://192.168.10.15:6060").replace(/\/+$/, "")
  const controller = typeof AbortController === "function" ? new AbortController() : undefined
  const timeout = controller ? window.setTimeout(() => controller.abort(), 5000) : undefined
  try {
    const res = await fetch(`${base}/api/cui/tasks`, {
      cache: "no-store",
      ...(controller ? { signal: controller.signal } : {})
    })
    if (!res.ok) {
      return
    }
    const data = (await res.json()) as { tasks?: unknown[] }
    if (!Array.isArray(data?.tasks)) {
      return
    }
    serviceReady.value = true
    updatedLabel.value = "刚刚同步"
    for (const raw of data.tasks) {
      if (raw && typeof raw === "object") {
        const item = normalizeTaskPayload(raw as Record<string, unknown>)
        if (item) {
          upsertTask(item, false)
        }
      }
    }
  } catch {
    // 静默忽略网络未就绪或测试环境无后端的情况
  } finally {
    if (timeout) {
      window.clearTimeout(timeout)
    }
  }
}

const ballStyle = computed(() => {
  const clamped = clampPos(pos.value.x, pos.value.y)
  return {
    left: `${clamped.x}px`,
    top: `${clamped.y}px`
  }
})

const noticeStyle = computed(() => {
  const clamped = clampPos(pos.value.x, pos.value.y)
  return {
    left: `${Math.max(MARGIN, clamped.x - 240)}px`,
    top: `${Math.max(MARGIN, clamped.y - 54)}px`
  }
})

const drawerStyle = computed(() => {
  const clamped = clampPos(pos.value.x, pos.value.y)
  const drawerWidth = Math.min(376, Math.max(0, viewport.value.w - MARGIN * 2))
  const drawerHeight = 560
  const gap = 12
  const rightSideLeft = clamped.x + SIZE + gap
  const leftSideLeft = clamped.x - drawerWidth - gap
  const left = rightSideLeft + drawerWidth + MARGIN <= viewport.value.w ? rightSideLeft : Math.max(MARGIN, leftSideLeft)
  const top = Math.min(Math.max(MARGIN, clamped.y - 12), Math.max(MARGIN, viewport.value.h - drawerHeight - MARGIN))
  return {
    left: `${left}px`,
    top: `${top}px`
  }
})

function getDefaultPos(w: number, h: number) {
  return {
    x: Math.max(MARGIN, w - SIZE - MARGIN - 80),
    y: Math.max(MARGIN, h - SIZE - MARGIN - 120)
  }
}

function getStoredPos(): { x: number; y: number } {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return getDefaultPos(viewport.value.w, viewport.value.h)
  }
  try {
    const parsed = JSON.parse(raw)
    const x = Number(parsed?.x)
    const y = Number(parsed?.y)
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return getDefaultPos(viewport.value.w, viewport.value.h)
    }
    return { x, y }
  } catch {
    return getDefaultPos(viewport.value.w, viewport.value.h)
  }
}

function setStoredPos(next: { x: number; y: number }) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}

function clampPos(x: number, y: number) {
  const maxX = Math.max(MARGIN, viewport.value.w - SIZE - MARGIN)
  const maxY = Math.max(MARGIN, viewport.value.h - SIZE - MARGIN)
  return {
    x: Math.min(maxX, Math.max(MARGIN, x)),
    y: Math.min(maxY, Math.max(MARGIN, y))
  }
}

let dragStart = { x: 0, y: 0 }
let dragStartPos = { x: 0, y: 0 }
let moved = false

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) {
    return
  }
  e.preventDefault()
  dragging.value = true
  moved = false
  dragStart = { x: e.clientX, y: e.clientY }
  dragStartPos = { ...clampPos(pos.value.x, pos.value.y) }
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  window.addEventListener("pointermove", onPointerMove)
  window.addEventListener("pointerup", onPointerUp, { once: true })
}

function onPointerMove(e: PointerEvent) {
  if (!dragging.value) {
    return
  }
  const dx = e.clientX - dragStart.x
  const dy = e.clientY - dragStart.y
  if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
    moved = true
  }
  pos.value = clampPos(dragStartPos.x + dx, dragStartPos.y + dy)
}

function onPointerUp() {
  dragging.value = false
  window.removeEventListener("pointermove", onPointerMove)
  if (moved) {
    const next = clampPos(pos.value.x, pos.value.y)
    pos.value = next
    setStoredPos(next)
    return
  }
  drawerOpen.value = !drawerOpen.value
  if (drawerOpen.value) {
    fetchTasks().catch(() => undefined)
  }
}

let resizeRaf = 0
function onViewportResize() {
  if (resizeRaf) {
    cancelAnimationFrame(resizeRaf)
  }
  resizeRaf = requestAnimationFrame(() => {
    viewport.value = { w: window.innerWidth, h: window.innerHeight }
    pos.value = clampPos(pos.value.x, pos.value.y)
    setStoredPos(pos.value)
  })
}

onMounted(() => {
  window.addEventListener("resize", onViewportResize)
  window.addEventListener("cui-task-status", onTaskStatusEvent)
  pos.value = clampPos(pos.value.x, pos.value.y)
  fetchTasks().catch(() => undefined)
  pollTimer = window.setInterval(() => {
    if (drawerOpen.value || activeCount.value > 0) {
      fetchTasks().catch(() => undefined)
    }
  }, 6000)
})

onUnmounted(() => {
  window.removeEventListener("resize", onViewportResize)
  window.removeEventListener("cui-task-status", onTaskStatusEvent)
  window.removeEventListener("pointermove", onPointerMove)
  if (resizeRaf) {
    cancelAnimationFrame(resizeRaf)
  }
  if (noticeTimer) {
    window.clearTimeout(noticeTimer)
  }
  if (pollTimer) {
    window.clearInterval(pollTimer)
  }
})
</script>

<style scoped>
.map-float-ball {
  position: fixed;
  z-index: 1200;
  width: 52px;
  height: 52px;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 999px;
  cursor: grab;
  touch-action: none;
  user-select: none;
  background: linear-gradient(145deg, #42a5ff 0%, var(--color-primary, #2d8cf0) 52%, #176dcc 100%);
  box-shadow: 0 8px 24px rgba(45, 140, 240, 0.42), inset 0 1px 0 rgba(255, 255, 255, 0.26);
  transition: box-shadow 0.18s ease, transform 0.18s ease, background 0.18s ease;
}

.map-float-ball:hover {
  transform: scale(1.04);
  background: var(--color-primary, #2d8cf0);
  box-shadow: 0 8px 20px rgba(45, 140, 240, 0.5);
}

.ball-core {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
}

.ball-core__ring {
  position: absolute;
  width: 28px;
  height: 28px;
  border: 3px solid rgba(255, 255, 255, 0.94);
  border-right-color: rgba(255, 255, 255, 0.34);
  border-radius: 50%;
  transform: rotate(-36deg);
}

.ball-core__bars {
  position: relative;
  width: 14px;
  height: 13px;
  border-bottom: 2px solid rgba(255, 255, 255, 0.9);
}

.ball-core__bars::before,
.ball-core__bars::after {
  content: "";
  position: absolute;
  bottom: 2px;
  width: 3px;
  border-radius: 3px 3px 1px 1px;
  background: #ffffff;
}

.ball-core__bars::before {
  left: 2px;
  height: 6px;
  box-shadow: 5px -4px 0 #ffffff, 10px -8px 0 #ffffff;
}

.map-float-ball__badge {
  position: absolute;
  top: -5px;
  right: -4px;
  display: grid;
  place-items: center;
  min-width: 21px;
  height: 21px;
  padding: 0 5px;
  border: 2px solid #17243a;
  border-radius: 999px;
  background: #ff5964;
  color: #ffffff;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  box-shadow: 0 4px 10px rgba(255, 89, 100, 0.4);
}

.map-float-ball.has-running-tasks:not(.is-open):not(.is-dragging)::before {
  content: "";
  position: absolute;
  inset: -6px;
  border: 1px solid rgba(74, 169, 255, 0.5);
  border-radius: inherit;
  animation: task-bubble-pulse 2.2s ease-out infinite;
}

@keyframes task-bubble-pulse {
  0% { opacity: 0.72; transform: scale(0.9); }
  72%, 100% { opacity: 0; transform: scale(1.24); }
}

.map-float-ball:focus-visible {
  outline: 2px solid rgba(147, 197, 253, 0.95);
  outline-offset: 3px;
}

.map-float-ball.is-dragging {
  cursor: grabbing;
  transform: scale(1.06);
  transition: none;
}

.map-float-ball.is-open {
  box-shadow: 0 10px 24px rgba(45, 140, 240, 0.52);
}

.map-float-ball__notice {
  position: fixed;
  z-index: 1201;
  max-width: 260px;
  padding: 8px 12px;
  border: 1px solid rgba(92, 173, 255, 0.42);
  border-radius: 12px;
  background: rgba(17, 29, 49, 0.94);
  color: #ffffff;
  font-size: 12px;
  box-shadow: 0 12px 32px rgba(4, 12, 27, 0.35);
}

.map-float-ball__notice strong {
  display: block;
  color: #75bfff;
  font-size: 11px;
  margin-bottom: 2px;
}

.task-center-drawer {
  position: fixed;
  z-index: 1199;
  width: min(376px, calc(100vw - 32px));
  max-height: min(620px, calc(100vh - 32px));
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 18px;
  background: linear-gradient(160deg, rgba(28, 44, 70, 0.96), rgba(17, 29, 49, 0.96));
  box-shadow: 0 24px 64px rgba(4, 12, 27, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(18px);
  display: flex;
  flex-direction: column;
}

.task-center-drawer__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 18px 13px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.task-center-drawer__eyebrow {
  margin: 0 0 2px;
  color: #75bfff;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.task-center-drawer__header h3 {
  margin: 0;
  color: #ffffff;
  font-size: 16px;
  font-weight: 600;
}

.task-center-drawer__close {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
  cursor: pointer;
}

.task-center-drawer__close:hover {
  background: rgba(255, 255, 255, 0.16);
}

.task-center-summary {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) auto;
  gap: 11px;
  align-items: center;
  margin: 14px 14px 0;
  padding: 13px 14px;
  border: 1px solid rgba(92, 173, 255, 0.24);
  border-radius: 15px;
  background: linear-gradient(135deg, rgba(45, 140, 240, 0.2), rgba(45, 140, 240, 0.08));
}

.task-center-summary__signal {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 3px;
  padding-bottom: 10px;
  background: rgba(45, 140, 240, 0.28);
}

.task-center-summary__signal span {
  display: block;
  width: 3px;
  border-radius: 3px;
  background: #75bfff;
  animation: task-signal 1.1s ease-in-out infinite alternate;
}

.task-center-summary__signal span:nth-child(1) { height: 7px; }
.task-center-summary__signal span:nth-child(2) { height: 13px; animation-delay: 0.18s; }
.task-center-summary__signal span:nth-child(3) { height: 10px; animation-delay: 0.36s; }

@keyframes task-signal {
  from { opacity: 0.45; transform: scaleY(0.7); }
  to { opacity: 1; transform: scaleY(1); }
}

.task-center-summary strong {
  display: block;
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
}

.task-center-summary p {
  margin: 3px 0 0;
  color: rgba(255, 255, 255, 0.68);
  font-size: 11px;
}

.task-center-summary__updated {
  color: rgba(255, 255, 255, 0.58);
  font-size: 11px;
  white-space: nowrap;
}

.task-center-drawer__body {
  display: grid;
  gap: 18px;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 14px 14px;
  scrollbar-width: thin;
  scrollbar-color: rgba(117, 191, 255, 0.35) transparent;
}

.task-section {
  display: grid;
  gap: 9px;
}

.task-section__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 20px;
}

.task-section__title-row h4 {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  color: rgba(255, 255, 255, 0.92);
  font-size: 12px;
  font-weight: 600;
}

.task-section__title-row > span {
  color: rgba(255, 255, 255, 0.42);
  font-size: 11px;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.status-dot.is-running {
  background: #4aa9ff;
  box-shadow: 0 0 0 4px rgba(74, 169, 255, 0.12);
}

.status-dot.is-queued {
  background: #aab7c8;
}

.task-running-card {
  padding: 13px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.055);
}

.task-running-card__top,
.task-running-card__stage,
.task-running-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.task-kind {
  display: inline-flex;
  align-items: center;
  min-height: 20px;
  padding: 2px 7px;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 600;
}

.task-kind.is-generate { color: #8fcbff; background: rgba(45, 140, 240, 0.16); }
.task-kind.is-publish { color: #b6a5ff; background: rgba(130, 105, 255, 0.16); }
.task-kind.is-export { color: #78dfc5; background: rgba(49, 190, 155, 0.14); }

.task-running-card__time {
  color: rgba(255, 255, 255, 0.42);
  font-size: 10px;
}

.task-running-card h5 {
  margin: 9px 0 11px;
  overflow: hidden;
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-running-card__stage {
  color: rgba(255, 255, 255, 0.7);
  font-size: 11px;
}

.task-running-card__stage strong {
  color: #8fcbff;
  font-size: 12px;
}

.task-progress-track {
  position: relative;
  height: 6px;
  margin: 7px 0 9px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.09);
}

.task-progress-track > span {
  position: relative;
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #2d8cf0, #70c5ff);
  box-shadow: 0 0 10px rgba(74, 169, 255, 0.4);
}

.task-progress-track > span::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.42), transparent);
  transform: translateX(-100%);
  animation: task-progress-shimmer 2.1s ease-in-out infinite;
}

@keyframes task-progress-shimmer {
  to { transform: translateX(100%); }
}

.task-running-card__footer {
  color: rgba(255, 255, 255, 0.46);
  font-size: 10px;
}

.live-indicator {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.live-indicator i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #4aa9ff;
  box-shadow: 0 0 0 3px rgba(74, 169, 255, 0.12);
}

.task-queued {
  padding-top: 2px;
}

.queued-task-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 9px;
  align-items: center;
  padding: 9px 10px;
  border: 1px dashed rgba(255, 255, 255, 0.1);
  border-radius: 11px;
  background: rgba(255, 255, 255, 0.025);
}

.queued-task-row__name {
  overflow: hidden;
  color: rgba(255, 255, 255, 0.76);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.queued-task-row__status {
  color: rgba(255, 255, 255, 0.38);
  font-size: 10px;
}

.recent-task-list {
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 13px;
  background: rgba(255, 255, 255, 0.035);
}

.recent-task-row {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) auto;
  gap: 9px;
  align-items: center;
  padding: 10px 11px;
}

.recent-task-row + .recent-task-row {
  border-top: 1px solid rgba(255, 255, 255, 0.07);
}

.recent-task-row__icon {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 700;
}

.recent-task-row__icon.is-success { color: #72dfb7; background: rgba(52, 199, 143, 0.13); }
.recent-task-row__icon.is-failed,
.recent-task-row__icon.is-cancelled { color: #ff8992; background: rgba(255, 89, 100, 0.13); }

.recent-task-row__content {
  min-width: 0;
}

.recent-task-row__content strong,
.recent-task-row__content span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent-task-row__content strong {
  color: rgba(255, 255, 255, 0.88);
  font-size: 11px;
  font-weight: 500;
}

.recent-task-row__content span,
.recent-task-row time {
  margin-top: 2px;
  color: rgba(255, 255, 255, 0.4);
  font-size: 9px;
}

.recent-task-row__links {
  display: flex;
  gap: 10px;
  margin-top: 4px;
}

.recent-task-row__links a {
  color: #75bfff;
  font-size: 11px;
  text-decoration: underline;
}

.recent-task-empty {
  padding: 12px;
  border: 1px dashed rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  color: rgba(255, 255, 255, 0.56);
  font-size: 11px;
}

.recent-task-row time {
  margin-top: 0;
  white-space: nowrap;
}

.task-center-drawer__footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 14px 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  color: rgba(255, 255, 255, 0.34);
  font-size: 12px;
}

.placeholder-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.32);
}

.placeholder-dot.is-live {
  background: #34c78f;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (prefers-reduced-motion: reduce) {
  .map-float-ball.has-running-tasks::before,
  .task-center-summary__signal span,
  .task-progress-track > span::after {
    animation: none;
  }
}
</style>
