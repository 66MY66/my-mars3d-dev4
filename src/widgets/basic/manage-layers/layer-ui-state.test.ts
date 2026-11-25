import { describe, expect, it } from "vitest"
import { forgetPersistedLayerUiState } from "./layer-ui-state"

describe("forgetPersistedLayerUiState", () => {
  it("removes undone import layers from saved checkbox and style records", () => {
    localStorage.setItem("mars3d_layer_checked_keys", JSON.stringify(["keep-layer", "import-group", "import-raster"]))
    localStorage.setItem("mars3d_layer_expanded_keys", JSON.stringify(["import-group", "keep-layer"]))
    localStorage.setItem("mars3d_layer_opacity_values", JSON.stringify({ "keep-layer": 1, "import-raster": 0.4 }))
    localStorage.setItem("mars3d_layer_raster_style_values_v1", JSON.stringify({ "import-raster": { brightness: 1.2 } }))
    localStorage.setItem("mars3d_layer_vector_style_values_v1", JSON.stringify({ "keep-layer": { lineWidth: 2 } }))
    localStorage.setItem("mars3d_layer_sibling_order_v1", JSON.stringify({
      "import-group": ["import-raster"],
      "keep-parent": ["keep-layer", "import-raster"]
    }))

    forgetPersistedLayerUiState(["import-group", "import-raster"])

    expect(JSON.parse(localStorage.getItem("mars3d_layer_checked_keys") || "[]")).toEqual(["keep-layer"])
    expect(JSON.parse(localStorage.getItem("mars3d_layer_expanded_keys") || "[]")).toEqual(["keep-layer"])
    expect(JSON.parse(localStorage.getItem("mars3d_layer_opacity_values") || "{}")).toEqual({ "keep-layer": 1 })
    expect(JSON.parse(localStorage.getItem("mars3d_layer_raster_style_values_v1") || "{}")).toEqual({})
    expect(JSON.parse(localStorage.getItem("mars3d_layer_vector_style_values_v1") || "{}")).toEqual({ "keep-layer": { lineWidth: 2 } })
    expect(JSON.parse(localStorage.getItem("mars3d_layer_sibling_order_v1") || "{}")).toEqual({
      "keep-parent": ["keep-layer"]
    })
  })
})
