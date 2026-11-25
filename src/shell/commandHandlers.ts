import { commandBus } from "@/core/commandBus"
import { setHostContext } from "@/cui-bridge/hostContext"
import { parseBbox } from "@/cui-bridge/hostLocate"
import { router } from "@/shell/router"
import { setTheme } from "@/shell/theme"
import { getStoredSidebarCollapsed, setStoredSidebarCollapsed } from "@/shell/sidebar"
import { useWidget } from "@mars/common/store/widget"

type NavigationTarget = string | { name: string }

type ShellCommandDependencies = {
  navigate: (target: NavigationTarget) => Promise<unknown> | unknown
  widgetApi: {
    activate: (option: any, reload?: boolean) => void
    disable: (option: string | string[]) => void
    getWidget: (name: string) => any
  }
}

const routeTargets: Record<string, NavigationTarget> = {
  map: "/",
  "satellite.dataPool": { name: "satellite-data-pool" },
  "satellite.metadata": { name: "satellite-metadata" },
  "satellite.catalog": { name: "satellite-catalog" },
  "satellite.query": { name: "satellite-query" },
  "satellite.share": { name: "satellite-share" }
}

const panelTargets: Record<string, string> = {
  layer: "manage-layers",
  basemap: "manage-basemap"
}

export function registerShellCommands(dependencies?: ShellCommandDependencies) {
  const widgetApi = dependencies?.widgetApi ?? useWidget()
  const navigate = dependencies?.navigate ?? ((target: NavigationTarget) => router.push(target))

  commandBus.register("route.navigate", async (args) => {
    const route = args?.route
    const target = typeof route === "string" ? routeTargets[route] : undefined
    if (!target) {
      return { success: false, error: "INVALID_ARGUMENT: unsupported route" }
    }
    await navigate(target)
    return { success: true, data: { route } }
  })

  commandBus.register("ui.panel.open", (args) => {
    const panel = args?.panel
    const widgetName = typeof panel === "string" ? panelTargets[panel] : undefined
    if (!widgetName) {
      return { success: false, error: "INVALID_ARGUMENT: unsupported panel" }
    }
    if (!widgetApi.getWidget(widgetName)) {
      return { success: false, error: "TARGET_NOT_FOUND: panel is unavailable" }
    }
    widgetApi.activate({ name: widgetName }, false)
    return { success: true, data: { panel, state: "open" } }
  })

  commandBus.register("ui.panel.close", (args) => {
    const panel = args?.panel
    const widgetName = typeof panel === "string" ? panelTargets[panel] : undefined
    if (!widgetName) {
      return { success: false, error: "INVALID_ARGUMENT: unsupported panel" }
    }
    if (!widgetApi.getWidget(widgetName)) {
      return { success: false, error: "TARGET_NOT_FOUND: panel is unavailable" }
    }
    widgetApi.disable(widgetName)
    return { success: true, data: { panel, state: "closed" } }
  })

  commandBus.register("theme.switch", (args) => {
    const mode = args?.mode
    if (mode !== "light" && mode !== "dark") {
      return { success: false, error: "mode 只能是 light 或 dark" }
    }
    setTheme(mode)
    return { success: true, data: { mode } }
  })

  commandBus.register("sidebar.toggle", () => {
    const next = !getStoredSidebarCollapsed()
    setStoredSidebarCollapsed(next)
    window.dispatchEvent(new CustomEvent("sidebarToggle", { detail: { collapsed: next } }))
    return { success: true, data: { collapsed: next } }
  })

  commandBus.register("widget.refresh", (args) => {
    const id = args?.id
    if (!id || typeof id !== "string") {
      return { success: false, error: "缺少参数 id" }
    }
    const widget = widgetApi.getWidget(id)
    if (!widget) {
      return { success: false, error: `widget 不存在: ${id}` }
    }
    widgetApi.activate({ name: id }, true)
    return { success: true }
  })

  commandBus.register("map.locate", async (args) => {
    const { executeHostLocate } = await import("@/cui-bridge/hostMap")
    return executeHostLocate(args)
  })

  commandBus.register("panel.open", (args) => {
    const name = args?.name
    if (name === "judgment") {
      const target = typeof args?.target === "string" ? args.target.trim() : ""
      if (!target) {
        return { success: false, error: "INVALID_ARGUMENT: missing alert target" }
      }
      if (!widgetApi.getWidget("alert-confirm")) {
        return { success: false, error: "PANEL_NOT_FOUND" }
      }
      const title = typeof args?.title === "string" && args.title.trim() ? args.title.trim() : target
      widgetApi.activate({
        name: "alert-confirm",
        data: {
          props: {
            cuiLink: {
              alertId: target,
              title,
              taskId: args?.task_id ? String(args.task_id) : "",
              panelInstanceId: args?.panel_instance_id ? String(args.panel_instance_id) : "",
              machineJudgment: args?.machine_judgment ?? null,
              savedReviews: Array.isArray(args?.saved_reviews) ? args.saved_reviews : [],
              allowedActions: Array.isArray(args?.allowed_actions) ? args.allowed_actions.map(String) : []
            }
          }
        }
      }, false)
      setHostContext({ id: target, label: title, type: "alert" })
      return { success: true, data: { name: "judgment", target, state: "open" } }
    }
    if (name === "cartography") {
      const project = projectIdOf(args?.project)
      if (!project) {
        return { success: false, error: "PROJECT_REQUIRED: cartography open needs an existing project" }
      }
      const scope = args?.scope && typeof args.scope === "object" ? args.scope : {}
      const crs = scope.crs ?? args?.crs
      if (crs != null && crs !== "EPSG:4326") {
        return { success: false, error: "EXTENT_MISMATCH" }
      }
      const bbox = parseBbox(scope.bbox ?? args?.bbox)
      if (!bbox) {
        return { success: false, error: "EXTENT_MISMATCH" }
      }
      if (!widgetApi.getWidget("thematic-workbench")) {
        return { success: false, error: "PANEL_NOT_FOUND" }
      }
      const projectVersion = args?.project_version ? String(args.project_version) : ""
      widgetApi.activate({
        name: "thematic-workbench",
        data: {
          props: {
            source: "cui",
            targetName: project,
            cuiProjectId: project,
            cuiProjectVersion: projectVersion,
            cuiBbox: bbox,
            cuiTaskId: args?.task_id ? String(args.task_id) : ""
          }
        }
      }, false)
      setHostContext({ id: project, label: projectVersion ? `${project} ${projectVersion}` : project, type: "project" })
      return { success: true, data: { name: "cartography", project, bbox, state: "open" } }
    }
    return { success: false, error: "PANEL_UNSUPPORTED" }
  })
}

function projectIdOf(project: unknown): string {
  if (typeof project === "string") {
    return project.trim()
  }
  if (project && typeof project === "object" && typeof (project as { project_id?: unknown }).project_id === "string") {
    return (project as { project_id: string }).project_id.trim()
  }
  return ""
}
