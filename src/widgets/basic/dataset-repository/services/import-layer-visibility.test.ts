import { describe, expect, it } from "vitest"
import { applyImportLayerVisibility } from "./import-layer-visibility"

const layers = [
  { id: "vector", sourceType: "group", name: "矢量", visible: true },
  { id: "boundary", sourceType: "geojson", name: "云南州市界", pid: "vector", visible: true },
  { id: "events", sourceType: "geojson", name: "2023-2025年地震事件", pid: "vector", visible: true }
]

describe("applyImportLayerVisibility", () => {
  it("creates every layer hidden when the optional selection is empty", () => {
    const result = applyImportLayerVisibility(layers, [])

    expect(result.map((layer) => layer.id)).toEqual(["vector", "boundary", "events"])
    expect(result.find((layer) => layer.id === "vector")).toMatchObject({ visible: true, show: true })
    expect(result.find((layer) => layer.id === "boundary")).toMatchObject({ visible: false, show: false })
    expect(result.find((layer) => layer.id === "events")).toMatchObject({ visible: false, show: false })
  })

  it("shows only the checked layers and still keeps the others", () => {
    const result = applyImportLayerVisibility(layers, ["boundary"])

    expect(result.map((layer) => layer.id)).toEqual(["vector", "boundary", "events"])
    expect(result.find((layer) => layer.id === "boundary")).toMatchObject({ visible: true, show: true })
    expect(result.find((layer) => layer.id === "events")).toMatchObject({ visible: false, show: false })
  })
})
