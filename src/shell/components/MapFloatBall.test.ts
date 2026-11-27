import { mount } from "@vue/test-utils"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { nextTick } from "vue"
import MapFloatBall from "./MapFloatBall.vue"

describe("MapFloatBall live task center", () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = ""
    Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
      configurable: true,
      value: vi.fn()
    })
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ tasks: [] }) }))
  })

  afterEach(() => {
    document.body.innerHTML = ""
    delete (HTMLElement.prototype as any).setPointerCapture
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("updates running and completed tasks from cui-task-status events and renders download links", async () => {
    const wrapper = mount(MapFloatBall, { attachTo: document.body })
    const ball = document.body.querySelector(".map-float-ball") as HTMLButtonElement

    window.dispatchEvent(new CustomEvent("cui-task-status", {
      detail: {
        task_id: "TSK-RPT-100",
        status: "running",
        title: "九寨沟热异常研判报告",
        current_step: "正在排版报告",
        progress: 65
      }
    }))
    await nextTick()

    expect(ball.classList.contains("has-running-tasks")).toBe(true)
    expect(ball.querySelector(".map-float-ball__badge")?.textContent).toBe("1")

    const state = (wrapper.vm as any).$.setupState
    state.onPointerDown({
      button: 0,
      pointerId: 1,
      clientX: 100,
      clientY: 100,
      preventDefault: vi.fn(),
      currentTarget: ball
    })
    state.onPointerUp()
    await nextTick()

    const drawer = document.body.querySelector(".task-center-drawer") as HTMLElement
    expect(drawer).toBeTruthy()
    expect(drawer.textContent).toContain("九寨沟热异常研判报告")
    expect(drawer.textContent).toContain("65%")

    window.dispatchEvent(new CustomEvent("cui-task-status", {
      detail: {
        task_id: "TSK-RPT-100",
        status: "succeeded",
        title: "九寨沟热异常研判报告",
        download_url: "http://192.168.10.15:9002/rs-products/cui-linkage/report.docx",
        preview_url: "http://192.168.10.15:9002/rs-products/cui-linkage/report.html"
      }
    }))
    await nextTick()

    const links = Array.from(drawer.querySelectorAll("a"))
    expect(links.some((a) => a.getAttribute("href")?.includes("report.docx"))).toBe(true)
  })

  it("closes the drawer from its close control", async () => {
    const wrapper = mount(MapFloatBall, { attachTo: document.body })
    ;(wrapper.vm as any).$.setupState.drawerOpen = true
    await nextTick()

    const close = document.body.querySelector(".task-center-drawer__close") as HTMLButtonElement
    close.click()
    await nextTick()

    expect(document.body.querySelector(".task-center-drawer")).toBeNull()
  })
})
