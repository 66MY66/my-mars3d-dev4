import type { PopulationProfilePoint } from "./population-latitude-profile"

export type StatsChartKey = "population" | "economy" | "housing" | "radiation"

type StatsRow = Record<string, any>

export type EconomyDistributionCell = {
  west: number
  east: number
  south: number
  north: number
  value: number
  total?: number
  areaKm2?: number
  coverage?: number
  effectiveAreaKm2?: number
  row?: number
  column?: number
}

const ECONOMY_TIERS = [
  { name: "低密度", color: "#ffd678" },
  { name: "中密度", color: "#ffb048" },
  { name: "高密度", color: "#e65a28" }
] as const

type EconomyPoint = {
  lon: number
  lat: number
  value: number
  total: number
  coverage: number | null
  effectiveAreaKm2: number | null
  tier: 0 | 1 | 2
  column: number
  row: number
  lonWidth: number
  latHeight: number
}

type EconomyBin = {
  totals: [number, number, number]
  count: number
  lon0: number
  lon1: number
  lat0: number
  lat1: number
}

function economyTier(value: number, lowEdge: number, highEdge: number): 0 | 1 | 2 {
  if (value <= lowEdge) { return 0 }
  if (value <= highEdge) { return 1 }
  return 2
}

function toEconomyPoints(cells: EconomyDistributionCell[]): EconomyPoint[] {
  const positive = cells.filter((cell) => {
    return [cell.west, cell.east, cell.south, cell.north, cell.value].every(Number.isFinite) && cell.value > 0 && cell.east > cell.west && cell.north > cell.south
  })
  const values = positive.map((cell) => cell.value).sort((a, b) => a - b)
  const lowEdge = values.length ? values[Math.floor((values.length - 1) / 3)] : 0
  const highEdge = values.length ? values[Math.floor((values.length - 1) * 2 / 3)] : 0
  return positive.map((cell) => {
    const coverage = Number(cell.coverage)
    let effectiveAreaKm2: number | null = null
    if (Number.isFinite(cell.effectiveAreaKm2)) {
      effectiveAreaKm2 = Number(cell.effectiveAreaKm2)
    } else if (Number.isFinite(cell.areaKm2) && Number.isFinite(coverage)) {
      effectiveAreaKm2 = Number(cell.areaKm2) * coverage
    }
    return {
      lon: (cell.west + cell.east) / 2,
      lat: (cell.south + cell.north) / 2,
      value: cell.value,
      total: Number.isFinite(cell.total) ? Math.max(0, Number(cell.total)) : 0,
      coverage: Number.isFinite(coverage) ? coverage : null,
      effectiveAreaKm2,
      tier: economyTier(cell.value, lowEdge, highEdge),
      column: Number.isFinite(cell.column) ? Number(cell.column) : Math.round(cell.west * 1e6),
      row: Number.isFinite(cell.row) ? Number(cell.row) : Math.round(cell.south * 1e6),
      lonWidth: cell.east - cell.west,
      latHeight: cell.north - cell.south
    }
  })
}

function aggregateEconomyBins(points: EconomyPoint[], axis: "column" | "row", maxBins: number): EconomyBin[] {
  const groups = new Map<number, EconomyPoint[]>()
  points.forEach((point) => {
    const key = axis === "column" ? point.column : point.row
    const list = groups.get(key) || []
    list.push(point)
    groups.set(key, list)
  })
  let entries = [...groups.entries()].sort((a, b) => a[0] - b[0])
  if (entries.length > maxBins) {
    const size = Math.ceil(entries.length / maxBins)
    const merged: Array<[number, EconomyPoint[]]> = []
    for (let index = 0; index < entries.length; index += size) {
      merged.push([entries[index][0], entries.slice(index, index + size).flatMap((entry) => entry[1])])
    }
    entries = merged
  }
  return entries.map((entry) => {
    const group = entry[1]
    const totals: [number, number, number] = [0, 0, 0]
    group.forEach((point) => { totals[point.tier] += point.total })
    return {
      totals,
      count: group.length,
      lon0: Math.min(...group.map((point) => point.lon - point.lonWidth / 2)),
      lon1: Math.max(...group.map((point) => point.lon + point.lonWidth / 2)),
      lat0: Math.min(...group.map((point) => point.lat - point.latHeight / 2)),
      lat1: Math.max(...group.map((point) => point.lat + point.latHeight / 2))
    }
  })
}

function fitEconomyRange(points: EconomyPoint[], plotWidth: number, plotHeight: number) {
  const lonMin = Math.min(...points.map((point) => point.lon - point.lonWidth / 2))
  const lonMax = Math.max(...points.map((point) => point.lon + point.lonWidth / 2))
  const latMin = Math.min(...points.map((point) => point.lat - point.latHeight / 2))
  const latMax = Math.max(...points.map((point) => point.lat + point.latHeight / 2))
  const midLat = (latMin + latMax) / 2
  const cos = Math.max(0.2, Math.cos(midLat * Math.PI / 180))
  let lon0 = lonMin
  let lon1 = lonMax
  let lat0 = latMin
  let lat1 = latMax
  const lonSpan = Math.max(lon1 - lon0, 1e-6)
  const latSpan = Math.max(lat1 - lat0, 1e-6)
  const viewRatio = plotWidth / (plotHeight * cos)
  if (lonSpan / latSpan < viewRatio) {
    const pad = (latSpan * viewRatio - lonSpan) / 2
    lon0 -= pad
    lon1 += pad
  } else {
    const pad = (lonSpan / viewRatio - latSpan) / 2
    lat0 -= pad
    lat1 += pad
  }
  return { lonMin: lon0, lonMax: lon1, latMin: lat0, latMax: lat1 }
}

function formatEconomyNumber(value: number) {
  return Number(value || 0).toLocaleString("zh-CN", { maximumFractionDigits: 2 })
}

function economyMarginalRect(_params: any, api: any, horizontal: boolean) {
  const center = api.value(0)
  const start = api.value(2)
  const end = api.value(3)
  const half = api.value(4)
  if (!(end > start) || !(half > 0)) { return null }
  const origin = api.coord(horizontal ? [start, center - half] : [center - half, start])
  const extent = api.coord(horizontal ? [end, center + half] : [center + half, end])
  const length = Math.abs((horizontal ? extent[0] - origin[0] : extent[1] - origin[1]))
  const thickness = Math.max(1, Math.abs((horizontal ? extent[1] - origin[1] : extent[0] - origin[0])) - 1)
  if (!(length > 0)) { return null }
  return {
    type: "rect",
    shape: {
      x: Math.min(origin[0], extent[0]),
      y: Math.min(origin[1], extent[1]),
      width: horizontal ? length : thickness,
      height: horizontal ? thickness : length
    },
    style: api.style({ opacity: 0.9 })
  }
}

const divisionLabels: Record<StatsChartKey, string> = {
  population: "人口栅格 · 行政区汇总",
  housing: "建筑结构 · 抗震等级",
  economy: "区域经济贡献",
  radiation: "月份 · 异常等级"
}

export function getStatsDivisionLabel(key: StatsChartKey) {
  return divisionLabels[key]
}

function buildPopulationOption(rows: StatsRow[]) {
  if (rows.some((row) => row["区间"] != null)) {
    return buildDensityHistogramOption(rows, "人口总量（人）", "#4c8dff")
  }
  const sorted = [...rows].sort((a, b) => Number(b["人口"] || 0) - Number(a["人口"] || 0))
  return {
    animation: false,
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (items: any[]) => {
        const index = Number(items?.[0]?.dataIndex || 0)
        const row = sorted[index] || {}
        return `${row["区划"] || "未命名"}<br/>人口：${Number(row["人口"] || 0).toLocaleString()} 人<br/>密度：${Number(row["人口密度"] || 0).toLocaleString()} 人/km²`
      }
    },
    grid: { left: 82, right: 28, top: 14, bottom: 28 },
    xAxis: { type: "value", name: "人口（人）" },
    yAxis: { type: "category", inverse: true, data: sorted.map((row) => row["区划"]) },
    series: [{ name: "人口总数", type: "bar", data: sorted.map((row) => Number(row["人口"] || 0)), barMaxWidth: 22, itemStyle: { color: "#4c8dff" } }]
  }
}

function buildHousingOption(rows: StatsRow[]) {
  const grades = ["高风险", "较高风险", "中风险", "较低风险", "低风险"]
  const colors = ["#f5222d", "#fa8c16", "#fadb14", "#73d13d", "#20c997"]
  return {
    animation: false,
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (value: number) => `${Number(value).toFixed(1)}%` },
    legend: { top: 0, data: grades },
    grid: { left: 86, right: 24, top: 38, bottom: 24 },
    xAxis: { type: "value", min: 0, max: 100, axisLabel: { formatter: "{value}%" } },
    yAxis: { type: "category", data: rows.map((row) => row["分类"] || row["区划"]) },
    series: grades.map((grade, index) => ({
      name: grade,
      type: "bar",
      stack: "抗震等级",
      data: rows.map((row) => Number(row[grade] || 0)),
      barMaxWidth: 24,
      itemStyle: { color: colors[index] },
      emphasis: { focus: "series" }
    }))
  }
}

function buildEconomyOption(rows: StatsRow[]) {
  if (rows.some((row) => row["区间"] != null)) {
    return buildDensityHistogramOption(rows, "GDP总量（万元）", "#fa8c16")
  }
  return {
    animation: false,
    tooltip: { formatter: (item: any) => `${item?.name || "未命名"}<br/>经济量：${Number(item?.value || 0).toLocaleString()}` },
    series: [{
      name: "区域经济贡献",
      type: "treemap",
      roam: false,
      nodeClick: false,
      breadcrumb: { show: false },
      label: { show: true, formatter: "{b}\n{c}" },
      upperLabel: { show: false },
      data: rows.map((row) => ({ name: String(row["区划"] || "未命名"), value: Math.max(0, Number(row["经济"] || 0)) }))
    }]
  }
}

export function buildEconomyDistributionOption(cells: EconomyDistributionCell[], layout?: { width?: number; height?: number }) {
  const points = toEconomyPoints(cells)
  const width = layout?.width && layout.width > 120 ? layout.width : 640
  const height = layout?.height && layout.height > 120 ? layout.height : 320
  const mainLeft = 52
  const mainRight = 74
  const mainTop = 64
  const mainBottom = 42
  const range = points.length ? fitEconomyRange(points, Math.max(80, width - mainLeft - mainRight), Math.max(80, height - mainTop - mainBottom)) : { lonMin: 0, lonMax: 1, latMin: 0, latMax: 1 }
  const longitudeBins = aggregateEconomyBins(points, "column", 36)
  const latitudeBins = aggregateEconomyBins(points, "row", 28)
  const maxLongitudeTotal = Math.max(1, ...longitudeBins.map((bin) => bin.totals.reduce((sum, value) => sum + value, 0)))
  const maxLatitudeTotal = Math.max(1, ...latitudeBins.map((bin) => bin.totals.reduce((sum, value) => sum + value, 0)))
  const dense = points.length > 4000
  const scatter = ECONOMY_TIERS.map((tier, index) => ({
    id: `point-${tier.name}`,
    name: tier.name,
    type: "scatter",
    xAxisIndex: 1,
    yAxisIndex: 1,
    data: points.filter((point) => point.tier === index).map((point) => [point.lon, point.lat, point.value, point.total, point.coverage, point.effectiveAreaKm2]),
    symbolSize: dense ? 3 : 5,
    large: dense,
    largeThreshold: 2000,
    progressive: 4000,
    itemStyle: { color: tier.color, opacity: 0.75 },
    emphasis: { scale: false }
  }))
  const topBars = ECONOMY_TIERS.map((tier, index) => ({
    id: `lon-${tier.name}`,
    name: tier.name,
    type: "custom",
    xAxisIndex: 0,
    yAxisIndex: 0,
    data: longitudeBins.flatMap((bin) => {
      const stacked = bin.totals.slice(0, index).reduce((sum, value) => sum + value, 0)
      const amount = bin.totals[index]
      if (!(amount > 0)) { return [] }
      return [[(bin.lon0 + bin.lon1) / 2, stacked + amount, stacked, stacked + amount, (bin.lon1 - bin.lon0) * 0.46, amount, bin.count, bin.lon0, bin.lon1]]
    }),
    renderItem: (params: any, api: any) => economyMarginalRect(params, api, false),
    itemStyle: { color: tier.color },
    tooltip: { show: true }
  }))
  const rightBars = ECONOMY_TIERS.map((tier, index) => ({
    id: `lat-${tier.name}`,
    name: tier.name,
    type: "custom",
    xAxisIndex: 2,
    yAxisIndex: 2,
    data: latitudeBins.flatMap((bin) => {
      const stacked = bin.totals.slice(0, index).reduce((sum, value) => sum + value, 0)
      const amount = bin.totals[index]
      if (!(amount > 0)) { return [] }
      return [[(bin.lat0 + bin.lat1) / 2, stacked + amount, stacked, stacked + amount, (bin.lat1 - bin.lat0) * 0.46, amount, bin.count, bin.lat0, bin.lat1]]
    }),
    renderItem: (params: any, api: any) => economyMarginalRect(params, api, true),
    itemStyle: { color: tier.color }
  }))
  return {
    animation: false,
    legend: { top: 0, left: "center", itemWidth: 10, itemHeight: 10, data: ECONOMY_TIERS.map((tier) => tier.name), textStyle: { fontSize: 11 } },
    tooltip: {
      trigger: "item",
      confine: true,
      formatter: (params: any) => {
        const value = params?.value
        if (!Array.isArray(value)) { return "" }
        if (params.seriesType === "scatter") {
          const coverage = Number.isFinite(value[4]) ? `${Math.round(Number(value[4]) * 100)}%` : "—"
          const area = Number.isFinite(value[5]) ? `${Number(value[5]).toFixed(2)} km²` : "—"
          return `${params.seriesName}<br/>经度：${Number(value[0]).toFixed(3)}°E<br/>纬度：${Number(value[1]).toFixed(3)}°N<br/>GDP密度：${formatEconomyNumber(value[2])} 万元/km²<br/>GDP总量：${formatEconomyNumber(value[3])} 万元<br/>覆盖率：${coverage}<br/>有效面积：${area}`
        }
        const seriesId = String(params.seriesId || "")
        if (seriesId.startsWith("lon-")) {
          return `${params.seriesName}<br/>经度：${Number(value[7]).toFixed(3)}°E–${Number(value[8]).toFixed(3)}°E<br/>GDP总量：${formatEconomyNumber(value[5])} 万元<br/>格网数：${Number(value[6]).toLocaleString("zh-CN")}`
        }
        if (seriesId.startsWith("lat-")) {
          return `${params.seriesName}<br/>纬度：${Number(value[7]).toFixed(3)}°N–${Number(value[8]).toFixed(3)}°N<br/>GDP总量：${formatEconomyNumber(value[5])} 万元<br/>格网数：${Number(value[6]).toLocaleString("zh-CN")}`
        }
        return ""
      }
    },
    axisPointer: { link: [{ xAxisIndex: [0, 1] }, { yAxisIndex: [1, 2] }] },
    grid: [
      { left: mainLeft, right: mainRight, top: 22, height: 38 },
      { left: mainLeft, right: mainRight, top: mainTop, bottom: mainBottom },
      { width: 62, right: 8, top: mainTop, bottom: mainBottom }
    ],
    xAxis: [
      { type: "value", gridIndex: 0, min: range.lonMin, max: range.lonMax, axisLabel: { show: false }, axisTick: { show: false }, axisLine: { show: false }, splitLine: { show: false } },
      { type: "value", gridIndex: 1, name: "经度", nameLocation: "middle", nameGap: 26, min: range.lonMin, max: range.lonMax, axisLabel: { formatter: (value: number) => `${Number(value).toFixed(2)}°` } },
      { type: "value", gridIndex: 2, min: 0, max: maxLatitudeTotal * 1.08, axisLabel: { show: false }, axisTick: { show: false }, axisLine: { show: false }, splitLine: { show: false } }
    ],
    yAxis: [
      { type: "value", gridIndex: 0, min: 0, max: maxLongitudeTotal * 1.08, axisLabel: { show: false }, axisTick: { show: false }, axisLine: { show: false }, splitLine: { show: false } },
      { type: "value", gridIndex: 1, name: "纬度", nameLocation: "end", nameGap: 8, min: range.latMin, max: range.latMax, axisLabel: { formatter: (value: number) => `${Number(value).toFixed(2)}°` } },
      { type: "value", gridIndex: 2, min: range.latMin, max: range.latMax, axisLabel: { show: false }, axisTick: { show: false }, axisLine: { show: false }, splitLine: { show: false } }
    ],
    graphic: points.length ? [] : [{ type: "text", left: "center", top: "middle", style: { text: "当前范围没有正的 GDP 密度", fill: "#8c8c8c", fontSize: 12 } }],
    series: [...scatter, ...topBars, ...rightBars]
  }
}

function buildDensityHistogramOption(rows: StatsRow[], valueName: string, color: string) {
  return {
    animation: false,
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (items: any[]) => {
        const row = rows[Number(items?.[0]?.dataIndex || 0)] || {}
        return `${row["区间"]}<br/>${valueName}：${Math.round(Number(row["总量"] || 0)).toLocaleString()}<br/>格网数：${Number(row["格网数"] || 0).toLocaleString()}<br/>面积：${Number(row["面积"] || 0).toFixed(2)} km²`
      }
    },
    grid: { left: 72, right: 22, top: 18, bottom: 56 },
    xAxis: { type: "category", data: rows.map((row) => row["区间"]), axisLabel: { rotate: 35 } },
    yAxis: { type: "value", name: valueName },
    series: [{ name: valueName, type: "bar", data: rows.map((row) => Number(row["总量"] || 0)), itemStyle: { color }, barMaxWidth: 28 }]
  }
}

export function buildPopulationLatitudeProfileOption(latitude: number | null, points: Array<PopulationProfilePoint | null>) {
  const longitudes = points
    .filter((point): point is PopulationProfilePoint => !!point && Number.isFinite(point.longitude))
    .map((point) => point.longitude)
  const longitudeMin = longitudes.length ? Math.min(...longitudes) : undefined
  const longitudeMax = longitudes.length ? Math.max(...longitudes) : undefined
  const longitudePadding = longitudeMin !== undefined && longitudeMax !== undefined
    ? Math.max((longitudeMax - longitudeMin) * 0.05, 0.0005)
    : undefined
  return {
    animation: false,
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "cross" },
      formatter: (items: any[]) => {
        const value = items?.[0]?.value
        if (!Array.isArray(value) || value[0] == null) { return "" }
        return `经度：${Number(value[0]).toFixed(3)}°E<br/>纬度：${Number(latitude ?? 0).toFixed(3)}°N<br/>人口密度：${Number(value[1] || 0).toLocaleString()} 人/km²<br/>格网人口：${Math.round(Number(value[2] || 0)).toLocaleString()} 人`
      }
    },
    grid: { left: 76, right: 24, top: 22, bottom: 62 },
    xAxis: {
      type: "value",
      name: "经度",
      nameLocation: "middle",
      nameGap: 42,
      ...(longitudeMin !== undefined && longitudePadding !== undefined
        ? { min: longitudeMin - longitudePadding, max: (longitudeMax as number) + longitudePadding }
        : {}),
      axisLabel: { formatter: (value: number) => `${Number(value).toFixed(2)}°E` }
    },
    yAxis: {
      type: "value",
      name: "人口密度（人/km²）",
      nameGap: 54,
      nameLocation: "middle"
    },
    dataZoom: [
      { type: "inside", xAxisIndex: 0 },
      { type: "slider", xAxisIndex: 0, height: 16, bottom: 8 }
    ],
    series: [{
      name: "人口密度",
      type: "line",
      showSymbol: points.length <= 120,
      symbolSize: 5,
      connectNulls: false,
      lineStyle: { width: 2, color: "#4c8dff" },
      areaStyle: { color: "rgba(76,141,255,0.14)" },
      data: points.map((point) => point ? [point.longitude, point.density, point.population] : [null, null, null])
    }]
  }
}

function buildRadiationOption(rows: StatsRow[]) {
  const months = rows.map((row) => row["月份"])
  const lower = rows.map((row) => Number(row["正常下限"] || 0))
  const range = rows.map((row, index) => Math.max(0, Number(row["正常上限"] || 0) - lower[index]))
  return {
    animation: false,
    tooltip: { trigger: "axis" },
    legend: { top: 0, data: ["热辐射", "历史基准", "正常范围", "异常点"] },
    grid: { left: 48, right: 22, top: 38, bottom: 30 },
    xAxis: { type: "category", boundaryGap: false, data: months },
    yAxis: { type: "value", name: "辐射值" },
    series: [
      { name: "正常下限", type: "line", stack: "正常范围", data: lower, symbol: "none", lineStyle: { opacity: 0 }, areaStyle: { opacity: 0 } },
      { name: "正常范围", type: "line", stack: "正常范围", data: range, symbol: "none", lineStyle: { opacity: 0 }, areaStyle: { color: "rgba(82,196,26,0.22)" } },
      { name: "历史基准", type: "line", data: rows.map((row) => Number(row["基准值"] || 0)), symbol: "none", lineStyle: { type: "dashed", color: "#8c8c8c" } },
      { name: "热辐射", type: "line", data: rows.map((row) => Number(row["数值"] || 0)), smooth: true, symbolSize: 6, lineStyle: { width: 2, color: "#fa541c" } },
      { name: "异常点", type: "scatter", data: rows.filter((row) => row["异常"]).map((row) => [row["月份"], Number(row["数值"] || 0)]), symbolSize: 10, itemStyle: { color: "#f5222d" } }
    ]
  }
}

export function buildStatsChartOption(key: StatsChartKey, rows: StatsRow[]) {
  if (key === "population") {
    return buildPopulationOption(rows)
  }
  if (key === "housing") {
    return buildHousingOption(rows)
  }
  if (key === "economy") {
    return buildEconomyOption(rows)
  }
  return buildRadiationOption(rows)
}
