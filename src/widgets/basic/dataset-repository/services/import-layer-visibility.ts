type ImportLayer = Record<string, any>

function isGroupLayer(layer: ImportLayer): boolean {
  return String(layer?.sourceType || layer?.type || "").toLowerCase() === "group"
}

/**
 * 导入时保留全部图层。
 * selectedIds 为 null 表示本次没有图层选择，沿用成果包原来的显隐。
 * 空数组表示用户打开了图层选择但没有勾选：全部创建，先不显示。
 * 非空数组只立刻显示勾选的图层，其余图层创建后先不显示。
 */
export function applyImportLayerVisibility(layers: ImportLayer[], selectedIds: string[] | null): ImportLayer[] {
  const list = Array.isArray(layers) ? layers : []
  if (selectedIds === null) {
    return list.map((layer) => ({ ...layer }))
  }

  const selected = new Set(selectedIds.map((id) => String(id || "").trim()).filter(Boolean))
  return list.map((layer) => {
    if (isGroupLayer(layer)) {
      return withVisibility(layer, true)
    }
    const id = String(layer?.id || "")
    return withVisibility(layer, selected.has(id))
  })
}

function withVisibility(layer: ImportLayer, visible: boolean): ImportLayer {
  const options = layer?.options && typeof layer.options === "object"
    ? { ...layer.options, show: visible }
    : layer?.options
  return {
    ...layer,
    visible,
    show: visible,
    ...(options ? { options } : {})
  }
}
