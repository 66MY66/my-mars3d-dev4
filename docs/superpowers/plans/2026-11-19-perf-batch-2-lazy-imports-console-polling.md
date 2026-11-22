# 前端性能优化第二批 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 消除首批优化未覆盖的三个问题：mars-map 首屏静态加载 ECharts/XLSX、生产环境保留 console、setInterval 固定间隔轮询的请求重叠。

**Architecture:** (1) mars-map.vue 的 echarts 改惰性单例（首次 initOrReinitChart 时动态 import），XLSX 改导出时动态 import，类型引用改 `import type`；(2) terser `drop_console: true`；(3) 轮询从 `setInterval` 改为"请求完成后再 setTimeout 下一次"的自调度循环，加 `visibilitychange` 暂停。所有修改行为保持不变。

**Tech Stack:** Vue 3 + Vite 7 + Vitest (jsdom) + echarts/xlsx（动态 import）

**Spec:** `analysis/前端卡顿排查与优化建议（非渲染引擎）.md` §4.1/§4.2/§9.1/§9.3（探查报告），本计划自带实现决策。

## Global Constraints

- **零新依赖**：不加任何 npm 包。
- **行为保持**：图表初始化语义、Excel 导出产物、轮询拉取的数据流不变。
- **测试环境是 jsdom**：`import()` 在 vitest 中可用（原生动态导入），无需 mock Worker 那样的回退。
- 每个任务以 `git commit` 结束，`perf:` 前缀。

## Review Focus

1. **惰性 echarts 的并发 init**：两个 chart key 在同一 tick 触发 initOrReinitChart，动态 import 的 promise 必须共享（单例缓存），不能各自 import 后重复 init 同一 el。
2. **自调度轮询的重入**：setTimeout 回调里 await 的请求若抛错，循环必须继续（catch 后再排下一次），不能一次失败就停摆。
3. **visibilitychange 恢复**：页面从隐藏恢复时必须立即拉一次而不是等满间隔。
4. **XLSX 导出失败路径**：动态 import 本身可能失败（网络/chunk 加载错误），必须落入既有的 `catch { $message("导出失败") }` 分支。

---

### Task 1: mars-map.vue 移除 ECharts/XLSX 静态导入

**Files:**
- Modify: `src/components/mars-work/mars-map.vue:391-392`（import 行）、`:744`（类型）、`:1785`（init）、`:2368-2379`（export）

**Interfaces:**
- Consumes: 无。
- Produces: 模块级惰性加载器 `loadECharts(): Promise<typeof import("echarts")>` 和 `loadXLSX(): Promise<typeof import("xlsx")>`，均缓存 promise 单例；`initOrReinitChart` 改为 async；`exportCardExcel` 改为 async。

- [ ] **Step 1: 实现**

顶部 import 改为：
```ts
// 原两行静态 import 删除；echarts 类型单独保留：
import type { ECharts } from "echarts"
```
模块级（`chartInstances` 声明附近）：
```ts
let echartsPromise: Promise<typeof import("echarts")> | null = null
function loadECharts() {
  echartsPromise ||= import("echarts")
  return echartsPromise
}
```
`initOrReinitChart` 改 async，`const chart = echarts.init(el, theme)` 改为：
```ts
const echarts = await loadECharts()
const chart = echarts.init(el, theme)
```
`chartInstances` 类型 `Map<string, echarts.ECharts>` 改为 `Map<string, ECharts>`。函数内的 `await` 之后的代码若访问了已可能 dispose 的实例，需复查：`initOrReinitChart` 中 dispose 旧实例发生在 await 之前，await 后只有 init + set，无双 await 竞态需防同一 key 重复 init —— 在 await 恢复后检查 `chartInstances.get(key)` 是否已被并发调用填入，若是则放弃本次。

`exportCardExcel` 改 async，`try` 块开头加 `const XLSX = await loadXLSX()`（`loadXLSX` 同模式），删除静态 import。动态 import 失败自然落入既有 `catch { $message("导出失败") }`。

- [ ] **Step 2: 确认无静态引用残留**

Run: `grep -n 'from "echarts"\|from "xlsx"' src/components/mars-work/mars-map.vue`
Expected: 仅剩 `import type { ECharts } from "echarts"` 一行。

- [ ] **Step 3: 类型检查 + 既有测试**

Run: `pnpm lint`
Expected: 通过。Run: `pnpm vitest run src/components/mars-work` （若该目录无测试则跳过，由全量回归兜底）。

- [ ] **Step 4: Commit**

```bash
git add src/components/mars-work/mars-map.vue
git commit -m "perf: lazily import echarts and xlsx in mars-map to cut first-load cost"
```

### Task 2: 生产构建 drop_console

**Files:**
- Modify: `vite.config.ts:264`

**Interfaces:**
- Consumes: 无。
- Produces: 生产构建移除全部 console.*；dev 不受影响（terser 仅 build 生效）。

- [ ] **Step 1: 修改**

`drop_console: false` → `drop_console: true`，注释同步更新。

- [ ] **Step 2: 验证**

Run: `pnpm build 2>&1 | tail -5`
Expected: 构建成功。抽查 `dist/assets/*.js` 中 `console.log(` 出现次数为 0（`grep -c "console.log(" dist/assets/*.js | head`，允许 error/warn 若被单独保留则视产物而定——terser drop_console 移除全部 console.*，预期为 0）。

- [ ] **Step 3: Commit**

```bash
git add vite.config.ts
git commit -m "perf: drop console in production build"
```

### Task 3: ThematicJobs 轮询改自调度 + 页面隐藏暂停

**Files:**
- Modify: `src/widgets/basic/dataset-repository/components/ThematicJobs.vue:563-583`
- Modify: `src/widgets/basic/eoapi-workbench/components/ThematicJobs.vue:422-441`
- Test: `src/widgets/basic/dataset-repository/components/ThematicJobs.test.ts`（既有 `polls archive completion...` 用例为回归网；追加一个自调度行为用例）

**Interfaces:**
- Consumes: 既有 `pollArchives()`、`loadJobs()`、`updateSelectedJobDetail()`（签名不变）。
- Produces: 模块内私有函数 `scheduleNextPoll(delayMs = 3000)`：仅在 `pollInterval !== null`（轮询已启动）且 `document.visibilityState === "visible"` 时 `window.setTimeout` 下一次 tick；tick = async 函数，try/catch 包裹全部拉取逻辑后无条件 `scheduleNextPoll()`。`startPolling`/`stopPolling` 签名与语义不变（stopPolling 需同时 clearTimeout）。新增 `visibilitychange` 监听：恢复可见时若轮询未挂起则立即 tick 一次，onUnmounted 移除监听。

- [ ] **Step 1: 写失败测试**

在 `ThematicJobs.test.ts` 追加（沿用文件内既有的 fake timers / mount 模式）：
```ts
it("schedules next poll only after the previous tick's requests settle", async () => {
  vi.useFakeTimers()
  // mount 组件并触发 startPolling（沿用既有用例的激活路径）
  // 断言：advance 3000ms 后 tick 发起请求但未 resolve 时，
  // 再 advance 3000ms 不产生第二次请求；flush 后才产生下一次
})
```
测试写法以文件内既有 fake timers 用例为准，实现者按该文件惯例落地，断言核心是"未 settle 不再发请求"。

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run src/widgets/basic/dataset-repository/components/ThematicJobs.test.ts`
Expected: 新用例 FAIL（当前 setInterval 不等待 settle）。

- [ ] **Step 3: 实现两个 ThematicJobs**

`dataset-repository` 版（tick 内容 = 现 interval 回调体）：
```ts
function tickPoll() {
  void (async () => {
    try {
      pollArchives().catch(() => { requestError.value = "归档状态查询失败，将自动重试" })
      const hasRunning = jobs.value.some(j => j.status === "running" || j.status === "queued")
      if (hasRunning || ownedJobs.size) {
        await loadJobs()
        // …既有 ownedJobs / selectedJob 逻辑原样搬入
      }
    } catch { /* 单次失败不停摆 */ }
    scheduleNextPoll()
  })()
}
function scheduleNextPoll(delayMs = 3000) {
  if (pollInterval === null || document.visibilityState !== "visible") return
  pollInterval = window.setTimeout(tickPoll, delayMs)
}
```
`startPolling`：`pollInterval = null; scheduleNextPoll(0)`。`stopPolling`：`clearTimeout(pollInterval)`（变量语义从 interval id 变 timer id，改名 `pollTimer` 以防混淆）。`visibilitychange`：`document.addEventListener("visibilitychange", onVisibility)`，`onVisibility` 在恢复可见且轮询活跃时立即 tick；onUnmounted 移除监听 + stopPolling（既有调用）。
`eoapi-workbench` 版同构改造（tick 体是其现有 interval 回调）。

- [ ] **Step 4: 运行测试**

Run: `pnpm vitest run src/widgets/basic/dataset-repository/components/ThematicJobs.test.ts src/widgets/basic/eoapi-workbench/components/ThematicJobs.test.ts 2>/dev/null || pnpm vitest run src/widgets/basic/dataset-repository/components/ThematicJobs.test.ts`
Expected: 全绿（jsdom 的 `document.visibilityState` 默认 "visible"，既有用例不受影响）。

- [ ] **Step 5: Commit**

```bash
git add src/widgets/basic/dataset-repository/components/ThematicJobs.vue src/widgets/basic/eoapi-workbench/components/ThematicJobs.vue src/widgets/basic/dataset-repository/components/ThematicJobs.test.ts
git commit -m "perf: self-scheduling job polling with settle-before-next and visibility pause"
```

---

## 后续候选（本计划不含，待实测确认收益后再立计划）

- `my-repository/index.vue:1387`、`current-task/index.vue:3084/3094` 的 setInterval 同构改造（先确认其 tick 是否含网络请求）。
- 其余 25 个文件的 `JSON.parse(JSON.stringify())` 残留（多为小对象，收益待测）。
- 首屏构建体积分析（rollup-plugin-visualizer 之外的方案待定）。
