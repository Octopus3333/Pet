# 散步（Walk）玩法逻辑文档

> 本文档梳理 `assets/script/game/walk/` 目录下整套散步玩法的代码结构、数据流、核心算法与运行机制。
> 涉及目录外部的关键依赖（`GameData`、`DataManager`、`SocketManager`、`MainController` 等）一并说明。

---

## 一、整体概览

散步是一个「横向卷轴自动行进」的玩法：玩家组队后进入散步场景，宠物沿着地图自动向前移动，途经事件点（宝箱/节奏点）获得奖励，UI 上同时展示地图滚动、事件进度条、队伍成员与背包道具。

整套逻辑围绕以下角色分层组织：

| 层级 | 文件 | 职责 |
| --- | --- | --- |
| 入口控制 | [WalkManager.ts](file:///d:/work/comma/comma_pet/assets/script/game/walk/WalkManager.ts) | 单例，负责进入/重连/关闭散步、Socket 通信、加载流程编排、定位与测速 |
| 主视图 | [WalkMain.ts](file:///d:/work/comma/comma_pet/assets/script/game/walk/WalkMain.ts) | 散步主界面组件，协调地图内容、事件条、玩家信息、背包，loading/旋转动画 |
| 地图滚动 | [MapContent.ts](file:///d:/work/comma/comma_pet/assets/script/game/walk/MapContent.ts) | 地图格子（MapCell）的缓存池、横向滚动、出屏回收、按帧位移 |
| 地图格子 | [MapCell.ts](file:///d:/work/comma/comma_pet/assets/script/game/walk/MapCell.ts) | 单个地图格子，负责背景图的动态创建/更新 |
| 事件进度条 | [MapEventBar.ts](file:///d:/work/comma/comma_pet/assets/script/game/walk/MapEventBar.ts) | 顶部事件条，按事件节奏滚动、回收、更新距离与进度 |
| 事件项 | [MapEventItems.ts](file:///d:/work/comma/comma_pet/assets/script/game/walk/MapEventItems.ts) | 单个事件格，显示事件与剩余距离 |
| 队伍成员 | [WalkUser.ts](file:///d:/work/comma/comma_pet/assets/script/game/walk/WalkUser.ts) | 队伍成员头像/昵称/清洁度/体力/心情展示 |
| 背包道具 | [BagItem.ts](file:///d:/work/comma/comma_pet/assets/script/game/walk/BagItem.ts) | 散步中背包道具格，显示图标/品质/属性变化/亲密度，点击查看详情 |
| 配置管理 | [WalkMapCfgManager.ts](file:///d:/work/comma/comma_pet/assets/script/game/walk/WalkMapCfgManager.ts) | 单例，加载 `map_bg_cfg.json` 与 `route_config.json`，提供查询接口 |

---

## 二、数据结构与配置

### 2.1 运行时数据（来自服务器，定义于 [InterfaceDefine.ts](file:///d:/work/comma/comma_pet/assets/script/common/utils/InterfaceDefine.ts)）

```ts
// 散步整体信息（WalkMapInfo，L563）
interface WalkMapInfo {
    team_id: number
    begin_at: number          // 散步开始时间（秒）
    system_time: number       // 服务器当前时间（秒）
    walk_address_id: number   // 散步地点 id
    walk_address_name: number
    round: number             // 圈数
    users: WalkUser[]         // 队伍成员
    map_cell_info: MapCellData[] // 地图格子序列
}

// 地图格子（MapCellData，L552）
interface MapCellData {
    id: number
    rewardPos: []             // 奖励点位置
    events: MapEvent[]        // 该格子上的事件（节奏点）
    dropsInfo: DropItem[]     // 掉落道具
    mapBgs: number[]          // 背景图 id 序列
}

// 事件/节奏点（MapEvent，L545）
interface MapEvent {
    type: number
    id: number
    rewards: []
    distance: number
    second: number            // 到达该事件所需的累计秒数（定位/测速的关键字段）
}

// 队伍成员（WalkUser，L455）
interface WalkUser {
    user_id: string
    nickname: string
    head_img: string
    pet_type: number          // 1:猫 2:狗 3:兔
    color: number
    is_me: boolean
    clean: number
    energy: number
    ready_status: number
}
```

### 2.2 静态配置（由 [WalkMapCfgManager.ts](file:///d:/work/comma/comma_pet/assets/script/game/walk/WalkMapCfgManager.ts) 加载）

```ts
// 地图背景配置（MapBgCfg，L574）
interface MapBgCfg {
    map_id: number
    location: number          // 即 walk_address_id
    order: number[]           // 该地点+地图下的背景图 id 播放顺序
    rate: number
    des: string
}

// 路线配置（RouteConfig，L587）
interface RouteConfig {
    route_id: number
    location: number
    count: number             // 该路线包含的背景图数量
    rate: number
    events: number[]
    DropPos: DropPosItem[][]  // 掉落位置
}
```

**配置加载策略**（`WalkMapCfgManager._doLoad`）：
- 使用 `Promise.all` 并行加载 `config/map_bg_cfg` 与 `config/route_config` 两个 JsonAsset；
- `map_bg_cfg` 以 `"{location}_{map_id}"` 为键存入 Map；
- `route_config` 以 `route_id` 为键存入 Map；
- 通过 `_loaded` / `_loadingPromise` 双标志保证并发安全与幂等（多次 `load()` 只真正加载一次）。

**对外查询接口**：
- `getMapBg(walkAddressId, mapId)` → 返回背景图 id 顺序数组；
- `getMapBgImageId(walkAddressId, mapId, index)` → 返回顺序中指定下标的图片 id；
- `getRouteConfig(routeId)` → 返回路线配置；
- `getAllRouteConfigs()` / `getAllMapBgConfigs()` → 全量获取。

---

## 三、入口与生命周期

### 3.1 触发入口

散步的启动由 [MainController.ts](file:///d:/work/comma/comma_pet/assets/script/game/MainController.ts) `onEnterGame`（L297）触发：

```ts
async onEnterGame(msgId, res){
    WalkManager.ins.init()
    WalkManager.ins.enterGame(res)
}
```

重连场景由 `WalkTeamManager` 调用 `WalkManager.ins.relogin(res)`。

### 3.2 WalkManager 状态机

[WalkManager.ts](file:///d:/work/comma/comma_pet/assets/script/game/walk/WalkManager.ts) 是单例（`WalkManager.ins`），核心字段：

- `walkNode: Node` — 散步主界面节点；
- `loadingMinTime = 1000` — loading 最短展示时间（ms）；
- `clientTime` — 客户端时间戳，用于时间校正。

**关键流程方法**：

1. `init()` — 注册 `SocketMSgId.WalkLoadingCompleteNotify` 监听（→ `onCompleteNotiy`）。
2. `enterGame(gameInfo)` — 若无节点则通过 `UIManager.show(ViewPath.WalkMain)` 创建，激活节点后调用 `loading(gameInfo)`。
3. `loading(gameInfo, relogin?)` — 核心加载编排：
   - `walkMain.showLoading()` 显示 loading 并启动旋转动画；
   - `await WalkMapCfgManager.ins.load()` 加载静态配置；
   - `DataManager.ins.updateWalkData(gameInfo)` 将服务器数据写入 `walkData`（内部调用 `GameData.loadRoads` 构建 `map_cell_info`），失败则关界面返回；
   - `walkMain.loadGameData()` 加载地图/事件条/玩家/背包；
   - 若非重连，`await sendWalkLoadingComplete()` 向服务器上报「客户端加载完成」并等待回包。
4. `onCompleteNotiy(msgId, data)` — 服务器确认加载完成后的回调（也是真正的「开跑」触发点）：
   - 隐藏 loading；
   - `DataManager.ins.loadWalkingData(data)` 写入 `begin_at` / `system_time` / `round`；
   - 计算 `runTime = system_time - begin_at`（已散步秒数）；
   - `walkMain.loadCurrentLocation(runTime)` 把地图定位到当前进度；
   - 遍历 `map_cell_info` 找到第一个 `event.second > runTime` 的事件，确定当前所在地图索引 `curNodeIndex`、事件索引 `curEventsIndex` 与剩余时间 `restTime`；
   - `walkMain.loadRunTime(restTime, curNodeIndex, curEventsIndex)` 据此计算滚动速度；
   - `walkMain.startGame()` 启动滚动。
5. `relogin(data)` — `enterGame(data)` 后直接调用 `onCompleteNotiy("", data)` 跳过等待服务器回包。
6. `closeGame()` / `clean()` — 销毁节点、清理。

### 3.3 时间校正

`checkTime(serverTime, distime)`：用 `Date.now() - serverTime*1000` 估算客户端与服务器时间偏移，返回校正后的剩余时间（当前实现中未在主流程中被调用，预留工具方法）。

---

## 四、数据加载与地图构建（GameData）

[GameData.ts](file:///d:/work/comma/comma_pet/assets/script/Data/GameData.ts) 中与散步相关的方法：

- `getWalkData()` — 返回内存中的 `walkData`。
- `updateWalkData(res)` — 校验 `scene_map` 与 `walk_address_id` 后写入 `users`/`team_id`/`walk_address_name`，并调用 `loadRoads(res)` 重建地图格子序列。
- `loadWalkingData(res)` — 仅写入时间相关字段 `begin_at` / `system_time` / `round`（加载完成回包时调用）。
- `loadRoads(data)` — **地图格子构建核心**：
  1. 取该地点的背景图顺序数组 `mapIdArray = getMapBg(walk_address_id, scene_map)`，取不到则回退 `map_id = 1`；
  2. 遍历服务器下发的 `data.roads`，每条路生成一个 `MapCellData`：
     - `road_id == -1 / -2`（特殊路）：只取一张背景图 `mapBgs = [mapIdArray[mapBgIndex++]]`，无奖励点；
     - 普通路：取 `RouteConfig`，`rewardPos = cfg.DropPos`，按 `cfg.count` 依次 push `count` 张背景图，`mapBgIndex` 递增；
  3. `events` 由 `road.rhythms` 映射而来：`{id: rhythm_id, second: second}`（注意：此处只填了 `id` 与 `second` 两个字段）；
  4. `dropsInfo` 由 `road.drops` 映射为 `{itemId, pos: Vec2(x,y)}`（注意：原代码 `cell.dropsInfo.push` 但 `dropsInfo` 未初始化时存在隐患，实际走 `else` 分支赋空数组）。

---

## 五、主界面 WalkMain

[WalkMain.ts](file:///d:/work/comma/comma_pet/assets/script/game/walk/WalkMain.ts) 是散步界面的根组件，挂载于 `prefabs/walk/WalkMain`。

### 5.1 主要引用节点

- `mapContent: MapContent` — 地图滚动区；
- `mapEventBar: MapEventBar` — 顶部事件条；
- `nd_player_content: Node` — 队伍成员容器；
- `sv_items: ScrollView` — 背包道具滚动列表；
- `nd_loading` / `nd_box` / `nd_rewars_info` — loading、宝箱开关与奖励信息。

### 5.2 加载流程 `loadGameData()`

按顺序：
1. `loadMapContent()` — 等待 `MapContent.load` 完成；
2. `mapEventBar.loadContent()` — 初始化事件条；
3. `loadUser()` — 按 `users` 数量增/减/复用 `WalkUserInfo` 节点并 `loadData`；
4. `loadBagItemPrefab()` — 预加载 `walk/BagItem` 预制体；
5. `requestBackpackIfNeeded()` — 若本地背包为空，请求服务器背包；
6. `refreshBackpack()` — 刷新背包列表。

### 5.3 背包刷新 `refreshBackpack()`

- 监听 `EventType.RefreshBackpack` 事件触发；
- 按物品数量增删/隐藏节点，对每个节点挂 `BagItem` 组件并 `loadData`；
- 节点对象池化复用（不够则 `instantiate(_bagItemPb)`，多余则 `active=false`）。

### 5.4 宝箱交互 `onClickBox()`

切换 `_isBoxOpen`，异步切换 `box`/`boxOpen` 贴图，并显隐 `nd_rewars_info`。

### 5.5 Loading 动画

- `showLoading()` 记录开始时间并启动 `sp_loading` 节点的 360°/秒无限旋转 tween；
- `hideLoading()` 保证 loading 至少展示 1 秒（不足则 `setTimeout` 补足），再停止旋转并隐藏。

### 5.6 启动 `startGame()`

调用 `mapContent.run()` 与 `mapEventBar.startBar()`，两者各自开启 `1/60` 秒的定时滚动。

---

## 六、地图滚动机制 MapContent

[MapContent.ts](file:///d:/work/comma/comma_pet/assets/script/game/walk/MapContent.ts) 负责地图背景的横向无缝滚动。

### 6.1 关键参数

| 字段 | 默认值 | 含义 |
| --- | --- | --- |
| `gridSize` | 10 | 一个路线分成多少格子 |
| `routeSize` | 10 | 一个单位路线含多少 route |
| `mapCacheSize` | 3 | 同时缓存的地图格子数量 |
| `routeMete` | 1000 | 一条路线代表的「米」数 |
| `speed` | 1 | 速度系数 |
| `rateTimeDis` | 1/60 | 每帧位移像素（动态计算） |
| `curGridIndex` / `curDistance` / `mapIndex` | — | 当前格子/距离/地图索引 |

### 6.2 单位换算（核心算法）

- `getGridMeter()` = `routeMete / routeSize / gridSize` → 每格多少米；
- `getSecondMeter()` = `speed * getGridMeter()` → 每秒多少米；
- `getPixcel()` = `界面宽 / gridSize` → 每格多少像素；
- `getPixcelGridRate()` = `getGridMeter() / getPixcel()` → 每像素多少米。

### 6.3 定位 `loadCurrentLocation(time)` / `loadLocation(distance)`

- `distance = time * getSecondMeter()` 把已用秒数换算成已走米数；
- `loadLocation` 按 `distance` 对 `routeMete`、`routeSize`、`gridSize` 取模与整除，估算当前所在地图索引 `mapIndex` 与格子索引 `curGridIndex`；
- 之后 `loadMapCaches()` 初始化地图格子缓存。

### 6.4 测速 `loadRunTime(time, index, eventIdx)`

目的：在已知「剩余时间 `time` 内要到达第 `index` 个地图的第 `eventIdx` 个事件」的前提下，反推每帧应位移的像素。

1. 累加从当前地图到目标地图之间每个地图的像素距离（`events.length * perDis`，`perDis = gridSize * getGridMeter()`）；
2. 加上目标地图内 `(eventIdx + 1) * perDis`；
3. `restDistance = 目标距离 - 当前距离`；
4. `restWidth = restDistance / getPixcelGridRate()` 换算成像素；
5. `rateTimeDis = restWidth / time / 60` → 每帧位移像素（按 60 帧/秒）。

> 该值同时驱动 `run()` 中的实际滚动速度。

### 6.5 滚动与回收 `run()`

```ts
this.schedule(() => {
    if (this.pause) return
    for (obj of this.mapCaches) {
        obj.node.x -= this.rateTimeDis            // 每帧左移
        if (this.checkOutView(obj)) {             // 完全移出左边界
            this.setLastCell(obj)                 // 挪到最右并加载下一张
        }
    }
}, 1/60)
```

- `checkOutView`：`cell.x + cellWidth < 0` 视为出屏；
- `setLastCell`：把该格挪到当前最右侧（`getLastPosX()`），`mapIndex++`，按 `map_cell_info[mapIndex]` 重新 `init`，实现无缝循环；
- `loadMapCaches`：初始化时按 `mapCacheSize` 创建 3 个格子依次拼接，x 坐标累加宽度。

### 6.6 MapCell 背景图

[MapCell.ts](file:///d:/work/comma/comma_pet/assets/script/game/walk/MapCell.ts) `createMapBgs()`：
- 按 `mapData.mapBgs` 数组动态创建子节点，每个挂 `Sprite + UITransform + UIOpacity`（opacity=100）；
- 通过 `loadImg` 加载 `textures/walk/walkBg/location_{locationId}/bg_{index}/spriteFrame`；
- 子节点 x 按 `i * width` 排列，并累加更新自身宽度（最终被强制设为 3000）；
- 若已有子节点数 ≥ 需要，则原地复用并重新 `loadImg`，多余的 destroy。

---

## 七、事件进度条 MapEventBar

[MapEventBar.ts](file:///d:/work/comma/comma_pet/assets/script/game/walk/MapEventBar.ts) 是顶部「事件节奏条」，独立于地图滚动，按事件节奏自驱滚动。

### 7.1 字段

- `info: MapEvent[]` — 所有事件（按 `map_cell_info` 顺序展平）；
- `curItemList: Node[]` — 当前可见的事件格节点；
- `eventsDis = 100` — 每个事件对应的「米」数；
- `spacing = 87` — 事件格之间的像素间距；
- `curEventIndex` / `nextLoadIndex` — 当前事件索引 / 下一个待加载索引。

### 7.2 初始化 `loadContent()`

1. `loadEvents()` 把所有 `map_cell_info[i].events` 展平 push 进 `info`；
2. 按 mask 宽度与 `spacing` 计算可见事件数 `visibleCount = ceil(maskWidth/spacing)+1`；
3. 创建 `count = min(visibleCount, info.length)` 个事件格，x = `(i+1)*spacing`，调用 `setCellData`；
4. `updateAllCellDistances()` 刷新每个格子的剩余距离。

### 7.3 滚动 `startBar()` → `onTick()`（每 1/60 秒）

```ts
speed = getSpeed()                       // eventsDis / info[curEventIndex].second
pixelPerSec = speed * getPerPixcelMete() // spacing / eventsDis
dx = pixelPerSec / 60
for (cell of curItemList) cell.x -= dx
```

- `getSpeed()`：以「当前事件」需要的秒数计算每秒米数；若已超出末尾事件，退化为按最后一事件速度；
- 当当前事件格 `x <= 0`（被玩家追上/越过）时 `curEventIndex++`，推进进度；
- `recycleExitedCells()`：把左移出 mask 的事件格回收到右侧，绑定 `info[nextLoadIndex++]`，实现循环；无更多事件则隐藏；
- 每帧 `updateMy()`（更新玩家位置剩余距离文字）与 `updateProgress()`（更新进度条宽度到当前事件格的世界 x）；
- 当 `curItemList` 为空（所有事件跑完）则 `unscheduleAllCallbacks()` 停止。

### 7.4 距离换算

- `getPerPixcelMete()` = `spacing / eventsDis` → 每米多少像素；
- `calcMetersFromX(x)` = `round(x / per)` → 由像素 x 反算剩余米数，用于显示。

---

## 八、辅助视图组件

### 8.1 MapEventItems（[MapEventItems.ts](file:///d:/work/comma/comma_pet/assets/script/game/walk/MapEventItems.ts)）

单个事件格组件，持有 `_eventIndex` 与 `_event`，提供：
- `setEventIndex` / `getEventIndex`；
- `setData(event, remainingMeters)` — 绑定事件并显示初始距离；
- `updateDistance(meters)` — 刷新 `lb_distance` 文字（`{m}m`）。

### 8.2 WalkUserInfo（[WalkUser.ts](file:///d:/work/comma/comma_pet/assets/script/game/walk/WalkUser.ts)）

队伍成员展示组件，`loadData(data: WalkUser)` 填充：
- `lb_clean_num` = `clean`；
- `lb_energy_num` = `energy`；
- `lb_xinqing_num` = `0`（心情，当前固定 0）；
- `lb_user_name` = `nickname`。

### 8.3 BagItem（[BagItem.ts](file:///d:/work/comma/comma_pet/assets/script/game/walk/BagItem.ts)）

散步中背包道具格组件：
- `onLoad` 时 `ensureRefs()` 绑定子节点引用 + `bindTouchEvent()`；
- 点击 → `UIManager.show(ViewPath.ItemDescripView)` 弹出道具详情；
- `loadData(item)` → `refreshView()`：
  - 按 `item_id` 加载品质框 `loadItemQuality` 与图标 `loadItem`；
  - `lb_use_count` 显示 `remain_count/total_use_count`；
  - 按 `type===1`（清洁类）区分主/副属性：主属性显示 `clean` 或 `energy`，并按正负选用 `cleanUp/cleanDown/foodUp/foodDown` 图标，数值用绿色(92,231,146)/红色(255,96,62)区分增减；
  - `lb_num_3` 显示 `+intimacy`（亲密度）。

---

## 九、网络通信

涉及的 Socket 消息 id（见 [SocketManager.ts](file:///d:/work/comma/comma_pet/assets/script/common/network/SocketManager.ts) `SocketMSgId`）：

| 消息 id | 方向 | 说明 |
| --- | --- | --- |
| `WalkLoadingComplete` | C→S | 客户端加载完成上报，`sendWalkLoadingComplete` 带回调等待响应 |
| `WalkLoadingCompleteNotify` | S→C | 服务器确认，触发 `onCompleteNotiy` → 真正开跑 |
| `WalkRunNotify` / `WalkRunEndNotify` | S→C | 散步运行/结束通知（当前 `WalkManager` 中 `WalkEnd` 监听被注释，未启用） |

> 组队相关协议（`WalkTeamMake`、`WalkInvite`、`WalkReady`、`WalkRun`、`WalkTeamJoin/Leave` 等）由 `WalkTeamManager` 负责，不在本目录内，本目录只接收已组队完成后的 `enterGame`/`relogin` 入口。

---

## 十、完整时序图（文字版）

```
[登录成功]
   │
   ▼ EventType.EnterGame
MainController.onEnterGame(res)
   │
   ├─ WalkManager.ins.init()              // 注册 WalkLoadingCompleteNotify 监听
   └─ WalkManager.ins.enterGame(res)
         │
         ├─ UIManager.show(WalkMain)      // 创建/复用界面节点
         └─ loading(res)
               │
               ├─ walkMain.showLoading()  // 旋转动画
               ├─ WalkMapCfgManager.ins.load()  // 并行加载两份配置
               ├─ DataManager.ins.updateWalkData(res)
               │     └─ GameData.loadRoads()    // 构建 map_cell_info
               ├─ walkMain.loadGameData()
               │     ├─ mapContent.load()
               │     ├─ mapEventBar.loadContent()
               │     ├─ loadUser()
               │     └─ refreshBackpack()
               └─ sendWalkLoadingComplete()    // C→S，等待回包
                     │
                     ▼ S→C WalkLoadingCompleteNotify
               WalkManager.onCompleteNotiy(data)
                     │
                     ├─ hideLoading()
                     ├─ loadWalkingData(data)        // 写 begin_at/system_time/round
                     ├─ runTime = system_time - begin_at
                     ├─ 遍历 map_cell_info 找首个 second>runTime 的事件
                     ├─ walkMain.loadCurrentLocation(runTime)   // 定位
                     ├─ walkMain.loadRunTime(restTime, nodeIdx, eventIdx) // 测速
                     └─ walkMain.startGame()
                           ├─ mapContent.run()       // 1/60s 滚动 + 回收
                           └─ mapEventBar.startBar() // 1/60s 事件条滚动 + 回收
```

---

## 十一、已知问题与注意点

1. **`loadRoads` 中 `cell.dropsInfo` 未初始化**：`if(cell.drops)` 判断的是 `cell.drops`（不存在），恒走 `else` 分支赋 `[]`，掉落道具实际未被写入 `dropsInfo`。
2. **`events` 字段不完整**：`loadRoads` 只给 `events` 填了 `id` 与 `second`，`type/rewards/distance` 均未赋值；`MapEventBar` 与 `onCompleteNotiy` 仅依赖 `second`，故当前可运行，但若后续需要事件类型/奖励需补全。
3. **`MapContent.load` 重复调用**：`load()` 内 `await this.loadMapBgRes()` 后又调用了一次 `this.loadMapBgRes()`（当前为空实现，无副作用，但属冗余）。
4. **`MapCell` 宽度被硬编码**：`createMapBgs` 末尾 `this.node.getComponent(UITransform).width = 3000`，覆盖了前面按图累加的真实宽度，`getWidth()` 返回值固定为 3000。
5. **`WalkManager.clean()` 递归**：`clean()` 内部调用了 `this.clean()` 自身，会导致栈溢出，应改为调用清理逻辑或 `closeGame()`。
6. **`walkNext` 事件未启用**：`init()` 中 `DispatchEvent.ins.on(EventType.walkNext, ...)` 被注释，`Define.ts` 中也无 `walkNext` 定义。
7. **`checkTime` 未接入主流程**：时间校正方法已实现但未被调用，当前 `runTime` 直接用服务器时间差。
8. **心情值固定为 0**：`WalkUserInfo.loadData` 中 `lb_xinqing_num` 硬编码为 0。
9. **loading 最短时间**：`hideLoading` 保证至少展示 1 秒，但 `WalkManager.loadingMinTime=1000` 与 `hideLoading` 中的 1000 是两处独立常量，未联动。

---

## 十二、扩展指引

- **新增事件类型/奖励**：需在服务器协议、`MapEvent` 接口、`loadRoads` 映射逻辑、`MapEventBar.onTick` 事件推进处一并补充；
- **调整滚动速度/距离感**：修改 `MapContent` 的 `routeMete`/`gridSize`/`routeSize`/`speed`，或 `MapEventBar` 的 `eventsDis`/`spacing`；
- **新增散步地点**：在 `map_bg_cfg.json` 与 `route_config.json` 中补充配置，`WalkMapCfgManager` 自动按 `location_routeId` 键加载，无需改代码；
- **暂停/恢复**：`MapContent.pause` 字段已预留，`run()` 中会跳过位移；`MapEventBar` 暂无暂停字段，需补充。
