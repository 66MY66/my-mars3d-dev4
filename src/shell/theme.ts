export type ThemeMode = "light" | "dark"

const storageKey = "theme"
let mediaBound = false

export function getStoredTheme(): ThemeMode | null {
  const value = localStorage.getItem(storageKey)
  if (value === "light" || value === "dark") {
    return value
  }
  return null
}

export function getCurrentTheme(): ThemeMode {
  const datasetTheme = document.documentElement.dataset.theme
  if (datasetTheme === "dark") {
    return "dark"
  }
  return "light"
}

function applyTheme(mode: ThemeMode) {
  document.documentElement.dataset.theme = mode
  window.dispatchEvent(new CustomEvent("themeChange"))
}

export function setTheme(mode: ThemeMode) {
  localStorage.setItem(storageKey, mode)
  applyTheme(mode)
}

export function initTheme() {
  const stored = getStoredTheme()
  const supportsMatchMedia = typeof window.matchMedia === "function"
  if (stored) {
    applyTheme(stored)
  } else if (supportsMatchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    applyTheme("dark")
  } else {
    setTheme("light")
  }

  if (supportsMatchMedia && !mediaBound) {
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    if (typeof mq?.addEventListener === "function") {
      mediaBound = true
      mq.addEventListener("change", (event) => {
        setTheme(event.matches ? "dark" : "light")
      })
    }
  }
}
