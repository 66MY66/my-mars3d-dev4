# CUI 联动分工：CUI

这份说明只写你要做的事。完整合同见 `docx/前端项目与CUI联动方案.md`。本期只打通整个项目的前端功能。专题制图工作台内部的模板、样式、出图、导出，以及工作台自己的对话，不在本期。那些能力等专线立项后再做。

你拥有 Hermes 对话侧的发送、回执展示和追问。你不实现父页面里的命令，不做业务数据库查询。

## 你在链路里的位置

1. 用户在桌面宠物打开的 Hermes 对话里说出意图。
2. 你把话交给 skill。skill 返回「命令名 + 参数」，输出停在这里。
3. 你在 Hermes iframe 里用 `postMessage` 把命令发给父页面。
4. 父页面执行路由、面板或定位，再把 `cmd.result` 回给你。
5. 你只根据这条回执向用户说话。失败时按错误码追问或停止。不要猜测一个默认位置或默认面板，也不要在对话层改写 skill 给的命令。

`postMessage` 的两端只能是父页面和这个 iframe。不要让 skill 自己去发。

接桥顺序：等球所把宿主收口后，你先用手工命令打通「打开图层」和「进入数据池」。这两条通了，再改为发送 skill 的结果。

## 你要做的工作

1. iframe 加载完成后向父页面发送 `cui.ready`。收到 `host.init` 后保存 `capabilities`、`route`、`theme`、`context`。
2. 之后只发送 `capabilities` 里有的命令。不要硬编码宿主没宣告的命令。
3. 按下面的信封发送 `cmd.execute`。`requestId` 每次唯一，并用同一个 id 匹配 `cmd.result`。
4. skill 给出的 `command` 和 `arguments` 原样放进 `payload`。不要改成组件名，不要改成另一套字段（不要发 `cmd` / `args`）。
5. 成功时告诉用户打开了哪一页或哪一块面板，用语和回执 data 一致。失败时按文末错误表说话。
6. 回执 `locateStatus` 为 `missing_coords` 时，必须追问地点或范围。这时地图不会动，不要说成定位失败，也不要自己补坐标再发一次。
7. 工作台本期只能回复「已打开专题制图工作台」或「已关闭专题制图工作台」。用户要求改模板、出图、导出时，说明该能力在工作台专线，不要发送带项目 id、版本、bbox 的命令，也不要发送 `panel.open` 且 `name` 为 `cartography`。
8. 父页面 origin 与 `VITE_HERMES_WEB_UI_URL` 的 origin 不一致时，消息会被宿主丢掉。联调地址只认球所给的环境变量，不要写死内网 IP。

## 你必须遵守的消息

你发给父页面的就绪消息，使用现有通道字段：

```json
{
  "channel": "satellite-cui",
  "version": "1.0",
  "instanceId": "cui-main",
  "type": "cui.ready"
}
```

你发给父页面的命令：

```json
{
  "channel": "satellite-cui",
  "version": "1.0",
  "instanceId": "cui-main",
  "type": "cmd.execute",
  "requestId": "由你生成的唯一 id",
  "payload": {
    "command": "命令名",
    "arguments": {}
  }
}
```

父页面会回 `host.init` 和 `cmd.result`。`host.init.payload` 里有 `theme`、`projectName`、`route`、`capabilities`、`context`。`context` 只有最后一次成功打开的告警：`{ "id", "label", "type": "alert" }`，没有则为 `null`。不要指望父页面回传地图点击、图层勾选或工作台内部状态。

`cmd.result` 里看 `payload.success`、`payload.command`、`payload.data`、`payload.error`。`requestId` 与你发出的相同。对不上的回执不要拿去回复用户。

`postMessage` 的目标 origin 使用父页面 origin。不要使用 `*`。

## 你只会用到的命令

这些名字以球所最终放进 `capabilities` 的清单为准。预期就是下面这些。

| 用户意图 | command | arguments 要点 |
| :--- | :--- | :--- |
| 进入地图或卫星子系统某一页 | `route.navigate` | `route` 只能是 `map`、`satellite.dataPool`、`satellite.metadata`、`satellite.catalog`、`satellite.query`、`satellite.share` |
| 打开或关闭一块面板 | `ui.panel.open` 或 `ui.panel.close` | `panel` 只能是 `layer`、`basemap`、`split`、`timeline`、`dataset`、`repository`、`save`、`playback`、`alert`、`cartography` |
| 地图定位 | `map.locate` | 坐标来自 skill。没有坐标也要照发，然后根据 `missing_coords` 追问 |
| 打开某一条告警的研判 | `panel.open` | `name` 只能是 `"judgment"`，且必须有 `target` |

`alert` 只是把告警确认面板打开。带着某一条告警打开时，命令是 `panel.open`，不是 `panel` 为 `alert`。

面板别名对应的用户说法：`layer` 图层，`basemap` 底图，`split` 分屏对比，`timeline` 时间轴演化，`dataset` 数据集仓库，`repository` 我的仓库，`save` 保存成果，`playback` 成果回放，`alert` 告警确认，`cartography` 专题制图工作台。

不要发送 `theme.switch`、`sidebar.toggle`、`widget.refresh`。

## 回执你要怎么说

| 宿主结果 | 你对用户说什么 |
| :--- | :--- |
| `success: true`，且是路由或面板 | 说明打开或关闭了哪一页、哪一块面板，名称与回执一致 |
| `locateStatus` 为 `succeeded` | 说明已经定位到该目标，并已高亮 |
| `success: true` 且 `locateStatus` 为 `missing_coords` | 追问地点或范围。不要重试 |
| `error` 含 `UNSUPPORTED_COMMAND` | 告知当前做不到。不要重试同一条命令 |
| `error` 含 `INVALID_ARGUMENT` | 向用户追问缺的目标、告警或参数，让 skill 改参数后再发 |
| `TARGET_NOT_FOUND` 或 `PANEL_NOT_FOUND` | 告知页面上暂时没有该功能 |
| `PANEL_UNSUPPORTED` | 告知这种打开方式本期不做。工作台开关改发 `ui.panel.open` / `ui.panel.close`，`panel` 为 `cartography` |
| `EXTENT_MISMATCH` | 请用户或 skill 重新给出 `EPSG:4326` 范围 |
| `LOCATE_FAILED` | 建议先进入地图页再试一次。可先发 `route.navigate` 到 `map`，不要循环重试定位 |

父页面不会为这些错误再弹一套提示。用户只听你的回复。

## 你要交给谁、交什么、以什么形式

| 交给谁 | 交什么 | 形式 | 怎样算交齐 |
| :--- | :--- | :--- | :--- |
| 球所 | 接桥结果 | 一份联调记录。每条含：发出的完整 JSON、收到的完整 JSON、界面实际变化 | 至少有手工命令「打开图层」「进入数据池」两条，且 `requestId` 能对上 |
| 球所、skill | 五条主路径记录 | 同一份记录继续追加。每条含用户原话、实际发出的 `command`/`arguments`、回执、你对用户说的话 | 话和回执一致；工作台那条消息里没有项目 id、版本、bbox |
| skill | 发送约定 | 短说明：你只原样转发 skill 的 `command` 和 `arguments`，由 iframe 发 `postMessage` | skill 不需要再交一份前端脚本给你 |
| 自己保留 | 拒绝用例记录 | 三条：错误 origin 无执行、`widget.refresh` 被拒绝、`panel.open` 且 `name` 为 `cartography` 被拒绝 | 每条有发出的消息和宿主回执；错误 origin 那条没有回执也可以，但要写明界面没有变化 |

五条主路径的用户原话是：

1. 「打开卫星数据池」→ 回执含 `satellite.dataPool`。
2. 「打开图层」，再说「关闭图层」→ 图层面板打开后再关闭。
3. 「定位到这个范围」→ skill 给了合法 bbox 时地图飞行并高亮；没给坐标时地图不动，你的回复是追问。
4. 「打开这条告警」→ 告警确认面板带上该条告警。若允许动作里没有发布，你不要告诉用户可以发布。
5. 「打开专题制图工作台」→ 工作台打开。你的回复只说已打开。

联调记录用一份文档交齐。不要交父页面的命令实现，也不要交业务查询接口。

## 不要做的事

- 不要在对话层把别名翻译成 `manage-layers`、`thematic-workbench` 这类组件名再发送。
- 不要同时维护两套消息格式。
- 不要在 `capabilities` 没有某条命令时自行补发。
- 不要在本期做工作台内部对话。用户提出那些需求时，用一句话说明在专线，然后停止。
- 目录冻结前不要私自增加命令。
