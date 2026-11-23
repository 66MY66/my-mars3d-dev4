import { GRID_DENSITY_SOURCES } from "@/utils/grid-density-statistics"

const POPULATION_VISUAL_COLORS = [
  "#ffffff", "#e8f5cb", "#c6e08c", "#8dc95c", "#56b044",
  "#2f8f3d", "#1f6f36", "#14552d", "#0b3d20"
] as const

export function populationVisualRgb(value: number): [number, number, number] {
  const bins = GRID_DENSITY_SOURCES.population.bins
  const index = bins.findIndex((bin) => value >= bin.min && value <= bin.max)
  const hex = POPULATION_VISUAL_COLORS[Math.max(0, index)] || POPULATION_VISUAL_COLORS[0]
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
}
