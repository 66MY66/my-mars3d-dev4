import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

describe("population statistics card UI contract", () => {
  it("uses the profile-only layout without the density/profile mode switch", () => {
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "mars-map.vue"), "utf8")

    expect(source).not.toContain("populationChartMode")
    expect(source).not.toContain("handlePopulationChartModeChange")
    expect(source).toContain("class=\"population-latitude-control\"")
    expect(source).toContain("'population-profile': c.key === 'population'")
  })
})
