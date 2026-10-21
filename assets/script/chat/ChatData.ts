/**
 * 聊天数据模型
 * 定义消息发送方枚举和单条消息数据结构
 */

import { ChatMsg, Item } from "../common/utils/InterfaceDefine";

/** 单条聊天消息（别名指向 InterfaceDefine.ChatMsg） */
export type ChatMessage = ChatMsg;

/** 聊天消息列表 */
export type ChatMessageList = ChatMsg[];

/** 聊天显示模式 */
export enum ChatDisplayMode {
    /** 立即显示（玩家聊天） */
    Immediate = 0,
    /** 延迟逐条显示（剧情对话） */
    Delayed = 1,
}

/** 延迟显示配置 */
export interface ChatDelayConfig {
    /** 每条消息显示的间隔时间（秒），默认 1.5 */
    interval?: number;
    /** 第一条消息延迟显示时间（秒），默认 0.5 */
    firstDelay?: number;
    /** 是否自动滚动到底部，默认 true */
    autoScroll?: boolean;
    /** 是否显示打字效果，默认 false */
    typewriter?: boolean;
    /** 打字速度（字符/秒），默认 30 */
    typeSpeed?: number;
}

// ========== 聊天列表相关 ==========

/** 好友/群聊类型 */
export enum ChatObjType {
    /** 私聊好友 */
    Friend = 0,
    /** 群聊 */
    Group = 1,
}



