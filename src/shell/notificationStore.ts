import { computed, reactive } from "vue"
import type { AlertInfo } from "@/shell/alerts"

export type NotificationType = "alert"

export type NotificationSeverity = "严重" | "中等" | "轻微"

export type NotificationItem = {
  id: string
  type: NotificationType
  title: string
  createdAt: number
  read: boolean
  widget?: string
  payload?: {
    alert?: AlertInfo
  }
}

const readStorageKey = "notifications_read_ids_v1"

const state = reactive({
  initialized: false,
  items: [] as NotificationItem[],
  readSet: new Set<string>()
})

let loadingPromise: Promise<void> | null = null

function loadReadSet(): Set<string> {
  try {
    if (typeof localStorage === "undefined") {
      return new Set()
    }
    const raw = localStorage.getItem(readStorageKey)
    const arr = raw ? JSON.parse(raw) : []
    if (Array.isArray(arr)) {
      return new Set(arr.map((x) => String(x)))
    }
  } catch {}
  return new Set()
}

function persistReadSet() {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(readStorageKey, JSON.stringify(Array.from(state.readSet)))
    }
  } catch {}
}

function toMs(t: Date | string): number {
  if (t instanceof Date) {
    return t.getTime()
  }
  const d = new Date(t)
  const ms = d.getTime()
  return Number.isFinite(ms) ? ms : Date.now()
}

function formatTimeLabel(ms: number): string {
  const d = new Date(ms)
  const now = new Date()
  const hh = String(d.getHours()).padStart(2, "0")
  const mm = String(d.getMinutes()).padStart(2, "0")
  const isSameDay =
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
  if (isSameDay) {
    return `今天 ${hh}:${mm}`
  }
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day} ${hh}:${mm}`
}

function sortByTimeDesc(items: NotificationItem[]) {
  items.sort((a, b) => b.createdAt - a.createdAt)
}

export function parseNotificationSeverity(title: string): NotificationSeverity {
  const match = title.match(/（(严重|中等|轻微)）/)
  if (match?.[1] === "严重" || match?.[1] === "中等" || match?.[1] === "轻微") {
    return match[1]
  }
  return "轻微"
}

export function getSeverityColor(severity: NotificationSeverity): string {
  switch (severity) {
    case "严重":
      return "#CB272D"
    case "中等":
      return "#FF7D00"
    case "轻微":
      return "#FADC19"
    default:
      return "#FADC19"
  }
}

export function getSeverityRank(severity: NotificationSeverity): number {
  return { 严重: 3, 中等: 2, 轻微: 1 }[severity]
}

function initRealAlertsIfNeeded() {
  if (state.initialized) {
    return
  }
  state.initialized = true
  state.readSet = loadReadSet()
  if (typeof fetch !== "function" || typeof window === "undefined") {
    return
  }
  if (!loadingPromise) {
    loadingPromise = fetch("/api/geo-anomaly-alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data || !Array.isArray(data.alerts)) {
          return
        }
        data.alerts.forEach((row: any) => {
          const days = Array.isArray(row.days) ? row.days : []
          const points = Array.isArray(row.points) ? row.points : []
          const latestDay = days[days.length - 1]
          const validPts = points.filter((p: any) => Number.isFinite(Number(p.lon)) && Number.isFinite(Number(p.lat)))
          const centerLon = validPts.length
            ? validPts.reduce((s: number, p: any) => s + Number(p.lon), 0) / validPts.length
            : 0
          const centerLat = validPts.length
            ? validPts.reduce((s: number, p: any) => s + Number(p.lat), 0) / validPts.length
            : 0
          const confirmedCnt = points.filter((p: any) => Boolean(p.confirmed)).length
          const idx = row.anomaly_index != null ? Number(row.anomaly_index) : 0
          let degree = "轻微"
          if (idx >= 2.5) {
            degree = "严重"
          } else if (idx >= 1.5) {
            degree = "中等"
          }
          const latestDate = String(latestDay?.date || points[0]?.date || new Date().toISOString().slice(0, 10))
          upsertAlert({
            taskName: String(row.task_name || ""),
            anomalyDate: latestDate,
            anomalyIndex: row.anomaly_index ?? null,
            baselineSampleCount: row.baseline_n ?? null,
            trend: row.trend === "rising" || row.trend === "falling" || row.trend === "stable" ? row.trend : null,
            observedTemperature: latestDay?.obs_c ?? null,
            forecastTemperature: latestDay?.fc_c ?? null,
            temperatureDifference: latestDay?.diff_c ?? null,
            pointCount: points.length,
            confirmedPointCount: confirmedCnt,
            alertNo: `${row.task_name || ""}|${latestDate}`,
            name: `${row.task_name || "热异常"} 监测告警`,
            type: "热异常",
            time: latestDate,
            source: "地表热异常监测数据库",
            region: "",
            location: `${centerLon.toFixed(5)}, ${centerLat.toFixed(5)}`,
            status: confirmedCnt === points.length && points.length > 0 ? "已确认" : "待确认",
            degree,
            duration: `${days.length}天`,
            scope: "",
            analysisResult: "",
            monitoring: {
              maxSurfaceTemperature: latestDay?.obs_c ?? 0,
              averageTemperature: latestDay?.obs_c ?? 0,
              backgroundTemperature: latestDay?.fc_c ?? 0,
              maxTemperatureDifference: latestDay?.diff_c ?? idx,
              abnormalArea: 0,
              abnormalPixelCount: points.length,
              cloudCoverage: 0,
              confidence: 0
            }
          })
        })
      })
      .catch(() => {})
  }
}

function upsertAlert(alert: AlertInfo) {
  initRealAlertsIfNeeded()
  const createdAt = toMs(alert.time)
  const id = `alert_${createdAt}_${alert.location.replace(/\s+/g, "")}`
  const deg = alert.degree || "轻微"
  const title = `${formatTimeLabel(createdAt)} ${alert.taskName || ""} 预告警通知（${deg}）`.trim()
  const existing = state.items.find((x) => x.id === id)
  if (existing) {
    existing.title = title
    existing.createdAt = createdAt
    existing.payload = { alert }
    existing.widget = "alert-confirm"
  } else {
    state.items.unshift({
      id,
      type: "alert",
      title,
      createdAt,
      read: state.readSet.has(id),
      widget: "alert-confirm",
      payload: { alert }
    })
  }
  sortByTimeDesc(state.items)
}

function markRead(id: string) {
  initRealAlertsIfNeeded()
  state.readSet.add(id)
  persistReadSet()
  const it = state.items.find((x) => x.id === id)
  if (it) {
    it.read = true
  }
}

function markAllRead() {
  initRealAlertsIfNeeded()
  state.items.forEach((n) => {
    n.read = true
    state.readSet.add(n.id)
  })
  persistReadSet()
}

const listForView = computed(() => {
  initRealAlertsIfNeeded()
  return state.items.map((n) => ({
    ...n,
    timeLabel: formatTimeLabel(n.createdAt)
  }))
})

const unreadCount = computed(() => {
  initRealAlertsIfNeeded()
  return state.items.filter((n) => !n.read).length
})

function getById(id: string): NotificationItem | null {
  initRealAlertsIfNeeded()
  return state.items.find((x) => x.id === id) || null
}

export function useNotificationStore() {
  initRealAlertsIfNeeded()
  return {
    listForView,
    unreadCount,
    markRead,
    markAllRead,
    upsertAlert,
    getById
  }
}
