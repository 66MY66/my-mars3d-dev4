export const DATA_MANAGEMENT_MODULE_ID = "data-management"
export const VISUALIZATION_MODULE_ID = "visualization"
export const DATA_MANAGEMENT_HOME = "/satellite/data-pool"
export type ModuleAction = "layers" | "cui"

export function getModuleAction(query: { open?: unknown }): ModuleAction | undefined {
  return query.open === "layers" || query.open === "cui" ? query.open : undefined
}

const CONNECTED_MODULE_IDS = new Set([DATA_MANAGEMENT_MODULE_ID, VISUALIZATION_MODULE_ID])

export function getInitialModuleId(path: string, _storedModuleId: string | null): string {
  return path.startsWith("/satellite") ? DATA_MANAGEMENT_MODULE_ID : VISUALIZATION_MODULE_ID
}

export function getNavigableModuleId(moduleId: string, currentModuleId: string): string {
  return CONNECTED_MODULE_IDS.has(moduleId) ? moduleId : currentModuleId
}
