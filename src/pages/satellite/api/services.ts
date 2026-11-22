/**
 * 数据管理 API 服务（eoAPI 版）
 * @description 五个板块映射到项目二 eoAPI：
 *  - 资源池 pool      → /datasets（按 tags/dataType 分组聚合的"存储池"视图）
 *  - 元数据 metadata  → /collections + /collections/{id}/items（STAC）
 *  - 数据目录 catalog → /collections（collection 即目录节点，父子按关键字分组）
 *  - 查询任务 query   → /search（STAC search，七组条件真生效）
 *  - 数据共享 share   → /datasets 的 visibility/publishStatus
 */
import {
  getCollectionsAll,
  getCollection,
  getItems,
  searchItems,
  createDataset,
  deleteDataset
} from "@mars/widgets/basic/dataset-repository/services/eoapi-datasets"
import { eoapiGet } from "./client"
import type { JeecgPage, SatelliteRecord } from "./types"

function ok<T>(data: T): { success: true; data: T } {
  return { success: true, data }
}

function pageOf(records: SatelliteRecord[], pageNo = 1, pageSize = 10): JeecgPage<SatelliteRecord> {
  const start = (pageNo - 1) * pageSize
  return {
    records: records.slice(start, start + pageSize),
    total: records.length,
    current: pageNo,
    size: pageSize
  }
}

// ============ 资源池：以 eoAPI 数据集聚合出"池"视图 ============

export const poolApi = {
  async list(params: Record<string, unknown> = {}): Promise<JeecgPage<SatelliteRecord>> {
    const res = await eoapiGet<SatelliteRecord[]>("/datasets", { params: { limit: 200 } })
    if (!res.success || !res.data) { throw new Error(res.message || "数据集列表获取失败") }
    const datasets = res.data as SatelliteRecord[]
    // 按第一个 tag 聚合成池；无 tag 的归"默认池"
    const byTag = new Map<string, SatelliteRecord[]>()
    for (const d of datasets) {
      const tags = Array.isArray(d.tags) ? (d.tags as string[]) : []
      const key = tags[0] || "默认池"
      const list = byTag.get(key) || []
      list.push(d)
      byTag.set(key, list)
    }
    const pools: SatelliteRecord[] = Array.from(byTag.entries()).map(([tag, list]) => ({
      id: `pool_${tag}`,
      poolName: tag,
      // 真实指标：池内数据集数 / STAC 条目数（并行查询）
      totalCapacity: list.length,
      usedCapacity: 0,
      itemCount: 0,
      dataFormat: "多源",
      satellites: Array.from(new Set(list.map((d) => String(d.name || "").split("-")[0]).filter(Boolean))).join(","),
      status: "正常",
      dataType: "数据集",
      createdAt: Math.min(...list.map((d) => Number(d.createdAt) || Date.now()))
    }))
    // 并行取每个池的 STAC 条目数（items 接口不返回 numberMatched，直接数 features，limit 100 封顶）
    await Promise.all(pools.map(async (pool) => {
      const list = byTag.get(String(pool.poolName)) || []
      const counts = await Promise.all(list.map(async (d) => {
        try {
          const r = await eoapiGet<{ features?: unknown[] }>(`/collections/${d.datasetId}/items`, { params: { limit: 100 } })
          return (r.data?.features || []).length
        } catch { return 0 }
      }))
      pool.itemCount = counts.reduce((a, b) => a + b, 0)
      pool.usedCapacity = pool.itemCount
    }))
    return pageOf(pools, Number(params.pageNo) || 1, Number(params.pageSize) || 10)
  },
  async get(id: string): Promise<SatelliteRecord> {
    const page = await poolApi.list({ pageNo: 1, pageSize: 200 })
    const found = page.records.find((r) => String(r.id) === String(id))
    if (!found) { throw new Error("资源池不存在") }
    return found
  },
  /** 创建"池"= 创建一个带池名 tag 的 eoAPI 数据集 */
  async add(data: SatelliteRecord): Promise<string> {
    const res = await createDataset({
      name: `池-${String(data.poolName || "未命名")}`,
      description: `数据资源池：${String(data.poolName || "")}`,
      visibility: "private",
      tags: [String(data.poolName || "默认池")]
    })
    if (!res.success || !res.data) { throw new Error(res.message || "资源池创建失败") }
    return (res.data as unknown as SatelliteRecord).datasetId as string
  },
  async edit(): Promise<string> { throw new Error("eoAPI 暂不支持池编辑，请通过数据集管理") },
  async remove(): Promise<string> { throw new Error("eoAPI 暂不支持池删除，请通过数据集管理") },
  async removeBatch(): Promise<string> { throw new Error("eoAPI 暂不支持池删除，请通过数据集管理") },
  async exportExcel(): Promise<Blob> { throw new Error("导出功能开发中") }
}

// ============ 元数据：STAC items ============
// 真实数据 = pgSTAC 条目；"编辑"= 更新条目属性（title/datetime/bbox）；
// "验证"= 校验条目必备字段（id/collection/datetime/bbox/geometry）

/** STAC item 更新走 datasets-api 的 revision 通道不可行，直连 STAC 也不支持 PATCH；
 *  实际可写通道：datasets-api 无 item 更新端点 → 编辑功能标记为"仅 title/datetime"通过重新编目实现。
 *  ponytail: pgSTAC 未开 PATCH /items，编辑暂只改展示层草稿（localStorage），后端开启后切直写。 */

const METADATA_EDIT_DRAFT_KEY = "satellite_metadata_edits"

function loadMetadataEdits(): Record<string, Record<string, unknown>> {
  try {
    return JSON.parse(localStorage.getItem(METADATA_EDIT_DRAFT_KEY) || "{}")
  } catch {
    return {}
  }
}

function saveMetadataEdit(itemId: string, patch: Record<string, unknown>) {
  const edits = loadMetadataEdits()
  edits[itemId] = { ...(edits[itemId] || {}), ...patch }
  localStorage.setItem(METADATA_EDIT_DRAFT_KEY, JSON.stringify(edits))
}

export const metadataApi = {
  async list(params: Record<string, unknown> = {}): Promise<JeecgPage<SatelliteRecord>> {
    const limit = Number(params.pageSize) || 10
    const offset = ((Number(params.pageNo) || 1) - 1) * limit
    // 未指定 collection 时跨全部数据集检索（STAC /search）
    const collectionId = String(params.collectionId || "")
    let items: SatelliteRecord[]
    if (collectionId) {
      const res = await getItems(collectionId, { limit, offset })
      if (!res.success || !res.data) { throw new Error(res.message || "元数据获取失败") }
      items = res.data as unknown as SatelliteRecord[]
    } else {
      const res = await searchItems({ limit, query: params.query as Record<string, any> | undefined })
      if (!res.success || !res.data) { throw new Error(res.message || "元数据获取失败") }
      items = res.data as unknown as SatelliteRecord[]
    }
    const edits = loadMetadataEdits()
    const records: SatelliteRecord[] = (items as unknown as SatelliteRecord[]).map((it) => {
      const item = it as unknown as { id: string; collection: string; properties: Record<string, any>; bbox?: number[] }
      const edit = edits[`${item.collection}/${item.id}`] || {}
      const title = String(edit.title ?? item.properties?.title ?? item.id)
      const satellite = String(edit.satellite ?? item.properties?.platform ?? item.collection)
      return {
        id: `${item.collection}/${item.id}`,
        metadataId: item.id,
        collectionId: item.collection,
        title,
        satellite,
        sensor: String(item.properties?.instruments?.[0] ?? item.properties?.sensor ?? "—"),
        dataType: item.properties?.gsd != null ? "栅格" : "数据",
        resolution: edit.resolution ?? item.properties?.gsd ?? "—",
        acquisitionTime: String(edit.acquisitionTime ?? item.properties?.datetime ?? ""),
        region: Array.isArray(item.bbox) ? item.bbox.map((n: number) => Number(n.toFixed(4))).join(", ") : "—",
        bbox: item.bbox,
        // 验证状态：条目必备字段齐全 = 已验证（真实校验结果，非人工标记）
        status: item.id && item.collection && item.properties?.datetime && Array.isArray(item.bbox) ? "已验证" : "未验证",
        _raw: item
      }
    })
    // 客户端过滤（satellite/dataType/dateRange）
    let filtered = records
    if (params.satellite) {
      filtered = filtered.filter((r) => String(r.satellite).includes(String(params.satellite)))
    }
    if (params.dataType) {
      filtered = filtered.filter((r) => r.dataType === params.dataType)
    }
    if (Array.isArray(params.dateRange) && params.dateRange.length === 2) {
      const [s, e] = params.dateRange as [string, string]
      filtered = filtered.filter((r) => {
        const t = String(r.acquisitionTime || "")
        return t && (!s || t >= s) && (!e || t <= `${e}T23:59:59Z`)
      })
    }
    return { records: filtered, total: filtered.length, current: 1, size: limit }
  },
  async get(collectionId: string, itemId: string): Promise<SatelliteRecord> {
    const { getItem } = await import("@mars/widgets/basic/dataset-repository/services/eoapi-datasets")
    const res = await getItem(collectionId, itemId)
    if (!res.success || !res.data) { throw new Error(res.message || "元数据获取失败") }
    return res.data as unknown as SatelliteRecord
  },
  /**
   * 编辑元数据：可写字段 = 标题/卫星/分辨率/获取时间（本地编辑草稿，叠加在真实数据上展示）
   * ponytail: pgSTAC 不支持 PATCH items，落 localStorage 草稿；后端补端点后切换直写。
   */
  async edit(record: SatelliteRecord): Promise<string> {
    const id = String(record.id || `${record.collectionId}/${record.metadataId}`)
    if (!id.includes("/")) { throw new Error("元数据标识缺失") }
    saveMetadataEdit(id, {
      title: record.title,
      satellite: record.satellite,
      resolution: record.resolution,
      acquisitionTime: record.acquisitionTime
    })
    return id
  },
  /** 验证：真实校验条目 STAC 必备字段，返回缺失项 */
  async validate(record: SatelliteRecord): Promise<{ valid: boolean; missing: string[] }> {
    const raw = (record._raw || record) as { id?: string; collection?: string; properties?: Record<string, any>; bbox?: number[]; geometry?: unknown }
    const missing: string[] = []
    if (!raw.id) { missing.push("id") }
    if (!raw.collection) { missing.push("collection") }
    if (!raw.properties?.datetime) { missing.push("datetime") }
    if (!Array.isArray(raw.bbox) || raw.bbox.length !== 4) { missing.push("bbox") }
    if (!raw.geometry) { missing.push("geometry") }
    return { valid: missing.length === 0, missing }
  },
  async remove(): Promise<string> { throw new Error("元数据由数据集版本自动生成，不支持直接删除（请删除数据集）") },
  async exportExcel(): Promise<Blob> { throw new Error("导出功能开发中") }
}

// ============ 数据目录：STAC collections ============

export const catalogApi = {
  async list(params: Record<string, unknown> = {}): Promise<JeecgPage<SatelliteRecord>> {
    const res = await getCollectionsAll({ limit: 200 })
    if (!res.success || !res.data) { throw new Error(res.message || "目录获取失败") }
    const nodes: SatelliteRecord[] = (res.data as unknown as SatelliteRecord[]).map((c) => ({
      id: c.id,
      name: c.title || c.id,
      parentId: "",
      level: 0,
      dataCount: 0,
      status: "正常",
      isLeaf: true,
      description: c.description || "",
      createdAt: (c.summaries as SatelliteRecord)?.createdAt || 0
    }))
    return pageOf(nodes, Number(params.pageNo) || 1, Number(params.pageSize) || 500)
  },
  async get(id: string): Promise<SatelliteRecord> {
    const res = await getCollection(id)
    if (!res.success || !res.data) { throw new Error(res.message || "目录获取失败") }
    return res.data as unknown as SatelliteRecord
  },
  async add(): Promise<string> { throw new Error("eoAPI 中目录即数据集，请通过数据集管理创建") },
  async edit(): Promise<string> { throw new Error("eoAPI 暂不支持目录编辑") },
  async remove(): Promise<string> { throw new Error("eoAPI 暂不支持目录删除") },
  async exportExcel(): Promise<Blob> { throw new Error("导出功能开发中") }
}

// ============ 查询任务：STAC search（条件真生效） ============

export const queryTaskApi = {
  async list(params: Record<string, unknown> = {}): Promise<JeecgPage<SatelliteRecord>> {
    const res = await searchItems({
      collections: params.collectionId ? [String(params.collectionId)] : undefined,
      bbox: Array.isArray(params.bbox) && params.bbox.length === 4 ? (params.bbox as [number, number, number, number]) : undefined,
      datetime: params.datetime ? String(params.datetime) : undefined,
      limit: Number(params.pageSize) || 50,
      query: params.query as Record<string, any> | undefined
    })
    if (!res.success || !res.data) { throw new Error(res.message || "查询失败") }
    return { records: res.data as unknown as SatelliteRecord[], total: (res.data as unknown as SatelliteRecord[]).length, current: 1, size: Number(params.pageSize) || 50 }
  },
  async add(): Promise<string> { throw new Error("查询由 /search 即时执行，不保存任务") },
  async exportExcel(): Promise<Blob> { throw new Error("导出功能开发中") }
}

// ============ 数据共享：datasets visibility ============

export const shareApi = {
  async list(params: Record<string, unknown> = {}): Promise<JeecgPage<SatelliteRecord>> {
    const res = await eoapiGet<SatelliteRecord[]>("/datasets", { params: { limit: 200 } })
    if (!res.success || !res.data) { throw new Error(res.message || "数据集列表获取失败") }
    const shares: SatelliteRecord[] = (res.data as unknown as SatelliteRecord[])
      .filter((d) => String(d.visibility || "") !== "")
      .map((d) => ({
        id: d.datasetId,
        dataId: d.datasetId,
        dataName: d.name,
        shareType: d.visibility === "public" ? "公开" : "私有",
        permissions: d.visibility === "public" ? ["查看"] : [],
        authTarget: [],
        status: d.publishStatus === "published" ? "已发布" : "未发布",
        createdAt: d.createdAt
      }))
    return pageOf(shares, Number(params.pageNo) || 1, Number(params.pageSize) || 10)
  },
  async add(): Promise<string> { throw new Error("共享通过数据集可见性设置管理") },
  async edit(): Promise<string> { throw new Error("共享通过数据集可见性设置管理") },
  async remove(): Promise<string> { throw new Error("共享通过数据集可见性设置管理") },
  async exportExcel(): Promise<Blob> { throw new Error("导出功能开发中") }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
