# 性能测量脚本（前后必须逐字一致，保证可比性）

测量目标：容器部署的生产构建（http://localhost:5280），chrome-devtools MCP 驱动。

## S1. rAF 帧率采样器（B2/B4 用）

注入后立即开始采样，`durationMs` 后 resolve。返回平均 FPS、最长帧、>100ms 帧数。

```js
async () => {
  const durationMs = 5000
  const frames = []
  let last = performance.now()
  await new Promise(resolve => {
    const loop = (now) => {
      frames.push(now - last); last = now
      if (now - frames[0] < durationMs) { requestAnimationFrame(loop) } else { resolve() }
    }
    requestAnimationFrame(loop)
  })
  const avg = frames.length / (frames.reduce((a, b) => a + b, 0) / 1000)
  const worst = Math.max(...frames)
  const over100 = frames.filter(d => d > 100).length
  return { avgFps: Math.round(avg), worstFrameMs: Math.round(worst), framesOver100ms: over100, sampled: frames.length }
}
```

（B4 符号拖拽用 `durationMs = 3000`，其余同。）

## S2. long task 监听器（B1/B4/B5 用）

注入后开始监听 `longtask`，`durationMs` 后 resolve。返回最长任务、总阻塞、任务数。

```js
async () => {
  const durationMs = 8000
  const tasks = []
  const po = new PerformanceObserver(list => {
    for (const e of list.getEntries()) { tasks.push({ start: e.startTime, dur: e.duration, name: e.name }) }
  })
  po.observe({ entryTypes: ["longtask"] })
  await new Promise(r => setTimeout(r, durationMs))
  po.disconnect()
  return {
    count: tasks.length,
    longestMs: tasks.length ? Math.round(Math.max(...tasks.map(t => t.dur))) : 0,
    totalBlockingMs: Math.round(tasks.reduce((a, t) => a + Math.max(0, t.dur - 50), 0)),
    names: [...new Set(tasks.map(t => t.name))].slice(0, 5)
  }
}
```

（B1 用 `durationMs = 8000` 覆盖分析全程；B5 用 `durationMs = 3000`。）

## S3. 空闲渲染探针（B3 用）

注入后每帧记录是否有 rAF 活动，3 秒后返回 rAF 回调总数与最长帧间隔。

```js
async () => {
  const durationMs = 3000
  let rafCount = 0
  let last = performance.now()
  let maxGap = 0
  const start = last
  await new Promise(resolve => {
    const loop = (now) => {
      rafCount++; maxGap = Math.max(maxGap, now - last); last = now
      if (now - start < durationMs) { requestAnimationFrame(loop) } else { resolve() }
    }
    requestAnimationFrame(loop)
  })
  // rafCount 即页面自身 rAF 心跳数；maxGap 大说明中间有帧掉队
  return { rafCount, maxGapMs: Math.round(maxGap) }
}
```

判定「渲染活动归零」：trace（performance_start_trace）中无持续脚本/光栅活动 + S3 的 rafCount 接近采样上限（每帧都有我们自己的探针在跑，若页面也在持续渲染则 CPU 占用高）。最终以 trace 为准，S3 作辅助。

## 场景操作步骤（v2 修订：无 GPU / 无可信指针事件环境的适配协议）

实测约束：headless Chrome 软件光栅化（空闲帧 ~987ms，绝对 FPS 目标不可达，以相对改善 ≥70% 判据）；
合成事件进不了 Cesium；`SCREENSHOT_TOOLS_IN_WORKBENCH=false`（产品 flag，测试钉住，不为测量翻转）。
故 B1/B5/B4 经 `window.__thematicPerfHook`（map.ts onMounted 挂载，commit 09b2263）驱动真实函数路径。

**统一前置**：打开专题制图工作台 → `hook.lockSelection({west:100.5, south:24.5, east:104.5, north:28})`
→ 点击出现的「锁定范围」按钮（真实 selectionConfirmed 链）。

| 场景 | 操作 | 采集 |
|------|------|------|
| B1 分析冻结 | 从当前地图 canvas 截取选区像素（1280 宽）→ 启动 S2 → `hook.runStatisticsProbe(data, w, h, {operation:"category", method:"quantile", classes:5, validMin:0, validMax:255})`（真实 processStatisticsPixels）| S2 longtask + 耗时 |
| B2 相机运动 | 启动 S1+S2 → `hook.map().camera.flyTo({lng:102.5, lat:26.25, alt:836842, duration:5})`（长弧飞行，每帧触发 postRender 选区链，与拖拽同路径且可复现）| S1 帧间隔 + S2 |
| B3 空闲渲染 | 前置后静置，S3 探针 3 秒 | S3 + trace 存档 |
| B4 符号拖拽 | `hook.beginSymbolPlacement({kind:"epicenter", family:"earthquake", label:"震中", icon:"", accent:"#e04b4b"}, {size:32, rotation:0, opacity:1, color:"#e04b4b"})` → `hook.fireMapClick(102.5, 26.25)`（真实放置处理链）→ MCP 可信 drag(符号→canvas) | S1+S2 |
| B5 透明度滑块 | `hook.renderRaster(生成的 1280 宽 canvas dataURL, 选区, 0.9)` 先建图层 → 启动 S2 → 连续 10 次 `hook.renderRaster(同图, 选区, 0.1..0.9)`（真实基线滑块路径）→ 对照组 `rasterGraphic.setStyle({opacity})` | S2 longtask 对比 |

B1 像素来源（前后一致）：drawImage 当前 canvas 选区裁剪至 1280 宽 2D canvas → getImageData。
B5 图像来源：同上转 dataURL（PNG）。

## 记录格式（追加到 summary.md）

```
| 轮次 | 日期 | image digest | commit | B1 longest/total | B2 fps/worst | B3 rafCount | B4 fps/longest | B5 longest | 结论 |
```

## 记录格式（追加到 summary.md）

```
| 轮次 | 日期 | image digest | commit | B1 longest/total | B2 fps/worst | B3 rafCount | B4 fps/longest | B5 longest | 结论 |
```
