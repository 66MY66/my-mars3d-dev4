export type AccessPeriod = "week" | "month"

export interface AccessCategory {
  name: string
  color: string
  daily: number[]
}

export interface AccessTrendSeries {
  name: string
  color: string
  data: number[]
}

export interface AccessTooltipItem {
  marker?: string
  seriesName?: string
  value?: number | string
}

export function formatAccessTooltip(date: string, params: AccessTooltipItem | AccessTooltipItem[]): string {
  const items = Array.isArray(params) ? params : [params]
  return [date, ...items.map((item) => `${item.marker || ""}${item.seriesName || ""}：${item.value ?? 0}`)].join("<br/>")
}

function formatMonthDay(date: Date): string {
  return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

export function getAccessDateRange(period: AccessPeriod, now = new Date(), format: "short" | "full" = "short"): string[] {
  const days = period === "week" ? 7 : 30
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(end)
    date.setDate(end.getDate() - (days - index - 1))
    return format === "full"
      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
      : formatMonthDay(date)
  })
}

export function buildAccessTrend(categories: AccessCategory[], dates: string[]): AccessTrendSeries[] {
  return categories.map((category) => ({
    name: category.name,
    color: category.color,
    data: dates.map((_, index) => Number(category.daily[index] || 0))
  }))
}
