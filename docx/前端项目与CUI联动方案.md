下面是一份可以直接发给三位负责人对齐的完整方案。范围只覆盖「整个项目」的前端功能由 CUI 控制；专题制图工作台只保留开关入口，内部对话不在本期。

## 1. 目标

用户在桌面宠物打开的 Hermes 对话里，用自然语言完成这些事：进入地图或卫星数据管理的某一页，打开或关闭工具栏上已有的面板，把地图飞到指定位置并高亮，带着一条告警打开研判面板。

界面动作只在父页面执行。对话产品不操作 Vue 组件，也不操作 Mars3D。业务数据不在这条桥上重新请求。

## 2. 范围

**本期要打通**

- 路由：地图首页，以及卫星子系统的数据池、元数据、目录、查询、共享。
- 面板：图层、底图、分屏对比、时间轴演化、数据集仓库、我的仓库、保存成果、成果回放、告警确认。
- 地图定位：中心点或范围，坐标系仅 `EPSG:4326`，可高亮。
- 告警研判入口：带着告警 id、标题、任务、机判结论、允许动作打开「告警确认」。

**本期明确不做**

- 专题制图工作台内部的模板、样式、出图、导出，以及工作台自己的对话。本期只允许「打开 / 关闭工作台」这个项目级动作。现有的 `panel.open` / `cartography`（带项目 id、版本、bbox）不进入本期能力目录，留给工作台专线。
- 主题切换、侧栏折叠、按 widget id 强制刷新。这些命令留在宿主里，不对 CUI 宣告。
- 把地图点击、图层勾选、工作台编辑状态回传给对话。
- 在 skill 或 CUI 仓库里实现飞相机、开面板。

## 3. 链路

一次成功的控制固定为五步。

1. 用户在 CUI 里说出意图。
2. CUI 把话交给 skill。skill 查数据，决定调用目录中的一条命令，并填好参数。
3. 调用发生在 Hermes iframe 里。iframe 用 `postMessage` 把命令发给父页面。
4. 父页面的 `commandBus` 执行路由、面板或定位，再把结果 `postMessage` 回 iframe。
5. CUI 只根据这条回执向用户说话。失败时用错误码追问，不猜测一个默认位置或默认面板。

skill 若在服务端，它只产出「命令名 + 参数」。`postMessage` 的两端只能是父页面和 Hermes iframe。

宿主侧今天已有这条桥：宠物弹窗同时挂着卫星协议（`map.locate`、`panel.open`）和壳层协议（`route.navigate`、`ui.panel.open`、`ui.panel.close`）。本期不新增窗口、不新增 iframe。要做的是让 CUI 只看见一张命令目录，两套监听在宿主内部收口。

## 4. 对外合同

CUI 与 skill 只使用一种信封。宿主可以在内部继续分发给现有两个监听，但对外字段只有一套。

**CUI → 宿主**

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

**宿主 → CUI**

就绪后，宿主在收到 iframe 的 `cui.ready` 时回 `host.init`。主题或当前告警上下文变化时再发一次。

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

`capabilities` 必须与白名单完全一致。`route` 表示人当前所在页面。`context` 只有最后一次成功打开的告警研判：`{ "id", "label", "type": "alert" }`，没有则为 `null`。

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

失败时 `success` 为 `false`，并带 `error`。`requestId` 原样返回。来源窗口不是当前 Hermes iframe，或来源 origin 不是 `VITE_HERMES_WEB_UI_URL` 的 origin 时，宿主直接丢弃，不执行。

联调地址只认该环境变量。方案合同里不写内网默认 IP。

## 5. 命令目录

### 5.1 到页面：`route.navigate`

参数：`{ "route": "<目标>" }`。

| route | 页面 |
| :--- | :--- |
| `map` | 地图首页 |
| `satellite.dataPool` | 数据池 |
| `satellite.metadata` | 元数据 |
| `satellite.catalog` | 目录 |
| `satellite.query` | 查询 |
| `satellite.share` | 共享 |

成功回执：`{ "route" }`。未知目标：`INVALID_ARGUMENT: unsupported route`。

### 5.2 开关面板：`ui.panel.open` / `ui.panel.close`

参数：`{ "panel": "<别名>" }`。别名是公开合同，CUI 不传组件文件名。

| 别名 | 宿主面板 | 本期状态 |
| :--- | :--- | :--- |
| `layer` | 图层 | 已通 |
| `basemap` | 底图 | 已通 |
| `split` | 分屏对比 | 本期新增别名 |
| `timeline` | 时间轴演化 | 本期新增别名 |
| `dataset` | 数据集仓库 | 本期新增别名 |
| `repository` | 我的仓库 | 本期新增别名 |
| `save` | 保存成果 | 本期新增别名 |
| `playback` | 成果回放 | 本期新增别名 |
| `alert` | 告警确认 | 本期新增别名，只打开空面板 |
| `cartography` | 专题制图工作台 | 本期只开关，不带项目和范围 |

成功回执：`{ "panel", "state": "open" | "closed" }`。未知别名：`INVALID_ARGUMENT: unsupported panel`。面板未注册：`TARGET_NOT_FOUND: panel is unavailable`。

`alert` 与下面的 `panel.open` / `judgment` 不同。前者只把告警确认面板打开；后者带着一条具体告警打开。

### 5.3 地图定位：`map.locate`

参数沿用现有计划：`target`、`center`（`[经度, 纬度]`）、`bbox`（`[west, south, east, north]`）、`geometry`、`crs`、`highlight`。`highlight` 省略时默认高亮。

成功：`{ "locateStatus": "succeeded", "target" }`。没有坐标：`success: true` 且 `locateStatus: "missing_coords"`，CUI 据此追问位置，宿主不飞到默认点。范围非法或坐标系不是 `EPSG:4326`：`EXTENT_MISMATCH`。地图还没就绪或相机调用失败：`LOCATE_FAILED`。

### 5.4 带上下文打开告警：`panel.open`

参数：`name` 固定为 `"judgment"`，以及 `target`（告警 id）、`title`、`task_id`、`panel_instance_id`、`machine_judgment`、`saved_reviews`、`allowed_actions`。

宿主把这些写入告警确认面板的 `cuiLink`。没有 `confirm_publish` 时，面板上的发布保持禁用。这是现有行为，本期只保证命令能到达。

成功：`{ "name": "judgment", "target", "state": "open" }`，同时 `host.init.context` 更新为这条告警。缺少 `target`：`INVALID_ARGUMENT: missing alert target`。面板不存在：`PANEL_NOT_FOUND`。

`panel.open` 的其他 `name` 本期一律 `PANEL_UNSUPPORTED`，包括 `cartography`。工作台专线启用前，CUI 要用 `ui.panel.open` 的 `cartography` 别名做纯开关。

### 5.5 不进入目录的命令

`theme.switch`、`sidebar.toggle`、`widget.refresh` 不出现在 `capabilities` 里。iframe 若仍发这些命令，回 `UNSUPPORTED_COMMAND: command is not allowed`。

## 6. 错误时各方怎么做

| 错误码 | 谁处理 | CUI 怎么说 |
| :--- | :--- | :--- |
| `UNSUPPORTED_COMMAND` | CUI 发了目录外命令 | 告知当前做不到，不重试同一条 |
| `INVALID_ARGUMENT` | skill 少参数或目标不在表内 | 向用户追问缺失项，改参数后再发 |
| `TARGET_NOT_FOUND` / `PANEL_NOT_FOUND` | 宿主面板未挂载 | 告知页面上暂时没有该功能 |
| `EXTENT_MISMATCH` | skill 给了非法范围或错误坐标系 | 要求重新给出 `EPSG:4326` 范围 |
| `missing_coords` | skill 没给位置 | 追问地点或范围 |
| `LOCATE_FAILED` | 地图未就绪 | 建议用户先进入地图页再试一次 |

宿主不弹第二套错误框来替代回执。用户能看见的解释由 CUI 说。

## 7. 三人分工与交付物

### 球所（前端宿主）

拥有命令实现、白名单和回执。

交付：

1. 一张与第 5 节一致的能力目录，写进 `host.init.capabilities`，并与 iframe 白名单相同。
2. 对外只保留第 4 节这一种信封。壳层旧字段若仍被内部使用，由宿主适配，不要求 CUI 发两套。
3. 第 5.2 节新增面板别名的打开与关闭，接到现有 widget：`split-screen-compare`、`eoapi-timeline-player`、`dataset-repository`、`my-repository`、`save-result`、`result-playback`、`alert-confirm`、`thematic-workbench`。
4. `panel.open` 在本期只接受 `judgment`。`cartography` 从对 CUI 生效的能力中拿掉，避免和「只开关工作台」混用。
5. `host.init` 增加 `route`。成功打开研判后更新 `context`。
6. 联调说明一页：环境变量名、消息样例、错误码。不把 `http://192.168.10.15:6060` 写进交付合同。
7. 宿主侧测试：合法命令会打开对应页面或面板；非法 origin、目录外命令、缺参数都会被拒绝并回执。

不交付：对话文案、意图识别、告警和项目的业务查询接口、工作台内部协议。

### skill

拥有「何时调用哪条命令，参数从哪来」。

交付：

1. 工具清单，与第 5 节一一对应。每个工具写明命令名、必填参数、参数来源（哪次查询、哪个字段）。
2. 参数约束：定位只用 `EPSG:4326`；路由和面板只用目录中的枚举；打开研判必须有告警 id；缺位置时产出 `map.locate` 的空坐标语义，让宿主返回 `missing_coords`，而不是编一个中心点。
3. 告警场景的参数映射：告警 id、标题、任务 id、机判、允许动作，对应 `panel.open` / `judgment` 的字段。
4. 一组验收话术和期望命令，至少覆盖：打开数据池、打开图层、飞到某范围、打开某一条告警、关闭分屏。每条写明期望的 `command` 与 `arguments`。
5. 明确声明：skill 的输出停在「命令调用」。由 CUI 所在 iframe 负责 `postMessage`。

不交付：Vue 面板实现、地图相机、`postMessage` 监听。

### CUI

拥有 Hermes 对话侧的发送、回执展示和追问。

交付：

1. iframe 加载完成后发送 `cui.ready`，并接收 `host.init`。后续命令只从 `capabilities` 里选，不硬编码宿主没宣告的命令。
2. 按第 4 节信封发送 `cmd.execute`，`requestId` 唯一，并用同一个 id 匹配 `cmd.result`。
3. 把 skill 给出的命令原样发出，不在对话层改写成组件名或另一套字段。
4. 回执话术：成功时说明打开了哪一页或哪一块面板；失败时按第 6 节追问或停止。`missing_coords` 必须追问位置。
5. 工作台话术边界：本期只能说「已打开 / 已关闭专题制图工作台」。用户若要求改模板、出图，回复该能力在工作台专线，不发送 `cartography` 的项目参数命令。
6. 联调记录：每条验收话术的实际消息与宿主回执。

不交付：父页面命令实现、业务数据库查询。

## 8. 实施顺序

1. **三方冻结目录。** 以第 4、5、6 节为合同。目录未冻结前，不并行加命令。
2. **宿主收口。** 一种信封、一份白名单、`route` 与 `judgment` 上下文、新增面板别名。球所先用固定消息自测，不依赖对话模型。
3. **CUI 接桥。** 接通 `cui.ready`、`host.init`、`cmd.execute`、`cmd.result`。先用手工命令打通「打开图层」「进入数据池」。
4. **skill 接工具。** 按验收话术产出命令。CUI 改为发 skill 的结果，不再手工拼命令。
5. **五条主路径一起验收。** 进入数据池；打开并关闭图层；按 bbox 定位并高亮；打开一条告警且发布按钮受 `allowed_actions` 约束；只开关专题制图工作台，不带项目参数。
6. **工作台专线另立。** CUI 同学给出工作台内部命令后，再单独立项。宿主只增加新的能力项和白名单，不回写本期这张表。

## 9. 验收

本期完成的判定是下面五条都能在真实对话里走完，且 CUI 说的话与 `cmd.result` 一致。

1. 「打开卫星数据池」→ 路由变为数据池，回执含 `satellite.dataPool`。
2. 「打开图层」再「关闭图层」→ 图层面板打开后关闭。
3. 「定位到这个范围」且 skill 给出合法 bbox → 地图飞行并出现高亮；不给坐标时地图不动，对话追问。
4. 「打开这条告警」→ 告警确认面板带上该条 `cuiLink`；允许动作不含发布时，发布不可用。
5. 「打开专题制图工作台」→ 工作台打开，且消息里没有项目 id、版本和 bbox。

另加三条拒绝：错误 origin 的消息不执行；`widget.refresh` 被拒绝；`panel.open` / `cartography` 被拒绝。
