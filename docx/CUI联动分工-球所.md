# CUI 联动分工：球所（前端宿主）

这份说明只写你要做的事。完整合同见 `docx/前端项目与CUI联动方案.md`。本期只打通整个项目的前端功能。专题制图工作台内部对话不在本期。

你拥有命令实现、白名单和回执。界面动作只在父页面执行。你不写对话文案，不做意图识别，不提供告警和项目的业务查询接口，也不定义工作台内部协议。

## 你在链路里的位置

用户在 Hermes 对话里说一句话。CUI 把话交给 skill。skill 只产出「命令名 + 参数」。CUI 所在的 iframe 用 `postMessage` 发给父页面。你的 `commandBus` 执行路由、面板或定位，再把 `cmd.result` 回给这个 iframe。

`postMessage` 的两端只能是父页面和 Hermes iframe。skill 在服务端时碰不到这条通道。

宿主今天已经有这条桥：宠物弹窗同时挂着卫星协议（`map.locate`、`panel.open`）和壳层协议（`route.navigate`、`ui.panel.open`、`ui.panel.close`）。本期不新增窗口，不新增 iframe。你要做的是让 CUI 只看见一张命令目录，两套监听在宿主内部收口。

## 你要做的工作

1. 对外只保留下面这一种信封。壳层旧字段（`cmd` / `args`、另一套 version）若仍被内部使用，由你在宿主里适配。不要要求 CUI 发两套消息。
2. 把能力目录写进 `host.init.capabilities`，并与 iframe 白名单完全相同。目录以外的命令一律拒绝。
3. 补齐面板别名的打开和关闭，接到现有 widget。
4. `panel.open` 本期只接受 `judgment`。`cartography` 从对 CUI 生效的能力里拿掉。工作台只用 `ui.panel.open` / `ui.panel.close` 的 `cartography` 别名做开关，不接收项目 id、版本、bbox。
5. `host.init` 增加当前 `route`。成功打开研判后，把 `context` 更新为这条告警。主题变化或告警上下文变化时，再发一次 `host.init`。
6. 来源窗口不是当前 Hermes iframe，或来源 origin 不是 `VITE_HERMES_WEB_UI_URL` 的 origin 时，直接丢弃，不执行。
7. 失败只走 `cmd.result`。不要另做一套错误弹窗代替回执。用户能看见的解释由 CUI 说。
8. 先用固定消息自测，不依赖对话模型。顺序是：你收口 → CUI 用手工命令接桥 → skill 再接工具。

`theme.switch`、`sidebar.toggle`、`widget.refresh` 可以留在宿主内部，但不得出现在 `capabilities` 里。iframe 若仍发送，回 `UNSUPPORTED_COMMAND: command is not allowed`。

## 你必须实现的对外消息

CUI 发给你的命令：

```json
{
  "channel": "satellite-cui",
  "version": "1.0",
  "instanceId": "cui-main",
  "type": "cmd.execute",
  "requestId": "由 CUI 生成的唯一 id",
  "payload": {
    "command": "命令名",
    "arguments": {}
  }
}
```

你在收到 `cui.ready` 后回：

```json
{
  "channel": "satellite-cui",
  "version": "1.0",
  "instanceId": "cui-main",
  "type": "host.init",
  "payload": {
    "theme": "light",
    "projectName": "地震预测与防震减灾卫星遥感平台",
    "route": "map",
    "capabilities": [],
    "context": null
  }
}
```

`route` 表示人当前所在页面。`context` 只有最后一次成功打开的告警研判：`{ "id", "label", "type": "alert" }`，没有则为 `null`。地图点击、图层勾选、工作台编辑状态本期不回传。

每条命令都回：

```json
{
  "channel": "satellite-cui",
  "version": "1.0",
  "instanceId": "cui-main",
  "type": "cmd.result",
  "requestId": "与请求相同",
  "payload": {
    "command": "命令名",
    "success": true,
    "data": {}
  }
}
```

失败时 `success` 为 `false`，并带 `error`。`requestId` 原样返回。

## 你必须实现的命令

`capabilities` 只宣告这些命令：`route.navigate`、`ui.panel.open`、`ui.panel.close`、`map.locate`、`panel.open`。

### `route.navigate`

参数：`{ "route": "<目标>" }`。

| route | 页面 |
| :--- | :--- |
| `map` | 地图首页 |
| `satellite.dataPool` | 数据池 |
| `satellite.metadata` | 元数据 |
| `satellite.catalog` | 目录 |
| `satellite.query` | 查询 |
| `satellite.share` | 共享 |

成功回执 data：`{ "route" }`。未知目标：`INVALID_ARGUMENT: unsupported route`。

### `ui.panel.open` / `ui.panel.close`

参数：`{ "panel": "<别名>" }`。CUI 只传别名，不传组件名。

| 别名 | 你要接到的 widget | 说明 |
| :--- | :--- | :--- |
| `layer` | 图层 `manage-layers` | 已通，保持 |
| `basemap` | 底图 `manage-basemap` | 已通，保持 |
| `split` | `split-screen-compare` | 本期新增 |
| `timeline` | `eoapi-timeline-player` | 本期新增 |
| `dataset` | `dataset-repository` | 本期新增 |
| `repository` | `my-repository` | 本期新增 |
| `save` | `save-result` | 本期新增 |
| `playback` | `result-playback` | 本期新增 |
| `alert` | `alert-confirm` | 本期新增，只打开空面板，不带研判上下文 |
| `cartography` | `thematic-workbench` | 本期只开关，忽略项目、版本、范围 |

成功回执 data：`{ "panel", "state": "open" }` 或 `{ "panel", "state": "closed" }`。未知别名：`INVALID_ARGUMENT: unsupported panel`。面板未注册：`TARGET_NOT_FOUND: panel is unavailable`。

`alert` 与 `panel.open` / `judgment` 不要做成同一个入口。前者只打开告警确认面板；后者带着一条具体告警打开。

### `map.locate`

参数：`target`、`center`（`[经度, 纬度]`）、`bbox`（`[west, south, east, north]`）、`geometry`、`crs`、`highlight`。`highlight` 省略时默认高亮。坐标系只接受 `EPSG:4326`。

成功 data：`{ "locateStatus": "succeeded", "target" }`。没有坐标：`success: true`，data 为 `{ "locateStatus": "missing_coords", "target" }`，地图不飞到默认点。范围非法或坐标系不对：`EXTENT_MISMATCH`。地图未就绪或相机失败：`LOCATE_FAILED`。

### `panel.open`

`arguments.name` 只接受 `"judgment"`。其他 name，包括 `cartography`，一律 `PANEL_UNSUPPORTED`。

`judgment` 参数：`target`（告警 id）、`title`、`task_id`、`panel_instance_id`、`machine_judgment`、`saved_reviews`、`allowed_actions`。写入告警确认面板的 `cuiLink`。没有 `confirm_publish` 时，发布保持禁用。缺少 `target`：`INVALID_ARGUMENT: missing alert target`。面板不存在：`PANEL_NOT_FOUND`。

成功 data：`{ "name": "judgment", "target", "state": "open" }`。同时更新 `host.init.context`。

## 你要交给谁、交什么、以什么形式

| 交给谁 | 交什么 | 形式 | 怎样算交齐 |
| :--- | :--- | :--- | :--- |
| CUI、skill | 能力目录 | 一份清单，命令名与上面四条一致，并写明每条的参数和错误码 | `host.init.capabilities` 与白名单、与这份清单三者相同 |
| CUI | 消息样例 | 各一条可直接投递的 JSON：`cui.ready` 的回复 `host.init`、一条成功 `cmd.result`、一条失败 `cmd.result` | 字段名只有 `command` / `arguments`，没有第二套 `cmd` / `args` |
| CUI | 联调环境 | 环境变量名 `VITE_HERMES_WEB_UI_URL`，以及「origin 必须等于该地址的 origin」这一条规则 | 文档和示例里不出现 `http://192.168.10.15:6060` |
| CUI、skill | 错误码表 | 与方案第 6 节相同的码：`UNSUPPORTED_COMMAND`、`INVALID_ARGUMENT`、`TARGET_NOT_FOUND`、`PANEL_NOT_FOUND`、`PANEL_UNSUPPORTED`、`EXTENT_MISMATCH`、`LOCATE_FAILED`，以及成功语义 `missing_coords` | 每个码有一条真实回执样例 |
| 自己 / 联调记录 | 宿主测试 | 测试结果说明 | 覆盖下面「你自己先测过的项」 |

联调说明合成一页即可，收件人是 CUI 和 skill。不要把对话话术写进这一页。

## 你自己先测过的项

这些在交给 CUI 手工联调之前就要通过：

1. `route.navigate` 到 `satellite.dataPool`，回执 data 含该 route。
2. `ui.panel.open` / `ui.panel.close` 对 `layer` 以及本期新增的每个别名各走一次。
3. `map.locate` 合法 bbox 会飞行并高亮；不给坐标时地图不动且 `locateStatus` 为 `missing_coords`。
4. `panel.open` 且 `name` 为 `judgment`、带 `target` 时，告警面板出现对应 `cuiLink`；`allowed_actions` 不含 `confirm_publish` 时发布不可用。
5. `panel.open` 且 `name` 为 `cartography` 时回 `PANEL_UNSUPPORTED`，工作台不被这条命令打开。
6. `ui.panel.open` 且 `panel` 为 `cartography` 时工作台打开，参数里即使带了项目 id 也不传入工作台。
7. `widget.refresh` 回 `UNSUPPORTED_COMMAND`。
8. 错误 origin、或 source 不是当前 iframe 的消息不执行、不回执。
9. 缺 `target` 的 judgment 回 `INVALID_ARGUMENT: missing alert target`。

## 不要做的事

- 不要在 skill 仓库或 CUI 仓库里实现飞相机、开面板。
- 不要把 `panel.open` / `cartography`（带项目 id、版本、bbox）放进本期能力目录。
- 不要接受任意 widget id。只接受上表别名。
- 不要在目录冻结前自行加命令。新增命令要先改三方合同。
