// 像素分析 Worker 客户端：模块级单例 Worker + jsdom/旧浏览器同步回退
// 协议：postMessage({ id, kind, payload }) → { id, ok:true, result } | { id, ok:false, error }
// pixels 拷贝传入不转移所有权（主线程还需用原 buffer 生成 sourceImage）
export type AnalysisKind = "signal" | "statistics" | "spatial" | "temporal" | "raster"

export type AnalysisPayload =
  | { pixels: Uint8ClampedArray; width: number; height: number; options: unknown }
  | { frames: unknown[]; options: unknown }

type Pending = { resolve: (value: any) => void; reject: (reason: Error) => void }

let worker: Worker | null = null
let workerBroken = false
let nextId = 1
const pending = new Map<number, Pending>()

function acquireWorker(): Worker | null {
  if (workerBroken || typeof Worker === "undefined") {
    return null
  }
  if (!worker) {
    try {
      worker = new Worker(new URL("./analysis-worker.ts", import.meta.url), { type: "module" })
      worker.onmessage = (event: MessageEvent) => {
        const { id, ok, result, error } = event.data || {}
        const entry = pending.get(id)
        if (!entry) { return }
        pending.delete(id)
        if (ok) { entry.resolve(result) } else { entry.reject(new Error(error || "分析 Worker 执行失败")) }
      }
      worker.onerror = () => {
        workerBroken = true
        for (const [, entry] of pending) { entry.reject(new Error("分析 Worker 异常退出")) }
        pending.clear()
      }
    } catch {
      workerBroken = true
      worker = null
    }
  }
  return worker
}

async function runSync(kind: AnalysisKind, payload: AnalysisPayload) {
  // 动态 import 保持与 Worker 相同的模块路径，避免主包重复内联
  if (kind === "temporal") {
    const { processTemporalFrames } = await import("./temporal-analysis")
    return processTemporalFrames((payload as any).frames, (payload as any).options)
  }
  const { pixels, width, height, options } = payload as { pixels: Uint8ClampedArray; width: number; height: number; options: any }
  if (kind === "statistics") {
    const { processStatisticsPixels } = await import("./statistics-analysis")
    return processStatisticsPixels(pixels, width, height, options)
  }
  if (kind === "signal") {
    const { processSignalPixels } = await import("./signal-analysis")
    return processSignalPixels(pixels, width, height, options)
  }
  if (kind === "spatial") {
    const { processSpatialPixels } = await import("./spatial-analysis")
    return processSpatialPixels(pixels, width, height, options)
  }
  const { processRasterPixels } = await import("./raster-analysis")
  return processRasterPixels(pixels, width, height, options)
}

export async function runAnalysis(kind: AnalysisKind, payload: AnalysisPayload): Promise<any> {
  const instance = acquireWorker()
  if (!instance) {
    return await runSync(kind, payload)
  }
  const id = nextId++
  return await new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    try {
      instance.postMessage({ id, kind, payload })
    } catch (error) {
      pending.delete(id)
      reject(error instanceof Error ? error : new Error(String(error)))
    }
  })
}
