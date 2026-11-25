import { describe, expect, it } from "vitest"
import { planLocate } from "@/cui-bridge/hostLocate"

describe("planLocate", () => {
  it("plans a highlighted flight from the alert center and bbox", () => {
    expect(planLocate({
      target: "ALT-SC-001",
      crs: "EPSG:4326",
      center: [103.82, 33.2],
      bbox: [103.65, 33.05, 103.98, 33.35],
      highlight: true
    })).toMatchObject({
      status: "locate",
      target: "ALT-SC-001",
      center: [103.82, 33.2],
      highlight: true
    })
  })

  it("keeps a coordinate-less alert from flying", () => {
    expect(planLocate({ target: "ALT-NOCOORD-01" })).toEqual({ status: "missing_coords", target: "ALT-NOCOORD-01" })
  })

  it("rejects a bbox that is not EPSG:4326", () => {
    expect(planLocate({ crs: "EPSG:3857", bbox: [1, 2, 3, 4] })).toEqual({ status: "error", error: "EXTENT_MISMATCH" })
  })
})
