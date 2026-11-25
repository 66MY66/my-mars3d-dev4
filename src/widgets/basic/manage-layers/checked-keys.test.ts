import { describe, expect, it } from "vitest"
import { checkedKeysForLayerTree, descendantLeafKeys, mergeCheckedKeysWithVisibleLayers, resolveInitialCheckedKeys } from "./checked-keys"

describe("resolveInitialCheckedKeys", () => {
  it("inherits currently visible layers when no persisted selection exists", () => {
    expect(resolveInitialCheckedKeys(null, [
      { id: "import-group" },
      { id: "import-raster", show: true },
      { id: "import-vector", show: false }
    ])).toEqual(["import-group", "import-raster"])
  })

  it("preserves an explicitly persisted empty selection", () => {
    expect(resolveInitialCheckedKeys([], [
      { id: "import-raster", show: true }
    ])).toEqual([])
  })

  it("keeps currently visible layers when saved keys do not include them", () => {
    expect(mergeCheckedKeysWithVisibleLayers(["older-layer"], [
      { id: "older-layer", show: true },
      { id: "import-raster", show: true },
      { id: "hidden-vector", show: false }
    ])).toEqual(["older-layer", "import-raster"])
  })
})

describe("checkedKeysForLayerTree", () => {
  const tree = [
    {
      id: "__import_root__",
      key: "__import_root__",
      disabled: true,
      children: [
        {
          id: "import-group",
          key: "import-group",
          group: true,
          children: [
            {
              id: "vector-group",
              key: "vector-group",
              group: true,
              children: [
                { id: "boundary", key: "boundary", layerId: "boundary" },
                { id: "events", key: "events", layerId: "events" }
              ]
            }
          ]
        }
      ]
    }
  ]

  it("checks only the visible leaf under an unchecked import group", () => {
    const visible = new Set(["boundary"])
    expect(checkedKeysForLayerTree(tree, [], (node) => visible.has(String(node.layerId)))).toEqual(["boundary"])
  })

  it("keeps a visible leaf checked when the saved record missed it", () => {
    const visible = new Set(["boundary"])
    expect(checkedKeysForLayerTree(tree, ["events"], (node) => visible.has(String(node.layerId)))).toEqual(["events", "boundary"])
  })

  it("resolves a group click to its leaf layers", () => {
    expect(descendantLeafKeys(tree[0].children[0])).toEqual(["boundary", "events"])
    expect(descendantLeafKeys(tree[0].children[0].children[0].children[0])).toEqual(["boundary"])
  })
})
