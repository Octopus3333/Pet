import { sys } from 'cc';
import { LocalDB } from '../db/LocalDB';
import { Chat, ChatMsg, ChatParam } from '../common/utils/InterfaceDefine';
import { HttpClient } from '../common/network/HttpClient';
import { SocketManager, SocketMSgId } from '../common/network/SocketManager';
import { ToastManager } from '../common/utils/ToastManager';
import { WaitingManager } from '../common/utils/WaitingManager';
import { DataManager } from '../Data/DataManager';

export interface FetchResult {
    success: boolean;
    message?: string;
    chatCount?: number;
    msgCount?: number;
}

export interface ChatQueryCondition {
    chat_id?: number;
    user_id?: string;
}

export interface ChatDataResult {
    chat: Chat | null;
    messages: ChatMsg[];
}

export class ChatDataManager {
    private static _instance: ChatDataManager | null = null;
    private _db: LocalDB = LocalDB.getInstance();
    private readonly DB_NAME = 'chat_data';
    private readonly STORAGE_LIMIT = 4 * 1024 * 1024;
    private readonly MAX_CHAT_COUNT = 500;
    private readonly MAX_MSG_PER_CHAT = 200;

    /** 内存缓存：存储所有 Chat 数据 */
    private _chatContent: Chat[] = [];
    /** 内存缓存：存储所有 ChatMsg 数据 */
    private _msgList: ChatMsg[] = [];
    /** 当前正在聊天的窗口 Chat 数据 */
    private _curMsgTo: Chat | ChatParam = null;
    /** 当前内存缓存归属的登录账号 userId（多账号数据隔离用） */
    private _currentOwnerId: string = '';

    /** 获取当前聊天窗口的 Chat 结构体 */
    get curMsgTo(): Chat | ChatParam {
        return this._curMsgTo;
    }

    /** 设置当前聊天窗口的 Chat 结构体 */
    set curMsgTo(chat: Chat | ChatParam) {
        this._curMsgTo = chat;
    }
    private constructor() {}

    static get instance(): ChatDataManager {
        if (!ChatDataManager._instance) {
            ChatDataManager._instance = new ChatDataManager();
            ChatDataManager._instance.init();
        }
        return ChatDataManager._instance;
    }

    private init(): void {
        this._db.init(this.DB_NAME);
        this.createTables();
        this.loadCacheFromDB();
    }

    /**
     * 从数据库加载当前登录账号的数据到内存缓存
     * 仅加载 owner_id 与当前登录用户匹配的数据，避免多账号数据污染
     */
    private loadCacheFromDB(): void {
        const ownerId = this._getOwnerId();
        this._currentOwnerId = ownerId;
        if (!ownerId) {
            this._chatContent = [];
            this._msgList = [];
            return;
        }
        this._chatContent = this._db.query('chat', { where: { owner_id: ownerId } }).rows as Chat[];
        this._msgList = this._db.query('chat_msg', { where: { owner_id: ownerId } }).rows as ChatMsg[];
    }

    /**
     * 获取当前登录账号的 userId（数据隔离用）
     */
    private _getOwnerId(): string {
        return DataManager.ins.getUserInfo()?.userId || '';
    }

    /**
     * 登录账号切换后重新加载内存缓存
     * - 一次性将历史无 owner_id 的数据归属给当前登录账号
     * - 若登录账号发生变化，则按新账号重新从 DB 过滤加载
     * 应在登录成功后调用
     */
    reloadCacheForCurrentUser(): void {
        const ownerId = this._getOwnerId();
        let changed = false;
        if (ownerId) {
            const c1 = this._db.update('chat', { owner_id: ownerId }, { where: { owner_id: '' } });
            const c2 = this._db.update('chat_msg', { owner_id: ownerId }, { where: { owner_id: '' } });
            if (c1 > 0 || c2 > 0) changed = true;
        }
        if (!changed && ownerId === this._currentOwnerId) return;
        this.loadCacheFromDB();
    }

    private createTables(): void {
        if (!this._db.existsTable('chat')) {
            this._db.createTable({
                name: 'chat',
                columns: [
                    { name: 'chat_id', type: 'INTEGER', primaryKey: true, autoIncrement: true },
                    { name: 'user_id', type: 'TEXT', notNull: true },
                    { name: 'nickname', type: 'TEXT', notNull: true, defaultValue: '' },
                    { name: 'head_img', type: 'TEXT', notNull: true, defaultValue: '' },
                    { name: 'pet_img', type: 'TEXT', notNull: true, defaultValue: '' },
                    { name: 'last_msg', type: 'TEXT', notNull: true, defaultValue: '' },
                    { name: 'last_msg_id', type: 'INTEGER', notNull: true, defaultValue: 0 },
                    { name: 'created_at', type: 'INTEGER', notNull: true, defaultValue: 0 },
                    { name: 'unread_count', type: 'INTEGER', notNull: true, defaultValue: 0 },
                    { name: 'chat_type', type:'INTEGER', notNull:true, defaultValue:1}
                ],
                indexes: [
                    { name: 'idx_chat_user_id', columns: ['user_id'], unique: true },
                    { name: 'idx_chat_create_at', columns: ['created_at'] },
                ],
            });
        }

        if (!this._db.existsTable('chat_msg')) {
            this._db.createTable({
                name: 'chat_msg',
                columns: [
                    { name: 'msg_id', type: 'INTEGER', notNull: true },
                    { name: 'chat_id', type: 'INTEGER', notNull: true },
                    { name: 'user_id', type: 'TEXT', notNull: true },
                    { name: 'nickname', type: 'TEXT', notNull: true, defaultValue: '' },
                    { name: 'head_img', type: 'TEXT', notNull: true, defaultValue: '' },
                    { name: 'msg', type: 'TEXT', notNull: true, defaultValue: '' },
                    { name: 'msg_type', type: 'INTEGER', notNull: true, defaultValue: 0 },
                    { name: 'created_at', type: 'INTEGER', notNull: true, defaultValue: 0 },
                    { name: 'client_id', type: 'TEXT', notNull: true, defaultValue: '' },
                    { name: 'before_msg_id', type: 'INTEGER', notNull: true, defaultValue: 0 },
                    { name: 'is_me', type: 'INTEGER', notNull: true, defaultValue: 0 },
                    { name: 'is_claimed', type: 'INTEGER', notNull: true, defaultValue: 0 },
                    { name: 'item_id', type: 'TEXT', notNull: true, defaultValue: '' },
                    { name: 'chat_type', type:'INTEGER', notNull:true, defaultValue:1}
                ],
                indexes: [
                    { name: 'idx_chat_msg_chat_id', columns: ['chat_id'] },
                    { name: 'idx_chat_msg_create_at', columns: ['created_at'] },
                ],
            });
        } else {
            // 迁移：为已有表添加缺失的列
            this._db.addColumn('chat_msg', { name: 'client_id', type: 'TEXT', defaultValue: '' });
            this._db.addColumn('chat_msg', { name: 'before_msg_id', type: 'INTEGER', defaultValue: 0 });
            this._db.addColumn('chat_msg', { name: 'is_me', type: 'INTEGER', defaultValue: 0 });
            this._db.addColumn('chat_msg', { name: 'is_claimed', type: 'INTEGER', defaultValue: 0 });
            this._db.addColumn('chat_msg', { name: 'item_id', type: 'TEXT', defaultValue: '' });
        }
        // 数据隔离：为两张表添加 owner_id 列，标识数据归属的登录账号，避免多账号数据污染
        this._db.addColumn('chat', { name: 'owner_id', type: 'TEXT', defaultValue: '' });
        this._db.addColumn('chat_msg', { name: 'owner_id', type: 'TEXT', defaultValue: '' });
    }

    /**
     * 从服务器请求数据并保存到本地
     * @param url 服务器接口地址
     * @param params 请求参数
     * @returns 请求结果，包含成功状态和数据统计
     */
    async fetchAndSaveChats(url: string, params?: Record<string, unknown>): Promise<FetchResult> {
        try {
            const response = await HttpClient.instance.get(url, params);

            if (!response || !response.data) {
                return { success: false, message: '服务器返回数据为空' };
            }

            const data = response.data as { chats?: Chat[]; messages?: ChatMsg[] };
            const chats = data.chats || [];
            const messages = data.messages || [];

            this.saveChats(chats);
            this.saveMessages(messages);
            this.enforceStorageLimit();

            return {
                success: true,
                chatCount: chats.length,
                msgCount: messages.length,
            };
        } catch (error) {
            console.error('[ChatDataManager] fetchAndSaveChats failed:', error);
            return { success: false, message: error instanceof Error ? error.message : '请求失败' };
        }
    }

    /**
     * 保存聊天会话数据
     * @param chats 聊天会话数组
     */
    public saveChats(chats: Chat[]): void {
        const ownerId = this._getOwnerId();
        for (const chat of chats) {
            var existing = this._db.findOne('chat', { where: { user_id: chat.user_id, owner_id: ownerId } });
            console.log("user_id_find", existing, "chat_id_find", this._db.findOne('chat', { where: { chat_id: chat.user_id, owner_id: ownerId } }))
            existing = existing? existing:this._db.findOne('chat', { where: { chat_id: chat.user_id, owner_id: ownerId } });
            if (existing) {
                this._db.update('chat', {
                    nickname: chat.nickname,
                    head_img: chat.head_img,
                    pet_img: chat.pet_img,
                    last_msg: chat.last_msg,
                    last_msg_id: chat.last_msg_id,
                    created_at: chat.created_at,
                    unread_count: chat.unread_count,
                }, { where: { user_id: chat.user_id, owner_id: ownerId } });
                // 更新内存缓存
                const idx = this._chatContent.findIndex(c => c.user_id === chat.user_id);
                if (idx !== -1) {
                    this._chatContent[idx] = chat;
                }
            } else {
                this._db.insert('chat', { ...chat, owner_id: ownerId } as Record<string, any>);
                // 添加到内存缓存
                this._chatContent.push(chat);
            }
        }
        this.enforceChatLimit();
    }

    /**
     * 保存聊天消息数据
     * @param messages 消息数组
     */
    public saveMessages(messages: ChatMsg[]): void {
        const ownerId = this._getOwnerId();
        for (const msg of messages) {
            const existing = this._db.query('chat_msg', { where: { msg_id: msg.msg_id, owner_id: ownerId } });
            console.log("existing", existing)
            if (existing.rows.length === 0) {
                this._db.insert('chat_msg', { ...msg, owner_id: ownerId } as Record<string, any>);
                console.log("msg===============",msg)
                // 添加到内存缓存
                this._msgList.push(msg);
            }else{
                this.updateChatMsg(msg.msg_id, msg)
            }
        }
        this.enforceMessageLimit();
    }



    /**
     * 保存单条消息到内存和DB
     */
    saveMessage(msg: ChatMsg): void {
        // 检查是否已存在（通过 client_id 或 msg_id）
        if (msg.client_id) {
            const existing = this._msgList.find(m => m.client_id === msg.client_id);
            if (existing) {
                console.warn('[ChatDataManager] saveMessage: client_id 已存在，跳过');
                return;
            }
        } else if (msg.msg_id > 0) {
            const existing = this._msgList.find(m => m.msg_id === msg.msg_id);
            if (existing) {
                console.warn('[ChatDataManager] saveMessage: msg_id 已存在，跳过');
                return;
            }
        }
        this._db.insert('chat_msg', { ...msg, owner_id: this._getOwnerId() } as Record<string, any>);
        this._msgList.push(msg);
        console.log("MsgList===", this._msgList)
        this.enforceMessageLimit();
    }

    /**
     * 通过client_id找到消息并更新内存和DB
     */
    updateMessageByClientId(clientId: string, data: Partial<ChatMsg>): void {
        const idx = this._msgList.findIndex(m => m.client_id === clientId);
        console.log("idx===============",idx , clientId, data)
        if (idx === -1) return; 
        this._msgList[idx] = { ...this._msgList[idx], ...data };
        this._db.update('chat_msg', data as Record<string, any>, { where: { client_id: clientId } });
    }

    /**
     * 更新本地存储的单条聊天会话数据
     * @param chatId 会话ID
     * @param data 要更新的数据
     * @returns 是否更新成功
     */
    updateChat(chatId: number, data: Partial<Chat>): boolean {
        const existing = this._db.query('chat', { where: { chat_id: chatId } });
        if (existing.rows.length === 0) {
            console.warn(`[ChatDataManager] updateChat: 未找到 chat_id=${chatId}`);
            return false;
        }

        this._db.update('chat', data as Record<string, any>, { where: { chat_id: chatId } });
        
        // 更新内存缓存
        const idx = this._chatContent.findIndex(c => c.chat_id === chatId);
        if (idx !== -1) {
            this._chatContent[idx] = { ...this._chatContent[idx], ...data };
        }
        
        return true;
    }

    /**
     * 更新本地存储的单条消息数据
     * @param msgId 消息ID
     * @param data 要更新的数据
     * @returns 是否更新成功
     */
    updateChatMsg(msgId: number, data: Partial<ChatMsg>): boolean {
        const existing = this._db.query('chat_msg', { where: { msg_id: msgId } });
        if (existing.rows.length === 0) {
            console.warn(`[ChatDataManager] updateChatMsg: 未找到 msg_id=${msgId}`);
            return false;
        }
        this._db.update('chat_msg', data as Record<string, any>, { where: { msg_id: msgId } });
        
        // 更新内存缓存
        const idx = this._msgList.findIndex(m => m.msg_id === msgId);
        if (idx !== -1) {
            this._msgList[idx] = { ...this._msgList[idx], ...data };
        }
        
        return true;
    }

    /**
     * 移除本地存储的单条聊天会话数据
     * @param chatId 会话ID
     * @returns 是否移除成功
     */
    removeChat(chatId: number): boolean {
        const existing = this._db.query('chat', { where: { chat_id: chatId } });
        if (existing.rows.length === 0) {
            console.warn(`[ChatDataManager] removeChat: 未找到 chat_id=${chatId}`);
            return false;
        }

        this._db.delete('chat_msg', { where: { chat_id: chatId } });
        this._db.delete('chat', { where: { chat_id: chatId } });
        
        // 更新内存缓存
        this._chatContent = this._chatContent.filter(c => c.chat_id !== chatId);
        this._msgList = this._msgList.filter(m => m.chat_id !== chatId);
        
        return true;
    }

    /**
     * 移除本地存储的单条消息数据
     * @param msgId 消息ID
     * @returns 是否移除成功
     */
    removeChatMsg(msgId: number): boolean {
        const existing = this._db.query('chat_msg', { where: { msg_id: msgId } });
        if (existing.rows.length === 0) {
            console.warn(`[ChatDataManager] removeChatMsg: 未找到 msg_id=${msgId}`);
            return false;
        }

        this._db.delete('chat_msg', { where: { msg_id: msgId } });
        
        // 更新内存缓存
        this._msgList = this._msgList.filter(m => m.msg_id !== msgId);
        
        return true;
    }
    getChat(info:{chat_id?:number, user_id?:string}){
        if(info.user_id){
           return this.getChatByUserId(info.user_id)
        }
        if(info.chat_id){
            return this.getChatById(info.chat_id)
        }
        return null
    }
    /**
     * 根据chat_id获取聊天会话
     * @param chatId 会话ID
     * @returns 聊天会话对象，未找到返回null
     */
    getChatById(chatId: number): Chat | null {
        return this._chatContent.find(c => c.chat_id === chatId) || null;
    }

    /**
     * 根据user_id获取聊天会话
     * @param userId 用户ID
     * @returns 聊天会话对象，未找到返回null
     */
    getChatByUserId(userId: string): Chat | null {
        let Chat = this._chatContent.find(c => c.user_id === userId) || null;
        if(!Chat){
            const result =  this._db.query('chat', { where: { user_id: userId, owner_id: this._currentOwnerId } })
            var ChatArray = (result.rows || []) as Chat[];
            Chat = ChatArray[0]
        }
           
        return Chat
    }

        /**
     * 根据chat_id获取消息列表（内存缓存优先，内存空则从DB同步）
     * @param  userId 会话ID
     * @returns 消息数组，按时间正序排列
     */
    getMessagesByUserId(userId: string): ChatMsg[] {
        let messages = this._msgList
            .filter(m => m.user_id === userId)
            .sort((a, b) => a.created_at - b.created_at);
        // 内存缓存为空时从DB同步
        try {
            if (messages.length === 0) {
                const result = this._db.query('chat_msg', { where: { user_id: userId, owner_id: this._currentOwnerId } });
                messages = (result.rows || []) as ChatMsg[];
                messages.sort((a, b) => a.created_at - b.created_at);
            }
        } catch (error) {
        }

        return messages;
    }


    /**
     * 根据chat_id获取消息列表（内存缓存优先，内存空则从DB同步）
     * @param chatId 会话ID
     * @returns 消息数组，按时间正序排列
     */
    getMessagesByChatId(chatId: number): ChatMsg[] {
        let messages = this._msgList
            .filter(m => m.chat_id === chatId)
            .sort((a, b) => a.created_at - b.created_at);
        // 内存缓存为空时从DB同步
        try {
            if (messages.length === 0) {
                const result = this._db.query('chat_msg', { where: { chat_id: chatId } });
                console.log("result============",result)
                messages = (result.rows || []) as ChatMsg[];
                messages.sort((a, b) => a.created_at - b.created_at);
            }
        } catch (error) {
            console.error("errro",error)
        }

        return messages;
    }

    /**
     * 根据条件查询聊天数据
     * 支持按chat_id或user_id查询，返回对应的chat会话和消息列表
     * 直接从内存缓存（_chatContent和_msgList）中查询，不访问数据库
     * @param condition 查询条件
     * @returns 查询结果，包含chat会话和消息列表
     */
    getChatDataByCondition(condition: ChatQueryCondition): ChatDataResult {
        let chat: Chat | null = null;
        let messages: ChatMsg[] = [];

        if (condition.chat_id !== undefined && condition.chat_id !== null) {
            // 从 _chatContent 中查找 chat
            chat = this._chatContent.find(c => c.chat_id === condition.chat_id) || null;
            // 从 _msgList 中查找对应的消息
            messages = this._msgList
                .filter(m => m.chat_id === condition.chat_id)
                .sort((a, b) => a.created_at - b.created_at);
        } else if (condition.user_id !== undefined && condition.user_id !== null) {
            // 从 _chatContent 中查找 chat
            chat = this._chatContent.find(c => c.user_id === condition.user_id) || null;
            // 如果找到 chat，再从 _msgList 中查找对应的消息
            if (chat) {
                messages = this._msgList
                    .filter(m => m.chat_id === chat!.chat_id)
                    .sort((a, b) => a.created_at - b.created_at);
            }
        }

        return { chat, messages };
    }

    /**
     * 获取所有聊天会话
     * @returns 所有会话数组
     */
    getAllChats(): Chat[] {
        return this._chatContent;
    }

    /**
     * 获取本地存储的最大 last_msg_id
     * @returns 最大的 last_msg_id，没有数据时返回 null
     */
    getMaxLastMsgId(): number | null {
        const chats = this.getAllChats();
        if (chats.length === 0) {
            return null;
        }
        let maxId = 0;
        for (const chat of chats) {
            if (chat.last_msg_id > maxId) {
                maxId = chat.last_msg_id;
            }
        }
        return maxId;
    }

    /**
     * 获取本地存储的最小 last_msg_id
     * @returns 最小的 last_msg_id，没有数据时返回 null
     */
    getMinLastMsgId(): number | null {
        const chats = this.getAllChats();
        if (chats.length === 0) {
            return null;
        }
        let minId = chats[0].last_msg_id;
        for (const chat of chats) {
            if (chat.last_msg_id < minId) {
                minId = chat.last_msg_id;
            }
        }
        return minId;
    }

    /**
     * 获取指定会话中消息的最大 msg_id（内存+DB）
     */
    getMaxMsgIdByChatId(chatId: number): number {
        let messages = this._msgList.filter(m => m.chat_id === chatId);
        if (messages.length === 0) {
            const result = this._db.query('chat_msg', { where: { chat_id: chatId } });
            messages = (result.rows || []) as ChatMsg[];
        }
        if (messages.length === 0) return 0;
        let maxId = 0;
        for (const m of messages) {
            if (m.msg_id > maxId) maxId = m.msg_id;
        }
        return maxId;
    }

    /**
     * 获取指定会话中消息的最小 msg_id（内存+DB）
     */
    getMinMsgIdByChatId(chatId: number): number {
        let messages = this._msgList.filter(m => m.chat_id === chatId);
        if (messages.length === 0) {
            const result = this._db.query('chat_msg', { where: { chat_id: chatId } });
            messages = (result.rows || []) as ChatMsg[];
        }
        if (messages.length === 0) return 0;
        let minId = messages[0].msg_id;
        for (const m of messages) {
            if (m.msg_id < minId) minId = m.msg_id;
        }
        return minId;
    }

    /**
     * 通过 Socket 请求聊天列表数据（初始加载，is_new=true）
     * 从缓存拿最大的 last_msg_id，无缓存则 last_msg_id=0
     * @param pageSize 每页请求数量
     * @param onSuccess 成功回调，返回聊天列表数据
     */
    requestChatList(pageSize: number, onSuccess: (chats: Chat[]) => void): void {
        const lastMsgId = this.getMaxLastMsgId() ?? 0;
        this._requestChatListWithLastMsgId(lastMsgId, pageSize, true, onSuccess);
    }

    /**
     * 下拉刷新请求聊天列表（is_new=false）
     * last_msg_id 传当前缓存中最小的 last_msg_id
     * @param pageSize 每页请求数量
     * @param onSuccess 成功回调，返回聊天列表数据
     */
    requestChatListRefresh(pageSize: number, onSuccess: (chats: Chat[]) => void): void {
        const lastMsgId = this.getMinLastMsgId() ?? 0;
        this._requestChatListWithLastMsgId(lastMsgId, pageSize, false, onSuccess);
    }

    private _requestChatListWithLastMsgId(lastMsgId: number, pageSize: number, isNew: boolean, onSuccess: (chats: Chat[]) => void): void {
        const req: { last_msg_id: number, page_size: number, is_new: boolean } = {
            last_msg_id: lastMsgId,
            page_size: pageSize,
            is_new: isNew,
        };

        WaitingManager.ins.show();
        SocketManager.instance.sendDataWithCallback(SocketMSgId.ChatList, req, (res) => {
            WaitingManager.ins.hide();
            if (res.code !== 0) {
                ToastManager.ins.showToast(res.msg);
                return;
            }

            const chats = res.chats || [];
            this.saveChats(chats);
            onSuccess(chats);
        });
    }

    /**
     * 增量请求聊天消息（通过 lastMsgId 请求增量数据，自动保存到内存和DB）
     * @param to 请求参数 { chat_id?, user_id?, page_size?, last_id? }
     * @param onSuccess 成功回调，返回更新后的完整消息列表
     */
    requestMessages(
        to: { chat_id?: number, user_id?: string, page_size?: number, last_id: number, is_new:boolean},
        onSuccess: (messages: ChatMsg[]) => void
    ): void {
        SocketManager.instance.sendDataWithCallback(SocketMSgId.MsgList, to, (res) => {
            console.log("res============",res)
            if (res.code !== 0) {
                ToastManager.ins.showToast(res.msg);
                onSuccess([]);
                return;
            }
            const newMessages = res.msgs || [];
            console.log("newMessage length", newMessages.length)
            if (newMessages.length > 0) {
                this.saveMessages(newMessages);
            }
            onSuccess(newMessages);
        });
    }

    /**
     * 加载聊天消息（初始打开，is_new=true）
     * 内部完成：查chat → 计算last_id（本地最大msg_id，无数据为0）→ 请求增量 → 取完整数据 → 补充is_me
     * @param params chat_id 优先，无 chat_id 时用 user_id 查找
     * @param onSuccess 成功回调，返回展示用消息列表
     */
    loadChatMessages(
        params: ChatParam,
        onSuccess: (messages: ChatMsg[]) => void,
        page_size?:number
    ): void {
        console.log("loadChatMessages==================")
        let chat: Chat | null = null;
        let chatId: number | undefined;
        if (params.user_id) {
            // 兜底用 user_id 查找
            chat = this.getChatByUserId(params.user_id);
            chatId = chat?.chat_id;
        }else if (params.chat_id !== undefined) {
            // 优先用 chat_id 直接查找
            chatId = params.chat_id;
            chat = this.getChatById(chatId);
        }  

        // 保存当前聊天窗口的 Chat 数据
        this._curMsgTo = chat || params;

        // 计算 last_id = 当前本地缓存和DB中最大的 msg_id
        const lastId = chatId ? this.getMaxMsgIdByChatId(chatId) : 0;

        // 构建增量请求参数
        const reqParams: { chat_id?: number, user_id?: string, page_size?: number, last_id: number,is_new:boolean } = {};
        if (chatId !== undefined) {
            reqParams.chat_id = chatId;
        } else if (params.user_id) {
            reqParams.user_id = params.user_id;
        }
        reqParams.page_size = page_size || 8
        reqParams.last_id = lastId
        reqParams.is_new = true
        this.requestMessages(reqParams, (newMessages) => {
            console.log("new messages", newMessages, chatId)
            var allMessages =[]
            if(chatId){
                allMessages = this.getMessagesByChatId(chatId)
            }else{
                allMessages = this.getMessagesByUserId(params.user_id)
            }
            const currentUserId = DataManager.ins.getUserInfo()?.userId;
            for (const m of allMessages) {
                m.is_me = m.user_id == currentUserId;
            }

            onSuccess(allMessages);
        });
    }
    //客户端本地添加消息
    clientAddChatMsgData(){

    }

    /** 关闭当前聊天窗口，清除 _curMsgTo */
    closeCurChat(): void {
        this._curMsgTo = null;
    }
    /**
     * 下拉刷新加载更多（is_new=false）
     * last_id 传当前本地最小 msg_id
     */
    loadMoreChatMessages(
        params: { chat_id?: number, user_id?: string , page_size?:number},
        onSuccess: (messages: ChatMsg[]) => void
    ): void {
        let chat: Chat | null = null;
        let chatId: number | undefined;

        if (params.chat_id !== undefined) {
            chatId = params.chat_id;
            chat = this.getChatById(chatId);
        } else if (params.user_id) {
            chat = this.getChatByUserId(params.user_id);
            chatId = chat?.chat_id;
        }

        // 计算 last_id = 当前本地缓存和DB中最小的 msg_id
        const lastId = chatId ? this.getMinMsgIdByChatId(chatId) : 0;

        const reqParams: { chat_id?: number, user_id?: string, page_size?: number, last_id: number,is_new:boolean } = {};
        if (chatId !== undefined) {
            reqParams.chat_id = chatId;
        } else if (params.user_id) {
            reqParams.user_id = params.user_id;
        }
        reqParams.page_size = params.page_size || 8
        reqParams.last_id = lastId
        reqParams.is_new = false
        this.requestMessages(reqParams, (newMessages) => {
            console.log("new more messages", newMessages.length)
            const currentUserId = DataManager.ins.getUserInfo()?.userId;
            for (const m of newMessages) {
                m.is_me = m.user_id != currentUserId;
            }

            onSuccess(newMessages);
        });
    }

    /**
     * 获取所有消息
     * @returns 所有消息数组
     */
    getAllMessages(): ChatMsg[] {
        return this._msgList;
    }

    /**
     * 获取存储使用情况
     * @returns 已使用空间和限制空间（字节）
     */
    getStorageUsage(): { used: number; limit: number } {
        let used = 0;
        for (let i = 0; i < sys.localStorage.length; i++) {
            const key = sys.localStorage.key(i);
            if (key && key.startsWith(`${this.DB_NAME}_`)) {
                const value = sys.localStorage.getItem(key);
                if (value) {
                    used += key.length + value.length;
                }
            }
        }
        return { used, limit: this.STORAGE_LIMIT };
    }

    /**
     * 清空所有聊天数据
     */
    clearAll(): void {
        this._db.truncate('chat');
        this._db.truncate('chat_msg');
        this._chatContent = [];
        this._msgList = [];
        console.log('[ChatDataManager] 已清空所有聊天数据');
    }

    /**
     * 销毁实例
     */
    static destroy(): void {
        ChatDataManager._instance = null;
        LocalDB.destroy();
    }

    /**
     * 执行聊天会话数量限制，超出时删除最旧的数据
     */
    private enforceChatLimit(): void {
        const ownerId = this._getOwnerId();
        const chatCount = this._db.count('chat', { where: { owner_id: ownerId } });
        if (chatCount <= this.MAX_CHAT_COUNT) return;

        const excess = chatCount - this.MAX_CHAT_COUNT;
        const oldestChats = this._db.query('chat', {
            where: { owner_id: ownerId },
            orderBy: 'created_at',
            order: 'ASC',
            limit: excess,
        });

        for (const chat of oldestChats.rows) {
            this._db.delete('chat_msg', { where: { chat_id: chat.chat_id } });
            this._db.delete('chat', { where: { chat_id: chat.chat_id } });
            // 同步更新内存缓存
            this._chatContent = this._chatContent.filter(c => c.chat_id !== chat.chat_id);
            this._msgList = this._msgList.filter(m => m.chat_id !== chat.chat_id);
        }

        console.log(`[ChatDataManager] 数据库中清理了 ${excess} 个旧聊天会话`);
    }

    /**
     * 执行每条会话消息数量限制，超出时删除最旧的数据
     */
    private enforceMessageLimit(): void {
        const chats = this._db.query('chat', { where: { owner_id: this._getOwnerId() } }).rows;
        let deleted = false;

        for (const chat of chats) {
            const msgCount = this._db.count('chat_msg', { where: { chat_id: chat.chat_id } });

            if (msgCount > this.MAX_MSG_PER_CHAT) {
                const excess = msgCount - this.MAX_MSG_PER_CHAT;
                const oldestMsgs = this._db.query('chat_msg', {
                    where: { chat_id: chat.chat_id },
                    orderBy: 'created_at',
                    order: 'ASC',
                    limit: excess,
                });

                for (const msg of oldestMsgs.rows) {
                    this._db.delete('chat_msg', { where: { msg_id: msg.msg_id } });
                    // 同步更新内存缓存
                    this._msgList = this._msgList.filter(m => m.msg_id !== msg.msg_id);
                }
                deleted = true;
            }
        }
    }

    /**
     * 执行存储容量限制，超出时删除最旧的数据
     */
    private enforceStorageLimit(): void {
        let usage = this.getStorageUsage();
        let deleted = false;

        while (usage.used > this.STORAGE_LIMIT) {
            const oldestChats = this._db.query('chat', {
                where: { owner_id: this._getOwnerId() },
                orderBy: 'created_at',
                order: 'ASC',
                limit: 10,
            });

            if (oldestChats.rows.length === 0) break;

            for (const chat of oldestChats.rows) {
                this._db.delete('chat_msg', { where: { chat_id: chat.chat_id } });
                this._db.delete('chat', { where: { chat_id: chat.chat_id } });
                // 同步更新内存缓存
                this._chatContent = this._chatContent.filter(c => c.chat_id !== chat.chat_id);
                this._msgList = this._msgList.filter(m => m.chat_id !== chat.chat_id);
            }
            deleted = true;

            usage = this.getStorageUsage();
            console.log(`[ChatDataManager] 存储超限，已清理旧数据，当前使用: ${(usage.used / 1024).toFixed(2)} KB`);
        }
    }
}
