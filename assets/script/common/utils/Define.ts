import { ShopItemCellData } from './InterfaceDefine';

export const Common = {
    prefabPath:"prefabs/",
    texturePath:"textures/",
    configPath:"config/",
    VideoPath:"video/",
    AnimaPath:"anima/"
}
export const ViewPath = {
    Toast:Common.prefabPath + "common/Toast",
    Waiting:Common.prefabPath + "common/WaittingLayer",
    UserInfoDetail:Common.prefabPath + "common/UserInfoDetail",
    MaskPanel:Common.prefabPath + "story/MaskPanel",
    QuizPanel:Common.prefabPath + "story/QuizPanel",
    StoryMain:Common.prefabPath + "story/StoryMain",
    PhotoPopup:Common.prefabPath + "story/PhotoPopup",
    StoryFullAnima:Common.prefabPath + "story/StoryFullAnima",
    HomePanel:Common.prefabPath + "home/HomePanel",
    RubbishHomePanel:Common.prefabPath + "home/RubbishHomePanel",
    StoryStep2: Common.prefabPath + "story/StoryStep2",
    ChatPanel:Common.prefabPath + "chat/ChatPanel",
    ChatCell:Common.prefabPath + "chat/ChatCell",
    ChatList:Common.prefabPath + "chat/ChatList",
    ChatObjCell:Common.prefabPath + "chat/ChatObjCell",
    SearchFriend:Common.prefabPath + "chat/SearchFriend",
    ApplyFriendList:Common.prefabPath + "chat/ApplyFriendList",
    ReportPopup: Common.prefabPath + "chat/ReportPopup",

    TreasureNotes:Common.prefabPath + "story/TreasureNotes",
    NotesContent:Common.prefabPath + "story/NotesContent",
    PhotoCellLayer:Common.prefabPath + "story/PhotoCellLayer",
    PhotoPanel:Common.prefabPath + "photo/PhotoPanel",
    UserAgreementPanel:Common.prefabPath + "login/PrivacyPanel",
    PrivacyAgreementPanel:Common.prefabPath + "login/PrivacyPanel",

    PhotoDetailPanel:Common.prefabPath + "photo/PhotoDetailPanel",
    ProtoPanel:Common.prefabPath + "login/ProtoPanel",
    DiaryNotesCell:Common.prefabPath + "story/DiaryNotesCell",
    LoginPanel:Common.prefabPath + "login/LoginPanel",
    CreateNamePanel:Common.prefabPath +  "story/CreateNamePanel",
    GetRewardsLayer:Common.prefabPath +  "common/GetRewardsLayer",
    StoragePanel:Common.prefabPath + "storage/StoragePanel",
    ShopPanel:Common.prefabPath + "shop/ShopPanel",
    ShopItemDisPanel:Common.prefabPath + "shop/ShopItemDisPanel",
    SalePanel:Common.prefabPath + "storage/SalePanel",
     WarehouseFullPopup:Common.prefabPath + "storage/WarehouseFullPopup",
    ItemDescripView:Common.prefabPath + "common/ItemDescripeView",
    ConfirmPopup:Common.prefabPath + "common/ConfirmPopup",
    InvitView:Common.prefabPath + "common/InvitView",
    SettingPanel: Common.prefabPath + "setting/SettingPanel",
    AccountPanel: Common.prefabPath + "setting/AccountPanel",
    DeleteAccountAgreementPanel: Common.prefabPath + "setting/DeleteAccountAgreementPanel",
    AboutPanel: Common.prefabPath + "setting/AboutPanel",
    FeedbackPanel: Common.prefabPath + "setting/FeedbackPanel",
    RoomLayer:Common.prefabPath + "team/RoomLayer",
    InvitTips:Common.prefabPath + "team/InviteTips",
    InviteTeamPanel:Common.prefabPath + "team/InviteTeamPanel",
    ConfirmLeaveTeamPanel:Common.prefabPath + "team/ConfirmLeaveTeamPanel",
    GmLayer:Common.prefabPath + "gm",
    WalkMain:Common.prefabPath + "walk/WalkMain",
    WalkEnd:Common.prefabPath + "walk/WalkEnd",
    WalkMap:Common.prefabPath + "team/WalkMap"
    }
export const EventType ={
        StoryStart : "StoryStart",
        StoryLoadFinish:"StoryLoadFinish",
        StoryNext:"StoryNext",
        StoryEnd:"StoryEnd",
        QuizResult:"QuizResult",
        ChatDialogueEnd:"ChatDialogueEnd",
        ChatMessageSent:"ChatMessageSent",
        ChatClose:"ChatClose",
        RefreshPlayerInfo:"RefreshPlayerInfo",

        // 登录UI相关事件
        ClickGetPhoneCode:"ClickGetPhoneCode",
        ClickLogin:"ClickLogin",
        PhoneInputChanged:"PhoneInputChanged",           // 手机号输入变化
        CodeInputChanged:"CodeInputChanged",             // 验证码输入变化
        AgreementToggleChanged:"AgreementToggleChanged", // 协议勾选状态变化
        CountdownUpdate:"CountdownUpdate",               // 倒计时更新
        ShowAgreementDialog:"ShowAgreementDialog",       // 显示协议弹窗
        LoginSuccess:"LoginSuccess",                     // 登录成功（UI层监听）
        LoginOut:"LoginOut",
        LoginFailed:"LoginFailed",                       // 登录失败（UI层监听）
        AgreeProto:"AgreeProto",                          //同意协议
        StoryFinish:"StoryFinish",
        
        RefreshCoin:"RefreshCoin",
        RedPointUpdate:"RedPointUpdate",
        RefreshApplyList:"RefreshApplyList",  //重新刷新申请列表
        GetMaQueRewardFinish:"GetMaQueRewardFinish",
        RefreshBackpack:"RefreshBackpack",       // 背包数据刷新
        RefreshBondItems:"RefreshBondItems",     // 羁绊物数据刷新
        RefreshWarehouse:"RefreshWarehouse",     // 仓库数据刷新
        ItemNotiyChange:"ItemNotiyChange",
        StorageItemSelect:"StorageItemSelect",   // 道具选中事件
        PendingBackpackSelect:"PendingBackpackSelect", // 仓库/羁绊道具移入背包后待选中
        PendingWarehouseSelect:"PendingWarehouseSelect", // 背包道具移入仓库后待选中
        PendingBondSelect:"PendingBondSelect", // 背包羁绊物移入羁绊栏后待选中
        ExpandSuccess:"ExpandSuccess", //扩容事件

        BackHome:"BackHome",//返回主界面
        ItemUse:"ItemUse" ,//狗头上的提示   ,
        RefreshBtnProgress:"RefreshBtnProgress" ,// 刷新大厅按钮进度
        PetRun:"PetRun",
        PetTouch:"PetTouch",
        EnterHuDong:"EnterHuDong", //进入互动模式
        PetDoubleTap:"PetDoubleTap",
        PetPlaying:"PetPlaying",
        WalkTeamMake:"WalkTeamMake",
        WalkTeamGo:"WalkTeamGo",
        WalkTeamReady:"WalkTeamReady",
        WalkTeamChoose:"WalkTeamChoose",
        WalkTeamLeave:"WalkTeamLeave",
        ShowWalkInvite:"ShowWalkInvite",
        JoinTeam:"JoinTeam",
        EnterGame:"EnterGame",
        WalkRunNotify:"WalkRunNotify",
        LoadNextWalk:"LoadNextWalk",

        ShopItemSold:"ShopItemSold",         // 商店商品已售出
        ShopRefreshCount:"ShopRefreshCount", // 商店刷新次数更新
        BackTeam:"BackTeam",
        TeamUserUpdate:"TeamUserUpdate"
    }

export const BIRD_ID = "XN69BL"
/**
 * 登录相关事件
 */
export const LoginEvent = {
    LOGIN_SUCCESS: "LOGIN_SUCCESS",           // 登录成功
    LOGIN_FAILED: "LOGIN_FAILED",             // 登录失败
    LOGOUT: "LOGOUT",                         // 登出
    TOKEN_EXPIRED: "TOKEN_EXPIRED",           // Token过期
    DEVICE_MISMATCH: "DEVICE_MISMATCH",       // 设备不匹配
    CODE_SENT: "CODE_SENT",                   // 验证码已发送
    CODE_COUNTDOWN: "CODE_COUNTDOWN",         // 倒计时更新
}

/**
 * 后端错误码定义
 */
export const ErrorCode = {
    // 验证码相关 1001-1999
    PHONE_FORMAT_ERROR: 1001,           // 手机号格式错误
    SEND_CODE_FREQUENT: 1002,           // 发送频率超限（90秒）
    SEND_CODE_LIMIT: 1003,              // 发送次数超限
    SEND_CODE_FAILED: 1004,             // 短信发送失败
    
    // 登录相关 2001-2999
    VERIFY_CODE_ERROR: 2001,            // 验证码错误
    VERIFY_CODE_EXPIRED: 2002,          // 验证码已过期
    PHONE_NOT_REGISTERED: 2003,         // 手机号未注册
    DEVICE_CONFLICT: 2004,              // 设备绑定冲突
    
    // Token相关 3001-3999
    REFRESH_TOKEN_INVALID: 3001,        // Refresh Token无效
    DEVICE_ID_MISMATCH: 3002,           // 设备ID不匹配

    // 用户信息相关 4001-4999
    TOKEN_INVALID: 4001,                // Token无效
    TOKEN_EXPIRED: 4002,                // Token已过期
    DEVICE_ID_NOT_MATCH: 4003,          // 设备ID不匹配
}

/** 道具变更类型 */
export const ItemChangeType = {
    Add: 1,        // 新增
    Decrease: 2,   // 次数减少
    Remove: 3,     // 移除
} as const

/** 仓库类型 */
export const WarehouseType = {
    All: 0,     // 全部
    Clean: 1,   // 清洁
    Food: 2,    // 食物
    Toy: 3,     // 玩具
    Other: 4,   // 其他
} as const

/** 道具分类（本地存储列表标识） */
export const ItemCategory = {
    Backpack: 'backpack',   // 背包
    Bond: 'bond',           // 羁绊物
    Warehouse: 'warehouse', // 仓库
} as const

/** 道具位置（用于 ItemMove 请求） */
export const ItemPosition = {
    Warehouse: 1,   // 仓库
    Bond: 2,        // 羁绊
    Backpack: 3,    // 背包
} as const

/** 道具相关服务端错误码 */
export const ItemErrorCode = {
    /** 背包容量不足 */
    BackpackCapacityInsufficient: 4296,
} as const

/** 外出背包默认配置（Prefab 共 8 格） */
export const BackpackDefault = {
    /** UI 总格子数 */
    TotalSlots: 8,
    /** 服务端未返回容量（0）时的初始免费格数 */
    InitialCapacity: 4,
} as const

/** 将服务端 backpack_capacity 规范为可用容量（0 → 初始 4 格） */
export function normalizeBackpackCapacity(capacity: number): number {
    const value = Number(capacity) || 0
    return value > 0 ? value : BackpackDefault.InitialCapacity
}

export const PetAciton = {
    Idle :0,
    stroke_face:1,
    stroke_head:2,
    stroke_xiaba:3,
    clean:4,
    eat:5,
    toy:6,
    refuse:7,
    dianTou:8,
    naoTou:9
}
export const AnimationGreyName = {
    [1]: {
        Idle:"idle",
        StrokeHead:"naotou",
    },
    [2]: {
        Idle:"idle",
        StrokeHead:"naotou",
    },
    [3]: {
        Idle:"idle",
        StrokeHead:"naotou",
    },
}
export const GreyPetAnimaName = ["D_CAT","D_DOG","D_TU"]

/** 商店子标签类型 */
export const ShopTagType = {
    Sale: 0,
    Food: 1,
    Clean: 2,
    Toy: 3,
    Cloth: 4,
    Furniture: 5,
    Other: 6,
} as const;

export type ShopTagTypeValue = typeof ShopTagType[keyof typeof ShopTagType];

/** 各标签商品列表 */
export type ShopTagItemsMap = Partial<Record<ShopTagTypeValue, ShopItemCellData[]>>;

/** 商店分区刷新次数 */
export interface ShopRefreshInfo {
    remain: number;
    max: number;
}

/** 商店数据源接口 */
export interface IShopDataProvider {
    load(): Promise<void>;
    getItemsByTag(tag: ShopTagTypeValue): ShopItemCellData[];
    /** 刷新可消耗商品分区 */
    refreshTag(tag: ShopTagTypeValue): Promise<ShopItemCellData[]>;
    getRefreshInfo(tag: ShopTagTypeValue): ShopRefreshInfo | null;
    isRefreshableTag(tag: ShopTagTypeValue): boolean;
    hasTagNew(tag: ShopTagTypeValue): boolean;
    clearTagIsNew(tag: ShopTagTypeValue): Promise<void>;
}

export const ColorSkin = {
    [1] : [
        "black","blue","daimao","jubai","jubai2","jumao","lihua","nainiu","nainiu2","sanhua","white","xianluo"
    ],
    [2] : [
        "baigou","bandian","bianmu","chaiquan","demu","hashiqi","heichai","heigou","huangbaiquan","keji","tianyuanquan","yunshibianmu"
    ],
    [3] : ["baiweibo","black","chocolatepinse","chocolatesanhua","grey","huibai","jusesuibian","nainiu","sanhua","white","yellow","zongse"]
}
export const ColorPetAnimaName = {
    [1]: {
        Idle:"idle",
        stroke_face:"mo_lian",
        stroke_head:"mo_tou",
        stroke_xiaba:"mo_xiaba",
        StrokeHead:"naotou",
    },
    [2]: {
        Idle:"idle",
        stroke_face:"mo_lian",
        stroke_head:"mo_tou",
        stroke_xiaba:"mo_xiaba",
        StrokeHead:"naotou",
    },
    [3]: {
        Idle:"idle",
        stroke_face:"mo/mo_lian",
        stroke_head:"mo/mo_tou",
        stroke_xiaba:"mo/mo_xiaba2",
        StrokeHead:"naotou",
    },
}

/** 协议类型 */
export const AgreementType = {
    User: 1,           // 用户协议
    Privacy: 2,        // 隐私协议
    DeleteAccount: 3,  // 注销须知
} as const;

/** 协议URL */
export const AgreementUrl = {
    User: 'https://h5.commaclub.cn/agreement/comma-family-user/index.html',
    Privacy: 'https://h5.commaclub.cn/agreement/comma-family-privacy/index.html',
    DeleteAccount: 'https://h5.commaclub.cn/agreement/comma-family-logout/index.html',
};

/** 相册分类枚举（与后端对齐） */
export const AlbumCategory = {
    Daily: 0,     // 日常
    Cat: 2,       // 猫
    Dog: 3,       // 狗
    Rabbit: 4,    // 兔
    Friend: 5,    // 好友分享
} as const;
export type AlbumCategoryValue = typeof AlbumCategory[keyof typeof AlbumCategory];