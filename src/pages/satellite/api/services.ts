/**
 * 数据管理 API 服务（eoAPI 全量对齐版）
 * @description 五个板块全面对齐 eoAPI STAC + datasets + ground-station 台账：
 *  - 资源池 pool      → 合并 /collections 与 /datasets 聚合真实资源池，并统计接入/产出/上传概览
 *  - 元数据 metadata  → /collections + /collections/{id}/items + /search（STAC 全量条目）
 *  - 数据目录 catalog → /collections + /search 实时计算每个目录真实 dataCount
 *  - 查询任务 query   → /search（全量 1000 上限）
 *  - 数据共享 share   → 合并 /collections 与 /datasets（46 集合全覆盖）
 */
import {
  getCollectionsAll,
  getCollection,
  getItems,
  searchItems,
  createDataset
} from "@mars/widgets/basic/dataset-repository/services/eoapi-datasets"
import { eoapiGet } from "./client"
import type { JeecgPage, SatelliteRecord } from "./types"

function pageOf(records: SatelliteRecord[], pageNo = 1, pageSize = 10): JeecgPage<SatelliteRecord> {
  const start = (pageNo - 1) * pageSize
  return {
    records: records.slice(start, start + pageSize),
    total: records.length,
    current: pageNo,
    size: pageSize
  }
}

function toTimestampMs(val: unknown): number {
  if (typeof val === "number" && Number.isFinite(val)) { return val }
  if (typeof val === "string" && val.trim()) {
    const ms = new Date(val).getTime()
    if (Number.isFinite(ms)) { return ms }
  }
  return 0
}

function toDateKey(val: unknown): string {
  const ms = toTimestampMs(val)
  if (!ms) { return "" }
  const d = new Date(ms)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function toTimeLabel(val: unknown): string {
  const ms = toTimestampMs(val)
  if (!ms) { return "-" }
  const d = new Date(ms)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  const hh = String(d.getHours()).padStart(2, "0")
  const mm = String(d.getMinutes()).padStart(2, "0")
  return `${y}-${m}-${day} ${hh}:${mm}`
}

function formatBytes(bytes: unknown): string {
  const n = Number(bytes)
  if (!Number.isFinite(n) || n <= 0) { return "-" }
  if (n < 1024) { return `${n} B` }
  if (n < 1024 * 1024) { return `${(n / 1024).toFixed(1)} KB` }
  if (n < 1024 * 1024 * 1024) { return `${(n / (1024 * 1024)).toFixed(1)} MB` }
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function inferCollectionFormat(col: Record<string, any> | undefined, ds: SatelliteRecord | undefined): string {
  const explicit = String(
    ds?.format ||
    (ds?.summaries as SatelliteRecord)?.format ||
    (col?.summaries as SatelliteRecord)?.format ||
    ""
  ).trim()
  if (explicit && explicit !== "未知") {
    return explicit
  }
  const cid = String(col?.id || ds?.datasetId || "").toLowerCase()
  if (cid === "ground-station-l0") { return "PDS / HDF5" }
  if (cid.includes("modis")) { return "HDF4" }
  if (cid.includes("viirs") || cid.includes("atms")) { return "NetCDF4" }
  if (cid.includes("fy3") || cid === "ground-station-l1") { return "HDF5" }
  if (cid.includes("thermal") || cid.includes("optical") || cid.includes("sar") || cid.includes("insar") || cid.includes("fy-")) { return "GeoTIFF" }
  if (cid.includes("geohazard") || cid.includes("damage") || cid.includes("road") || cid.includes("spatial-thematic")) { return "GeoJSON" }
  if (cid.includes("report") || cid.includes("thematic-map")) { return "专题报告/图件" }
  return "STAC"
}

function inferPoolName(col: Record<string, any> | undefined, ds: SatelliteRecord | undefined): string {
  const tags = Array.isArray(ds?.tags) ? (ds?.tags as string[]).filter(Boolean) : []
  if (tags.length > 0) {
    return String(tags[0])
  }
  const cid = String(col?.id || ds?.datasetId || "").toLowerCase()
  if (cid === "ground-station-l0") {
    return "地面站原始数据池"
  }
  if (
    cid.includes("modis") ||
    cid.includes("viirs") ||
    cid.includes("atms") ||
    cid.includes("fy3") ||
    cid.includes("gf-") ||
    cid.includes("sentinel") ||
    cid.includes("insar") ||
    cid === "ground-station-l1"
  ) {
    return "卫星遥感标准产品池"
  }
  if (cid.includes("thermal") || cid === "fy-thermal") {
    return "热红外与地震异常监测池"
  }
  if (
    cid.includes("report") ||
    cid.includes("damage") ||
    cid.includes("geohazard") ||
    cid.includes("road") ||
    cid.includes("spatial-thematic") ||
    cid.includes("thematic-map") ||
    cid === "earthquake_lab_demo" ||
    cid === "satellite-data-center"
  ) {
    return "灾情评估与专题产品池"
  }
  return "自定义数据集池"
}

function inferMetadataType(item: { collection?: string; properties?: Record<string, any> }): string {
  const cid = String(item.collection || "").toLowerCase()
  const level = String(item.properties?.["processing:level"] || "").toUpperCase()
  const inst = String(item.properties?.instruments?.[0] || item.properties?.sensor || "").toLowerCase()
  if (cid === "ground-station-l0" || level === "L0") { return "原始L0" }
  if (cid.includes("sar") || cid.includes("sentinel-1") || cid.includes("insar") || inst.includes("sar")) { return "SAR" }
  if (cid.includes("thermal") || cid === "fy-thermal") { return "热红外" }
  if (cid.includes("modis") || cid.includes("viirs") || cid.includes("atms") || cid.includes("fy3") || cid.includes("optical") || cid === "ground-station-l1") {
    return "光学"
  }
  return "专题数据"
}

function inferAccessCategory(colId: string): string {
  const cid = colId.toLowerCase()
  if (cid === "ground-station-l0") { return "地面站卫星原始数据" }
  if (cid.includes("thermal") || cid === "fy-thermal") { return "热红外监测数据" }
  if (
    cid.includes("modis") ||
    cid.includes("viirs") ||
    cid.includes("atms") ||
    cid.includes("fy3") ||
    cid.includes("optical") ||
    cid.includes("sentinel") ||
    cid.includes("insar") ||
    cid === "ground-station-l1"
  ) {
    return "卫星遥感标准产品"
  }
  return "地震灾情与专题数据"
}

function inferOutputCategory(colId: string): { category: string; subsystem: string; content: string } {
  const cid = colId.toLowerCase()
  if (cid.includes("thermal") || cid === "fy-thermal" || cid.includes("geohazard")) {
    return { category: "热红外异常监测成果", subsystem: "中短期宏观异常监测子系统", content: "热红外/异常监测成果" }
  }
  if (cid.includes("report") || cid.includes("damage") || cid.includes("road")) {
    return { category: "灾情与评估报告", subsystem: "损失评估子系统", content: "灾情评估报告/损毁图斑" }
  }
  if (
    cid.includes("modis") ||
    cid.includes("viirs") ||
    cid.includes("atms") ||
    cid.includes("fy3") ||
    cid.includes("optical") ||
    cid.includes("sentinel") ||
    cid.includes("insar") ||
    cid.startsWith("ground-station-")
  ) {
    return { category: "卫星遥感标准数据", subsystem: "地面站子系统", content: "标准化遥感影像产品" }
  }
  return { category: "空间专题与自定义成果", subsystem: "地震数据灾备与大数据管理子系统", content: "专题图层/自定义数据集" }
}

async function fetchCollectionsAndDatasets() {
  const [colsRes, dsRes, itemsRes] = await Promise.all([
    getCollectionsAll({ limit: 200 }).catch(() => ({ success: false as const, data: undefined, message: "collections 请求失败" })),
    eoapiGet<SatelliteRecord[]>("/datasets", { params: { limit: 200 } }).catch(() => ({ success: false as const, data: undefined, message: "datasets 请求失败" })),
    searchItems({ limit: 1000 }).catch(() => ({ success: false as const, data: undefined, message: "items 检索失败" }))
  ])
  if (!colsRes.success && !dsRes.success) {
    throw new Error(colsRes.message || dsRes.message || "eoAPI 数据集获取失败")
  }
  const collections = Array.isArray(colsRes.data) ? (colsRes.data as unknown as Record<string, any>[]) : []
  const datasets = Array.isArray(dsRes.data) ? (dsRes.data as unknown as SatelliteRecord[]) : []
  const items = Array.isArray(itemsRes.data) ? (itemsRes.data as unknown as Record<string, any>[]) : []
  return { collections, datasets, items }
}

function addPercent(categories: Array<{ name: string; color: string; count: number; dailyMap: Record<string, number> }>) {
  const total = categories.reduce((s, c) => s + c.count, 0)
  return categories.map((c) => ({
    ...c,
    percent: total > 0 ? Math.round((c.count / total) * 100) : 0,
    daily: [] as number[]
  }))
}

// ============ 资源池：合并 eoAPI STAC collections 与 datasets ============

export const poolApi = {
  async list(params: Record<string, unknown> = {}): Promise<JeecgPage<SatelliteRecord>> {
    const { collections, datasets, items } = await fetchCollectionsAndDatasets()

    const itemCountByCol = new Map<string, number>()
    const platformsByCol = new Map<string, Set<string>>()
    for (const it of items) {
      const cid = String(it.collection || "")
      if (!cid) { continue }
      itemCountByCol.set(cid, (itemCountByCol.get(cid) || 0) + 1)
      const plat = String(it.properties?.platform || "").trim()
      if (plat) {
        if (!platformsByCol.has(cid)) { platformsByCol.set(cid, new Set()) }
        platformsByCol.get(cid)?.add(plat)
      }
    }

    const dsById = new Map<string, SatelliteRecord>()
    for (const d of datasets) {
      const did = String(d.datasetId || d.id || "")
      if (did) { dsById.set(did, d) }
    }

    type PoolEntry = {
      id: string
      title: string
      format: string
      itemCount: number
      platforms: string[]
      createdAtMs: number
    }
    const byPool = new Map<string, PoolEntry[]>()
    const seen = new Set<string>()

    const pushEntry = (poolName: string, entry: PoolEntry) => {
      const arr = byPool.get(poolName) || []
      arr.push(entry)
      byPool.set(poolName, arr)
    }

    for (const col of collections) {
      const cid = String(col.id || "")
      if (!cid || seen.has(cid)) { continue }
      seen.add(cid)
      const ds = dsById.get(cid)
      const poolName = inferPoolName(col, ds)
      const temporalStart = Array.isArray(col.extent?.temporal?.interval?.[0]) ? col.extent.temporal.interval[0][0] : ""
      const createdAtMs = toTimestampMs(ds?.createdAt ?? (col.summaries as SatelliteRecord)?.createdAt ?? temporalStart)
      const colPlats = Array.from(platformsByCol.get(cid) || [])
      pushEntry(poolName, {
        id: cid,
        title: String(ds?.name || col.title || cid),
        format: inferCollectionFormat(col, ds),
        itemCount: itemCountByCol.get(cid) || 0,
        platforms: colPlats,
        createdAtMs
      })
    }

    for (const d of datasets) {
      const did = String(d.datasetId || d.id || "")
      if (!did || seen.has(did)) { continue }
      seen.add(did)
      const poolName = inferPoolName(undefined, d)
      pushEntry(poolName, {
        id: did,
        title: String(d.name || did),
        format: inferCollectionFormat(undefined, d),
        itemCount: itemCountByCol.get(did) || 0,
        platforms: Array.from(platformsByCol.get(did) || []),
        createdAtMs: toTimestampMs(d.createdAt)
      })
    }

    const pools: SatelliteRecord[] = Array.from(byPool.entries()).map(([poolName, list]) => {
      const totalItems = list.reduce((s, e) => s + e.itemCount, 0)
      const formats = Array.from(new Set(list.map((e) => e.format).filter(Boolean)))
      const satSet = new Set<string>()
      for (const e of list) {
        for (const p of e.platforms) { satSet.add(p) }
      }
      if (satSet.size === 0) {
        for (const e of list.slice(0, 5)) { satSet.add(e.title) }
      }
      const times = list.map((e) => e.createdAtMs).filter((t) => t > 0)
      return {
        id: `pool_${poolName}`,
        poolName,
        totalCapacity: list.length,
        usedCapacity: totalItems,
        itemCount: totalItems,
        dataFormat: formats.slice(0, 3).join("/") || "STAC",
        satellites: Array.from(satSet).slice(0, 8).join(","),
        status: "正常",
        dataType: "eoAPI 资源池",
        createdAt: times.length ? Math.min(...times) : Date.now()
      }
    })

    pools.sort((a, b) => (Number(b.itemCount) || 0) - (Number(a.itemCount) || 0))
    return pageOf(pools, Number(params.pageNo) || 1, Number(params.pageSize) || 100)
  },

  async getOverviewStats() {
    const [{ collections, datasets, items }, gsRes] = await Promise.all([
      fetchCollectionsAndDatasets(),
      fetch("/api/ground-station/tasks?limit=200")
        .then((r) => (r.ok ? r.json() : { tasks: [] }))
        .catch(() => ({ tasks: [] }))
    ])
    const colMap = new Map<string, Record<string, any>>()
    for (const c of collections) { colMap.set(String(c.id || ""), c) }
    const dsMap = new Map<string, SatelliteRecord>()
    for (const d of datasets) { dsMap.set(String(d.datasetId || d.id || ""), d) }
    const gsTasks = Array.isArray(gsRes?.tasks) ? (gsRes.tasks as Record<string, any>[]) : []

    const accessMap: Record<string, { name: string; color: string; count: number; dailyMap: Record<string, number> }> = {
      地面站卫星原始数据: { name: "地面站卫星原始数据", color: "#5B8FF9", count: 0, dailyMap: {} },
      卫星遥感标准产品: { name: "卫星遥感标准产品", color: "#61DDAA", count: 0, dailyMap: {} },
      热红外监测数据: { name: "热红外监测数据", color: "#65789B", count: 0, dailyMap: {} },
      地震灾情与专题数据: { name: "地震灾情与专题数据", color: "#F6BD16", count: 0, dailyMap: {} }
    }
    const outputMap: Record<string, { name: string; color: string; count: number; dailyMap: Record<string, number> }> = {
      卫星遥感标准数据: { name: "卫星遥感标准数据", color: "#5B8FF9", count: 0, dailyMap: {} },
      热红外异常监测成果: { name: "热红外异常监测成果", color: "#61DDAA", count: 0, dailyMap: {} },
      灾情与评估报告: { name: "灾情与评估报告", color: "#65789B", count: 0, dailyMap: {} },
      空间专题与自定义成果: { name: "空间专题与自定义成果", color: "#F6BD16", count: 0, dailyMap: {} }
    }
    const uploadMap: Record<string, { name: string; color: string; count: number; dailyMap: Record<string, number> }> = {
      "地面站原始数据(L0)": { name: "地面站原始数据(L0)", color: "#5B8FF9", count: 0, dailyMap: {} },
      "地面站预处理成果(L1)": { name: "地面站预处理成果(L1)", color: "#61DDAA", count: 0, dailyMap: {} },
      自定义上传数据集: { name: "自定义上传数据集", color: "#65789B", count: 0, dailyMap: {} }
    }

    const accessRecordsAll: SatelliteRecord[] = []
    const outputRecordsAll: SatelliteRecord[] = []
    const uploadRecordsAll: SatelliteRecord[] = []

    const sortedItems = [...items].sort((a, b) => {
      const tb = toTimestampMs(b.properties?.updated || b.properties?.datetime)
      const ta = toTimestampMs(a.properties?.updated || a.properties?.datetime)
      return tb - ta
    })

    for (const it of sortedItems) {
      const cid = String(it.collection || "")
      const col = colMap.get(cid)
      const ds = dsMap.get(cid)
      const fmt = String(it.properties?.["product:format"] || inferCollectionFormat(col, ds))
      const dtVal = it.properties?.updated || it.properties?.datetime || ds?.createdAt || ""
      const dateKey = toDateKey(dtVal)
      const timeLabel = toTimeLabel(dtVal)
      const title = String(it.properties?.title || it.id || cid)
      const srcLabel = cid.startsWith("ground-station") || String(it.properties?.["product:source"] || "") === "ground-station"
        ? "卫星地面站"
        : "eoAPI STAC 编目中心"

      const accCat = inferAccessCategory(cid)
      accessMap[accCat].count += 1
      if (dateKey) { accessMap[accCat].dailyMap[dateKey] = (accessMap[accCat].dailyMap[dateKey] || 0) + 1 }
      accessRecordsAll.push({
        id: `acc-${cid}-${it.id}`,
        name: title,
        collection: cid,
        source: srcLabel,
        time: timeLabel,
        format: fmt,
        status: "已接入"
      })

      const outInfo = inferOutputCategory(cid)
      outputMap[outInfo.category].count += 1
      if (dateKey) { outputMap[outInfo.category].dailyMap[dateKey] = (outputMap[outInfo.category].dailyMap[dateKey] || 0) + 1 }
      outputRecordsAll.push({
        id: `out-${cid}-${it.id}`,
        name: title,
        collection: cid,
        module: outInfo.subsystem,
        time: timeLabel,
        content: outInfo.content,
        format: fmt,
        sent: "是"
      })
    }

    for (const t of gsTasks) {
      const stage = String(t.data_stage || "processed")
      const cat = stage === "raw" ? "地面站原始数据(L0)" : "地面站预处理成果(L1)"
      const dtVal = t.updated_at || t.created_at || ""
      const dateKey = toDateKey(dtVal)
      uploadMap[cat].count += 1
      if (dateKey) { uploadMap[cat].dailyMap[dateKey] = (uploadMap[cat].dailyMap[dateKey] || 0) + 1 }
      const st = String(t.status || "")
      const statusLabelMap: Record<string, string> = { completed: "已编目", failed: "异常隔离", quarantined: "异常隔离", triggered: "处理中" }
      const stLabel = statusLabelMap[st] || "已上传"
      uploadRecordsAll.push({
        id: `up-gs-${t.batch_id}-${t.filename}`,
        name: String(t.filename || t.batch_id || ""),
        source: `${String(t.satellite || "GENERAL")} (${stage === "raw" ? "L0" : "L1"})`,
        interactionObject: "卫星地面站",
        time: toTimeLabel(dtVal),
        size: formatBytes(t.file_size),
        format: String(t.filename || "").split(".").pop()?.toUpperCase() || "FILE",
        status: stLabel
      })
    }

    for (const d of datasets) {
      const did = String(d.datasetId || d.id || "")
      const dtVal = d.createdAt || ""
      const dateKey = toDateKey(dtVal)
      uploadMap["自定义上传数据集"].count += 1
      if (dateKey) { uploadMap["自定义上传数据集"].dailyMap[dateKey] = (uploadMap["自定义上传数据集"].dailyMap[dateKey] || 0) + 1 }
      uploadRecordsAll.push({
        id: `up-ds-${did}`,
        name: String(d.name || did),
        source: "数据集仓库",
        interactionObject: "运行支撑与管理调度软件",
        time: toTimeLabel(dtVal),
        size: "-",
        format: inferCollectionFormat(colMap.get(did), d),
        status: d.publishStatus === "published" ? "已发布" : "待发布"
      })
    }

    const nowMs = Date.now()
    const weekAgoMs = nowMs - 7 * 86400 * 1000
    const splitByWeek = (rows: SatelliteRecord[]) => {
      const weekRows = rows.filter((r) => toTimestampMs(r.time) >= weekAgoMs)
      return { month: rows, week: weekRows.length > 0 ? weekRows : rows.slice(0, 20) }
    }

    return {
      accessCategories: addPercent(Object.values(accessMap)),
      outputCategories: addPercent(Object.values(outputMap)),
      uploadCategories: addPercent(Object.values(uploadMap)),
      records: {
        access: splitByWeek(accessRecordsAll),
        output: splitByWeek(outputRecordsAll),
        upload: splitByWeek(uploadRecordsAll)
      }
    }
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
    const limit = Math.max(Number(params.pageSize) || 1000, 1000)
    const offset = ((Number(params.pageNo) || 1) - 1) * (Number(params.pageSize) || 10)
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
        dataType: inferMetadataType(item),
        resolution: edit.resolution ?? item.properties?.gsd ?? "—",
        acquisitionTime: String(edit.acquisitionTime ?? item.properties?.datetime ?? ""),
        region: Array.isArray(item.bbox) ? item.bbox.map((n: number) => Number(n.toFixed(4))).join(", ") : "—",
        bbox: item.bbox,
        status: item.id && item.collection && item.properties?.datetime && Array.isArray(item.bbox) ? "已验证" : "未验证",
        _raw: item
      }
    })
    let filtered = records
    if (params.satellite) {
      const targetSat = String(params.satellite).toLowerCase()
      filtered = filtered.filter((r) => String(r.satellite).toLowerCase().includes(targetSat))
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

// ============ 数据目录：STAC collections（含实时 dataCount） ============

export const catalogApi = {
  async list(params: Record<string, unknown> = {}): Promise<JeecgPage<SatelliteRecord>> {
    const [colRes, itemsRes] = await Promise.all([
      getCollectionsAll({ limit: 200 }),
      searchItems({ limit: 1000 }).catch(() => ({ success: false as const, data: undefined }))
    ])
    if (!colRes.success || !colRes.data) { throw new Error(colRes.message || "目录获取失败") }
    const countMap = new Map<string, number>()
    if (itemsRes.success && Array.isArray(itemsRes.data)) {
      for (const it of itemsRes.data) {
        const cid = String(it.collection || "")
        if (cid) { countMap.set(cid, (countMap.get(cid) || 0) + 1) }
      }
    }
    const nodes: SatelliteRecord[] = (colRes.data as unknown as SatelliteRecord[]).map((c) => ({
      id: c.id,
      name: c.title || c.id,
      parentId: "",
      level: 0,
      dataCount: countMap.get(String(c.id)) || 0,
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
      limit: Number(params.pageSize) || 500,
      query: params.query as Record<string, any> | undefined
    })
    if (!res.success || !res.data) { throw new Error(res.message || "查询失败") }
    return { records: res.data as unknown as SatelliteRecord[], total: (res.data as unknown as SatelliteRecord[]).length, current: 1, size: Number(params.pageSize) || 500 }
  },
  async add(): Promise<string> { throw new Error("查询由 /search 即时执行，不保存任务") },
  async exportExcel(): Promise<Blob> { throw new Error("导出功能开发中") }
}

// ============ 数据共享：合并 eoAPI STAC collections 与 datasets 元数据 ============

export const shareApi = {
  async list(params: Record<string, unknown> = {}): Promise<JeecgPage<SatelliteRecord>> {
    const [colsRes, dsRes] = await Promise.all([
      getCollectionsAll({ limit: 200 }).catch(() => ({ success: false as const, data: undefined, message: "collections 请求失败" })),
      eoapiGet<SatelliteRecord[]>("/datasets", { params: { limit: 200 } }).catch(() => ({ success: false as const, data: undefined, message: "datasets 请求失败" }))
    ])
    if (!colsRes.success && !dsRes.success) {
      throw new Error(colsRes.message || dsRes.message || "共享数据集列表获取失败")
    }

    const collections = Array.isArray(colsRes.data) ? (colsRes.data as unknown as Record<string, any>[]) : []
    const datasets = Array.isArray(dsRes.data) ? (dsRes.data as unknown as SatelliteRecord[]) : []
    const dsById = new Map<string, SatelliteRecord>()
    for (const d of datasets) {
      const did = String(d.datasetId || d.id || "")
      if (did) { dsById.set(did, d) }
    }

    const merged: SatelliteRecord[] = []
    const seen = new Set<string>()

    for (const col of collections) {
      const cid = String(col.id || "")
      if (!cid || seen.has(cid)) { continue }
      seen.add(cid)
      const ds = dsById.get(cid)
      const colVisibility = String((col.summaries as SatelliteRecord)?.visibility || "public")
      const effectiveVis = ds ? String(ds.visibility || "private") : colVisibility
      const isPublic = effectiveVis === "public"
      const isPublished = ds ? String(ds.publishStatus || "") === "published" : true
      const temporalStart = Array.isArray(col.extent?.temporal?.interval?.[0]) ? col.extent.temporal.interval[0][0] : ""
      const createdAt = ds?.createdAt ?? (col.summaries as SatelliteRecord)?.createdAt ?? (temporalStart || "")
      merged.push({
        id: cid,
        datasetName: String(ds?.name || col.title || cid),
        dataId: cid,
        dataName: String(ds?.name || col.title || cid),
        description: String(ds?.description || col.description || "eoAPI STAC 数据集合"),
        format: inferCollectionFormat(col, ds),
        shareType: isPublic ? "共享" : "私人",
        permissions: isPublic ? ["查看"] : [],
        authTarget: [],
        status: isPublished ? "已发布" : "未发布",
        createdAt,
        source: ds ? "eoapi-merged" : "eoapi-stac"
      })
    }

    for (const d of datasets) {
      const did = String(d.datasetId || d.id || "")
      if (!did || seen.has(did)) { continue }
      seen.add(did)
      const isPublic = String(d.visibility || "") === "public"
      const isPublished = String(d.publishStatus || "") === "published"
      merged.push({
        id: did,
        datasetName: String(d.name || did),
        dataId: did,
        dataName: String(d.name || did),
        description: String(d.description || "暂无描述"),
        format: inferCollectionFormat(undefined, d),
        shareType: isPublic ? "共享" : "私人",
        permissions: isPublic ? ["查看"] : [],
        authTarget: [],
        status: isPublished ? "已发布" : "未发布",
        createdAt: d.createdAt || "",
        source: "eoapi-datasets"
      })
    }

    merged.sort((a, b) => {
      const pubDiff = (b.status === "已发布" ? 1 : 0) - (a.status === "已发布" ? 1 : 0)
      if (pubDiff !== 0) { return pubDiff }
      const timeDiff = toTimestampMs(b.createdAt) - toTimestampMs(a.createdAt)
      if (timeDiff !== 0) { return timeDiff }
      return String(a.dataName || "").localeCompare(String(b.dataName || ""), "zh-CN")
    })

    return pageOf(merged, Number(params.pageNo) || 1, Number(params.pageSize) || 500)
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
