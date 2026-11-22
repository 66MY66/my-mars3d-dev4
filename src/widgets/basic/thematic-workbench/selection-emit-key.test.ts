import { describe, expect, it, beforeAll } from "vitest"

// map.ts 顶层 import mars3d 会拉起 Cesium（jsdom 无 CanvasRenderingContext2D），
// 先注入最小桩再动态 import 被测函数
let cameraDigest: (map: any) => string
beforeAll(async () => {
  ;(globalThis as any).CanvasRenderingContext2D ||= class {}
  ;({ cameraDigest } = await import("./map"))
})

describe("cameraDigest", () => {
  it("returns none when map or camera is missing", () => {
    expect(cameraDigest(undefined)).toBe("none")
    expect(cameraDigest({} as any)).toBe("none")
  })

  it("changes when position changes and is stable for identical state", () => {
    const makeMap = (x: number, y: number, heading: number) => ({
      camera: { positionWC: { x, y, z: 0 }, heading, pitch: -1.5, roll: 0 },
      scene: { canvas: { clientWidth: 100, clientHeight: 50 } }
    }) as any
    const a = cameraDigest(makeMap(1, 2, 0))
    const same = cameraDigest(makeMap(1, 2, 0))
    const moved = cameraDigest(makeMap(3, 2, 0))
    const rotated = cameraDigest(makeMap(1, 2, 0.5))
    expect(same).toBe(a)
    expect(moved).not.toBe(a)
    expect(rotated).not.toBe(a)
  })
})
