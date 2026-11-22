import { describe, expect, it, vi, afterEach } from "vitest"
import { runAnalysis } from "./analysis-worker-client"
import { processStatisticsPixels } from "./statistics-analysis"

function image(width: number, height: number, valueAt: (x: number, y: number) => number) {
  const pixels = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4
      pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = valueAt(x, y)
      pixels[offset + 3] = 255
    }
  }
  return pixels
}

describe("analysis worker client", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("falls back to sync processing when Worker is unavailable", async () => {
    // jsdom 下无 Worker 构造器
    expect(typeof Worker).toBe("undefined")
    const pixels = image(8, 6, (x) => x * 30)
    const result = await runAnalysis("statistics", { pixels, width: 8, height: 6, options: { operation: "category", classCount: 3, classMethod: "quantile" } })
    const direct = processStatisticsPixels(pixels, 8, 6, { operation: "category", classCount: 3, classMethod: "quantile" })
    expect(result.pixels).toEqual(direct.pixels)
    expect(result.summary.rows).toEqual(direct.summary.rows)
  })

  it("round-trips through postMessage when Worker exists", async () => {
    const posted: any[] = []
    const listeners: Record<string, (event: any) => void> = {}
    class FakeWorker {
      onmessage: ((event: any) => void) | null = null
      constructor() {
        queueMicrotask(() => {
          const request = posted[posted.length - 1]
          this.onmessage?.({ data: { id: request.id, ok: true, result: { pixels: new Uint8ClampedArray([1, 2, 3, 4]), summary: { echo: request.kind } } } })
        })
      }

      postMessage(message: any) { posted.push(message) }
      addEventListener(type: string, listener: (event: any) => void) { listeners[type] = listener }
      terminate() {}
    }
    ;(globalThis as any).Worker = FakeWorker
    const pixels = image(2, 2, () => 128)
    const result = await runAnalysis("signal", { pixels, width: 2, height: 2, options: { operation: "filter" } })
    expect(posted).toHaveLength(1)
    expect(posted[0].kind).toBe("signal")
    expect((result as any).summary.echo).toBe("signal")
    delete (globalThis as any).Worker
  })
})
