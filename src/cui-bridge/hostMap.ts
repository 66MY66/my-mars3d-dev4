import * as mars3d from "mars3d"
import { planLocate } from "@/cui-bridge/hostLocate"

const highlightLayerId = "cui-host-highlight"
let hostMap: any = null

export function setHostMap(map: any) {
  hostMap = map
}

export function getHostMap() {
  return hostMap
}

function polygonRings(geometry: { type: string; coordinates: unknown }): number[][][] {
  if (geometry.type === "Polygon" && Array.isArray(geometry.coordinates)) {
    return geometry.coordinates as number[][][]
  }
  if (geometry.type === "MultiPolygon" && Array.isArray(geometry.coordinates)) {
    return (geometry.coordinates as number[][][][]).flat()
  }
  return []
}

function drawHighlight(map: any, bbox?: [number, number, number, number], geometry?: { type: string; coordinates: unknown }) {
  let layer = map.getLayerById?.(highlightLayerId)
  if (!layer) {
    layer = new mars3d.layer.GraphicLayer({ id: highlightLayerId, name: "CUI联动高亮" })
    map.addLayer(layer)
  }
  layer.clear?.()
  const rings = geometry ? polygonRings(geometry) : []
  let positions: number[][] = []
  if (rings.length) {
    positions = rings[0].map((pair) => [Number(pair[0]), Number(pair[1]), 0])
  } else if (bbox) {
    positions = [
      [bbox[0], bbox[3], 0],
      [bbox[2], bbox[3], 0],
      [bbox[2], bbox[1], 0],
      [bbox[0], bbox[1], 0]
    ]
  }
  if (!positions.length) {
    return
  }
  layer.addGraphic(new mars3d.graphic.PolygonEntity({
    positions,
    style: {
      color: "#ff4d4f",
      opacity: 0.32,
      outline: true,
      outlineColor: "#ff4d4f",
      outlineWidth: 2
    }
  }))
}

export function executeHostLocate(args: any) {
  const plan = planLocate(args)
  if (plan.status === "missing_coords") {
    return { success: true as const, data: { locateStatus: "missing_coords", target: plan.target } }
  }
  if (plan.status === "error") {
    return { success: false as const, error: plan.error }
  }
  if (!hostMap) {
    return { success: false as const, error: "LOCATE_FAILED" }
  }
  try {
    if (plan.bbox) {
      const [west, south, east, north] = plan.bbox
      hostMap.camera.flyTo({
        destination: mars3d.Cesium.Rectangle.fromDegrees(west, south, east, north),
        duration: 1.2
      })
    } else if (plan.center) {
      hostMap.setCameraView({ lng: plan.center[0], lat: plan.center[1], alt: 12000, pitch: -45 }, { duration: 1 })
    }
    if (plan.highlight) {
      drawHighlight(hostMap, plan.bbox, plan.geometry)
    }
    return { success: true as const, data: { locateStatus: "succeeded", target: plan.target } }
  } catch {
    return { success: false as const, error: "LOCATE_FAILED" }
  }
}
