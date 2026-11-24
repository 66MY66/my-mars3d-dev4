# 卫星遥感数据资源池页面布局优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 删除页面级统计/列表展示，并优化三个数据分析卡片的收起态布局。

**Architecture:** 保持单文件 Vue 页面和现有数据、图表、交互逻辑不变，只调整模板展示边界与 scoped Less 布局规则。收起态恢复已有明细列表，展开态继续使用现有趋势图和数据列表。

**Tech Stack:** Vue 3、Ant Design Vue、ECharts、Less、Vite。

**Spec:** `docs/superpowers/specs/2026-11-24-satellite-data-pool-layout-design.md`

## Global Constraints

- 不新增依赖和后端接口。
- 不删除资源池业务方法或状态数据。
- 页面展示文案与现有组件保持一致。

## Review Focus

- 收起态三卡片必须同时显示饼图和明细列表。
- 展开态趋势图、周期切换和数据列表不能被隐藏规则误伤。
- 窄屏下明细名称、数量、百分比不能重叠。
- 资源池列表模板移除后，资源池操作逻辑仍可被创建/导入流程使用。

### Task 1: 调整数据资源池页面展示

**Files:**
- Modify: `src/pages/satellite/views/SatelliteDataPoolLayout.vue`

- [ ] 移除顶部统计卡片模板和资源池列表表格模板。
- [ ] 修改收起态 CSS：显示 `.access-detail-list`，设置饼图与明细列表的横向尺寸和可读性。
- [ ] 更新响应式规则，确保小屏可换行且展开态趋势图仍占满可用宽度。
- [ ] 运行构建与相关检查。
