import { VectorTile } from "@mapbox/vector-tile"
import { PbfReader } from "pbf"

export type RoadLinePaint = { color: string; width: number; dash?: number[] }

export const roadLevelPaint: Record<string, RoadLinePaint> = {
  highWay: { color: "#547c66", width: 2.6 },
  nationalRoad: { color: "#a47a51", width: 2.2 },
  provincialRoad: { color: "#b4926d", width: 1.8 },
  levelThreeRoad: { color: "#b5a38b", width: 1.3 },
  levelFourRoad: { color: "#bcaf9b", width: 1.1 },
  secondaryRoad: { color: "#c2b8a9", width: 1 },
  roadsBeingBuilt: { color: "#969187", width: 1.3, dash: [6, 4] },
  other: { color: "#b7afa2", width: 1 },
  railway: { color: "#59626a", width: 1.5 },
  water: { color: "#5896b5", width: 1.2 }
}

const fallbackPaint: RoadLinePaint = { color: "#b7afa2", width: 1 }

export function roadLinePaint(level: unknown): RoadLinePaint {
  return roadLevelPaint[String(level || "")] || fallbackPaint
}

export function paintRoadVectorTile(buffer: ArrayBuffer) {
  const tile = new VectorTile(new PbfReader(buffer))
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = 256
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    return canvas
  }
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  for (const layer of Object.values(tile.layers)) {
    for (let index = 0; index < layer.length; index++) {
      const feature = layer.feature(index)
      const paint = roadLinePaint(feature.properties?.road_level)
      const factor = 256 / feature.extent
      ctx.beginPath()
      ctx.strokeStyle = paint.color
      ctx.lineWidth = paint.width
      ctx.setLineDash(paint.dash || [])
      for (const ring of feature.loadGeometry()) {
        ring.forEach((point, position) => {
          const x = point.x * factor
          const y = point.y * factor
          if (position === 0) {
            ctx.moveTo(x, y)
          } else {
            ctx.lineTo(x, y)
          }
        })
      }
      ctx.stroke()
    }
  }
  return canvas
}
