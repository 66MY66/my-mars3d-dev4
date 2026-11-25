export type LocatePlan =
  | { status: "missing_coords"; target: string | null }
  | {
      status: "locate"
      target: string | null
      center?: [number, number]
      bbox?: [number, number, number, number]
      geometry?: { type: string; coordinates: unknown }
      highlight: boolean
    }
  | { status: "error"; error: "EXTENT_MISMATCH" }

export function parseBbox(value: unknown): [number, number, number, number] | null {
  if (!Array.isArray(value) || value.length !== 4) {
    return null
  }
  const nums = value.map((item) => Number(item))
  if (nums.some((item) => !Number.isFinite(item))) {
    return null
  }
  const [west, south, east, north] = nums
  if (west >= east || south >= north) {
    return null
  }
  return [west, south, east, north]
}

function parseCenter(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length < 2) {
    return null
  }
  const lon = Number(value[0])
  const lat = Number(value[1])
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
    return null
  }
  return [lon, lat]
}

function parseGeometry(value: unknown): { type: string; coordinates: unknown } | null {
  if (!value || typeof value !== "object") {
    return null
  }
  const geometry = value as { type?: unknown; coordinates?: unknown }
  if (typeof geometry.type !== "string" || geometry.coordinates == null) {
    return null
  }
  return { type: geometry.type, coordinates: geometry.coordinates }
}

export function planLocate(args: any): LocatePlan {
  const target = typeof args?.target === "string" && args.target.trim() ? args.target.trim() : null
  const crs = args?.crs
  if (crs != null && crs !== "EPSG:4326") {
    return { status: "error", error: "EXTENT_MISMATCH" }
  }
  const center = parseCenter(args?.center)
  const bbox = args?.bbox == null ? null : parseBbox(args.bbox)
  if (args?.bbox != null && !bbox) {
    return { status: "error", error: "EXTENT_MISMATCH" }
  }
  const geometry = parseGeometry(args?.geometry)
  if (!center && !bbox && !geometry) {
    return { status: "missing_coords", target }
  }
  return {
    status: "locate",
    target,
    center: center ?? undefined,
    bbox: bbox ?? undefined,
    geometry: geometry ?? undefined,
    highlight: args?.highlight !== false
  }
}
