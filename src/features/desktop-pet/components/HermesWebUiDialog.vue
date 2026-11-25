<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="hermes-dialog-backdrop"
      data-hermes-dialog-backdrop
    >
      <section
        class="hermes-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hermes-dialog-title"
      >
        <header class="hermes-dialog-header">
          <h2 id="hermes-dialog-title">Hermes Web UI</h2>
          <div class="hermes-dialog-actions">
            <button type="button" aria-label="关闭 Hermes" title="关闭" @click="emit('close')">×</button>
          </div>
        </header>

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
import { currentHostInit, initSatelliteBridge } from "@/cui-bridge/hostBridge"
import { initShellBridge } from "@/cui-bridge/shellBridge"

const props = defineProps<{
  open: boolean
  src: string
}>()

const emit = defineEmits<{
  close: []
}>()

const frameRef = ref<HTMLIFrameElement | null>(null)
const hermesCommands = new Set(["route.navigate", "ui.panel.open", "ui.panel.close"])
let disposeBridge: null | (() => void) = null
let disposeSatelliteBridge: null | (() => void) = null
let satelliteReady = false
let allowedOrigin = ""

function postHostInit() {
  const target = frameRef.value?.contentWindow
  if (!props.open || !satelliteReady || !target || !allowedOrigin) {
    return
  }
  target.postMessage(currentHostInit(), allowedOrigin)
}

function disconnectBridge() {
  disposeBridge?.()
  disposeSatelliteBridge?.()
  disposeBridge = null
  disposeSatelliteBridge = null
  satelliteReady = false
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
  disposeSatelliteBridge = initSatelliteBridge(getWindow, allowedOrigin, () => {
    satelliteReady = true
    postHostInit()
  })
}

watch(
  [() => props.open, () => props.src],
  async ([open]) => {
    disconnectBridge()
    if (!open) {
      return
    }
    await nextTick()
    if (props.open) {
      connectBridge()
    }
  },
  { immediate: true }
)

function onHostContextChange() {
  postHostInit()
}

onMounted(() => {
  window.addEventListener("themeChange", onHostContextChange)
  window.addEventListener("cui-host-context", onHostContextChange)
})

onBeforeUnmount(() => {
  window.removeEventListener("themeChange", onHostContextChange)
  window.removeEventListener("cui-host-context", onHostContextChange)
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
}

.hermes-dialog-header {
  display: flex;
  flex: 0 0 48px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 10px 0 18px;
  color: #17202a;
  background: #ffffff;
  border-bottom: 1px solid #dce2e8;
}

.hermes-dialog-header h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.hermes-dialog-actions {
  display: flex;
  gap: 4px;
}

.hermes-dialog-actions button {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 7px;
  color: #34495e;
  background: transparent;
  font: inherit;
  font-size: 20px;
  cursor: pointer;
}

.hermes-dialog-actions button:hover {
  background: #edf1f5;
}

.hermes-dialog-actions button:focus-visible {
  outline: 2px solid #409eff;
  outline-offset: 1px;
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

@media (max-width: 720px) {
  .hermes-dialog-backdrop {
    padding: 0;
  }

  .hermes-dialog {
    width: 100vw;
    height: 100vh;
    border: 0;
    border-radius: 0;
  }
}
</style>
