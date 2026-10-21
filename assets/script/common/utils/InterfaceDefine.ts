import { Vec2 } from "cc";

/**
 * 用户信息接口
 */
export interface UserInfo {
    userId: string; // 用户ID
    nickname: string; // 昵称
    headImg: string; // 头像
    sysTime: number; // 系统当前时间戳(s)
    newUserLead: number; // 新用户引导进度
    petType: number; // 1:猫 2:狗 3:兔
    photoCount: number; // 照片张数
    petName: string; // 宠物昵称
    clean: number; // 清洁度(总量是10000)
    food: number; // 饱腹感(总量是10000)
    pink: number; // 粉爪币
    gold: number; // 金爪币
    energy: number; // 宠物体力
    energyMax: number; // 宠物体力上限
    nature: number; // 1:敏感 2:懒散 3:好奇 4:佛系 5:乖巧 6:黏人 7:好动 8:乐天 9:傲娇 10:忧郁 11:霸道 12:记仇
    color: number;//宠物花色
    intimacy: number; // 亲密度
    unreadCount: number; // 手机消息未读数量
    sparrowUnreadCount: number; // 麻雀消息未读数量
    sparrowStatus: number; // 麻雀状态: 0:未获取 1:离家 2:在家
    sparrowHasUnclaimed: boolean; // true:有未领取的麻雀奖励
    pet_created_at:number
    friendStatus: number; // 好友状态: 0:未添加 1:已申请 2:已添加
    reach_clean100:boolean;
    friend_count:number
    parent_call: string; // 用户称呼（如：主人、姐姐等）
    distance: number; // 累计散步距离(米)
}
export interface Friend {
    userId:string
    nickname:string
    head_img:string
}

/** 聊天会话信息 */
export interface Chat {
    chat_id: number;       // 会话id
    user_id: string;       // 发送者uid
    nickname: string;      // 用户昵称
    head_img: string;      // 头像
    pet_img: string;       // 宠物头像
    last_msg: string;      // 最后一句消息
    last_msg_id: number;   // 和好友聊天的最后一条消息id(用于翻页)
    created_at: number;     // 发送时间戳(s)
    unread_count: number;  // 未读数量
    chat_type:number
}
/** 聊天会话信息 */
export interface ChatParam {
    chat_type?:number
    chat_id?: number;       // 会话id
    user_id?: string;       // 发送者uid
    nickname?: string;      // 用户昵称
    head_img?: string;      // 头像
    pet_img?: string;       // 宠物头像
    last_msg?: string;      // 最后一句消息
    last_msg_id?: number;   // 和好友聊天的最后一条消息id(用于翻页)
    created_at?: number;     // 发送时间戳(s)
    unread_count?: number;  // 未读数量
}
/** 聊天消息 */
export interface ChatMsg {
    chat_type:number;
    chat_id: number;       // 会话id
    msg_id: number;        // 消息id
    user_id: string;       // 发送者uid
    nickname: string;      // 用户昵称
    head_img: string;      // 头像
    msg: string;           // 消息内容
    msg_type: number;      // 消息类型
    created_at: number;     // 发送时间戳(s)
    is_me?: boolean;       // 是否自己发送
    is_claimed?: boolean;  // 奖励是否已领取
    item_id?: Item[];      // 获得道具列表
    before_msg_id?: number;  // 上一条消息的msg_id（客户端维护）
    client_id?: string;    // 客户端消息唯一ID（自增，客户端维护）
}
export interface FriendApply{
    created_at:number
    head_img:string
    user_id:string
    status:number
    nickname:string
    note:string
    isMe:boolean
}

/** 他人用户详情（UserInfo / UserSearch 协议响应） */
export interface OtherUserDetail {
    user_id: string;
    nickname: string;
    head_img: string;
    pet_name: string;
    pet_albums: number;
    pet_type:number
    reach_clean100:boolean
    color:number
    intimacy: number;
    energy: number;
    clean: number;
    /** 服务器字段：0未添加 1已申请 2已添加 */
    friend_apply_status: number;
    /** 本地映射字段，同 friend_apply_status */
    friendStatus?: number;
    code?: number;
    msg?: string;
}
/**
 * 登录结果接口
 */
export interface LoginResult {
    success: boolean;
    errorCode?: number;
    errorMsg?: string;
}
export interface Item{ //背包道具
    item_id:number
    num:number
    id:number
    remain_count:number
    name:string
    type:number
    des:string
    can_send:boolean //是否可赠送
    sale_money:number //售价
    sale_type:number //售价类型
    can_sale:boolean
    total_use_count:number
    use_des:string
    intimacy:number
    clean:number
    pink:number
    energy:number
    animal_limit:number[]
    created_at:number
}

/** 服务器下发的道具（仅含服务端字段） */
export interface ServerItem {
    id: number;             // 唯一id
    item_id: number;        // 配置id
    remain_count: number;   // 剩余可用次数
    created_at:number
}

/** 本地道具配置（对应 itemConfig.json） */
export interface ItemConfig {
    item_id: number;        // 配置id
    name: string;          // 道具名称
    type: number;           // 1:清洁 2:食物 3:玩具 4:其他 6:服饰 7:家具
    category: string;       // 分类（中文）
    des: string;            // 道具说明
    animal_limit: number[];  // 动物限制
    can_send: boolean;      // 是否可赠送
    sale_money: number;     // 商店售价
    sale_type: number;      // 售价类型 1:粉爪币 2:金爪币
    recycle_money: number;  // 回收价格
    recycle_type: number;   // 回收类型 1:粉爪币 2:金爪币
    total_use_count: number;// 总使用次数
    can_sale: boolean;      // 是否可交易
    use_condition: string;  // 使用条件
    note: string;           // 备注
    quality:number
    intimacy:number
    clean:number
    pink:number
    energy:number
}

/** 商店商品 Cell 数据 */
export interface ShopItemCellData {
    item_id: number;
    /** 商品槽位唯一 id（区分同 item_id 的重复商品） */
    good_id?: string;
    /** 所属分区 good_type */
    good_type?: number;
    name?: string;
    price1?: number;
    price2?: number;
    discount?: number;
    sold?: boolean;
    is_new?: boolean;
}

/** 服务端商店商品（对应 Good） */
export interface GoodItem {
    item_id: number;
    /** 商品槽位唯一 id */
    good_id?: string;
    discount?: number;
    bought?: boolean;
}

/** 单个分区商品数据（good_types 数组元素） */
export interface GoodTypeGroup {
    good_type: number;
    is_new?: boolean;
    goods?: GoodItem[];
}

/** 商品列表请求（对应 GoodListReq） */
export interface GoodListReq {
}

/** 商品列表响应（对应 GoodListResp） */
export interface GoodListResp {
    good_types?: GoodTypeGroup[];
    /** 剩余可刷新次数（全账号共享，不在分区内） */
    refresh_count?: number;
    code?: number;
    msg?: string;
}

/** 商品购买请求（对应 GoodBuyReq） */
export interface GoodBuyReq {
    /** 道具 id */
    item_id: number;
    /** 商品槽位唯一 id（good/list 返回，购买时回传） */
    good_id: string;
    /** 分区：9特卖 1清洁 2食物 3玩具 4其他（以 good.proto 为准） */
    good_type: number;
    /** 计划消耗的粉爪币（与 gold 二选一） */
    pink?: number;
    /** 计划消耗的金爪币（与 pink 二选一） */
    gold?: number;
}

/** 商品购买响应（对应 GoodBuyResp） */
export interface GoodBuyResp {
    code?: number;
    msg?: string;
}

/** 可消耗商品刷新请求（对应 GoodRefreshReq） */
export interface GoodRefreshReq {
    /** 分区类型：1清洁 2食物 3玩具 4其他 */
    good_type: number;
}

/** 可消耗商品刷新响应（对应 GoodRefreshResp） */
export interface GoodRefreshResp {
    good_types?: GoodTypeGroup[];
    /** 剩余可刷新次数（全账号共享） */
    refresh_count?: number;
    code?: number;
    msg?: string;
}

/** 去掉 new 标签请求（对应 GoodIsNewReq） */
export interface GoodIsNewReq {
    /** 分区类型：9特卖 1清洁 2食物 3玩具 4其他 */
    good_type: number;
}

/** 去掉 new 标签响应（对应 GoodIsNewResp） */
export interface GoodIsNewResp {
    code?: number;
    msg?: string;
}

/** 道具变更同步结构（对应服务器 ItemChange） */
export interface ItemChange {
    id: number;             // 唯一id
    item_id: number;        // 配置id
    remain_count: number;   // 剩余可用次数
    change_type: number;    // 1:新增 2:次数减少 3:移除
    position?: number;      // 道具所在位置: 1:仓库 2:羁绊 3:背包（新增时用于确定目标列表）
    created_at:number;
}

/** 道具变更通知结构（对应服务器 ItemChangeNotify） */
export interface ItemChangeNotify {
    changes: ItemChange[];
}

/** 仓库信息请求参数 */
export interface WarehouseInfoReq {
    warehouse_type: number; // 0:全部 1:食物 2:清洁 3:玩具 4:其他
    page: number;
    page_size: number;
}

/** 羁绊物信息请求参数 */
export interface BondInfoReq {
    page: number;
    page_size: number;
}

/** 羁绊物信息响应（与仓库共用容量） */
export interface BondInfoResp {
    warehouse_stock?: number;
    warehouse_capacity?: number;
    warehouse_expand_pink?: number;
    items?: ServerItem[];
    list?: ServerItem[];
    total?: number;
    msg?: string;
    code?: number;
}

/** 确认弹窗参数 */
export interface ConfirmPopupData {
    title: string;           // 弹窗标题
    message: string;         // 提示内容
    confirmText?: string;    // 确认按钮文字，默认 “确定”
    cancelText?: string;     // 取消按钮文字，默认 “取消”
    subMessage?: string;    // 附加说明文字（默认显示，传入空字符串或留空则隐藏）
    showSubMessage?: boolean;//是否显示附加说明（默认 true）
    onConfirm?: () => void;  // 确认回调
    onCancel?: () => void;   // 取消回调（可选，一般关闭弹窗）
    hideOnConfirm?: boolean; // 点击确认后是否自动关闭，默认 true
    hideOnCancel?: boolean;  // 点击取消后是否自动关闭，默认 true
}

/** 背包信息请求参数 */
export interface BackpackInfoReq {
}

/** 背包信息响应（对应服务器 BackpackInfoResp） */
export interface BackpackInfoResp {
    backpack_stock: number;     // 背包库存(分子)
    backpack_capacity: number;  // 背包容量(分母)
    backpack_expand_pink: number;// 扩容需要的粉爪币
    items: ServerItem[];        // 物品列表
    list?: ServerItem[];        // 部分服务端回包字段名
    msg?: string;
    code?: number;
}

/** 仓库信息响应（对应服务器 WarehouseInfoResp） */
export interface WarehouseInfoResp {
    warehouse_stock: number;      // 仓库库存(分子)
    warehouse_capacity: number;   // 仓库容量(分母)
    warehouse_expand_pink: number;// 扩容需要的粉爪币
    items: ServerItem[];          // 物品列表
    total?: number;               // 当前分类下的道具总数（分页用）
    msg?: string;
    code?: number;
}

/** 仓库扩容请求参数 */
export interface WarehouseExpandReq {
}

/** 仓库扩容响应（对应服务器 WarehouseExpandResp） */
export interface WarehouseExpandResp {
    warehouse_stock: number;      // 仓库库存(分子)
    warehouse_capacity: number;   // 仓库容量(分母)
    warehouse_expand_pink: number;// 扩容需要的粉爪币
    msg?: string;
    code?: number;
}

/** 背包扩容请求参数 */
export interface BackpackExpandReq {
}

/** 背包扩容响应（对应服务器 BackpackExpandResp） */
export interface BackpackExpandResp {
    backpack_stock: number;     // 背包库存(分子)
    backpack_capacity: number;  // 背包容量(分母)
    backpack_expand_pink: number;// 扩容需要的粉爪币
    msg?: string;
    code?: number;
}

/** 道具移动请求参数 */
export interface ItemMoveReq {
    ids: number[];        // 唯一id列表
    position: number;     // 放入指定位置(1:仓库 2:羁绊 3:背包)
}

/** 道具移动响应（对应服务器 ItemMoveResp） */
export interface ItemMoveResp {
    msg?: string;
    code?: number;
}

/** 卖给狗店长请求参数 */
export interface SellToShopDogReq {
    ids: number[];        // 唯一id列表
}

/** 卖给狗店长响应（对应服务器 SellToShopDogResp） */
export interface SellToShopDogResp {
    delta_pink: number;   // 本次收入的粉爪币
    total_pink: number;   // 总的粉爪币
    msg?: string;
    code?: number;
}

/** 分页请求结果 */
export interface PageResult<T> {
    list: T[];
    page: number;
    page_size: number;
    total: number;
    has_more: boolean;
}

export interface RefreshBtnStruct{
    type:number
    needAnima?:boolean //是否需要动画
}

/**
 * 散步好友状态码（WalkFriend.walk_status 取值）
 */
export const WalkStatus = {
    /** 空闲（可邀请） */
    Idle: 0,
    /** 组队中 */
    InTeam: 1,
    /** 散步中 */
    Walking: 2,
} as const;

/**
 * 散步好友信息（WalkFriendList 协议返回的单个好友项）
 * 对应 InviteCell.prefab 的数据结构
 */
export interface WalkFriend {
    /** 好友用户ID */
    user_id: string;
    /** 昵称（展示在 lb_name） */
    nickname: string;
    /** 头像URL（加载到 sp_icon） */
    head_img: string;
    /** 宠物类型 1:猫 2:狗 3:兔 */
    pet_type: number;
    /** 花色 */
    color: number;
    /** 清洁度 */
    clean: number;
    /** 体力 */
    energy: number;
    /** 散步状态 0:空闲 1:组队中 2:散步中 */
    walk_status: number;
    /** true:好友还未解锁队伍当前目的地 */
    reason_status:number

    online_status:number
}

/**
 * InvitView 视图配置数据（可选，主要用于自定义标题和返回回调）
 * 好友列表数据由 MainController 请求后存入 DataManager，视图内部直接读取
 */
export interface InvitViewData {
    /** 标题（可选，默认不修改） */
    title?: string;
    /** 返回按钮回调（可选） */
    onBack?: () => void;
}

/** 散步队伍成员 */
export interface WalkUser {
    user_id: string;
    nickname: string;
    head_img: string;
    pet_type: number;   // 1:猫 2:狗 3:兔
    color: number;      // 花色
    is_me:boolean
    clean:number
    energy:number
    mood:number         // 心情
    ready_status:number
}

/** 散步队伍信息变化通知 */
export interface WalkTeamChangeNotify {
    team_id: number;
    walk_address_id: number;
    walk_address_name: string;
    users: WalkUser[];
}
export interface TeamData{
    team_id:number
    walk_address_id:number
    walk_address_name:string
    users:WalkUser[]
    owner:WalkUser
    ready_status:number
}
/** 散步详情请求 */
export interface WalkInfoReq {}

/** 散步详情响应 */
export interface WalkInfoResp {
    team_id?: number;
    walk_address_id?: number;
    walk_address_name?: number;
    users?: WalkUser[];
    code?: number;
    msg?: string;
}

/** 发起组队请求 */
export interface WalkTeamMakeReq {}

/** 发起组队响应 */
export interface WalkTeamMakeResp {
    team_id?: number;
    walk_address_id?: number;
    walk_address_name?: number;
    users?: WalkUser[];
    code?: number;
    msg?: string;
}

/** 招募列表请求（游标分页） */
export interface WalkSeekListReq {
    /** 招募id, 用于翻页，游标 */
    last_seek_id: number;
    /** 每页数量 */
    page_size: number;
    /** 是否请求最新数据。true: 请求 seek_id > last_seek_id 的数据（最新增量）；false: 请求 seek_id < last_seek_id 的数据（更老历史） */
    is_new: boolean;
}

/** 招募列表单项数据（与 TeamCell 渲染字段对齐） */
export interface WalkSeekItem {
    /** 招募id（游标） */
    seek_id: number;
    /** 队伍id */
    team_id: number;
    walk_address_id: number;
    walk_address_name: string;
    /** 招募备注 */
    remark: string;
    /** 发起人信息 */
    from_uinfo: WalkUser;
    /** 当前队伍成员 */
    users: WalkUser[];
    /** 队伍准备状态 */
    ready_status: number;
}

/** 招募列表响应 */
export interface WalkSeekListResp {
    /** 招募列表（按 seek_id 降序，最新在前） */
    list: WalkSeekItem[];
    /** 是否还有更多历史数据 */
    has_more?: boolean;
    code?: number;
    msg?: string;
}

/** 单张照片 */
export interface PhotoItem {
    id: number;
    name: string;
    date: string;
    bg: string;
    photo: string;
    quality: number;
}

/** 各分类照片数量*/
export interface CategoryCount {
    category: number;
    count: number;
}

/** 相册列表请求 */
export interface AlbumListReq {
    category: number;
    page: number;
}

/** 相册列表响应 */
export interface AlbumListResp {
    photos: PhotoItem[];
    total: number;
    counts: CategoryCount[];
    has_more: boolean;
    code?: number;
    msg?: string;
}


/** 各分类照片数量（对应 CategoryCount） */
export interface CategoryCount {
    category: number;
    count: number;
}

/** 单张照片（对应 proto PhotoItem） */
export interface PhotoItem {
    user_photo_id: number;      // user_photo.id
    photo_id: number;           // 照片ID
    photo_name: string;         // 照片名称
    rarity: number;             // 稀有度
    obtain_time: number;        // 获得时间戳(秒)
    is_read: boolean;           // 是否已读
    is_copy: boolean;           // 是否复印件
    from_user_name: string;     // 复印件来源用户名
    from_user_img: string;      // 复印件来源头像

    // 照片类型与文件
    photo_type: number;         // 1-单照片 2-组合照片
    photo_filename: string;     // 单照片文件名
    bg_filename: string;        // 背景图文件名
    fg_filename: string;        // 前景图文件名
    pose_filename: string;      // 角色姿势文件名
    pose_x: number;
    pose_y: number;
    pose_scale: number;
    emotion_filename: string;   // 表情文件名
    emotion_x: number;
    emotion_y: number;
    emotion_scale: number;
}

/** 相册列表请求（对应 AlbumListReq） */
export interface AlbumListReq {
    category: number;
    page: number;
}

/** 相册列表响应（对应 AlbumListResp） */
export interface AlbumListResp {
    photos: PhotoItem[];
    total: number;
    counts: CategoryCount[];
    has_more: boolean;
    code?: number;
    msg?: string;
}
export interface MapEvent{
    type:number
    id:number
    rewards:[]
    distance:number
    second:number
}
export interface MapCellData{
    id:number
    rewardPos:[]
    events:MapEvent[]
    dropsInfo:DropItem[]
    mapBgs:number[]
}
export interface DropItem{
    itemId:number
    pos:Vec2
}
export interface WalkMapInfo{
    team_id:number
    begin_at:number
    system_time:number
    walk_address_id:number
    walk_address_name:string
    round:number
    users:WalkUser[]
    map_cell_info:MapCellData[]
}

export interface MapBgCfg {
    map_id: number;
    location: number;
    order: number[];
    rate: number;
    des: string;
}

export interface DropPosItem {
    x: number;
    y: number;
}

export interface RouteConfig {
    route_id: number;
    location: number;
    count: number;
    rate: number;
    events: number[];
    DropPos: DropPosItem[][];
}

/** 路线掉落物 */
export interface RoadDrop {
    item_id: number;
    x: number;
    y: number;
}

/** 路线节奏 */
export interface RoadRhythm {
    rhythm_id: number;
    second: number;
}

/** 路线数据 */
export interface RoadData {
    road_id: number;
    drops: RoadDrop[];
    rhythms: RoadRhythm[];
}

/** 散步下一轮通知 */
export interface WalkRunNextNotify {
    team_id: number;
    walk_address_id: number;
    walk_address_name: string;
    users: WalkUser[];
    scene_map: number;
    roads: RoadData[];
    round:number
}

/** 照片详情请求 */
export interface PhotoDetailReq {
    user_photo_id: number;
    category: number;
}

/** 照片详情响应 */
export interface PhotoDetailResp {
    user_photo_id: number;
    photo_id: number;
    photo_variant_id: number;
    photo_name: string;
    rarity: number;
    image_url: string;
    album_desc: string;
    obtain_time: number;
    is_copy: boolean;
    from_user_name: string;
    from_user_img: string;
    shareable: boolean;
    remain_share_count: number;
    prev_photo_id: number;
    next_photo_id: number;
    photo_type: number;
    photo_filename: string;
    bg_filename: string;
    fg_filename: string;
    pose_filename: string;
    pose_x: number;
    pose_y: number;
    pose_scale: number;
    emotion_filename: string;
    emotion_x: number;
    emotion_y: number;
    emotion_scale: number;
    msg?: string;
    code?: number;
}