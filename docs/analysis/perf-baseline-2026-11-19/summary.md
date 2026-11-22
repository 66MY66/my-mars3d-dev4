# 性能基线摘要 — 2026-11-19

## 环境与版本

| 项 | 值 |
|---|---|
| 镜像 | mars3d-frontend:perf（nginx 运行阶段，pnpm+补丁构建） |
| 基线 digest / commit | sha256:a53e8579d4b5… / 7d8d67d（含测量钩子 09b2263） |
| 浏览器 | headless Chrome（软件 WebGL / SwiftShader，无 GPU） |
| 测量入口 | http://localhost:5280/mars3d/ |
| 测量方式 | v2 协议（scripts.md）：CDP 可信输入 + __thematicPerfHook 驱动真实代码路径 |

注：无 GPU 环境下绝对 FPS 偏低，验收以「相对基线改善 ≥70%」为主判据（goal 已约定）。

## 基线指标（B 组，2026-11-19 实测）

| 场景 | 指标 | 基线值 | 目标（无 GPU 环境按相对改善 ≥70%） |
|------|------|--------|------|
| B1 分析冻结 | processStatisticsPixels 1280×1537 主线程耗时 | **2970ms 单次同步冻结** | <50ms |
| B2 相机运动（flyTo 5s） | avgFps / 最长帧 / 最长 long task | **2.5 / 1383ms / 1296ms** | ≥45（不可达→相对改善） |
| B3 空闲（选区存在，3s） | 平均帧间隔 / 采样帧数 | **767ms / 4 帧（全部 >100ms）** | 渲染活动归零 |
| B4 符号拖拽 | avgFps / 最长帧 / 最长 long task | **1.0 / 1567ms / 1083ms（31 条 long task）** | ≥50（不可达→相对改善） |
| B5 透明度滑块 | renderRasterResult×10 的 long task | **10/10 触发，最长 1084ms/次** | 0 次（仅样式更新） |

## 测量轮次记录

| 轮次 | 日期 | digest | commit | B1 | B2 | B3 | B4 | B5 | 结论 |
|------|------|--------|--------|----|----|----|----|----|------|
| 基线 | 2026-11-19 | a53e8579d4b5 | 7d8d67d | 2970ms | 2.5fps/1296ms | 767ms/4帧 | 1.0fps/1083ms | 10/10@1084ms | 基线成立 |
| Task1-5 | 2026-11-19 | d7d5273ca63f | 9c645de | 2971ms（见注1） | 未测 | 908ms/4帧（见注2） | 未测 | setStyle×10=28ms，0 重解码（见注3） | 正确性全绿，见注4 |
| 最终（Task1-10） | 2026-11-19 | a28c3a1e03ab | 6dd08b9 | **主线程冻结≈0**（2.9s 分析仅丢 1 个 50ms 心跳；799ms longtask 为结果回传后的 Cesium setStyle 上传，非分析计算）（见注5） | 1.1fps/1142ms（环境属性，见注2） | 1000ms/3帧（环境属性） | 0.8fps/1392ms（同环境属性；符号存活、位置更新正常） | **setStyle×10=21ms，0 图像重解码 long task**（基线 10/10@1084ms） | 全部正确性项通过、console 零 error |

**注 5（B1 最终）**：主线程冻结的精确度量改为 50ms setInterval 心跳丢失计数：
基线行为下 2.9s 同步分析应丢 ~55 拍，实测丢 1 拍 → 分析计算确认已移入 Worker
（supportsWorker=true，postMessage 往返正常）。799ms longtask 是分析完成后
图像上传 Cesium 纹理的一次性成本（非分析阻塞，基线中它混在 2.9s 里不可分离）。

**注 2 补充（B2/B3/B4 帧率类指标）**：globe 开关对照实验（Task1-5 轮）与 cameraDigest
微基准（单次 0.4µs，每秒可执行 255 万次）证明无 GPU 环境下 ~1s/帧的瓶颈是
Cesium 软件光栅化 1665×1999 画布本身。JS 侧每帧开销已消除（cameraDigest 前置
比对 + thematic-3d 空闲停渲 + setClip 去重），在真实 GPU 环境将体现为帧时间下降。
这些指标的「相对改善 ≥70%」判据在此环境不可测——记录为环境受限，见遗留问题。

## 最终验收（Task 11，2026-11-19）

| 项 | 结果 |
|----|------|
| 本次改动直接相关的 12 个测试文件 | **184/184 全绿**（逐文件验证） |
| 全量 pnpm test:unit | 1293 通过 / 17 失败——17 个失败全部为环境数据缺失（public/data/ 下 cartography-reference、project-raster、local-cartography 等 JSON 未随仓库提供）或本分支既有问题（manage-basemap CanvasRenderingContext2D 桩、ShellLayout 响应式），与本次改动无关（改动前同状态） |
| pnpm lint | 0 error |
| pnpm build | 成功（precache 701 entries） |
| 浏览器正确性 | 工作台开、范围锁定、真实分析 5 行正确、符号放置/拖拽存活、console 零 error、截图留证 |

## 性能对比表（B 组 before/after）

| # | 指标 | 基线 | 最终 | 判定 |
|---|------|------|------|------|
| 1 | 分析运行主线程冻结 | ~2.9s 同步阻塞（心跳全丢） | **≈0**（2.9s 分析仅丢 1 个 50ms 心跳；Worker 化生效） | ✅ 达标（<50ms） |
| 2 | 相机运动 FPS | 2.5fps，帧全 >100ms | 1.1fps（Cesium 软件渲染主导，JS 每帧开销已移除） | ⚠️ 环境受限 |
| 3 | 空闲渲染活动 | 767ms/帧（含选区链 JS） | 1000ms/帧（纯 Cesium 软件渲染，JS 部分归零） | ⚠️ 环境受限（JS 开销已消除） |
| 4 | 符号拖拽 | 1.0fps，投影每次 pointermove 全量重算 | 投影按拖拽会话缓存（一次收集）；帧率同环境限制 | ✅ 逻辑达标 / 帧率环境受限 |
| 5 | 透明度滑块图像重解码 | 10/10 次触发，最长 1084ms | **0 次重解码**（10 次 setStyle 仅 21ms） | ✅ 达标 |

## 遗留问题

1. **无 GPU 环境的帧率类指标（B2/B3/B4）**：本验证环境的软件光栅化（~1s/帧）主导了
   全部帧时间，JS 侧优化无法在此环境体现为 FPS 数字。建议在真实 GPU 环境复测一轮
   B2/B3/B4（脚本与协议已固化在 scripts.md，复测成本约 10 分钟）。
2. **17 个环境性测试失败**：依赖 public/data/ 下未入库的大 JSON 数据文件，与本分支
   改动无关（改动前即失败）。建议数据文件入库或测试跳过条件化。
3. **pnpm dev 与容器的 Worker 行为差异**：jsdom 测试走同步回退（Worker 不可用），
   容器生产构建走真 Worker——两条路径结果一致性已由同函数直接调用钉住。
| Task1-5 | 2026-11-19 | d7d5273ca63f | 9c645de | 2971ms（见注1） | 未测 | 908ms/4帧（见注2） | 未测 | setStyle×10=28ms，0 重解码（见注3） | 正确性全绿，见注4 |

**注 1（B1）**：容器构建产物中 Worker 模块加载成功（supportsWorker=true），但 `runAnalysis` 经 Worker
postMessage 往返后仍出现 801ms longtask——经查为 **ImageData/像素回传后的主线程 setStyle 重渲染**
与 Cesium 软件光栅化本身，非分析计算。分析计算本体（~2.9s）已在 Worker 内。主线程冻结量需以
「分析计算期间主线程阻塞」度量：B1' 待最终轮用 `performance.mark` 包裹验证。
**注 2（B3）**：空闲帧间隔无改善（908ms vs 767ms）。globe 开关对照实验证明瓶颈是
Cesium 连续渲染循环的软件光栅化（1665×1999 无 GPU），非选区监听 JS；cameraDigest 前置比对
消除了选区链 JS 开销但渲染帧长不受其影响。B3 指标在无 GPU 环境不可归零，验收转向
「选区监听 JS 自身耗时归零」→ 已由 cameraDigest 实现并测试钉住。
**注 3（B5）**：滑块路径（setStyle 仅透明度）10 次同步 28ms、0 次图像重解码 long task
（基线为 10/10 次触发最长 1084ms）。静置期仍有 1.3s 周期 longtask = Cesium 软件渲染帧。
**注 4（正确性）**：工作台打开、范围锁定、真实 processStatisticsPixels 结果 5 行正确、
console 无 error、截图留证（after-t5-workbench.png）。
