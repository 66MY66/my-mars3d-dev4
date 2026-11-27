<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="hermes-dialog-backdrop"
      :class="{ 'is-docked': docked, 'is-dark': hostTheme === 'dark' }"
      data-hermes-dialog-backdrop
      :data-theme="hostTheme"
    >
      <section
        class="hermes-dialog"
        :class="{ 'is-docked': docked, 'is-dark': hostTheme === 'dark' }"
        role="dialog"
        :aria-modal="docked ? 'false' : 'true'"
        aria-labelledby="hermes-dialog-title"
      >
        <header class="hermes-dialog-header">
          <div class="hermes-dialog-title-wrap">
            <h2 id="hermes-dialog-title">Hermes Web UI</h2>
            <span v-if="docked" class="hermes-dock-badge">三端联动停靠中</span>
          </div>
          <div class="hermes-dialog-actions">
            <button
              type="button"
              class="hermes-dock-toggle"
              :aria-label="docked ? '居中展开' : '侧边停靠'"
              :title="docked ? '居中展开' : '侧边停靠，查看右侧地图与面板'"
              @click="docked = !docked"
            >
              {{ docked ? "展开" : "停靠" }}
            </button>
            <button type="button" aria-label="关闭 Hermes" title="关闭" @click="emit('close')">×</button>
          </div>
        </header>

        <div v-if="toastNotice" class="hermes-host-toast" :class="`is-${toastNotice.level}`" role="status">
          <strong>{{ toastNotice.title }}</strong>
          <span>{{ toastNotice.message }}</span>
        </div>

        <div class="hermes-dialog-body">
          <iframe
            ref="frameRef"
            class="hermes-dialog-frame"
            :src="src"
            title="Hermes Web UI"
            allow="autoplay; clipboard-read; clipboard-write; fullscreen; microphone"
            allowfullscreen
            @load="connectBridge"
          ></iframe>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue"
import {
  buildHostContext,
  buildHostTheme,
  currentHostInit,
  initSatelliteBridge
} from "@/cui-bridge/hostBridge"
import { getHostContext } from "@/cui-bridge/hostContext"
import { hostInstanceId } from "@/cui-bridge/protocol"
import { initShellBridge } from "@/cui-bridge/shellBridge"
import { getCurrentTheme } from "@/shell/theme"

const props = defineProps<{
  open: boolean
  src: string
}>()

const emit = defineEmits<{
  close: []
}>()

const frameRef = ref<HTMLIFrameElement | null>(null)
const docked = ref(false)
const hostTheme = ref<"light" | "dark">(getCurrentTheme())
const toastNotice = ref<{ level: string; title: string; message: string } | null>(null)
const hermesCommands = new Set(["route.navigate", "ui.panel.open", "ui.panel.close"])
let disposeBridge: null | (() => void) = null
let disposeSatelliteBridge: null | (() => void) = null
let satelliteReady = false
let allowedOrigin = ""
let peerInstanceId: string = hostInstanceId
let toastTimer: number | undefined

function showHostToast(payload: Record<string, unknown>) {
  const message = typeof payload.message === "string" ? payload.message.trim() : ""
  if (!message) {
    return
  }
  const title = typeof payload.title === "string" && payload.title.trim() ? payload.title.trim() : "任务提醒"
  const level = typeof payload.level === "string" && payload.level.trim() ? payload.level.trim() : "info"
  toastNotice.value = { level, title, message }
  if (toastTimer) {
    window.clearTimeout(toastTimer)
  }
  toastTimer = window.setTimeout(() => {
    toastNotice.value = null
  }, 4000)
}

function safePostToCui(envelope: unknown) {
  const frame = frameRef.value
  const target = frame?.contentWindow
  if (!props.open || !satelliteReady || !frame?.isConnected || !target || !allowedOrigin) {
    return
  }
  try {
    target.postMessage(envelope, allowedOrigin)
  } catch {
    // 忽略 iframe 卸载瞬间或跨域就绪前的瞬态异常
  }
}

function postHostInit() {
  safePostToCui(currentHostInit(peerInstanceId))
}

function postHostTheme() {
  safePostToCui(buildHostTheme(hostTheme.value, peerInstanceId))
}

function postHostContext() {
  safePostToCui(buildHostContext(getHostContext(), peerInstanceId))
}

function disconnectBridge() {
  disposeBridge?.()
  disposeSatelliteBridge?.()
  disposeBridge = null
  disposeSatelliteBridge = null
  satelliteReady = false
  peerInstanceId = hostInstanceId
}

function connectBridge() {
  disconnectBridge()
  const targetWindow = frameRef.value?.contentWindow ?? null
  if (!props.open || !targetWindow) {
    return
  }
  try {
    allowedOrigin = new URL(props.src, window.location.href).origin
  } catch {
    return
  }
  const getWindow = () => frameRef.value?.contentWindow ?? null
  disposeBridge = initShellBridge(getWindow, allowedOrigin, hermesCommands)
  disposeSatelliteBridge = initSatelliteBridge(getWindow, allowedOrigin, {
    onReady(id) {
      peerInstanceId = id || hostInstanceId
      satelliteReady = true
      postHostInit()
    },
    onCommandExecuted(command, result) {
      if (result?.success && (command === "map.locate" || command === "panel.open")) {
        docked.value = true
      }
    },
    onToast(payload) {
      showHostToast(payload)
    }
  })
}

watch(
  [() => props.open, () => props.src],
  async ([open]) => {
    disconnectBridge()
    if (!open) {
      docked.value = false
      toastNotice.value = null
      return
    }
    hostTheme.value = getCurrentTheme()
    await nextTick()
    if (props.open) {
      connectBridge()
    }
  },
  { immediate: true }
)

function onThemeChange() {
  hostTheme.value = getCurrentTheme()
  postHostTheme()
}

function onHostContextChange() {
  postHostContext()
}

function onHostToastEvent(event: Event) {
  const detail = (event as CustomEvent<Record<string, unknown>>).detail
  if (detail && typeof detail === "object") {
    showHostToast(detail)
  }
}

onMounted(() => {
  window.addEventListener("themeChange", onThemeChange)
  window.addEventListener("cui-host-context", onHostContextChange)
  window.addEventListener("cui-host-toast", onHostToastEvent)
})

onBeforeUnmount(() => {
  window.removeEventListener("themeChange", onThemeChange)
  window.removeEventListener("cui-host-context", onHostContextChange)
  window.removeEventListener("cui-host-toast", onHostToastEvent)
  if (toastTimer) {
    window.clearTimeout(toastTimer)
  }
  disconnectBridge()
})
</script>

<style scoped>
.hermes-dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 3200;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(5, 14, 25, 0.58);
  backdrop-filter: blur(4px);
}

.hermes-dialog-backdrop.is-docked {
  display: flex;
  justify-content: flex-start;
  align-items: stretch;
  padding: 68px 14px 14px;
  background: transparent;
  backdrop-filter: none;
  pointer-events: none;
}

.hermes-dialog {
  display: flex;
  flex-direction: column;
  width: min(1440px, 94vw);
  height: min(920px, 92vh);
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 14px;
  background: #f5f7fa;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
  pointer-events: auto;
  transition: width 0.2s ease, height 0.2s ease;
}

.hermes-dialog.is-docked {
  width: min(460px, 38vw);
  min-width: 340px;
  height: calc(100vh - 82px);
  border-color: rgba(45, 140, 240, 0.38);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.32);
}

.hermes-dialog.is-dark {
  background: #121926;
  border-color: rgba(148, 163, 184, 0.25);
}

.hermes-dialog-header {
  display: flex;
  flex: 0 0 48px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 10px 0 16px;
  color: #17202a;
  background: #ffffff;
  border-bottom: 1px solid #dce2e8;
}

.hermes-dialog.is-dark .hermes-dialog-header {
  color: #e2e8f0;
  background: #172030;
  border-bottom-color: rgba(148, 163, 184, 0.2);
}

.hermes-dialog-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.hermes-dialog-header h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.hermes-dock-badge {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 999px;
  color: #2d8cf0;
  background: rgba(45, 140, 240, 0.14);
}

.hermes-dialog-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.hermes-dialog-actions button {
  display: grid;
  min-width: 34px;
  height: 32px;
  place-items: center;
  padding: 0 8px;
  border: 0;
  border-radius: 7px;
  color: #34495e;
  background: transparent;
  font: inherit;
  font-size: 18px;
  cursor: pointer;
}

.hermes-dialog-actions .hermes-dock-toggle {
  font-size: 12px;
  font-weight: 500;
  border: 1px solid rgba(100, 116, 139, 0.28);
}

.hermes-dialog.is-dark .hermes-dialog-actions button {
  color: #cbd5e1;
}

.hermes-dialog-actions button:hover {
  background: #edf1f5;
}

.hermes-dialog.is-dark .hermes-dialog-actions button:hover {
  background: rgba(148, 163, 184, 0.16);
}

.hermes-dialog-actions button:focus-visible {
  outline: 2px solid #409eff;
  outline-offset: 1px;
}

.hermes-host-toast {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  font-size: 12px;
  color: #0f172a;
  background: #e0f2fe;
  border-bottom: 1px solid #bae6fd;
}

.hermes-host-toast.is-success {
  background: #dcfce7;
  border-bottom-color: #bbf7d0;
}

.hermes-host-toast.is-error {
  background: #fee2e2;
  border-bottom-color: #fecaca;
}

.hermes-dialog.is-dark .hermes-host-toast {
  color: #e2e8f0;
  background: #1e293b;
  border-bottom-color: rgba(56, 189, 248, 0.35);
}

.hermes-dialog-body {
  position: relative;
  flex: 1;
  min-height: 0;
}

.hermes-dialog-frame {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  background: #ffffff;
}

.hermes-dialog.is-dark .hermes-dialog-frame {
  background: #0f172a;
}

@media (max-width: 720px) {
  .hermes-dialog-backdrop,
  .hermes-dialog-backdrop.is-docked {
    padding: 0;
  }

  .hermes-dialog,
  .hermes-dialog.is-docked {
    width: 100vw;
    height: 100vh;
    border: 0;
    border-radius: 0;
  }
}
</style>
