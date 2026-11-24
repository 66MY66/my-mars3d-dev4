import { describe, expect, it } from "vitest"
import { roadLinePaint } from "./road-centerline-style"

describe("road centerline paint", () => {
  it("keeps highway, railway, water and roads under construction visually distinct", () => {
    expect(roadLinePaint("highWay").color).toBe("#547c66")
    expect(roadLinePaint("railway").color).toBe("#59626a")
    expect(roadLinePaint("water").color).toBe("#5896b5")
    expect(roadLinePaint("roadsBeingBuilt").dash).toEqual([6, 4])
    expect(roadLinePaint("levelFourRoad").color).not.toBe(roadLinePaint("nationalRoad").color)
    expect(roadLinePaint("missing").color).toBe("#b7afa2")
  })
})
