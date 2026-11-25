export function resolveInitialCheckedKeys(
  persistedKeys: string[] | null | undefined,
  layers: Array<{ id?: string | number; show?: boolean }>
): string[] {
  if (Array.isArray(persistedKeys)) {
    return persistedKeys
  }

  return visibleLayerIds(layers)
}

/** 打开图层管理时，已在地图上显示的图层必须保持勾选，不能被旧记录关掉。 */
export function mergeCheckedKeysWithVisibleLayers(
  persistedKeys: string[] | null | undefined,
  layers: Array<{ id?: string | number; show?: boolean }>
): string[] {
  const visibleIds = visibleLayerIds(layers)
  if (!Array.isArray(persistedKeys)) {
    return visibleIds
  }
  return Array.from(new Set([...persistedKeys.map((id) => String(id)), ...visibleIds]))
}

function visibleLayerIds(layers: Array<{ id?: string | number; show?: boolean }>): string[] {
  return layers
    .filter((layer) => layer.id !== undefined && layer.id !== null && layer.show !== false)
    .map((layer) => String(layer.id))
}

export type CheckableTreeNode = {
  id?: string | number
  key?: string | number
  layerId?: string | number
  group?: boolean
  disabled?: boolean
  isBasemap?: boolean
  children?: CheckableTreeNode[]
}

export function treeNodeLayerKey(node: CheckableTreeNode | null | undefined): string {
  if (!node) {
    return ""
  }
  const raw = node.layerId ?? node.key ?? node.id
  if (raw === undefined || raw === null || raw === "") {
    return ""
  }
  return String(raw)
}

function isVirtualTreeNode(node: CheckableTreeNode | null | undefined): boolean {
  return treeNodeLayerKey(node).startsWith("__")
}

/** 只收集真正对应地图图层的叶子。分组和虚拟根节点不参与勾选。 */
export function listControllableLeafNodes(nodes: CheckableTreeNode[]): CheckableTreeNode[] {
  const leaves: CheckableTreeNode[] = []
  const walk = (list: CheckableTreeNode[]) => {
    list.forEach((node) => {
      const children = Array.isArray(node?.children) ? node.children : []
      if (children.length) {
        walk(children)
      }
      if (!node || isVirtualTreeNode(node) || node.disabled || node.isBasemap || node.group || children.length) {
        return
      }
      if (!treeNodeLayerKey(node)) {
        return
      }
      leaves.push(node)
    })
  }
  walk(Array.isArray(nodes) ? nodes : [])
  return leaves
}

/**
 * 勾选集合以树节点自己的 key 为准。
 * 正在显示的叶子必须在里面；旧记录里已经不在这棵树上的 id 不能再把别的图层勾上。
 */
export function checkedKeysForLayerTree(
  nodes: CheckableTreeNode[],
  persistedKeys: string[] | null | undefined,
  isLayerVisible: (node: CheckableTreeNode) => boolean
): string[] {
  const leaves = listControllableLeafNodes(nodes)
  const leafKeys = new Set(leaves.map((node) => treeNodeLayerKey(node)))
  const visibleKeys = leaves.filter((node) => isLayerVisible(node)).map((node) => treeNodeLayerKey(node))
  const persisted = Array.isArray(persistedKeys)
    ? persistedKeys.map((id) => String(id)).filter((id) => leafKeys.has(id))
    : []
  return Array.from(new Set([...persisted, ...visibleKeys]))
}

export function normalizeCheckedKeyInput(keys: unknown): string[] {
  if (Array.isArray(keys)) {
    return keys.map((id) => String(id))
  }
  if (keys && typeof keys === "object" && Array.isArray((keys as { checked?: unknown[] }).checked)) {
    return (keys as { checked: unknown[] }).checked.map((id) => String(id))
  }
  return []
}

/** 分组勾选作用到它下面的全部叶子；叶子只作用到自己。 */
export function descendantLeafKeys(node: CheckableTreeNode | null | undefined): string[] {
  if (!node || isVirtualTreeNode(node) || node.disabled || node.isBasemap) {
    return []
  }
  const children = Array.isArray(node.children) ? node.children : []
  if (!children.length) {
    if (node.group) {
      return []
    }
    const key = treeNodeLayerKey(node)
    return key ? [key] : []
  }
  return children.flatMap((child) => descendantLeafKeys(child))
}
