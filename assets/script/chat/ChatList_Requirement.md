# 聊天列表需求文档

## 1. 需求概述

在现有聊天系统基础上，新增**聊天列表面板**功能。玩家可通过该面板查看所有好友/群聊对象，支持按名称搜索，并基于 ScrollView 实现高效复用渲染。

UI 预制体（`ChatList.prefab`、`ChatObjCell.prefab`）已由策划/美术搭建完成，开发侧只需完成功能逻辑。

---

## 2. 功能需求

### 2.1 好友列表展示

- 使用 ScrollView 垂直列表展示所有聊天对象。
- 每个列表项（Item）需要展示：
  - **头像**：对象头像 Sprite
  - **名称**：对象名称 Label
  - **互动历史**：最后一条消息/互动内容 Label
  - **时间**：最后互动时间 Label（可选，根据 UI 实际节点决定）
- 列表按最后互动时间倒序排列（最近互动的在最上方）。
- 点击 Item 可进入对应聊天会话（事件透出即可，跳转逻辑本次不强制实现）。

### 2.2 搜索功能

- 顶部提供搜索输入框（EditBox）。
- 玩家输入关键字时，列表实时过滤，仅显示名称包含关键字的对象。
- 搜索不区分大小写。
- 当搜索内容清空时，自动恢复展示全部好友列表。

### 2.3 复用机制

- 为避免数据量大时无限创建节点，ScrollView 中的 Item 必须实现复用。
- 复用池最大数量：**20 个 Item**。
- 列表滚动时，根据可见区域动态回收和复用 Item，保证界面上同时存在的 Item 节点不超过 20 个。
- Item 高度固定（与 `ChatObjCell.prefab` 高度一致）。

---

## 3. 数据需求

### 3.1 列表项数据结构

```ts
interface ChatFriendItem {
    /** 唯一 ID */
    id: string;
    /** 名称 */
    name: string;
    /** 类型：好友 / 群聊 */
    type: ChatObjType;
    /** 头像资源路径（resources 下相对路径） */
    avatarPath?: string;
    /** 最后一条互动历史文本 */
    lastMessage: string;
    /** 最后互动时间戳 */
    timestamp: number;
    /** 未读消息数（可选） */
    unreadCount?: number;
}
```

### 3.2 类型枚举

```ts
enum ChatObjType {
    Friend = 0,
    Group = 1,
}
```

### 3.3 数据来源

- 外部通过管理器接口传入完整列表数据。
- 支持后续单条更新（如收到新消息后刷新某个 Item）。

---

## 4. UI 预制体结构

### 4.1 ChatList.prefab

```
ChatList (Node)
├─ sp_top
├─ sp_bottom
├─ nd_mask
├─ ScrollView
│   └─ view
│       └─ content
├─ btn_close
├─ btn_more
└─ lb_name
```

说明：
- `ScrollView / view / content` 为列表滚动区域。
- 搜索输入框当前预制体中未包含，如需搜索功能需在顶部区域补充一个 `EditBox` 节点，或后续由功能脚本动态挂载。
- `btn_close` 用于关闭列表面板。

### 4.2 ChatObjCell.prefab

```
ChatObjCell (Node)
├─ sp_icon (Sprite)     ← 头像
├─ lb_name (Label)      ← 名称
├─ lb_history (Label)   ← 互动历史
└─ spriteFrame (Sprite) ← 底部分隔线
```

说明：
- 时间 Label 当前预制体中未包含，若 UI 后续补充，则脚本需同步绑定。
- 未读红点/数量节点当前未包含，属于可选增强。

---

## 5. 接口设计建议

### 5.1 管理器接口

建议由统一的 `ChatManager` 扩展聊天列表相关能力，避免新增独立管理器：

```ts
// 初始化时一并加载 ChatList 和 ChatObjCell 预制体
ChatManager.ins.initChatList(panelPath, cellPath, parent?);

// 显示列表
ChatManager.ins.showChatList(data: ChatFriendItem[]);

// 隐藏列表
ChatManager.ins.hideChatList();

// 更新单条
ChatManager.ins.updateChatListItem(item: ChatFriendItem);
```

### 5.2 组件接口

```ts
// ChatList 组件
setData(data: ChatFriendItem[]): void;        // 设置并刷新列表
updateItem(item: ChatFriendItem): void;       // 更新单条数据
setOnItemClick(callback: (item) => void): void; // 点击 Item 回调
close(): void;                                 // 关闭面板

// ChatObjCell 组件
setData(item: ChatFriendItem): void;          // 刷新 Item 显示
clear(): void;                                // 清空，便于复用
```

---

## 6. 测试需求

- 提供至少 20 条以上的测试数据，验证复用池上限。
- 验证滚动时 Item 节点数量不超过 20 个。
- 验证搜索过滤与清空恢复功能。
- 验证按时间倒序排列。
- 验证头像资源加载失败时不影响列表显示。

---

## 7. 注意事项

- 不要修改 UI 预制体结构，功能脚本只读取已有节点。
- 搜索输入框若当前预制体未提供，建议优先在预制体上补充 EditBox 节点。
- 复用逻辑需基于 ScrollView 的 `scrollOffset` 和 `viewHeight` 计算可见索引。
- 聊天列表与聊天对话属于