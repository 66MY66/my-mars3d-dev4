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

  it("answers cui.ready through the ready callback and executes map.locate", async () => {
    const ready = vi.fn()
    commandBus.register("map.locate", () => ({ success: true, data: { locateStatus: "succeeded", target: "ALT-SC-001" } }))
    const target = { postMessage: vi.fn() } as unknown as Window
    const dispose = initSatelliteBridge(() => target, "http://192.168.10.15:6060", ready)

    dispatch(target, "http://192.168.10.15:6060", {
      channel: satelliteChannel,
      version: satelliteProtocolVersion,
      instanceId: "cui-main",
      type: "cui.ready",
      payload: {}
    })
    expect(ready).toHaveBeenCalledOnce()

    dispatch(target, "http://192.168.10.15:6060", {
      channel: satelliteChannel,
      version: satelliteProtocolVersion,
      instanceId: "cui-main",
      type: "cmd.execute",
      requestId: "REQ-1",
      payload: { command: "map.locate", arguments: { target: "ALT-SC-001" } }
    })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(target.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      channel: satelliteChannel,
      type: "cmd.result",
      requestId: "REQ-1",
      payload: { command: "map.locate", success: true, data: { locateStatus: "succeeded", target: "ALT-SC-001" } }
    }), "http://192.168.10.15:6060")
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
