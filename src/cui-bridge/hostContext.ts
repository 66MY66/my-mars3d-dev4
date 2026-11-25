import type { HostContext } from "@/cui-bridge/protocol"

let current: HostContext = null

export function getHostContext(): HostContext {
  return current
}

export function setHostContext(next: HostContext) {
  current = next
  window.dispatchEvent(new CustomEvent("cui-host-context"))
}
