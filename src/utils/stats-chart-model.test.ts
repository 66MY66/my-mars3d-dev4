import { describe, expect, it } from "vitest"
import { buildEconomyDistributionOption, buildPopulationLatitudeProfileOption, buildStatsChartOption, getStatsDivisionLabel } from "./stats-chart-model"

describe("statistics chart model", () => {
  it("renders economy cells as a longitude-latitude scatter with value-weighted marginals", () => {
    const option: any = buildEconomyDistributionOption([
      { west: 100, east: 101, south: 20, north: 21, value: 10, total: 100, coverage: 1, effectiveAreaKm2: 10, row: 1, column: 1 },
      { west: 100, east: 101, south: 21, north: 22, value: 20, total: 50, coverage: 0.5, effectiveAreaKm2: 5, row: 2, column: 1 },
      { west: 101, east: 102, south: 20, north: 21, value: 90, total: 900, coverage: 0.8, effectiveAreaKm2: 8, row: 1, column: 2 },
      { west: 102, east: 103, south: 22, north: 23, value: 0, total: 0, coverage: 1, effectiveAreaKm2: 10, row: 3, column: 3 }
    ])
    expect(option.series.map((item: any) => item.name)).toEqual(["低密度", "中密度", "高密度", "低密度", "中密度", "高密度", "低密度", "中密度", "高密度"])
    expect(option.series.slice(0, 3).every((item: any) => item.type === "scatter")).toBe(true)
    expect(option.series[0].data).toEqual([[100.5, 20.5, 10, 100, 1, 10]])
    expect(option.series[1].data).toEqual([[100.5, 21.5, 20, 50, 0.5, 5]])
    expect(option.series[2].data).toEqual([[101.5, 20.5, 90, 900, 0.8, 8]])
    expect(option.xAxis[1].name).toBe("经度")
    expect(option.yAxis[1].name).toBe("纬度")
    expect(option.series[3].data[0][5]).toBe(100)
    expect(option.series[4].data[0][5]).toBe(50)
    const marginalTotal = option.series.slice(3).flatMap((item: any) => item.data).reduce((sum: number, value: number[]) => sum + value[5], 0)
    expect(marginalTotal).toBe(2100)
    const tooltip = option.tooltip.formatter({ seriesType: "scatter", seriesName: "低密度", value: option.series[0].data[0] })
    expect(tooltip).toContain("万元/km²")
    expect(tooltip).toContain("GDP总量：100 万元")
    expect(tooltip).toContain("覆盖率：100%")
    expect(tooltip).toContain("有效面积：10.00 km²")
    expect(JSON.stringify(option)).not.toContain("核密度")
  })

  it("renders real population density bins as a total-population bar chart", () => {
    const option: any = buildStatsChartOption("population", [{ 区间: "1–20", 格网数: 2, 面积: 3, 总量: 42 }])
    expect(option.xAxis.data).toEqual(["1–20"])
    expect(option.series[0].type).toBe("bar")
    expect(option.series[0].data).toEqual([42])
  })

  it("shows an empty economy distribution when every selected cell is zero", () => {
    const option: any = buildEconomyDistributionOption([
      { west: 100, east: 101, south: 20, north: 21, value: 0, total: 0, row: 1, column: 1 }
    ])
    expect(option.series[0].data).toEqual([])
    expect(option.graphic[0].style.text).toBe("当前范围没有正的 GDP 密度")
  })

  it("renders real GDP density bins as a GDP-total bar chart", () => {
    const option: any = buildStatsChartOption("economy", [{ 区间: "1–100", 格网数: 1, 面积: 2, 总量: 80 }])
    expect(option.xAxis.data).toEqual(["1–100"])
    expect(option.series[0].data).toEqual([80])
  })

  it("renders a population latitude profile as a longitude-density line with broken segments", () => {
    const option: any = buildPopulationLatitudeProfileOption(27.1025, [
      { longitude: 101.0075, latitude: 27.1025, density: 100, population: 25 },
      null,
      { longitude: 101.0175, latitude: 27.1025, density: 140, population: 35 }
    ])

    expect(option.xAxis.name).toBe("经度")
    expect(option.yAxis.name).toBe("人口密度（人/km²）")
    expect(option.series[0].type).toBe("line")
    expect(option.series[0].connectNulls).toBe(false)
    expect(option.series[0].sampling).toBeUndefined()
    expect(option.series[0].data).toEqual([
      [101.0075, 100, 25],
      [null, null, null],
      [101.0175, 140, 35]
    ])
  })

  it("bounds the profile longitude axis to the selected latitude cells", () => {
    const option: any = buildPopulationLatitudeProfileOption(27.1025, [
      { longitude: 101.0075, latitude: 27.1025, density: 100, population: 25 },
      { longitude: 101.0125, latitude: 27.1025, density: 140, population: 35 }
    ])

    expect(option.xAxis.min).toBeCloseTo(101.007, 6)
    expect(option.xAxis.max).toBeCloseTo(101.013, 6)
  })

  it("renders population as a descending horizontal ranking", () => {
    const option: any = buildStatsChartOption("population", [
      { 区划: "乙区", 人口: 200, 人口密度: 80 },
      { 区划: "甲区", 人口: 500, 人口密度: 120 }
    ])

    expect(option.yAxis.type).toBe("category")
    expect(option.yAxis.data).toEqual(["甲区", "乙区"])
    expect(option.xAxis.type).toBe("value")
    expect(option.series[0].type).toBe("bar")
    expect(option.series[0].data).toEqual([500, 200])
  })

  it("renders housing as five 100-percent stacked risk series", () => {
    const option: any = buildStatsChartOption("housing", [
      { 分类: "砖木结构", 高风险: 35, 较高风险: 25, 中风险: 20, 较低风险: 15, 低风险: 5 }
    ])

    expect(option.xAxis.max).toBe(100)
    expect(option.yAxis.data).toEqual(["砖木结构"])
    expect(option.series).toHaveLength(5)
    expect(option.series.every((item: any) => item.type === "bar" && item.stack === "抗震等级")).toBe(true)
  })

  it("renders economy as a treemap composition", () => {
    const option: any = buildStatsChartOption("economy", [
      { 区划: "甲区", 经济: 900 },
      { 区划: "乙区", 经济: 300 }
    ])

    expect(option.series[0].type).toBe("treemap")
    expect(option.series[0].data).toEqual([
      { name: "甲区", value: 900 },
      { name: "乙区", value: 300 }
    ])
  })

  it("renders thermal radiation with normal range, baseline and anomaly markers", () => {
    const option: any = buildStatsChartOption("radiation", [
      { 月份: "2026-01", 数值: 36, 基准值: 30, 正常下限: 26, 正常上限: 34, 异常: true },
      { 月份: "2026-02", 数值: 31, 基准值: 30, 正常下限: 26, 正常上限: 34, 异常: false }
    ])

    expect(option.series.map((item: any) => item.name)).toEqual(["正常下限", "正常范围", "历史基准", "热辐射", "异常点"])
    expect(option.series[1].stack).toBe("正常范围")
    expect(option.series[4].data).toEqual([["2026-01", 36]])
  })

  it("describes the grouping basis for each card", () => {
    expect(getStatsDivisionLabel("population")).toBe("人口栅格 · 行政区汇总")
    expect(getStatsDivisionLabel("housing")).toBe("建筑结构 · 抗震等级")
    expect(getStatsDivisionLabel("economy")).toBe("区域经济贡献")
    expect(getStatsDivisionLabel("radiation")).toBe("月份 · 异常等级")
  })
})
