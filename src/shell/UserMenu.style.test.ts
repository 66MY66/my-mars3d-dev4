import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const source = readFileSync(resolve(process.cwd(), "src/shell/UserMenu.vue"), "utf8")

describe("account button visual contract", () => {
  it("uses a 32px avatar and a 14px chevron in a 48px hug row", () => {
    expect(source).toMatch(/width:\s*48px/)
    expect(source).toMatch(/height:\s*32px/)
    expect(source).toMatch(/gap:\s*2px/)
    expect(source).toMatch(/width:\s*14px/)
    expect(source).toMatch(/margin:\s*11px\s+0/)
    expect(source).toMatch(/openLogin/)
    expect(source).not.toMatch(/HeaderIconButton/)
  })
})
