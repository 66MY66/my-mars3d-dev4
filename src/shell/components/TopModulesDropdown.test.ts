import { describe, expect, it } from "vitest"
import { getInitialModuleId, getNavigableModuleId, getModuleAction } from "./topModules"

describe("top module navigation state", () => {
  it("defaults to visualization outside the data-management route", () => {
    expect(getInitialModuleId("/", null)).toBe("visualization")
  })

  it("keeps the current module when an empty subsystem is clicked", () => {
    expect(getNavigableModuleId("preprocess", "visualization")).toBe("visualization")
    expect(getNavigableModuleId("risk-monitoring", "visualization")).toBe("visualization")
    expect(getNavigableModuleId("anomaly-monitoring", "visualization")).toBe("visualization")
    expect(getNavigableModuleId("loss-assessment", "visualization")).toBe("visualization")
  })

  it("switches the active module only for connected subsystems", () => {
    expect(getNavigableModuleId("data-management", "visualization")).toBe("data-management")
    expect(getNavigableModuleId("visualization", "data-management")).toBe("visualization")
  })

  it("recognizes navigation actions carried by the visualization route", () => {
    expect(getModuleAction({ open: "layers" })).toBe("layers")
    expect(getModuleAction({ open: "cui" })).toBe("cui")
    expect(getModuleAction({ open: "unknown" })).toBeUndefined()
  })
})
