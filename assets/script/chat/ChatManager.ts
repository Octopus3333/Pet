import { debug, Node, Prefab } from 'cc';
import { ChatMessage, ChatMessageList, ChatDelayConfig } from './ChatData';
import { Chat, ChatMsg, ChatParam } from '../common/utils/InterfaceDefine';
import { ChatPanel } from './ChatPanel';
import { ChatList } from './ChatList';
import { UIManager } from '../common/utils/UIManager';
import { ResLoader } from '../common/download/ResLoader';
import { CHAT_LIST_TEST_DATA } from './ChatListTestData';
import { ViewPath, EventType, Common } from '../common/utils/Define';
import { SocketManager, SocketMSgId } from '../common/network/SocketManager';
import { ToastManager } from '../common/utils/ToastManager';
import { DataManager } from '../Data/DataManager';
import { DispatchEvent } from '../common/utils/DispatchEvent';
import { ChatDataManager } from './ChatDataManager';
import { WaitingManager } from '../common/utils/WaitingManager';

/**
 * 聊天管理器（单例）
 * 提供外部调用接口，管理聊天面板和聊天列表的显示和数据
 *
 * 使用方式:
 *   const chat = ChatManager.ins;
 *   chat.showDialogue(messages);           // 剧情对话（延时显示）
 *   chat.showChat(messages);               // 玩家聊天（立即显示）
 *   chat.showChatList(data);               // 聊天列表
 *   chat.appendMessage(msg);               // 追加一条消息
 *   chat.close();                          // 关闭聊天面板
 *
 * 注意：聊天面板和聊天列表互斥，打开一个会自动关闭另一个。
 */
export class ChatManager {
    private static _ins: ChatManager = null!;

    private _panel: ChatPanel | null = null;

    private _isShowing = false;

    // 聊天列表相关
    private _chatListPanel: ChatList | null = null;
    private _chatListNode: Node | null = null;

    static get ins(): ChatManager {
        if (!ChatManager._ins) {
            ChatManager._ins = new ChatManager();
        }
        return ChatManager._ins;
    }

    private constructor() {
        this.registerSocketEvents();
    }

    public get isShowing(): boolean {
        return this._isShowing;
    }
    destroy(){
        this.unregisterSocketEvents()
    }
    private registerSocketEvents(): void {
        SocketManager.instance.on(SocketMSgId.BecomeFriendNotify, this.updateFriendList.bind(this));
        SocketManager.instance.on(SocketMSgId.FriendAddNotify, this.updateFriendList.bind(this));
        SocketManager.instance.on(SocketMSgId.ChatMsgNotify, this.onChatMsgNotify.bind(this));
    }

    private unregisterSocketEvents(): void {
        SocketManager.instance.off(SocketMSgId.BecomeFriendNotify, this.updateFriendList.bind(this));
        SocketManager.instance.off(SocketMSgId.FriendAddNotify, this.updateFriendList.bind(this));
        SocketManager.instance.off(SocketMSgId.ChatMsgNotify, this.onChatMsgNotify.bind(this));
    }

    updateApplyList(): void {
        WaitingManager.ins.show();
        SocketManager.instance.sendDataWithCallback(SocketMSgId.FriendApplyList, {}, (res) => {
            WaitingManager.ins.hide();
            if (res.code != 0) {
                ToastManager.ins.showToast(res.msg);
                return;
            }
            DataManager.ins.updateApplyList(res.add_mes);
            DataManager.ins.updateAddList(res.me_adds);
            DispatchEvent.ins.emit(EventType.RefreshApplyList);
        });
    }

    updateFriendList(): void {
        WaitingManager.ins.show();
        SocketManager.instance.sendDataWithCallback(SocketMSgId.FriendList, {}, (res) => {
            WaitingManager.ins.hide();
            if (res.code != 0) {
                ToastManager.ins.showToast(res.msg);
                return;
            }
            DataManager.ins.updateFriendsData(res.list);
            if (this._chatListPanel) {
                const friendPrefab = (this._chatListPanel as any).friend_prefab;
                if (friendPrefab) {
                    this._chatListPanel.setCellPrefab(friendPrefab);
                }
                this._chatListPanel.setData(res.list);
            }
        });
        this.updateApplyList()
    }
    loadChatMsgData(param:ChatParam, page_size?:number){
        ChatDataManager.instance.loadChatMessages(param,
        (allMessages)=>{
            this._panel?.setData(allMessages)
            // 设置标题为聊天对象的昵称
            const curChat = ChatDataManager.instance.curMsgTo;
            if (curChat && this._panel) {
                this._panel.setName(curChat.nickname);
            }
        },page_size)
    }

    addChatMsgData(pageSize:number = 8){
        ChatDataManager.instance.loadMoreChatMessages({page_size:pageSize},(newMessage)=>{
            this._panel?.addData(newMessage)
        })
    }
    loadChatData(pageSize: number = 8): void {
        ChatDataManager.instance.requestChatList(pageSize, () => {
            var chats = ChatDataManager.instance.getAllChats()
            chats.sort((a, b) => {
                const idA = a.last_msg_id ?? 0;
                const idB = b.last_msg_id ?? 0;
                return  idB - idA;
            });
            this._chatListPanel?.setData(chats);
        });       
    }
    addChatData(pageSize){
        ChatDataManager.instance.requestChatListRefresh(pageSize, (chats) => {
            this._chatListPanel?.addData(chats);
        });
    }
    // ========== 初始化 ==========

    public async openChat(to:ChatParam): Promise<void> {

        this.showChat(to);
    }

    /**
     * 发送消息已读，并同步更新本地未读数量
     */
    private sendMsgRead(to:{chat_id?:number, user_id?:string},cb): void {
        SocketManager.instance.sendDataWithCallback(SocketMSgId.ChatMsgRead, {user_id: to.user_id}, (res) => {
            console.log("ChatMsgRead res:", res)
            if(res.code != 0){
                ToastManager.ins.showToast(res.msg)
                return
            }
            cb&&cb(res)
        })
    }

    /**
     * 同步总未读数量到 userInfo 并发送红点更新事件
     */
    private syncUnreadCount(): void {
        const chats = ChatDataManager.instance.getAllChats();
        let totalUnread = 0;
        for (const chat of chats) {
            totalUnread += chat.unread_count || 0;
        }
        const userInfo = DataManager.ins.getUserInfo();
        if (userInfo) {
            userInfo.unreadCount = totalUnread;
        }
        DispatchEvent.ins.emit(EventType.RedPointUpdate, totalUnread > 0 ? String(totalUnread) : "");
    }

    /**
     * 收到新消息通知（别人发消息给我）
     * 1. 保存消息到本地DB
     * 2. 更新/创建Chat会话（last_msg、unread_count）
     * 3. 更新红点
     * 4. 刷新聊天列表
     */
    private onChatMsgNotify(event,data: any): void {
        console.log("onChatMsgNotify============",data)
        if (!data) return;
        console.log("[ChatManager] ChatMsgNotify:", data)

        const msg: ChatMsg = {
            msg_id: data.msg_id || 0,
            chat_id: data.chat_id || 0,
            user_id: data.user_id || "",
            nickname: data.nickname || "",
            head_img: data.head_img || "",
            msg: data.msg || "",
            msg_type: data.msg_type || 1,
            created_at: data.created_at || Math.floor(Date.now() / 1000),
        };

        // 1. 保存消息到本地
        ChatDataManager.instance.saveMessages([msg]);

        // 2. 更新或创建Chat会话
        const curChat = ChatDataManager.instance.curMsgTo;

        const existingChat = ChatDataManager.instance.getChatById(msg.chat_id);
        if (existingChat) {
            // 更新已有会话
            const updateData: Partial<Chat> = {
                last_msg: msg.msg,
                last_msg_id: msg.msg_id,
                created_at: msg.created_at,
                unread_count:data.unread_count
            };
            ChatDataManager.instance.updateChat(msg.chat_id, updateData);
        } else {
            console.log("msg.chat_id", msg.chat_id)
            // 新建会话
            const newChat: Chat = {
                chat_id: msg.chat_id,
                user_id: msg.user_id,
                nickname: msg.nickname,
                head_img: msg.head_img,
                pet_img: "",
                last_msg: msg.msg,
                last_msg_id: msg.msg_id,
                created_at: msg.created_at,
                unread_count:data.unread_count
            };
            ChatDataManager.instance.saveChats([newChat]);
        }

        // 3. 更新红点
        this.syncUnreadCount();

        // 4. 如果聊天列表面板打开，刷新列表
        if (this._chatListPanel && this._chatListNode && this._chatListNode.active) {
            const chats = ChatDataManager.instance.getAllChats();
            this._chatListPanel.setData(chats);
        }
        if (this._panel && this._panel.node?.active){
            var curChatData = this._panel.getData()

            if(curChatData.chat_id != msg.chat_id && curChatData.user_id != msg.user_id) return

            this.synReadCount(curChatData)
            this._panel.addData([msg]);

        }
    }

    async initChatPanel(){
        try {
            console.error("init chat panel")
            const panelNode = await UIManager.ins.show(ViewPath.ChatPanel);
            if (!panelNode) {
                console.error('[ChatManager] Failed to load ChatPanel prefab');
                return;
            }
            // panelNode.active = false;
            this._panel = panelNode.getComponent(ChatPanel);

            this._panel.setOnClose(() => this.close());
        } catch (error) {
            console.error('[ChatManager] Init failed:', error);
        }
    }
    
    synReadCount(to:{user_id?:string, chat_id?:number}){
        var chatData = ChatDataManager.instance.getChat(to)
        if(!chatData)return
        if(chatData.unread_count){
            this.sendMsgRead(to,(res)=>{
                console.log("un read count res==========",res)
                if(res.code != 0){
                    return
                }
                ChatDataManager.instance.updateChat(chatData.chat_id,{unread_count: 0})
                var userInfo = DataManager.ins.getUserInfo()
                userInfo.unreadCount = userInfo.unreadCount - chatData.unread_count
                DispatchEvent.ins.emit(EventType.RedPointUpdate)
            })

        }
    }
    // ========== 玩家聊天（立即显示） ==========

    public async showChat(to:ChatParam): Promise<void> {
        this.synReadCount(to)
        await this.showPanel();
        this.loadChatMsgData(to, 8);
    }

    // ========== 追加消息 ==========不做存储

    public async appendMessage(message: ChatMsg[]): Promise<void> {
        await this.showPanel();
        this._panel.addData(message)
    }

    public close(): void {
        this._isShowing = false;
        ChatDataManager.instance.closeCurChat();
        UIManager.ins.hide(ViewPath.ChatPanel)
    }

    public clear(): void {
        this._panel?.clear();
    }
    async showDogPanel(){
        await this.initChatPanel()
        this._panel.setDog()
        this._isShowing = true;
        this.hideChatList();
    }
    // ========== 聊天列表 ==========

    /**
     * 显示聊天列表（自动关闭聊天面板）
     */
    public async showChatList(data: Chat[] = CHAT_LIST_TEST_DATA,
        listPanelPath: string = 'prefabs/chat/ChatList',
        cellPrefabPath: string = 'prefabs/chat/ChatObjCell',
        parent?: Node
    ): Promise<void> {
        try {
            const listNode = await UIManager.ins.show(listPanelPath, parent);
            if (!listNode) {
                console.error('[ChatManager] Failed to load ChatList prefab');
                return;
            }

            this._chatListNode = listNode;
            this._chatListPanel = listNode.getComponent(ChatList);
            if (!this._chatListPanel) {
                console.error('[ChatManager] ChatList component not found on prefab');
                return;
            }

            const cellPrefab = await ResLoader.ins.loadResAsync(cellPrefabPath, Prefab);
            if (cellPrefab) {
                this._chatListPanel.setCellPrefab(cellPrefab);
            }            
            this._chatListPanel.setOnClose(() => this.hideChatList());
            listNode.active = false;
            this.ensureChatList();
            this.close(); // 面板和列表互斥
            if (this._chatListNode) {
                this._chatListNode.active = true;
            }
        } catch (error) {
            console.error('[ChatManager] initChatList failed:', error);
        }
    }

    public hideChatList(): void {
        if (this._chatListNode && this._chatListNode.isValid) {
            this._chatListNode.active = false;
        }
    }

    public updateChatListItem(item: Chat): void {
        this._chatListPanel?.updateItem(item);
    }


    // ========== 内部方法 ==========


    private ensureChatList(): void {
        if (!this._chatListPanel) {
            throw new Error('[ChatManager] ChatList not initialized. Call ChatManager.ins.initChatList() first.');
        }
    }

    /** 显示聊天面板（自动隐藏聊天列表，互斥） */
    private async showPanel(): Promise<void> {
        await this.initChatPanel()
        this._isShowing = true;
        //this.hideChatList();
    }


}