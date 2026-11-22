/// <reference lib="webworker" />
// 像素分析 Worker 入口：五种分析在独立线程执行，结果 postMessage 回传
import { processStatisticsPixels } from "./statistics-analysis"
import { processSignalPixels } from "./signal-analysis"
import { processSpatialPixels } from "./spatial-analysis"
import { processTemporalFrames } from "./temporal-analysis"
import { processRasterPixels } from "./raster-analysis"

export type AnalysisKind = "signal" | "statistics" | "spatial" | "temporal" | "raster"
export type AnalysisRequest =
  | { kind: "temporal"; frames: any[]; options: any }
  | { kind: AnalysisKind; pixels: Uint8ClampedArray; width: number; height: number; options: any }

self.onmessage = (event: MessageEvent) => {
  const { id, kind, payload } = event.data || {}
  try {
    let result: unknown
    if (kind === "temporal") {
      result = processTemporalFrames(payload.frames, payload.options)
    } else if (kind === "statistics") {
      result = processStatisticsPixels(payload.pixels, payload.width, payload.height, payload.options)
    } else if (kind === "signal") {
      result = processSignalPixels(payload.pixels, payload.width, payload.height, payload.options)
    } else if (kind === "spatial") {
      result = processSpatialPixels(payload.pixels, payload.width, payload.height, payload.options)
    } else if (kind === "raster") {
      result = processRasterPixels(payload.pixels, payload.width, payload.height, payload.options)
    } else {
      throw new Error(`未知分析类型：${kind}`)
    }
    ;(self as any).postMessage({ id, ok: true, result })
  } catch (error) {
    ;(self as any).postMessage({ id, ok: false, error: error instanceof Error ? error.message : String(error) })
  }
}
