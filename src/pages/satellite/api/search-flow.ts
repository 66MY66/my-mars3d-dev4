/**
 * eoAPI 同源 STAC 检索客户端
 * @description 通过 /api/eoapi/search 实时检索全量编目条目，支持多条件组合与精确统计。
 */
import { searchItems } from "@mars/widgets/basic/dataset-repository/services/eoapi-datasets"

export interface SearchFlowConditions {
  satellite?: string
  platform?: string
  instrument?: string
  collections?: string[]
  start?: string
  end?: string
  bbox?: number[]
  gsd_min?: number
  gsd_max?: number
  keyword?: string
  dir_id?: string
  limit?: number
}

export interface SearchFlowResult {
  item_id: string
  collection_id: string
  title: string
  datetime: string
  bbox: number[] | null
  gsd: number | null
  platform: string | null
  instruments: string[] | null
  visibility: string | null
  catalog_path: string | null
  stac_url: string
  preview: string | null
  map_layers: Record<string, { kind: "raster" | "vector"; geojson?: string; tiles?: string; preview?: string }> | null
  downloads: Record<string, unknown> | null
}

export interface SearchFlowStatistics {
  matched: number
  returned?: number
  response_ms: number
  total_ms?: number
  within_5s: boolean
  by_collection: Record<string, number>
  pages?: number
}

export interface SearchFlowResponse {
  results: SearchFlowResult[]
  statistics: SearchFlowStatistics
  export: { download_url?: string; expires_in?: number } | null
  search_log_id?: number
}

/** 保留导出常量以兼容外部引用，统一使用同源 /api/eoapi 代理 */
export const WINDMILL_BASE = "/api/eoapi"

/** 直连 eoAPI STAC /search 执行检索并构造标准化响应 */
export async function runSearchFlow(conditions: SearchFlowConditions): Promise<SearchFlowResponse> {
  const started = Date.now()
  let datetime: string | undefined
  if (conditions.start || conditions.end) {
    const s = conditions.start ? `${conditions.start}T00:00:00Z` : ".."
    const e = conditions.end ? `${conditions.end}T23:59:59Z` : ".."
    datetime = `${s}/${e}`
  }
  let collections: string[] | undefined
  if (conditions.collections?.length) {
    collections = conditions.collections
  } else if (conditions.dir_id) {
    collections = [conditions.dir_id]
  }

  const res = await searchItems({
    collections,
    bbox: Array.isArray(conditions.bbox) && conditions.bbox.length === 4
      ? (conditions.bbox as [number, number, number, number])
      : undefined,
    datetime,
    limit: Math.max(Number(conditions.limit) || 1000, 1000)
  })
  if (!res.success || !res.data) {
    throw new Error(res.message || "检索服务请求失败")
  }

  const satTokens = String(conditions.satellite || conditions.platform || "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
  const instTokens = String(conditions.instrument || "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
  const kw = String(conditions.keyword || "").trim().toLowerCase()

  const filtered = (res.data as Array<Record<string, any>>).filter((item) => {
    const props = item.properties || {}
    const plat = String(props.platform || item.collection || "").toLowerCase()
    const insts = Array.isArray(props.instruments) ? props.instruments.map((x: any) => String(x).toLowerCase()) : []
    const gsd = props.gsd != null ? Number(props.gsd) : null
    if (satTokens.length && !satTokens.some((tok) => plat.includes(tok))) {
      return false
    }
    if (instTokens.length && !instTokens.some((tok) => insts.some((i: string) => i.includes(tok)))) {
      return false
    }
    if (conditions.gsd_min != null && (gsd == null || gsd < conditions.gsd_min)) {
      return false
    }
    if (conditions.gsd_max != null && (gsd == null || gsd > conditions.gsd_max)) {
      return false
    }
    if (kw) {
      const text = [item.id, item.collection, props.title, props.description, props.platform, ...insts]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      if (!text.includes(kw)) { return false }
    }
    return true
  })

  const byCollection: Record<string, number> = {}
  const results: SearchFlowResult[] = filtered.map((item) => {
    const cid = String(item.collection || "")
    byCollection[cid] = (byCollection[cid] || 0) + 1
    const props = item.properties || {}
    const assets = (item.assets || {}) as Record<string, any>
    const preview = assets.thumbnail?.href || assets.rendered_preview?.href || null
    return {
      item_id: String(item.id || ""),
      collection_id: cid,
      title: String(props.title || item.id || ""),
      datetime: String(props.datetime || ""),
      bbox: Array.isArray(item.bbox) ? item.bbox : null,
      gsd: props.gsd != null ? Number(props.gsd) : null,
      platform: props.platform ? String(props.platform) : null,
      instruments: Array.isArray(props.instruments) ? props.instruments.map(String) : null,
      visibility: props.visibility ? String(props.visibility) : null,
      catalog_path: cid || null,
      stac_url: `/api/eoapi/collections/${encodeURIComponent(cid)}/items/${encodeURIComponent(String(item.id || ""))}`,
      preview: preview ? String(preview) : null,
      map_layers: null,
      downloads: assets
    }
  })

  const elapsed = Date.now() - started
  return {
    results,
    statistics: {
      matched: results.length,
      returned: results.length,
      response_ms: elapsed,
      total_ms: elapsed,
      within_5s: elapsed < 5000,
      by_collection: byCollection,
      pages: 1
    },
    export: null
  }
}
