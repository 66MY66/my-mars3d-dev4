import * as mars3d from "mars3d"
import { paintRoadVectorTile } from "./road-centerline-style"

const LAYER_TYPE = "mvt"

function tileRectangle(options: any) {
  const rectangle = options?.rectangle
  if (!rectangle) {
    return undefined
  }
  const west = Number(rectangle.xmin)
  const south = Number(rectangle.ymin)
  const east = Number(rectangle.xmax)
  const north = Number(rectangle.ymax)
  if (![west, south, east, north].every(Number.isFinite) || west >= east || south >= north) {
    return undefined
  }
  return mars3d.Cesium.Rectangle.fromDegrees(west, south, east, north)
}

class RoadCenterlineMvtLayer extends mars3d.layer.BaseTileLayer {
  constructor(options: any) {
    super(options)
    const symbol = (this as any).options?.symbol
    if (symbol && typeof symbol === "object" && !symbol.type && !symbol.styleOptions) {
      delete (this as any).options.symbol
    }
  }

  async _createImageryProvider(options: any = {}) {
    const source = options?.url ? options : (this as any).options || {}
    const url = String(source.url || "").trim()
    const Cesium = mars3d.Cesium
    const rectangle = tileRectangle(source)
    const provider = new Cesium.UrlTemplateImageryProvider({
      url,
      minimumLevel: source.minimumLevel,
      maximumLevel: source.maximumLevel ?? 18,
      ...(rectangle ? { rectangle } : {})
    })
    provider.requestImage = (x: number, y: number, z: number, request: any) => {
      const tileUrl = url.replaceAll("{x}", String(x)).replaceAll("{y}", String(y)).replaceAll("{z}", String(z))
      const pending = new Cesium.Resource({ url: tileUrl, request }).fetchArrayBuffer()
      if (!pending) {
        return undefined
      }
      return pending.then((buffer: ArrayBuffer | undefined) => (buffer ? paintRoadVectorTile(buffer) : undefined))
    }
    return provider
  }
}

let registered = false
try {
  registered = !!mars3d.LayerUtil.getClass(LAYER_TYPE as any)
} catch {
  registered = false
}
if (!registered) {
  mars3d.LayerUtil.register(LAYER_TYPE, RoadCenterlineMvtLayer as any)
}
