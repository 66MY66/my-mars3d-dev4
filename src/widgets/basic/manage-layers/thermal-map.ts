import * as mars3d from "mars3d"

let map: mars3d.Map | null = null
let heatLayer: mars3d.layer.HeatLayer | null = null

interface ThermalFrame {
  date: string
  taskNames?: string[]
  points: Array<{ lng: number; lat: number; value: number }>
}

const frames: ThermalFrame[] = []
let lastFrameIndex = -1

export function onMounted(mapInstance: mars3d.Map): void {
  map = mapInstance
  heatLayer = new mars3d.layer.HeatLayer({
    name: "热异常时空演化",
    min: 0,
    max: 15,
    heatStyle: {
      radius: 45,
      blur: 0.85,
      gradient: {
        0.25: "rgb(0,0,255)",
        0.55: "rgb(0,255,0)",
        0.85: "yellow",
        1.0: "rgb(255,0,0)"
      }
    },
    show: true,
    flyTo: true
  })
  map.addLayer(heatLayer)
  if (frames.length > 0) {
    updateThermalLayer(0)
    heatLayer.flyTo()
  }
}

export function onUnmounted(): void {
  if (map && heatLayer) {
    map.removeLayer(heatLayer, true)
    heatLayer = null
  }
  map = null
}

export function updateThermalLayer(frameIndex: number): void {
  if (!heatLayer || frames.length === 0) {
    return
  }
  const safeIndex = Math.max(0, Math.min(Math.floor(frameIndex), frames.length - 1))
  if (safeIndex === lastFrameIndex) {
    return
  }
  lastFrameIndex = safeIndex
  heatLayer.setPositions(frames[safeIndex].points as any)
}

export function getThermalDates(): string[] {
  return frames.map((f) => f.date)
}

export async function loadRealThermalData(startDate?: string, endDate?: string) {
  const qs = new URLSearchParams()
  if (startDate) {
    qs.set("start_date", startDate)
  }
  if (endDate) {
    qs.set("end_date", endDate)
  }
  const resp = await fetch(`/api/thermal-evolution?${qs.toString()}`)
  if (!resp.ok) {
    throw new Error(`加载热异常数据失败: HTTP ${resp.status}`)
  }
  const data = await resp.json()
  frames.length = 0
  lastFrameIndex = -1
  if (Array.isArray(data.frames)) {
    data.frames.forEach((f: any) => {
      frames.push({
        date: String(f.date || ""),
        taskNames: Array.isArray(f.taskNames) ? f.taskNames : [],
        points: Array.isArray(f.points) ? f.points : []
      })
    })
  }
  if (heatLayer && frames.length > 0) {
    updateThermalLayer(0)
    heatLayer.flyTo()
  }
  return data.summary || { startDate: "", endDate: "", totalFrames: frames.length, totalPoints: 0 }
}
