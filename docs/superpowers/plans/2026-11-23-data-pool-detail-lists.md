# 数据资源池卡片详情列表实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在数据资源池页面三张展开卡片下增加可切换显示的前端详情列表和独立分页。

**Architecture:** 继续在 `SatelliteDataPoolLayout.vue` 内实现，按钮、列表、模拟数据和分页状态均按 access/output/upload 三类独立维护。列表只在对应卡片展开且用户点击“数据列表”后显示；月/周切换时切换对应示例数据并重置分页。

**Tech Stack:** Vue 3 Options API、Ant Design Vue、现有 `a-table` 与分页配置。

**Spec:** 当前对话确认的三张卡片详情列表方案。

## Global Constraints

- 仅修改前端，不新增后端接口。
- 小卡片不显示“数据列表”按钮和详情列表。
- 详情列使用可替换的前端示例字段。
- 不改变现有资源池列表的行为。

## Review Focus

- 收起卡片后详情列表和按钮必须不可见。
- 三张卡片的列表显示状态与分页不能互相影响。
- 月/周切换后列表应切换示例数据并回到第 1 页。
- 空列表时表格应正常显示空状态。
- 资源池原有分页和加载逻辑不能回归。

### Task 1: 卡片详情列表交互与展示

**Files:**
- Modify: `src/pages/satellite/views/SatelliteDataPoolLayout.vue`

- [ ] **Step 1: Add the three list-toggle buttons and list table blocks**
- [ ] **Step 2: Add independent list visibility, sample records, columns, and pagination state**
- [ ] **Step 3: Wire period changes and card collapse behavior to list state**
- [ ] **Step 4: Add scoped styles for list spacing and table layout**
- [ ] **Step 5: Run lint/type/build checks available in the repository**

### Task 2: Regression verification

**Files:**
- Test: existing project checks; no new backend test required for this frontend-only UI change.

- [ ] **Step 1: Verify the changed Vue file parses and the project build/check command passes**
- [ ] **Step 2: Inspect the diff to confirm only the intended frontend component and plan changed**
