import { describe, expect, it } from "vitest"
import { readDbtDocument, mergeDbtSourceLayer, standardBounds, invalidateDbtBoundsCache } from "./dbt116-standard"

describe("dbt structural clone", () => {
  it("shares the raster image string across clones", () => {
    const doc = readDbtDocument({
      version: 1,
crs: "CGCS2000",
agency: "单位",
createdAt: "2026-01-01",
description: "描述",
      usage: "reference",
reference: { title: "参考图", bounds: { west: 103, south: 25, east: 106, north: 28 }, notice: "参考限制说明" },
      event: { time: "2026-01-01T08:00:00+08:00", place: "测试区", magnitude: 6.5, magnitudeType: "Ms", authority: "中国地震台网正式速报", bulletin: "CENC-2026-001", longitude: 104.5, latitude: 26.5 },
      region: { zone: "R1", province: "省", prefecture: "市", evidence: "依据" },
      crsEvidence: "CGCS2000 原始坐标",
layers: []
    } as any)
    const layer: any = {
      id: "L1",
name: "栅格",
role: "imagery",
security: "public",
scale: 50000,
publishedAt: "2026-01-01",
      authority: "行业来源",
source: "真实来源",
crs: "CGCS2000",
crsEvidence: "CGCS2000",
      raster: { image: `data:image/png;base64,${"A".repeat(1_000_000)}`, bounds: { west: 103, south: 25, east: 106, north: 28 }, rendering: "imagery", radiometry: "说明" },
      data: { type: "FeatureCollection", features: [] }
    }
    const merged = mergeDbtSourceLayer(doc, layer)
    expect(merged.layers[0].raster!.image).toBe(layer.raster.image)
  })

  it("memoizes standardBounds per document until invalidated", () => {
    const doc = readDbtDocument({
      version: 1,
crs: "CGCS2000",
agency: "单位",
createdAt: "2026-01-01",
description: "描述",
      usage: "reference",
reference: { title: "参考图", bounds: { west: 103, south: 25, east: 106, north: 28 }, notice: "参考限制说明" },
      event: { time: "2026-01-01T08:00:00+08:00", place: "测试区", magnitude: 6.5, magnitudeType: "Ms", authority: "中国地震台网正式速报", bulletin: "CENC-2026-001", longitude: 104.5, latitude: 26.5 },
      region: { zone: "R1", province: "省", prefecture: "市", evidence: "依据" },
      crsEvidence: "CGCS2000 原始坐标",
layers: []
    } as any)
    const first = standardBounds(doc, "T30201000")
    const second = standardBounds(doc, "T30201000")
    expect(second).toBe(first)
    invalidateDbtBoundsCache(doc)
  })
})
