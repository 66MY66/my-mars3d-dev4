export type TemporalOperation = "difference" | "statistics" | "trend" | "anomaly"
export type TemporalDifferenceMode = "delta" | "rate"
export type TemporalStatisticMode = "mean" | "variance"

export type TemporalFrameInput = {
  pixels: Uint8ClampedArray
  width: number
  height: number
  label: string
  timestamp: string
}

export type TemporalAnalysisOptions = {
  operation: TemporalOperation
  differenceMode?: TemporalDifferenceMode
  statisticMode?: TemporalStatisticMode
  minimumR2?: number
  anomalyThreshold?: number
  opacity?: number
}

export type TemporalAnalysisSummary = {
  operation: TemporalOperation
  frameCount: number
  pixelCount: number
  validPixelCount: number
  changedRatio: number
  anomalyRatio: number
  meanDelta: number
  meanVariance: number
  meanSlope: number
  meanR2: number
  minimum: number
  maximum: number
  frameMeans: number[]
}

export type TemporalAnalysisResult = {
  pixels: Uint8ClampedArray
  summary: TemporalAnalysisSummary
}

type PixelMetric = {
  valid: boolean
  first: number
  last: number
  mean: number
  variance: number
  slope: number
  r2: number
  anomaly: number
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

function getLuminance(pixels: Uint8ClampedArray, offset: number) {
  return (pixels[offset] * 0.2126 + pixels[offset + 1] * 0.7152 + pixels[offset + 2] * 0.0722) / 2.55
}

function interpolateColor(start: number[], end: number[], ratio: number) {
  const t = clamp(ratio, 0, 1)
  return start.map((value, index) => Math.round(value + (end[index] - value) * t))
}

function divergingColor(value: number, scale: number) {
  const ratio = clamp(Math.abs(value) / Math.max(scale, 0.001), 0, 1)
  if (value < 0) {
    return interpolateColor([214, 230, 242], [32, 93, 166], ratio)
  }
  return interpolateColor([247, 227, 205], [190, 45, 52], ratio)
}

function sequentialColor(value: number, maximum: number) {
  const ratio = clamp(value / Math.max(maximum, 0.001), 0, 1)
  if (ratio < 0.5) {
    return interpolateColor([18, 60, 92], [39, 181, 174], ratio * 2)
  }
  return interpolateColor([39, 181, 174], [244, 191, 69], (ratio - 0.5) * 2)
}

function getPixelMetric(frames: TemporalFrameInput[], offset: number, frameSums?: number[]): PixelMetric {
  const count = frames.length
  // 单遍计算：亮度只算一次，统计量全部手写循环（避免 map/reduce/slice 的闭包与中间数组）
  const values = new Float64Array(count)
  for (let i = 0; i < count; i++) {
    if (frames[i].pixels[offset + 3] < 16) {
      return { valid: false, first: 0, last: 0, mean: 0, variance: 0, slope: 0, r2: 0, anomaly: 0 }
    }
    const value = (frames[i].pixels[offset] * 0.2126 + frames[i].pixels[offset + 1] * 0.7152 + frames[i].pixels[offset + 2] * 0.0722) / 2.55
    values[i] = value
    if (frameSums) { frameSums[i] += value }
  }

  let sum = 0
  for (let i = 0; i < count; i++) { sum += values[i] }
  const mean = sum / count
  let variance = 0
  const xMean = (count - 1) / 2
  let covariance = 0
  let xVariance = 0
  let totalVariance = 0
  for (let i = 0; i < count; i++) {
    const deviation = values[i] - mean
    const xDeviation = i - xMean
    variance += deviation * deviation
    covariance += xDeviation * deviation
    xVariance += xDeviation * xDeviation
    totalVariance += deviation * deviation
  }
  variance /= count
  const slope = xVariance > 0 ? covariance / xVariance : 0
  // fittedMean 为线性拟合值的均值，数学上等于 mean；保留原计算路径
  const fittedMean = mean
  let residualVariance = 0
  for (let i = 0; i < count; i++) {
    const fitted = fittedMean + slope * (i - xMean)
    residualVariance += (values[i] - fitted) ** 2
  }
  const r2 = totalVariance > 0.0001 ? clamp(1 - residualVariance / totalVariance, 0, 1) : 0
  const backgroundCount = Math.max(1, count - 1)
  let backgroundSum = 0
  for (let i = 0; i < count - 1; i++) { backgroundSum += values[i] }
  const backgroundMean = backgroundSum / backgroundCount
  let backgroundVariance = 0
  for (let i = 0; i < count - 1; i++) { backgroundVariance += (values[i] - backgroundMean) ** 2 }
  backgroundVariance /= backgroundCount
  const anomaly = (values[count - 1] - backgroundMean) / Math.max(2, Math.sqrt(backgroundVariance))

  return {
    valid: true,
    first: values[0],
    last: values[count - 1],
    mean,
    variance,
    slope,
    r2,
    anomaly
  }
}

function validateFrames(frames: TemporalFrameInput[]) {
  if (frames.length < 2) {
    throw new Error("Temporal analysis requires at least two frames")
  }
  const width = frames[0].width
  const height = frames[0].height
  const expectedSize = width * height * 4
  if (
    width <= 0 ||
    height <= 0 ||
    frames.some((frame) => frame.width !== width || frame.height !== height || frame.pixels.length !== expectedSize)
  ) {
    throw new Error("Temporal frames must share the same dimensions")
  }
  return { width, height, expectedSize }
}

export function processTemporalFrames(frames: TemporalFrameInput[], options: TemporalAnalysisOptions): TemporalAnalysisResult {
  const { width, height, expectedSize } = validateFrames(frames)
  const output = new Uint8ClampedArray(expectedSize)
  const metrics: PixelMetric[] = []
  const opacity = clamp(Number(options.opacity) || 88, 10, 100) / 100
  const anomalyThreshold = clamp(Number(options.anomalyThreshold) || 2, 0.5, 4)
  const minimumR2 = clamp(Number(options.minimumR2) || 0.35, 0, 1)
  const frameSums = Array(frames.length).fill(0)
  const frameCounts = Array(frames.length).fill(0)
  let validPixelCount = 0
  let deltaSum = 0
  let varianceSum = 0
  let slopeSum = 0
  let r2Sum = 0
  let changedCount = 0
  let anomalyCount = 0
  let maxVariance = 0
  let maxAbsDelta = 0
  let maxAbsSlope = 0
  let minimum = Number.POSITIVE_INFINITY
  let maximum = Number.NEGATIVE_INFINITY

  for (let offset = 0; offset < expectedSize; offset += 4) {
    const metric = getPixelMetric(frames, offset, frameSums)
    metrics.push(metric)
    if (!metric.valid) {
      continue
    }
    validPixelCount += 1
    const delta = metric.last - metric.first
    deltaSum += delta
    varianceSum += metric.variance
    slopeSum += metric.slope
    r2Sum += metric.r2
    maxVariance = Math.max(maxVariance, metric.variance)
    maxAbsDelta = Math.max(maxAbsDelta, Math.abs(delta))
    maxAbsSlope = Math.max(maxAbsSlope, Math.abs(metric.slope))
    minimum = Math.min(minimum, metric.first, metric.last, metric.mean)
    maximum = Math.max(maximum, metric.first, metric.last, metric.mean)
    if (Math.abs(delta) >= 5) {
      changedCount += 1
    }
    if (Math.abs(metric.anomaly) >= anomalyThreshold) {
      anomalyCount += 1
    }
    for (let frameIndex = 0; frameIndex < frames.length; frameIndex++) {
      frameCounts[frameIndex] += 1
    }
  }

  metrics.forEach((metric, index) => {
    const offset = index * 4
    if (!metric.valid) {
      output[offset + 3] = 0
      return
    }

    let color = [255, 255, 255]
    let alpha = opacity
    if (options.operation === "difference") {
      const rawDelta = metric.last - metric.first
      const value = options.differenceMode === "rate" ? rawDelta / Math.max(1, metric.first) * 100 : rawDelta
      color = divergingColor(value, options.differenceMode === "rate" ? 50 : Math.max(8, maxAbsDelta))
      alpha *= Math.abs(value) < 1 ? 0.18 : 1
    } else if (options.operation === "statistics") {
      const value = options.statisticMode === "mean" ? metric.mean : metric.variance
      color = sequentialColor(value, options.statisticMode === "mean" ? 100 : maxVariance)
    } else if (options.operation === "trend") {
      color = divergingColor(metric.slope, Math.max(1, maxAbsSlope))
      alpha *= metric.r2 >= minimumR2 ? 1 : 0.16
    } else {
      color = metric.anomaly < 0
        ? interpolateColor([105, 157, 196], [52, 40, 138], Math.abs(metric.anomaly) / 4)
        : interpolateColor([248, 183, 116], [181, 23, 71], Math.abs(metric.anomaly) / 4)
      alpha *= Math.abs(metric.anomaly) >= anomalyThreshold ? 1 : 0
    }
    output[offset] = color[0]
    output[offset + 1] = color[1]
    output[offset + 2] = color[2]
    output[offset + 3] = Math.round(255 * alpha)
  })

  const safeCount = Math.max(1, validPixelCount)
  return {
    pixels: output,
    summary: {
      operation: options.operation,
      frameCount: frames.length,
      pixelCount: width * height,
      validPixelCount,
      changedRatio: changedCount / safeCount,
      anomalyRatio: anomalyCount / safeCount,
      meanDelta: Number((deltaSum / safeCount).toFixed(2)),
      meanVariance: Number((varianceSum / safeCount).toFixed(2)),
      meanSlope: Number((slopeSum / safeCount).toFixed(2)),
      meanR2: Number((r2Sum / safeCount).toFixed(2)),
      minimum: Number((Number.isFinite(minimum) ? minimum : 0).toFixed(1)),
      maximum: Number((Number.isFinite(maximum) ? maximum : 0).toFixed(1)),
      frameMeans: frameSums.map((sum, index) => Number((sum / Math.max(1, frameCounts[index])).toFixed(1)))
    }
  }
}
