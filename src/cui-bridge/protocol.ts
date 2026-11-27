export const protocolVersion = "1.0.0" as const

export type AppContextMessage = {
  version: typeof protocolVersion
  type: "app.context"
  data: {
    pageId: string
    userId: string
    theme: "light" | "dark"
  }
}

export type CmdExecuteMessage = {
  version: typeof protocolVersion
  type: "cmd.execute"
  requestId?: string
  payload: {
    cmd: string
    args?: any
  }
}

export type CmdResultMessage = {
  version: typeof protocolVersion
  type: "cmd.result"
  requestId?: string
  payload: {
    cmd: string
    success: boolean
    data?: any
    error?: string
  }
}

export type AnyBridgeMessage = AppContextMessage | CmdExecuteMessage | CmdResultMessage

export const satelliteChannel = "satellite-cui" as const
export const satelliteProtocolVersion = "1.0" as const
export const hostInstanceId = "cui-main" as const
export const hostProjectName = "地震预测与防震减灾卫星遥感平台" as const

export type HostContext = {
  id: string
  label: string
  type: "alert" | "project"
} | null

export type SatelliteEnvelope = {
  channel: typeof satelliteChannel
  version: typeof satelliteProtocolVersion
  instanceId: string
  type:
    | "cui.ready"
    | "cui.initialized"
    | "cui.theme.applied"
    | "host.init"
    | "host.theme"
    | "host.theme.change"
    | "host.context"
    | "cmd.execute"
    | "cmd.result"
    | "task.status"
    | "ui.toast"
    | "widget.refresh"
  requestId?: string
  payload?: Record<string, unknown>
}
