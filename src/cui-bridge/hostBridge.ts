import { commandBus } from "@/core/commandBus"
import { getHostContext } from "@/cui-bridge/hostContext"
import {
  getCurrentTheme
} from "@/shell/theme"
import {
  hostInstanceId,
  hostProjectName,
  satelliteChannel,
  satelliteProtocolVersion,
  type HostContext,
  type SatelliteEnvelope
} from "@/cui-bridge/protocol"

const hostCommands = new Set(["map.locate", "panel.open"])

export function buildHostInit(theme: "light" | "dark", context: HostContext): SatelliteEnvelope {
  return {
    channel: satelliteChannel,
    version: satelliteProtocolVersion,
    instanceId: hostInstanceId,
    type: "host.init",
    payload: {
      theme,
      projectName: hostProjectName,
      capabilities: ["map.locate", "panel.open"],
      context
    }
  }
}

export function currentHostInit(): SatelliteEnvelope {
  return buildHostInit(getCurrentTheme(), getHostContext())
}

function nextRequestId() {
  return `HOST-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function initSatelliteBridge(
  getCuiWindow: () => Window | null,
  allowedOrigin = window.location.origin,
  onReady?: () => void
) {
  async function onMessage(evt: MessageEvent) {
    const targetWindow = getCuiWindow()
    if (!targetWindow || evt.source !== targetWindow || evt.origin !== allowedOrigin) {
      return
    }
    const msg = evt.data as Partial<SatelliteEnvelope>
    if (!msg || msg.channel !== satelliteChannel || msg.version !== satelliteProtocolVersion) {
      return
    }
    if (msg.type === "cui.ready") {
      onReady?.()
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
        instanceId: hostInstanceId,
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
        instanceId: hostInstanceId,
        type: "cmd.result",
        requestId,
        payload: { command, success: false, error: "UNSUPPORTED_COMMAND: command is not allowed" }
      }, allowedOrigin)
      return
    }
    const result = await commandBus.execute(command, msg.payload?.arguments)
    const payload = result.success
      ? { command, success: true, data: result.data }
      : { command, success: false, error: result.error }
    targetWindow.postMessage({
      channel: satelliteChannel,
      version: satelliteProtocolVersion,
      instanceId: hostInstanceId,
      type: "cmd.result",
      requestId,
      payload
    }, allowedOrigin)
  }

  window.addEventListener("message", onMessage)
  return () => {
    window.removeEventListener("message", onMessage)
  }
}
