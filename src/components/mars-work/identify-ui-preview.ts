import type { DeformationMethod, MacroAnomalyType, PrecursorAnomalyType, QuickIdentifyCategory } from "@/api/quickIdentify"

/**
 * TEMPORARY UI preview for the anomaly-identify panel.
 * Delete this file and the IDENTIFY_UI_PREVIEW_ENABLED branch in mars-map.vue
 * when the layout review is finished. It does not replace the identify API.
 */
export const IDENTIFY_UI_PREVIEW_ENABLED = true
export const IDENTIFY_UI_PREVIEW_JOB_ID = "ui-preview"

type PreviewRing = Array<[number, number]>

type PreviewInput = {
  ring: PreviewRing
  category: QuickIdentifyCategory
  macroType: MacroAnomalyType
  precursorType: PrecursorAnomalyType
  deformationMethod: DeformationMethod
}

const PRECURSOR_SAMPLES = [
  { title: "前兆监测点1", time: "2026-03-12 08:40:00", duration: "18小时", areaM2: 126000, tempDiff: 3.6, level: 3 },
  { title: "前兆监测点2", time: "2026-03-18 14:15:00", duration: "9小时", areaM2: 84000, tempDiff: 2.1, level: 2 },
  { title: "前兆监测点3", time: "2026-04-02 21:05:00", duration: "27小时", areaM2: 215000, tempDiff: 4.8, level: 3 },
  { title: "前兆监测点4", time: "2026-04-09 06:30:00", duration: "6小时", areaM2: 52000, tempDiff: 1.4, level: 1 }
]

function bboxOfRing(ring: PreviewRing) {
  let minLng = Infinity
  let minLat = Infinity
  let maxLng = -Infinity
  let maxLat = -Infinity
  ring.forEach(([lng, lat]) => {
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      return
    }
    minLng = Math.min(minLng, lng)
    minLat = Math.min(minLat, lat)
    maxLng = Math.max(maxLng, lng)
    maxLat = Math.max(maxLat, lat)
  })
  if (!Number.isFinite(minLng)) {
    return { minLng: 102.7, minLat: 24.9, maxLng: 102.9, maxLat: 25.1 }
  }
  if (maxLng - minLng < 0.01) {
    minLng -= 0.02
    maxLng += 0.02
  }
  if (maxLat - minLat < 0.01) {
    minLat -= 0.02
    maxLat += 0.02
  }
  return { minLng, minLat, maxLng, maxLat }
}

function samplePoint(ring: PreviewRing, index: number, count: number) {
  const box = bboxOfRing(ring)
  const columns = 2
  const col = index % columns
  const row = Math.floor(index / columns)
  const rows = Math.ceil(count / columns)
  const lng = box.minLng + (box.maxLng - box.minLng) * ((col + 1) / (columns + 1))
  const lat = box.minLat + (box.maxLat - box.minLat) * ((row + 1) / (rows + 1))
  return [Number(lng.toFixed(6)), Number(lat.toFixed(6))]
}

export function buildIdentifyUiPreview(input: PreviewInput) {
  const count = input.category === "macro" ? 4 : PRECURSOR_SAMPLES.length
  const features = Array.from({ length: count }, (_, index) => {
    const sample = PRECURSOR_SAMPLES[index]
    const [lng, lat] = samplePoint(input.ring, index, count)
    if (input.category === "macro") {
      const typeText = macroTypeText(input.macroType)
      return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [lng, lat] },
        properties: {
          idx: index + 1,
          kind: "macro",
          macroType: input.macroType,
          typeText,
          level: sample.level,
          title: `${typeText}#${index + 1}`,
          time: sample.time,
          value: 20 + sample.level * 15
        }
      }
    }
    if (input.category === "deformation") {
      return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [lng, lat] },
        properties: {
          idx: index + 1,
          kind: "deformation",
          subType: input.deformationMethod,
          level: sample.level,
          value: 20 + sample.level * 15,
          title: `形变站点${index + 1}`,
          time: sample.time
        }
      }
    }
    return {
      type: "Feature",
      geometry: { type: "Point", coordinates: [lng, lat] },
      properties: {
        idx: index + 1,
        kind: "precursor",
        subType: input.precursorType,
        level: sample.level,
        value: 20 + sample.level * 15,
        title: sample.title,
        time: sample.time,
        duration: sample.duration,
        areaM2: sample.areaM2,
        tempDiff: sample.tempDiff
      }
    }
  })
  const anomalyAreaM2 = PRECURSOR_SAMPLES.reduce((sum, item) => sum + item.areaM2, 0)
  return {
    summary: { anomalyCount: features.length, anomalyAreaM2 },
    resultGeojson: { type: "FeatureCollection", features }
  }
}

function macroTypeText(macroType: MacroAnomalyType) {
  if (macroType === "groundwater") {
    return "地下水异常"
  }
  if (macroType === "bio") {
    return "生物异常"
  }
  if (macroType === "geosound") {
    return "地声异常"
  }
  if (macroType === "geolight") {
    return "地光异常"
  }
  if (macroType === "electromagnetic") {
    return "电磁异常"
  }
  return "气象异常"
}
