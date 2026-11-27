# CUI 联动分工：skill

这份说明只写你要做的事。完整合同见 `docx/前端项目与CUI联动方案.md`。本期只打通整个项目的前端功能。专题制图工作台内部的模板、样式、出图、导出不在本期。

你拥有「什么时候调用哪条命令，参数从哪来」。你的输出停在命令调用。你不实现 Vue 面板，不操作地图相机，不写 `postMessage` 监听。

## 你在链路里的位置

1. 用户在 CUI 里说出意图。
2. CUI 把话交给你。你查业务数据，决定调用目录中的一条命令，并填好参数。
3. 你把「命令名 + 参数」交给 CUI。CUI 所在的 Hermes iframe 负责 `postMessage` 给父页面。
4. 父页面执行后把回执给 CUI。失败时由 CUI 按错误码追问。你不要编一个默认位置或默认面板去补齐失败。

你若在服务端，没有 `window`，不能自己向父页面发 `postMessage`。不要在 skill 里封装前端操作的实现，只封装工具说明和参数。

等球所收口、CUI 用手工命令打通「打开图层」「进入数据池」之后，你再接入。在那之前把工具清单和验收话术先交出来，便于两方按同一张表接。

## 你要做的工作

1. 为下面每一条命令做一个工具。工具名与命令名一致，不要另起一套名字，也不要输出组件文件名。
2. 每个工具写明必填参数，以及参数来自哪次查询、哪个字段。
3. 路由和面板只用目录里的枚举。定位只用 `EPSG:4326`。
4. 打开研判必须有告警 id。没有 id 就不要发 `panel.open`。
5. 用户要定位但你没有坐标时，仍然产出 `map.locate`，且不带 `center`、`bbox`、`geometry`。让宿主返回 `missing_coords`。不要编造中心点。
6. 用户要改模板、出图、导出时，不要发工作台内部命令，也不要发带项目 id、版本、bbox 的 `panel.open`。打开或关闭工作台只用面板别名 `cartography`。
7. 准备一组验收话术。每条话术对应一条期望的 `command` 和 `arguments`，交给 CUI 按原样发送。

## 你只能产出的命令

信封由 CUI 包装。你交给 CUI 的内容只是 `command` 和 `arguments`。

### `route.navigate`

`arguments`：`{ "route": "<目标>" }`。

| route | 页面 |
| :--- | :--- |
| `map` | 地图首页 |
| `satellite.dataPool` | 数据池 |
| `satellite.metadata` | 元数据 |
| `satellite.catalog` | 目录 |
| `satellite.query` | 查询 |
| `satellite.share` | 共享 |

只使用这六个字符串。

### `ui.panel.open` / `ui.panel.close`

`arguments`：`{ "panel": "<别名>" }`。

只使用这些别名：`layer`、`basemap`、`split`、`timeline`、`dataset`、`repository`、`save`、`playback`、`alert`、`cartography`。

| 别名 | 含义 |
| :--- | :--- |
| `layer` | 图层 |
| `basemap` | 底图 |
| `split` | 分屏对比 |
| `timeline` | 时间轴演化 |
| `dataset` | 数据集仓库 |
| `repository` | 我的仓库 |
| `save` | 保存成果 |
| `playback` | 成果回放 |
| `alert` | 只打开告警确认面板，不带某一条告警 |
| `cartography` | 只打开或关闭专题制图工作台，不带项目和范围 |

带着某一条告警打开时，不要用 `alert`，改用下面的 `panel.open`。

### `map.locate`

`arguments` 可以包含：`target`、`center`（`[经度, 纬度]`）、`bbox`（`[west, south, east, north]`）、`geometry`、`crs`、`highlight`。

有范围时 `crs` 固定为 `"EPSG:4326"`。`bbox` 必须满足西 < 东、南 < 北。没有坐标就不要填这三个位置字段，也不要填一个假的 `center`。

### `panel.open`

只用于打开某一条告警的研判。`arguments` 固定为：

| 字段 | 必填 | 你要从业务数据填入的内容 |
| :--- | :--- | :--- |
| `name` | 是 | 固定字符串 `"judgment"` |
| `target` | 是 | 告警 id |
| `title` | 否 | 告警标题 |
| `task_id` | 否 | 任务 id |
| `panel_instance_id` | 否 | 面板实例 id |
| `machine_judgment` | 否 | 机判结论 |
| `saved_reviews` | 否 | 已有研判记录数组 |
| `allowed_actions` | 否 | 允许动作数组。发布对应 `confirm_publish`。没有这项时宿主会禁用发布，你不要为了能发布而自行补上 |

不要把 `name` 设为 `cartography` 或其他值。

### 不要产出的命令

不要产出 `theme.switch`、`sidebar.toggle`、`widget.refresh`。不要产出 `panel.open` 且 `name` 为 `cartography`。这些会被宿主拒绝，或和本期「只开关工作台」冲突。

## 宿主回执里和你有关的结果

你不解析界面，但验收话术要按这些结果来写期望。CUI 会把回执告诉用户。

| 情况 | 宿主结果 | 你下次应该怎么做 |
| :--- | :--- | :--- |
| 命令不在目录 | `UNSUPPORTED_COMMAND` | 改用目录内命令，不要重试同一条 |
| 参数或枚举不对 | `INVALID_ARGUMENT` | 补齐或改正参数后再让 CUI 发 |
| 面板没挂上 | `TARGET_NOT_FOUND` 或 `PANEL_NOT_FOUND` | 不要换一个 widget id 重试 |
| 范围或坐标系非法 | `EXTENT_MISMATCH` | 重新给出 `EPSG:4326` 范围 |
| 没给位置 | `success: true` 且 `locateStatus` 为 `missing_coords` | 这是预期结果。等用户补充地点，不要自行填坐标 |
| 地图还没就绪 | `LOCATE_FAILED` | 先产出 `route.navigate` 到 `map`，再定位 |

## 你要交给谁、交什么、以什么形式

| 交给谁 | 交什么 | 形式 | 怎样算交齐 |
| :--- | :--- | :--- | :--- |
| CUI | 工具清单 | 一份表。每行一个工具：命令名、必填参数、选填参数、参数来自哪次查询和哪个字段 | 行与上面的命令一一对应，没有目录外命令，没有组件名 |
| CUI | 告警字段映射 | 一张对照表：业务字段 → `panel.open` 的 `target`、`title`、`task_id`、`panel_instance_id`、`machine_judgment`、`saved_reviews`、`allowed_actions` | `target` 标成必填；`allowed_actions` 写明 `confirm_publish` 的来源，缺失时留空而不是补真 |
| CUI | 验收话术 | 一份表。每行：用户会说的话、期望 `command`、期望 `arguments` 全文 | 至少包含下面五条，JSON 可直接被 CUI 放进 `payload` |
| 球所、CUI | 边界声明 | 清单首页用一段话写明：skill 输出停在命令调用，`postMessage` 由 CUI iframe 发送 | 这段话出现在交付文档开头 |

验收话术至少这五条：

1. 「打开卫星数据池」→ `route.navigate`，`arguments` 为 `{ "route": "satellite.dataPool" }`。
2. 「打开图层」→ `ui.panel.open`，`arguments` 为 `{ "panel": "layer" }`。
3. 「飞到某范围」→ `map.locate`，`arguments` 含合法 `bbox` 和 `"crs": "EPSG:4326"`。另外单独写一条「只说定位、没有地点」的话术，`arguments` 不含坐标。
4. 「打开某一条告警」→ `panel.open`，`arguments.name` 为 `"judgment"`，且含真实或样例告警 id。
5. 「关闭分屏」→ `ui.panel.close`，`arguments` 为 `{ "panel": "split" }`。

建议再附一条「打开专题制图工作台」：`ui.panel.open`，`arguments` 为 `{ "panel": "cartography" }`，对象里没有项目 id、版本、bbox。

交付物用一份文档交齐即可。不要交前端补丁，不要交 iframe 脚本。

## 不要做的事

- 不要在参数不全时猜一个地图中心、猜一个面板、猜一条告警。
- 不要把宿主 widget 的内部 id（如 `manage-layers`、`thematic-workbench`）写进命令参数。对外只用别名。
- 不要实现飞相机、开面板、`postMessage`。
- 目录冻结前不要增加工具。新能力先改三方合同。
