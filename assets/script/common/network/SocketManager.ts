import { TokenManager } from '../auth/TokenManager';
import { GameConfig } from '../config/GameConfig';
import { RetryHelper, RetryOptions } from '../utils/RetryHelper';
import { WaitingManager } from '../utils/WaitingManager';

export interface SocketMessage {
    message_type: string;
    content_str: string;
    index?: number;
}
export const SocketMSgId = {
    UserInfo:"UserInfo", //查看用户详情
    UserSearch:"UserSearch",
    UserInfoUpdate:"UserInfoUpdate", // 更新用户信息
    FriendList:"FriendList",
    ChatList:"ChatList",
    MsgList:"MsgList",
    FriendAdd:"FriendAdd",
    FriendApplyList:"FriendApplyList",
    FriendApplyUpdate:"FriendApplyUpdate",
    FriendAddNotify:"FriendAddNotify",
    SparrowFlyoutNotify:"SparrowFlyoutNotify",
    SparrowFlybackNotify:"SparrowFlybackNotify",
    SparrowClaim:"SparrowClaim",
    MoneyChangeNotify:"MoneyChangeNotify",
    BecomeFriendNotify:"BecomeFriendNotify",
    ChatMsgRead:"ChatMsgRead",
    MsgSend:"MsgSend",
    ChatMsgNotify:"ChatMsgNotify",
    GmAddItems:"GmAddItems",
    ItemChangeNotify:"ItemChangeNotify",
    BackpackInfo:"BackpackInfo",
    BondInfo:"BondInfo",
    WarehouseInfo:"WarehouseInfo",
    WarehouseExpand:"WarehouseExpand",
    BackpackExpand:"BackpackExpand",
    ItemMove:"ItemMove",
    SellToShopDog:"SellToShopDog",
    CloseConnNotify:"CloseConnNotify",
    PetTouch:"PetTouch",
    ItemUse:"ItemUse",
    PetChangeNotify:"PetChangeNotify",
    Clean100Notify:"Clean100Notify",
    WalkTeamMake:"WalkTeamMake",
    WalkTeamChangeNotify:"WalkTeamChangeNotify",
    WalkInfo:"WalkInfo",
    WalkStart:"WalkStart",
    WalkFriendList:"WalkFriendList",        // 获取可邀请好友列表（全量）
    WalkInvite:"WalkInvite",     // 邀请好友加入队伍
    WalkSeekMake:"WalkSeekMake",
    WalkSeekList:"WalkSeekList",
    WalkInviteNotify:"WalkInviteNotify",
    WalkTeamJoin:"WalkTeamJoin",
    WalkTeamLeave:"WalkTeamLeave",
    WalkReady:"WalkReady",
    WalkRun:"WalkRun",
    WalkLoadingComplete:"WalkLoadingComplete",
    UserLoginAccount:"UserLoginAccount",
    UserDel:"UserDel",
    CheckCode:"CheckCode",
    FeedbackSend:"FeedbackSend",
    AlbumList:"AlbumList",  
    PhotoDetail:"PhotoDetail" ,
    WalkRunNotify:"WalkRunNotify",
    WalkLoadingCompleteNotify:"WalkLoadingCompleteNotify",
    WalkRunEndNotify:"WalkRunEndNotify",
    WalkRunNextNotify:"WalkRunNextNotify",
    WalkBackCamp:"WalkBackCamp"
}

export interface SocketEventListener {
    (event: string, data?: unknown): void;
}

export type SocketResponseCallback = (data?: any, error?: string) => void;

export class SocketManager {
    private static _instance: SocketManager;
    private _config = GameConfig.instance.network;
    private _socket: WebSocket | null = null;
    private _isConnected = false;
    private _eventListeners: Map<string, SocketEventListener[]> = new Map();
    private _reconnecting = false;
    private _intentionalClose = false;
    private _pingTimer: ReturnType<typeof setInterval> | null = null;
    private _requestIndex = 0;
    private _pendingResponses: Map<number, { callback: SocketResponseCallback; timer: ReturnType<typeof setTimeout> | null; responseType: string }> = new Map();

    private constructor() {}

    public static get instance(): SocketManager {
        if (!SocketManager._instance) {
            SocketManager._instance = new SocketManager();
        }
        return SocketManager._instance;
    }

    public get isConnected(): boolean {
        return this._isConnected;
    }

    public connect(): Promise<void> {
        if (this._isConnected) {
            return Promise.resolve();
        }

        const retryOptions: RetryOptions = {
            maxAttempts: this._config.maxRetryAttempts,
            delayMs: this._config.retryDelayMs,
            backoffFactor: this._config.retryBackoffFactor,
            onRetry: (attempt) => {
                this.emit('reconnect', attempt);
            },
        };

        return RetryHelper.execute(async () => {
            await this.performConnect();
        }, retryOptions);
    }

    public disconnect(): void {
        this._intentionalClose = true;
        this._reconnecting = false;
        if (this._pingTimer) {
            clearInterval(this._pingTimer);
            this._pingTimer = null;
        }
        if (this._socket) {
            this._socket.close();
            this._socket = null;
        }
        this._isConnected = false;
        // 清除token
        TokenManager.instance.clearTokens();
        // 清除所有事件监听
        this._eventListeners.clear();
        // 注意：_socket.close() 会触发 onclose 回调，该回调中已经会发出 'disconnect' 事件，
        // 这里不需要再次发出，否则会导致重复触发退出登录逻辑
    }
    
    public sendData(msgType, data?){
        var contentStr = ""
        if(data){
            contentStr = JSON.stringify(data)
        }
        this.send({message_type: msgType, content_str:contentStr})
    }

    /**
     * 发送协议并等待服务器回包回调
     * @param msgType 请求协议类型
     * @param data 请求数据，会自动注入 index 字段用于一一对应
     * @param callback 收到服务器回包时回调（data 为回包内容，error 为超时等异常信息）
     * @param responseType 回包协议类型，默认与 msgType 相同
     * @param timeoutMs 超时时间，默认 10 秒，<=0 则不检测超时
     */
    public sendDataWithCallback(
        msgType: string,
        data: unknown,
        callback: SocketResponseCallback,
        responseType: string = msgType,
        timeoutMs: number = 10000
    ): void {
        const index = ++this._requestIndex;
        const contentStr = data != null ? JSON.stringify(data) : '';

        let timer: ReturnType<typeof setTimeout> | null = null;
        if (timeoutMs > 0) {
            timer = setTimeout(() => {
                this._resolvePending(index, undefined, 'timeout');
            }, timeoutMs);
        }

        this._pendingResponses.set(index, { callback, timer, responseType });
        this.send({ message_type: msgType, content_str: contentStr, index });
    }

    private _resolvePending(index: number, data?: any, error?: string): void {
        const pending = this._pendingResponses.get(index);
        if (!pending) return;

        if (pending.timer) {
            clearTimeout(pending.timer);
            pending.timer = null;
        }
        this._pendingResponses.delete(index);
        pending.callback(data, error);
    }

    public send(message: SocketMessage): void {
        if (!this._socket || !this._isConnected) {
            throw new Error('Socket not connected');
        }
        console.log("send=====",message)
        this._socket.send(JSON.stringify(message));
    }

    public on(event: string, listener: SocketEventListener): void {
        if (!this._eventListeners.has(event)) {
            this._eventListeners.set(event, []);
        }
        this._eventListeners.get(event)!.push(listener);
    }

    public off(event: string, listener: SocketEventListener): void {
        const listeners = this._eventListeners.get(event);
        if (listeners) {
            const index = listeners.indexOf(listener);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }

    private getSocketUrl(): string {
        const baseUrl = this._config.httpBaseUrl.replace(/\/$/, '');
        const wsUrl = baseUrl.replace(/^http:\/\//i, 'ws://').replace(/^https:\/\//i, 'wss://');
        return `${wsUrl}/ws?token=${TokenManager.instance.getAccessToken()}`;
    }

    private async performConnect(): Promise<void> {
        return new Promise((resolve, reject) => {
            WaitingManager.ins.show()
            const url = this.getSocketUrl();
            this._socket = new WebSocket(url);
            
            const timeoutId = setTimeout(() => {
                if (this._socket) {
                    this._socket.close();
                }
                reject(new Error('Connection timeout'));
            }, this._config.socketConnectTimeout);

            this._socket.onopen = () => {
                console.log("socket===========================success")
                clearTimeout(timeoutId);
                this._isConnected = true;
                this._reconnecting = false;
                this.startPing();
                this.emit('connect');
                resolve();
                WaitingManager.ins.hide()

            };

            this._socket.onclose = (event) => {
                clearTimeout(timeoutId);
                if (this._pingTimer) {
                    clearInterval(this._pingTimer);
                    this._pingTimer = null;
                }
                this._isConnected = false;
                this._socket = null;
                this.emit('disconnect', event);

                // 客户端主动关闭则不重连
                if (this._intentionalClose) {
                    this._intentionalClose = false;
                    WaitingManager.ins.hide();
                    return;
                }

                if (!this._reconnecting) {
                    this._reconnecting = true;
                    this.tryReconnect();
                }
                WaitingManager.ins.hide()
            };

            this._socket.onerror = (error) => {
                clearTimeout(timeoutId);
                this.emit('error', error);
                reject(error);
                WaitingManager.ins.hide()
            };

            this._socket.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data) as SocketMessage;
                    let contentData: unknown = undefined;
                    console.log("onMessage", message)
                    if (message.content_str) {
                        try {
                            contentData = JSON.parse(message.content_str);
                        } catch {
                            contentData = message.content_str;
                        }
                    }

                    if (typeof message.index === 'number') {
                        const pending = this._pendingResponses.get(message.index);
                        if (pending && pending.responseType === message.message_type) {
                            this._resolvePending(message.index, contentData);
                        }
                    }

                    this.emit(message.message_type, contentData);
                } catch (error) {
                    this.emit('error', error);
                }
            };
        });
    }

    private async tryReconnect(): Promise<void> {
        if (this._isConnected || !this._reconnecting) {
            return;
        }

        const retryOptions: RetryOptions = {
            maxAttempts: this._config.maxRetryAttempts,
            delayMs: this._config.retryDelayMs,
            backoffFactor: this._config.retryBackoffFactor,
            onRetry: (attempt) => {
                this.emit('reconnect', attempt);
            },
        };

        try {
            await RetryHelper.execute(async () => {
                await this.performConnect();
            }, retryOptions);
        } catch (error) {
            this._reconnecting = false;
            this.emit('error', error);
        }
    }

    private startPing(): void {
        if (this._pingTimer) {
            clearInterval(this._pingTimer);
        }
        console.log("startPing")
        this._pingTimer = setInterval(() => {
            if (this._socket && this._isConnected) {
                console.log("发送心跳")
                this.sendData('ping' );
            }
        }, this._config.socketPingInterval);
    }

    private emit(event: string, data?: unknown): void {
        const listeners = this._eventListeners.get(event);
        if (listeners) {
            listeners.forEach((listener) => {
                try {
                    listener(event, data);
                } catch (error) {
                    console.error('Error in socket event listener:', error);
                }
            });
        }
    }
}