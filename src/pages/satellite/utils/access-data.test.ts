import { describe, expect, it } from "vitest"
import { buildAccessTrend, formatAccessTooltip, getAccessDateRange } from "./access-data"

describe("access data helpers", () => {
  it("builds a seven-day range ending on the previous day for weekly mode", () => {
    expect(getAccessDateRange("week", new Date("2026-11-23T12:00:00+08:00"))).toEqual([
      "11-16",
      "11-17",
      "11-18",
      "11-19",
      "11-20",
      "11-21",
      "11-22"
    ])
  })

  it("builds a thirty-day range ending on the previous day for monthly mode", () => {
    const range = getAccessDateRange("month", new Date("2026-11-23T12:00:00+08:00"))
    expect(range).toHaveLength(30)
    expect(range[0]).toBe("10-24")
    expect(range[29]).toBe("11-22")
  })

  it("creates one trend series per access category", () => {
    const result = buildAccessTrend(
      [
        { name: "地面站卫星原始数据", color: "#5B8FF9", daily: [1, 2] },
        { name: "气象数据", color: "#61DDAA", daily: [3, 4] }
      ],
      ["11-21", "11-22"]
    )
    expect(result).toEqual([
      { name: "地面站卫星原始数据", color: "#5B8FF9", data: [1, 2] },
      { name: "气象数据", color: "#61DDAA", data: [3, 4] }
    ])
  })

  it("can produce full dates for chart tooltips", () => {
    expect(getAccessDateRange("week", new Date("2026-11-23T12:00:00+08:00"), "full")[6]).toBe("2026-11-22")
  })

  it("aggregates all series values into one date tooltip", () => {
    expect(formatAccessTooltip("2026-11-22", [
      { marker: "●", seriesName: "地面站数据", value: 12 },
      { marker: "●", seriesName: "气象数据", value: 5 }
    ])).toBe("2026-11-22<br/>●地面站数据：12<br/>●气象数据：5")
  })
})
