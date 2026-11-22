# 专题图模块全量性能优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 消除 thematic-workbench 探查报告中确认的全部性能问题（11 组），行为保持不变，最后通过测试、构建与部署冒烟验证。

**Architecture:** 三层推进：(1) 纯函数层算法优化（直方图分位数、单遍统计、消除每像素分配）；(2) 像素分析移入 Web Worker（Vite 原生 `new Worker(new URL(...), {type:"module"})`，jsdom 测试走同步回退）；(3) 渲染/响应式/请求层修复（postRender 提前去重、拖拽投影缓存、deep watch 降级、请求并行化+缓存）。所有修改行为保持：现有 110+ 测试文件是回归安全网。

**Tech Stack:** Vue 3 + Vite 7（Worker 原生支持，零配置改动）+ Vitest (jsdom) + Mars3D/Cesium + three.js

**Spec:** 本计划自带探查结论（2026-11-19 三路探查 + 人工精读 map.ts），无独立 spec 文档。

## Global Constraints

- **行为保持**：所有分析结果数值、UI 交互语义、请求副作用不变（容差：浮点求和顺序差 ≤ 1e-9）。
- **零新依赖**：不加任何 npm 包；Worker 用 Vite 内置能力。
- **测试环境是 jsdom**：`typeof Worker === "undefined"`，任何 Worker 代码必须有同步回退。
- **不重构文件结构**：不拆分 10382 行的 index.vue（性能修复不需要）；组件拆分是另一个话题。
- **保留的功能性上限不动**：undo 栈 25MB 上限、256MB GeoTIFF 导入上限、50000 补充要素上限维持原样（产品行为，非性能债）。
- 每个任务以 `git commit` 结束；提交信息按仓库惯例 `perf:`/`fix:` 前缀。

## 明确不修项（探查报告中的较轻项，理由如下）

- `captureScope` 等 4 数字小对象的 `JSON.stringify`（map.ts:1256-1268 轮询内）——纳秒级，修了无可测收益。
- `segmentKey` 逐段字符串构建（dbt116-renderer.ts:102）——A3 canvas 一次性绘制成本，非交互热路径。
- `onBusinessLayersChanged` 6 事件×全部图层（map.ts:29-38）——已有 50ms debounce 兜底，清理完备。
- 就绪轮询循环的 `requestRender`（map.ts:959/993/1123/1257）——等待 Cesium 图元就绪的语义需要它，Task 3 消除空闲重渲染后影响大幅缩小。
- `openStyledComposition` 的 50ms 轮询（index.vue:4238）——等待子组件渲染状态，无事件可订阅。
- undo 栈 25MB / GeoTIFF 256MB / 补充要素 5 万上限——产品功能上限，见 Global Constraints。

## Review Focus

1. **Worker 回退等价性**：jsdom/旧浏览器走同步路径，结果必须与 Worker 路径位级一致（同一纯函数，天然一致，但要防调用方重复 transfer 后复用 buffer）。
2. **opacity-only setStyle 不清空图像**：Cesium `setStyle({opacity})` 合并样式时不能触发 image 重新加载/清空——冒烟时肉眼确认滑块只改透明度。
3. **shallowRef 模板的深层读取**：index.vue 模板读取结果对象嵌套字段（如 `signalResult.value?.summary`），改 shallowRef 后整体替换赋值必须仍触发渲染。
4. **拖拽投影缓存失效**：两次拖拽之间相机可能移动，缓存必须按拖拽会话失效，不能跨会话复用。
5. **并行化后的错误语义**：原串行循环遇错即停；`Promise.all` 同样首个 reject 中断，但已发出的请求会继续完成——错误提示文案与先前一致即可，不要求请求级原子性。

---

### Task 1: 纯函数层算法优化（五个分析模块）

**Files:**
- Modify: `src/widgets/basic/thematic-workbench/statistics-analysis.ts:111-133`
- Modify: `src/widgets/basic/thematic-workbench/raster-analysis.ts:60-69, 91, 113, 231`
- Modify: `src/widgets/basic/thematic-workbench/temporal-analysis.ts:84-112, 189-192`
- Modify: `src/widgets/basic/thematic-workbench/signal-analysis.ts:331-349, 365-405`
- Modify: `src/widgets/basic/thematic-workbench/spatial-analysis.ts:61-80, 97-146`
- Test: 既有 `statistics-analysis.test.ts` / `raster-analysis.test.ts` / `temporal-analysis.test.ts` / `signal-analysis.test.ts` / `spatial-analysis.test.ts` 必须全绿（回归即验证）。

**Interfaces:**
- Consumes: 无（首任务）。
- Produces: 各 `process*` 函数签名与返回结构**完全不变**（Task 2 的 Worker 直接复用它们）。

- [ ] **Step 1: 新增等价性测试**

在 `statistics-analysis.test.ts` 追加：对 1000 个随机值，`getBreaks`（直方图版）与朴素排序版结果一致（容差 1 个 bin 宽度）：

```ts
it("quantile breaks match sorted-array breaks within one bin", () => {
  const values = Array.from({ length: 1000 }, () => Math.random() * 255)
  // 直方图实现 vs 排序实现，断言 |hist[i] - sorted[i]| <= 255/256
})
```

- [ ] **Step 2: 运行确认新测试失败（函数还是排序版）**

Run: `pnpm vitest run src/widgets/basic/thematic-workbench/statistics-analysis.test.ts`
Expected: 新增用例 FAIL（尚无直方图路径）

- [ ] **Step 3: 实现优化**

- `statistics-analysis.ts`：分位数断点改 256 桶直方图（O(n)），全图分类遍历合并进同一次遍历。
- `raster-analysis.ts`：`getLuminanceValues` 返回 `Float32Array`；`getBreaks` 同样直方图化；`processRasterPixels` 把首次 `getValueStats` 结果作为参数传给 `applyAlgebra`，消除二次统计。
- `temporal-analysis.ts`：每像素的 `frames.map + 6 次 reduce/forEach` 合并为单次手写循环，统计量（min/max/mean/variance/slope）一遍算完；帧亮度在循环外预先算一次（消除 189-192 的重复 `getLuminance`）。
- `signal-analysis.ts`：`filterScalar` 的 `neighbors` 数组提升到函数级预分配复用；均值滤波完全免排序（滑动和），仅 median 保留排序；`localResidualEnergy` 同样复用预分配缓冲。
- `spatial-analysis.ts`：`contour` 格网循环的 `indices/corners/points` 每格分配改为循环外预分配 + 复用；`distanceFromMask` 两遍合并为单遍双指针（若不可合并则保留两遍，仅消除闭包分配）。

数值路径只许重组遍历，不许改公式。

- [ ] **Step 4: 运行五个模块测试全绿**

Run: `pnpm vitest run src/widgets/basic/thematic-workbench/{statistics,raster,temporal,signal,spatial}-analysis.test.ts`
Expected: PASS（含既有全部用例）

- [ ] **Step 5: Commit**

```bash
git add -u src/widgets/basic/thematic-workbench/
git commit -m "perf: optimize pixel analysis hot loops (histogram breaks, single-pass stats, buffer reuse)"
```

---

### Task 2: 像素分析 Worker 化

**Files:**
- Create: `src/widgets/basic/thematic-workbench/analysis-worker.ts`
- Create: `src/widgets/basic/thematic-workbench/analysis-worker-client.ts`
- Create: `src/widgets/basic/thematic-workbench/analysis-worker-client.test.ts`
- Modify: `src/widgets/basic/thematic-workbench/index.vue:4532, 4651, 4756, 5398, 5486`（五处 `process*Pixels(...)` 同步调用点）

**Interfaces:**
- Consumes: Task 1 的五个 `process*` 纯函数（原签名）。
- Produces:
  - `type AnalysisKind = "signal" | "statistics" | "spatial" | "temporal" | "raster"`
  - `runAnalysis(kind: AnalysisKind, payload: AnalysisRequest): Promise<AnalysisResult>`（client 导出；jsdom/Worker 不可用时同步 import 回退，直接调用纯函数）
  - `AnalysisRequest`：`{ pixels: Uint8ClampedArray; width: number; height: number; options: unknown }`，temporal 为 `{ frames: TemporalFrameInput[]; options }`。
  - Worker 协议：postMessage `{ id, kind, payload }` → 回 `{ id, ok: true, result } | { id, ok: false, error: string }`；pixels 用 transferable 转移所有权。

- [ ] **Step 1: 写 client 回退路径的失败测试**

```ts
it("falls back to sync processing when Worker is unavailable", async () => {
  // jsdom 下 typeof Worker === "undefined"
  const result = await runAnalysis("statistics", { pixels: new Uint8ClampedArray([...]), width: 2, height: 2, options: {...} })
  expect(result.summary).toBeDefined()
})
it("round-trips through postMessage when Worker exists", async () => {
  // 用 class FakeWorker 注入 window.Worker，验证消息协议与 transfer 调用
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run src/widgets/basic/thematic-workbench/analysis-worker-client.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 worker 与 client**

- `analysis-worker.ts`：`self.onmessage` 分发到五个纯函数，结果 postMessage 回传并 transfer `result.pixels.buffer`。
- `analysis-worker-client.ts`：模块级单例 Worker（`new Worker(new URL("./analysis-worker.ts", import.meta.url), { type: "module" })`，包 try/catch）；请求表 `Map<id, {resolve, reject}>`；Worker 构造失败或 `typeof Worker === "undefined"` 时 `import("./signal-analysis")` 等同步回退。
- index.vue 五处调用点：`const result = await runAnalysis("signal", { pixels: source.data, ... })`，注意 `source.data` 转移后不可再用（现有代码在结果里还用 `source` 生成 `sourceImage`——改为 transfer 前先 `source.data.slice()` 一份给 worker，或 worker 走拷贝不转移；**取后者：拷贝不转移，安全第一**，主线程保留原 buffer 生成 sourceImage）。

- [ ] **Step 4: 运行 client 测试 + 受影响的既有测试**

Run: `pnpm vitest run src/widgets/basic/thematic-workbench/analysis-worker-client.test.ts src/widgets/basic/thematic-workbench/screenshot-analysis.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/widgets/basic/thematic-workbench/analysis-worker*.ts src/widgets/basic/thematic-workbench/index.vue
git commit -m "perf: move pixel analysis off the main thread via web worker with sync fallback"
```

---

### Task 3: map.ts / thematic-3d.ts 每帧开销消除

**Files:**
- Modify: `src/widgets/basic/thematic-workbench/map.ts:477-509`（emitSelectionBounds / startSelectionBoundsListener）
- Modify: `src/widgets/basic/thematic-workbench/thematic-3d.ts:56-59, 81-86, 254-277`
- Create: `src/widgets/basic/thematic-workbench/selection-emit-key.test.ts`（若抽出纯函数）

**Interfaces:**
- Produces:
  - map.ts 内部纯函数 `cameraDigest(map): string`（经 `export` 暴露以便测试）：`[position.x, position.y, position.z, heading, pitch, roll, canvas.clientWidth, canvas.clientHeight].map(v => v.toFixed(1)).join(",")`
  - thematic-3d.ts 私有：`lastClipPath: string`（setClip 去重）、构造时缓存的 `reducedMotion` MediaQueryList。

- [ ] **Step 1: 写 cameraDigest 测试**

```ts
it("cameraDigest changes when position changes and not when only time passes", () => {
  // 用最小 fake map 对象（{ camera: {...}, scene: { canvas: {...} } }）验证
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run src/widgets/basic/thematic-workbench/selection-emit-key.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现**

- `emitSelectionBounds`：先算 `cameraDigest` + `rectInfo` 组成的廉价 key；与 `lastSelectionBoundsKey` 同则直接 return（**在**昂贵路径之前）。昂贵路径（`getSelectionCanvasOutline` 的 getHeight/投影）只在此后执行；`getSelectionViewportBounds` 与 `outline` 共享一次 `getSelectionCanvasOutline` 调用（当前算了两遍）。
- `thematic-3d.ts`：
  - 构造函数缓存 `this.reducedMotion = matchMedia(...)`，tick 里读 `.matches`，加 `change` 监听（dispose 移除）。
  - `tick`：`if (!this.rings.length && !this.flows.length) { return }` 放在 `requestRender` 之前（无动画内容不强制重渲染）。
  - `update()`：`JSON.stringify(this.bounds) !== JSON.stringify(bounds)` → 四字段数值比较；`settingsChanged` → 逐字段比较（`enabled/quality/height/opacity/speed/lighting/shadows/labels/density/tail` + `effects` 数组 join 比较）。
  - `setClip`：拼好 clipPath 字符串后与 `lastClipPath` 相同则 return，不同才写 `style.clipPath`。

- [ ] **Step 4: 运行相关既有测试**

Run: `pnpm vitest run src/widgets/basic/thematic-workbench/selection-geometry.test.ts src/widgets/basic/thematic-workbench/display-model.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -u src/widgets/basic/thematic-workbench/
git commit -m "perf: skip per-frame selection bound work when camera is idle, stop idle rAF renders"
```

---

### Task 4: 拖拽热路径（符号拖拽投影缓存 + 画板 rAF 合并）

**Files:**
- Modify: `src/widgets/basic/thematic-workbench/map.ts:158-203, 223-265`（snapSymbol + onMove）
- Modify: `src/widgets/basic/thematic-workbench/CartographyComposer.vue:619, 870-876`
- Modify: `src/widgets/basic/thematic-workbench/index.vue:5723-5726, 5996-6001`

**Interfaces:**
- Produces: map.ts 内部类型 `SnapTargets = { points: Point2D[]; segments: Array<[Point2D, Point2D]> }`；`snapSymbol(point, size, excludeId?, targets?: SnapTargets)`——targets 传入时跳过投影收集。

- [ ] **Step 1: 无独立测试（拖拽交互），以既有 composition 测试为回归网**

Run: `pnpm vitest run src/widgets/basic/thematic-workbench/cartography-layout.test.ts src/widgets/basic/thematic-workbench/composition-*.test.ts`
Expected: PASS（记录基线）

- [ ] **Step 2: 实现**

- `ensureCartographySymbolLayer` 的 `pointerdown`：进入拖拽时（相机已被 `enableInputs = false` 锁死，屏幕投影恒定）**一次性**收集 `SnapTargets`（复用 snapSymbol 现有收集逻辑抽出为 `collectSnapTargets(excludeId)`），`onMove` 里传入。`symbolDragCleanup` 里置空缓存。
- `updateCartographySymbolStyle` 单次调用维持直接收集。
- `CartographyComposer.vue`：两个 `items` deep watcher 合并为一个；拖拽 `move` 回调里 `item.x/y` 直接赋值，但 emit/save 的触发用 rAF 合并（`scheduleItemChange()`：一帧内多次 move 只 emit 一次）。
- `index.vue`：`onBoardWheel` → `renderAllCharts` 与 resize `onMove` → `renderChartItem` 均加帧合并标志（`pendingRenderAll`/`pendingRenderItem: Set<string>` + requestAnimationFrame 调度）。

- [ ] **Step 3: 运行回归**

Run: `pnpm vitest run src/widgets/basic/thematic-workbench/composition-*.test.ts src/widgets/basic/thematic-workbench/cartography-layout.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add -u src/widgets/basic/thematic-workbench/
git commit -m "perf: cache snap projections per drag session, coalesce board chart renders per frame"
```

---

### Task 5: 透明度 watch 改 opacity-only 更新

**Files:**
- Modify: `src/widgets/basic/thematic-workbench/map.ts`（新增导出）
- Modify: `src/widgets/basic/thematic-workbench/index.vue:3503-3559`（7 个 watch）

**Interfaces:**
- Produces: `export function setRasterResultOpacity(opacity: number): boolean`——仅当 `rasterGraphic` 存在时 `rasterGraphic.setStyle({ opacity: Math.min(1, Math.max(0, opacity)) })` + `requestRender`；无 graphic 返回 false。

- [ ] **Step 1: 实现**

map.ts 新增函数（紧邻 `renderRasterResult`）；index.vue 七个 watch 内 `mapWork.renderRasterResult(result.image, rectangle, opacity / 100)` 改为 `mapWork.setRasterResultOpacity(opacity / 100)`，其余守卫条件保留。

- [ ] **Step 2: 类型检查 + 相关测试**

Run: `pnpm vue-tsc --noEmit --skipLibCheck && pnpm vitest run src/widgets/basic/thematic-workbench/screenshot-analysis.test.ts`
Expected: 通过

- [ ] **Step 3: Commit**

```bash
git add -u src/widgets/basic/thematic-workbench/
git commit -m "perf: apply result opacity without re-uploading the base64 image"
```

---

### Task 6: 编辑器 deep watch 与全量序列化降级

**Files:**
- Modify: `src/widgets/basic/thematic-workbench/DbtStandardEditor.vue:255-270, 319-360, 413-499, 539-566`
- Modify: `src/widgets/basic/thematic-workbench/TemplateDataRenderer.vue:67-116, 159`
- Modify: `src/widgets/basic/thematic-workbench/ResultMapPublicationPanel.vue:79-104`
- Modify: `src/widgets/basic/thematic-workbench/DisplaySettings.vue:302-308`

**Interfaces:**
- Produces: 无新导出（组件内改动）。

- [ ] **Step 1: 记录既有测试基线**

Run: `pnpm vitest run src/widgets/basic/thematic-workbench/DbtStandardEditor.import.test.ts src/widgets/basic/thematic-workbench/ResultMapPublicationPanel.test.ts src/widgets/basic/thematic-workbench/TemplateMapEditor.test.ts`
Expected: PASS（基线）

- [ ] **Step 2: 实现**

- `DbtStandardEditor.vue`：
  - 553-566 的 deep watch：去掉每次击键的 `JSON.stringify(doc)` diff——改为 deep watch 只做 `dirtyRevision++`，防抖 180ms 后 `render()`；`renderSnapshot` 的 `JSON.parse(JSON.stringify(...))` 改 `structuredClone`（319/325/346/360/413/435/499 同样处理；undo/redo 比较复用已存字符串，不再重复 stringify）。
  - 550-552 的 `flush:"sync"` deep watcher：改为同一 `dirtyRevision` 计数（`publicationRevision` 由防抖后的微任务更新），消除每击键的同步深遍历。
- `TemplateDataRenderer.vue`：`sourceIssue` 从 computed 改 ref + 防抖 300ms watch（内部才调 `renderTemplateDocument`）；67 行 `JSON.stringify(next) !== JSON.stringify(sources.value)` 改为比较引用/长度 + 浅层 id 比较（`window` focus 事件里只做引用比较，变了才走深比较）。
- `ResultMapPublicationPanel.vue`：`sourceKey` 保留 computed（浅拼接），但 `watch(sourceKey)` 里的 `mapPublicationHash` 计算改防抖 300ms + 去掉 `flush:"sync"`。
- `DisplaySettings.vue`：`scheduleStyle` 已存在防抖——确认 302 行 watch 走它；304-307 两处 `JSON.parse(JSON.stringify(value))` 深拷贝改 `structuredClone`。

- [ ] **Step 3: 运行 Task 6 Step 1 的三个测试文件 + 全量**

Run: `pnpm vitest run src/widgets/basic/thematic-workbench/DbtStandardEditor.import.test.ts src/widgets/basic/thematic-workbench/ResultMapPublicationPanel.test.ts src/widgets/basic/thematic-workbench/TemplateMapEditor.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add -u src/widgets/basic/thematic-workbench/
git commit -m "perf: debounce editor deep watches, replace JSON round-trips with structuredClone"
```

---

### Task 7: dbt116-standard 深拷贝与 turf 重算消除

**Files:**
- Modify: `src/widgets/basic/thematic-workbench/dbt116-standard.ts:108-127, 142-205`
- Test: `src/widgets/basic/thematic-workbench/dbt116-standard.test.ts`

**Interfaces:**
- Produces: `readDbtDocument`/`mergeDbtSourceLayer`/`standardBounds`/`dbtDrawingBounds`/`dbtScopedLayers` 签名不变；内部新增模块级 `WeakMap<object, Bounds>` 缓存。

- [ ] **Step 1: 写失败测试**

```ts
it("does not copy the raster image string when merging layers", () => {
  const doc = makeDocWithRaster("x".repeat(1_000_000))
  const merged = mergeDbtSourceLayer(doc, otherLayer)
  expect(merged.layers[0].raster.image).toBe(doc.layers[0].raster.image) // 同一字符串引用
})
it("memoizes drawing bounds per layer array", () => { /* 两次调用返回相同对象 */ })
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run src/widgets/basic/thematic-workbench/dbt116-standard.test.ts`
Expected: 新用例 FAIL

- [ ] **Step 3: 实现**

- `readDbtDocument`：116 行每要素 `JSON.stringify(geometry).length > 2MB` 改为坐标计数估计（`坐标数 × 2 × 12 字符` 估算，常量命名 `GEOMETRY_COORD_BUDGET`）；121 行整包深拷贝改**手写浅结构克隆**（对象/数组新建，`raster.image` 等大字符串按引用共享——字符串不可变，安全）。
- `mergeDbtSourceLayer`：合并走增量校验（只校验新叠图层），不再每层重跑整包 `readDbtDocument`。
- `standardBounds`/`dbtDrawingBounds`：加 `WeakMap` 缓存（key 为输入 layer 数组引用）；`dbtScopedLayers` 与 `inspectDbtDocument` 把已算 bounds 作参数下传，消除 55-56 行的双重计算链。

- [ ] **Step 4: 运行测试**

Run: `pnpm vitest run src/widgets/basic/thematic-workbench/dbt116-standard.test.ts src/widgets/basic/thematic-workbench/cartography-backend-render.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -u src/widgets/basic/thematic-workbench/
git commit -m "perf: share raster strings across dbt clones, memoize turf bounds, incremental merge validation"
```

---

### Task 8: 请求层并行化、缓存与可取消

**Files:**
- Modify: `src/widgets/basic/thematic-workbench/remote-cartography-source.ts:40-130, 209-213`
- Modify: `src/widgets/basic/thematic-workbench/eoapi-thematics.ts:327-376, 399-403`
- Modify: `src/widgets/basic/thematic-workbench/result-map-publication.ts:41-46, 67-100, 139-144, 226-254`
- Modify: `src/widgets/basic/thematic-workbench/CartographyDataWorkflow.vue:361-364, 461-462, 491-497, 516, 587-591, 620`
- Modify: 调用 `waitForJob` 的组件（ThematicBackendServices.vue 等，grep 确认）

**Interfaces:**
- Produces:
  - `waitForJob(jobId: string, opts?: { signal?: AbortSignal }): Promise<...>`（新增可选参数，向后兼容）
  - `remote-cartography-source.ts` 模块级 `const vectorCache = new Map<string, { at: number; data: TemplateDocument }>()`，TTL 5 分钟，容量 20 条 LRU。

- [ ] **Step 1: 记录基线**

Run: `pnpm vitest run src/widgets/basic/thematic-workbench/remote-cartography-source.test.ts src/widgets/basic/thematic-workbench/RemoteCartographySources.test.ts src/widgets/basic/thematic-workbench/result-map-publication.test.ts src/widgets/basic/thematic-workbench/CartographyDataWorkflow.test.ts`
Expected: PASS（基线）

- [ ] **Step 2: 实现**

- `remote-cartography-source.ts`：66 行去掉 `cache: "no-store"`（STAC/tilejson 元数据可走 HTTP 缓存）；41-46 的 `text() + TextEncoder` 双份内存改 `arrayBuffer()` → 长度检查 → `new TextDecoder().decode()`（单份）；`remoteVector` 结果进 `vectorCache`。
- `eoapi-thematics.ts`：`waitForJob` 接受 `{ signal }`，每轮 `setTimeout` 前检查 `signal.aborted` 并 reject `DOMException("...", "AbortError")`；`quickGenerateThematic` 及组件调用方传 `AbortController`（组件 `onUnmounted` abort——ThematicBackendServices.vue:195 已有清理钩子，挂进去）。
- `result-map-publication.ts`：78 行两个 `await mapPublicationHash` 只算一次比较；139-144 的 48 个串行冲突检查改 `Promise.all`；226-254 `loadPublishedMap` 逐层 `Promise.all`（每层内部 parts 也并行，保持错误信息取第一个 reject）。
- `CartographyDataWorkflow.vue`：`queryAll` 目录检索 `Promise.all`；491-497 补充图幅 `Promise.all`；461 行 `render()` 复用 `queryAll` 刚取的 item（删掉重复 `refreshRemoteItem`）；516 行指纹：canonical JSON 只序列化一次供两个用途；587-591/620 逐层/逐项改 `Promise.all`。

- [ ] **Step 3: 运行基线四组测试**

Run: 同 Step 1
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add -u src/widgets/basic/thematic-workbench/
git commit -m "perf: parallelize publication/workflow requests, memoize remote vectors, abortable job polling"
```

---

### Task 9: index.vue 响应式大对象与杂项

**Files:**
- Modify: `src/widgets/basic/thematic-workbench/index.vue:2754, 2828-2912, 2903, 3469, 3766-3782, 5100-5101`

**Interfaces:**
- Produces: 无（组件内改动）。

- [ ] **Step 1: 记录基线**

Run: `pnpm vitest run src/widgets/basic/thematic-workbench/workbench-template-catalog.test.ts src/widgets/basic/thematic-workbench/earthquake-analysis.test.ts src/widgets/basic/thematic-workbench/workbench-draft.test.ts`
Expected: PASS

- [ ] **Step 2: 实现**

- `earthquakeDataset`（2903）、`earthquakeResult`（2911）、七个带 dataURL 的结果 ref（2828-2900）、`temporalFrames`（2854）、`backgroundBaseline`（2891）：`ref` → `shallowRef`（赋值点已是整体替换；模板深层读取在整体替换时照常触发）。`earthquakeDataset.value = dataset` 处加 `markRaw(dataset)`。
- 2754 行 `JSON.parse(JSON.stringify(source))` 深拷贝 → `structuredClone`。
- 3469 行 `isDirty` computed 的双 stringify：改 `watch(draft, ..., { deep: true })` 防抖 400ms 更新 `isDirty` ref（tab 切换/关闭确认读取 ref）。
- 模板卡片标签函数（1288-1354 调用的 `getTemplatePurpose`/`templateProfessionalIdentity`/`productMethods`/`getTemplateDataTypeLabels`/`getTemplateComponentLabels`）：加 `computed` 缓存 Map（key: templateId，依赖 `templateCatalog`/`templates`），模板里查表。
- 3766-3782 `loadTemplates`：消除双重 `mergeStandardTemplateCatalog([])` 与二次赋值。

- [ ] **Step 3: 运行基线测试 + vue-tsc**

Run: `pnpm vue-tsc --noEmit --skipLibCheck && pnpm vitest run src/widgets/basic/thematic-workbench/workbench-template-catalog.test.ts src/widgets/basic/thematic-workbench/workbench-draft.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add -u src/widgets/basic/thematic-workbench/
git commit -m "perf: shallow-ref large datasets and results, cache template card labels, dedupe loadTemplates"
```

---

### Task 10: 模板渲染图层泄漏修复与监听合并

**Files:**
- Modify: `src/widgets/basic/thematic-workbench/map.ts:1040-1142`（renderTemplateScene）

**Interfaces:**
- Produces: `renderTemplateScene` 签名不变。

- [ ] **Step 1: 实现**

- 1047 行：`clearTemplateHeat()` 提到函数入口无条件执行（修复 workflowKey+heat 路径旧 HeatLayer 泄漏）。
- 1042 行图层 id 去掉 `:${performance.now()}`，固定为 `thematic-workbench-expression:${workflowKey}`。
- 1084/1105 行每 graphic 的 `graphic.on(click)`：删除，改为图层级一次 `layer.on(mars3d.EventType.click, (event) => { const id = event.graphic?.attr?.templateId; if (id) { eventTarget.fire("templateFeatureSelected", { id }) } })`（GraphicLayer 事件带 `event.graphic`；features/annotations 的 attr 需含 `templateId`——现有 `attr: p` 已含）。

- [ ] **Step 2: 运行相关测试**

Run: `pnpm vitest run src/widgets/basic/thematic-workbench/template-renderer.test.ts src/widgets/basic/thematic-workbench/render-style.test.ts src/widgets/basic/thematic-workbench/expression-presentation.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add -u src/widgets/basic/thematic-workbench/
git commit -m "perf: fix heat layer leak on workflow renders, stable layer ids, layer-level click routing"
```

---

### Task 11: 全量验证与部署冒烟

**Files:**
- 无代码修改（验证任务）

- [ ] **Step 1: 全量单测**

Run: `pnpm test:unit`
Expected: 全绿（对照任务开始前记录的基线，不允许新失败）

- [ ] **Step 2: 类型 + Lint + 构建**

Run: `pnpm lint && pnpm build`
Expected: 0 error，构建产物生成

- [ ] **Step 3: 开发服务器冒烟（chrome-devtools MCP）**

Run: `pnpm dev`（后台）→ 浏览器打开 `http://localhost:5280`
逐项确认：
1. 打开专题图工作台，框选锁定范围——拖动相机时无控制台报错，选区边框跟随；静止 3 秒后（DevTools Performance 或 console）无持续 postRender 重活（3D 效果关闭时地图应停止重渲染）。
2. 任一分析（如统计）运行时 UI 不冻结（可点击其他按钮），结果正常渲染到框选。
3. 透明度滑块快速拖动：结果仅透明度变化，图像不消失。
4. 拖拽制图符号：跟手、无报错。
5. `list_console_messages` 无新增 error。

- [ ] **Step 4: Docker 部署验证（可选，如用户需要）**

Run: `./run.sh` → 浏览器访问部署地址重复 Step 3 的 1-2 项
Expected: 同上

- [ ] **Step 5: 汇报**

汇总：修复清单 ↔ 探查问题映射表、测试结果、冒烟截图，向用户报告。
