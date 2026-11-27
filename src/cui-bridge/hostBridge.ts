import { commandBus } from "@/core/commandBus"
import { getHostContext } from "@/cui-bridge/hostContext"
import { getCurrentTheme } from "@/shell/theme"
import {
  hostInstanceId,
  hostProjectName,
  satelliteChannel,
  satelliteProtocolVersion,
  type HostContext,
  type SatelliteEnvelope
} from "@/cui-bridge/protocol"

const hostCommands = new Set(["map.locate", "panel.open"])

export function buildHostInit(
  theme: "light" | "dark",
  context: HostContext,
  instanceId: string = hostInstanceId
): SatelliteEnvelope {
  return {
    channel: satelliteChannel,
    version: satelliteProtocolVersion,
    instanceId: instanceId || hostInstanceId,
    type: "host.init",
    payload: {
      theme,
      projectName: hostProjectName,
      capabilities: ["map.locate", "panel.open"],
      context
    }
  }
}

export function currentHostInit(instanceId: string = hostInstanceId): SatelliteEnvelope {
  return buildHostInit(getCurrentTheme(), getHostContext(), instanceId)
}

export function buildHostTheme(
  theme: "light" | "dark",
  instanceId: string = hostInstanceId
): SatelliteEnvelope {
  return {
    channel: satelliteChannel,
    version: satelliteProtocolVersion,
    instanceId: instanceId || hostInstanceId,
    type: "host.theme",
    payload: { theme }
  }
}

export function buildHostContext(
  context: HostContext,
  instanceId: string = hostInstanceId
): SatelliteEnvelope {
  return {
    channel: satelliteChannel,
    version: satelliteProtocolVersion,
    instanceId: instanceId || hostInstanceId,
    type: "host.context",
    payload: { context }
  }
}

function nextRequestId() {
  return `HOST-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export type SatelliteBridgeOptions = {
  onReady?: (instanceId: string) => void
  onCommandExecuted?: (command: string, result: any) => void
  onTaskStatus?: (payload: Record<string, unknown>) => void
  onToast?: (payload: Record<string, unknown>) => void
}

export function initSatelliteBridge(
  getCuiWindow: () => Window | null,
  allowedOrigin = window.location.origin,
  readyOrOptions?: ((instanceId?: string) => void) | SatelliteBridgeOptions
) {
  const options: SatelliteBridgeOptions =
    typeof readyOrOptions === "function" ? { onReady: readyOrOptions } : (readyOrOptions ?? {})
  let peerInstanceId: string = hostInstanceId

  async function onMessage(evt: MessageEvent) {
    const targetWindow = getCuiWindow()
    if (!targetWindow || evt.source !== targetWindow || evt.origin !== allowedOrigin) {
      return
    }
    const msg = evt.data as Partial<SatelliteEnvelope>
    if (!msg || msg.channel !== satelliteChannel || msg.version !== satelliteProtocolVersion) {
      return
    }
    if (typeof msg.instanceId === "string" && msg.instanceId.trim()) {
      peerInstanceId = msg.instanceId.trim()
    }
    if (msg.type === "cui.ready") {
      options.onReady?.(peerInstanceId)
      return
    }
    if (msg.type === "task.status") {
      const detail = (msg.payload && typeof msg.payload === "object" ? msg.payload : {}) as Record<string, unknown>
      window.dispatchEvent(new CustomEvent("cui-task-status", { detail }))
      options.onTaskStatus?.(detail)
      return
    }
    if (msg.type === "ui.toast") {
      const detail = (msg.payload && typeof msg.payload === "object" ? msg.payload : {}) as Record<string, unknown>
      window.dispatchEvent(new CustomEvent("cui-host-toast", { detail }))
      options.onToast?.(detail)
      return
    }
    if (msg.type === "cui.initialized" || msg.type === "cui.theme.applied") {
      return
    }
    if (msg.type !== "cmd.execute") {
      return
    }
    const command = typeof msg.payload?.command === "string" ? msg.payload.command : ""
    const requestId = msg.requestId || nextRequestId()
    if (!command) {
      targetWindow.postMessage({
        channel: satelliteChannel,
        version: satelliteProtocolVersion,
        instanceId: peerInstanceId,
        type: "cmd.result",
        requestId,
        payload: { command: "", success: false, error: "缺少command" }
      }, allowedOrigin)
      return
    }
    if (!hostCommands.has(command)) {
      targetWindow.postMessage({
        channel: satelliteChannel,
        version: satelliteProtocolVersion,
        instanceId: peerInstanceId,
        type: "cmd.result",
        requestId,
        payload: { command, success: false, error: "UNSUPPORTED_COMMAND: command is not allowed" }
      }, allowedOrigin)
      return
    }
    const result = await commandBus.execute(command, msg.payload?.arguments)
    const payload = result.success
      ? { command, success: true, data: result.data }
      : { command, success: false, error: "error" in result ? result.error : "指令执行失败" }
    targetWindow.postMessage({
      channel: satelliteChannel,
      version: satelliteProtocolVersion,
      instanceId: peerInstanceId,
      type: "cmd.result",
      requestId,
      payload
    }, allowedOrigin)
    if (result.success) {
      options.onCommandExecuted?.(command, result)
    }
  }

  window.addEventListener("message", onMessage)
  return () => {
    window.removeEventListener("message", onMessage)
  }
}
