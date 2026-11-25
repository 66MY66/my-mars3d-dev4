const STORAGE_KEY_CHECKED = "mars3d_layer_checked_keys"
const STORAGE_KEY_EXPANDED = "mars3d_layer_expanded_keys"
const STORAGE_KEY_OPACITY = "mars3d_layer_opacity_values"
const STORAGE_KEY_RASTER_STYLE = "mars3d_layer_raster_style_values_v1"
const STORAGE_KEY_VECTOR_STYLE = "mars3d_layer_vector_style_values_v1"
const STORAGE_KEY_SIBLING_ORDER = "mars3d_layer_sibling_order_v1"

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) {
      return fallback
    }
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value))
}

/** 撤销或清除导入后，去掉这些图层留在浏览器里的勾选和样式记录。 */
export function forgetPersistedLayerUiState(ids: Array<string | number>) {
  const drop = new Set(ids.map((id) => String(id).trim()).filter(Boolean))
  if (!drop.size) {
    return
  }

  const checked = readJson<unknown>(STORAGE_KEY_CHECKED, null)
  if (Array.isArray(checked)) {
    writeJson(STORAGE_KEY_CHECKED, checked.filter((id) => !drop.has(String(id))))
  }

  const expanded = readJson<unknown>(STORAGE_KEY_EXPANDED, null)
  if (Array.isArray(expanded)) {
    writeJson(STORAGE_KEY_EXPANDED, expanded.filter((id) => !drop.has(String(id))))
  }

  for (const key of [STORAGE_KEY_OPACITY, STORAGE_KEY_RASTER_STYLE, STORAGE_KEY_VECTOR_STYLE]) {
    const record = readJson<unknown>(key, null)
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      continue
    }
    const next: Record<string, unknown> = {}
    Object.entries(record as Record<string, unknown>).forEach(([id, value]) => {
      if (!drop.has(String(id))) {
        next[id] = value
      }
    })
    writeJson(key, next)
  }

  const siblingOrder = readJson<unknown>(STORAGE_KEY_SIBLING_ORDER, null)
  if (siblingOrder && typeof siblingOrder === "object" && !Array.isArray(siblingOrder)) {
    const next: Record<string, string[]> = {}
    Object.entries(siblingOrder as Record<string, unknown>).forEach(([parentId, order]) => {
      if (drop.has(String(parentId)) || !Array.isArray(order)) {
        return
      }
      next[parentId] = order.map((id) => String(id)).filter((id) => !drop.has(id))
    })
    writeJson(STORAGE_KEY_SIBLING_ORDER, next)
  }
}
