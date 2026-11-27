import { afterEach, describe, expect, it, vi } from "vitest"
import { commandBus } from "@/core/commandBus"
import { initSatelliteBridge } from "@/cui-bridge/hostBridge"
import { satelliteChannel, satelliteProtocolVersion } from "@/cui-bridge/protocol"

describe("satellite host bridge", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function dispatch(source: Window, origin: string, data: unknown) {
    const event = new MessageEvent("message", { data, origin })
    Object.defineProperty(event, "source", { value: source })
    window.dispatchEvent(event)
  }

  it("echoes CUI dynamic instanceId across ready and cmd.result and forwards task.status & ui.toast", async () => {
    const ready = vi.fn()
    const onTaskStatus = vi.fn()
    const onToast = vi.fn()
    const onExecuted = vi.fn()
    commandBus.register("map.locate", () => ({ success: true, data: { locateStatus: "succeeded", target: "ALT-SC-001" } }))
    const target = { postMessage: vi.fn() } as unknown as Window
    const cuiId = "uuid-cui-1234"
    const dispose = initSatelliteBridge(() => target, "http://192.168.10.15:6060", {
      onReady: ready,
      onCommandExecuted: onExecuted,
      onTaskStatus,
      onToast
    })

    dispatch(target, "http://192.168.10.15:6060", {
      channel: satelliteChannel,
      version: satelliteProtocolVersion,
      instanceId: cuiId,
      type: "cui.ready",
      payload: {}
    })
    expect(ready).toHaveBeenCalledWith(cuiId)

    dispatch(target, "http://192.168.10.15:6060", {
      channel: satelliteChannel,
      version: satelliteProtocolVersion,
      instanceId: cuiId,
      type: "cmd.execute",
      requestId: "REQ-1",
      payload: { command: "map.locate", arguments: { target: "ALT-SC-001" } }
    })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(target.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      channel: satelliteChannel,
      instanceId: cuiId,
      type: "cmd.result",
      requestId: "REQ-1",
      payload: { command: "map.locate", success: true, data: { locateStatus: "succeeded", target: "ALT-SC-001" } }
    }), "http://192.168.10.15:6060")
    expect(onExecuted).toHaveBeenCalledOnce()

    dispatch(target, "http://192.168.10.15:6060", {
      channel: satelliteChannel,
      version: satelliteProtocolVersion,
      instanceId: cuiId,
      type: "task.status",
      payload: { task_id: "TSK-RPT-1", status: "succeeded", download_url: "http://192.168.10.15:9002/x.docx" }
    })
    dispatch(target, "http://192.168.10.15:6060", {
      channel: satelliteChannel,
      version: satelliteProtocolVersion,
      instanceId: cuiId,
      type: "ui.toast",
      payload: { level: "success", title: "完成", message: "报告已生成" }
    })
    expect(onTaskStatus).toHaveBeenCalledOnce()
    expect(onToast).toHaveBeenCalledOnce()
    dispose()
  })

  it("ignores a satellite command from another origin", async () => {
    const handler = vi.fn(() => ({ success: true as const }))
    commandBus.register("panel.open", handler)
    const target = { postMessage: vi.fn() } as unknown as Window
    const dispose = initSatelliteBridge(() => target, "http://192.168.10.15:6060")

    dispatch(target, "http://attacker.example", {
      channel: satelliteChannel,
      version: satelliteProtocolVersion,
      type: "cmd.execute",
      payload: { command: "panel.open", arguments: { name: "judgment", target: "ALT-SC-001" } }
    })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(handler).not.toHaveBeenCalled()
    expect(target.postMessage).not.toHaveBeenCalled()
    dispose()
  })
})
