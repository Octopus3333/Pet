import { _decorator, Component, Node, ScrollView, Prefab, instantiate, UITransform, Layout, EventTouch, EditBox, Label, Button, Sprite, Widget } from 'cc';
import { ChatMessage, ChatMessageList, ChatDelayConfig } from './ChatData';
import { ChatCell } from './ChatCell';
import { ChatManager } from './ChatManager';
import { UIManager } from '../common/utils/UIManager';
import { StoryManager } from '../common/story/StoryManager';
import { DataManager } from '../Data/DataManager';
import { SocketManager, SocketMSgId } from '../common/network/SocketManager';
import { ChatDataManager } from './ChatDataManager';
import { ChatMsg } from '../common/utils/InterfaceDefine';
import { RecycleScrollView } from '../common/components/RecycleScrollView';
import { BIRD_ID, Common, ViewPath } from '../common/utils/Define';
import { loadImg } from '../common/utils/UiTools';

const { ccclass, property } = _decorator;

/**
 * 聊天面板组件
 * 挂在 ChatPanel 预制体上，管理消息列表的显示
 *

 */
@ccclass('ChatPanel')
export class ChatPanel extends Component {
    // ========== 节点引用 ==========

    @property(Node)
    nd_mask: Node = null!;
    @property(Sprite)
    sp_dog:Sprite = null
    @property(RecycleScrollView)
    nd_scroll: RecycleScrollView = null!;

    @property(Node)
    nd_content: Node = null!;
    @property(Node)
    nd_bird_di:Node = null

    @property(Label)
    lb_name: Label = null!;

    @property(EditBox)
    ed_box: EditBox = null!;

    @property(Button)
    btn_more: Button = null!;

    @property(Button)
    btn_emo: Button = null!;

    @property(Node)
    sp_bottom: Node = null!;

    @property minInputHeight = 90;      // 1 行高度
    @property maxInputLines = 5;        // 最多 5 行
    @property inputPaddingY = 20;       // 输入框背景上下内边距

    // ========== 配置 ==========

    @property(Prefab)
    cellPrefab: Prefab = null!;

    /** 已创建的 Cell 组件列表 */
    private _cells: ChatCell[] = [];

    //sp_bottom 顶部分割线
    private _bottomLine: Node | null = null;

    //ScrollView 可视区域
    private _scrollViewTrans: UITransform | null = null;

    private _onClose?: () => void;
    /** 当前聊天对象信息 */
    private _to: { chat_id?: number, user_id?: string, chat_type?:number } = {};

    // ========== 生命周期 ==========

    protected onLoad(): void {
        this.initScroll();
        if (!this.sp_bottom) {
            this.sp_bottom = this.node.getChildByName('sp_bottom');
        }
        this._bottomLine = this.sp_bottom?.getChildByName('line') ?? null;
        this._scrollViewTrans = this.nd_scroll?.scrollView?.view?.getComponent(UITransform) ?? null;
        this.ed_box.inputMode = EditBox.InputMode.ANY;
        this.ed_box.node.on(EditBox.EventType.TEXT_CHANGED, this.onInputChanged, this);
        this.updateInputHeight();
    }
    protected onEnable(): void {
        this.ed_box.string = "";
        this.updateInputHeight();

    }
    private onInputChanged(): void {
        this.updateInputHeight();
        this.updataEmo();
    }

    loadChatBg(){
        console.log("loadChatBg==================",this._to)
        if(this.sp_dog){
            this.sp_dog.node.active = false
        }
        if(!this.nd_bird_di)return
        this.nd_bird_di.active = false
        if(!this._to)return
        console.log("this._to.user_id == BIRD_ID", this._to.user_id == BIRD_ID)

        if(this._to.user_id == BIRD_ID){
            this.nd_bird_di.active = true
            loadImg(this.nd_bird_di.getComponent(Sprite), Common.texturePath + "chat/bg_bird/spriteFrame")
            return
        }
        if(this._to.chat_type == 2){
            this.setDog()
            return
        }
    }
    getData(){
        return this._to
    }
    setData(data){
        this._to.chat_id = data[0]?.chat_id
        this._to.user_id = data[0]?.user_id
        this._to.chat_type = data[0]?.chat_type
        this.loadChatBg()
        this.nd_scroll.setData(data,false)
        //可优化
        this.scheduleOnce(() => {
            this.scheduleOnce(() => {
                this.scrollToBottom();
            }, 0);
        }, 0);
    }
    //修改
    addData(data){
        this._to.chat_id = data[0]?.chat_id
        this._to.user_id = data[0]?.user_id
        this.nd_scroll.addData(data)
        //this.scrollToBottom()
          if (data.length > 0) {
        this.scrollToBottom()
        }
    }
    initScroll(){
        if(!this.nd_scroll){
            return
        }
        this.nd_scroll.setPrefab(this.cellPrefab)
        this.nd_scroll.setOnPullRefresh(() => this.onPullRefresh());
    }
    onPullRefresh(){
        ChatManager.ins.addChatMsgData(8)
    }
    protected onDestroy(): void {

        this.clearAllCells();
    }
    setName(str){
        this.lb_name.string = str
    }
    setDog(){
        this.nd_bird_di.active = true
        loadImg(this.nd_bird_di.getComponent(Sprite), Common.texturePath + "chat/bg_dog/spriteFrame")
        var userInfo = DataManager.ins.getUserInfo()
        if(!userInfo)return               
        this.lb_name.string = userInfo.newUserLead < 4 ? "???":userInfo.petName
        if(this.sp_dog){
            this.sp_dog.node.active = true
        }
    }
    onClickClose(){
        UIManager.ins.hideView(this.node)
        var userInfo = DataManager.ins.getUserInfo()
        console.log("userInfo",userInfo.newUserLead)
        if(userInfo.newUserLead < 4){
            StoryManager.ins.stopStory()
        }       
    }
    updataEmo(){
        const sp = this.btn_emo.node.getChildByName('btn_have')?.getComponent(Sprite);
        if(sp){
            sp.node.active = this.ed_box.string.length > 0
        }
        else{
            sp.node.active = false
        }
    }
    onClickMore(){
        //TODO: 功能待定
        UIManager.ins.show(ViewPath.ReportPopup);
    }
    // ========== 公共 API ==========

    public setOnClose(callback: () => void): void {
        this._onClose = callback;
    }

    onSendMsg(){
        const text = this.ed_box.string.trim();
        if (!text) return;

        const currentUser = DataManager.ins.getUserInfo();
        const currentUserId = currentUser?.userId;
        if (!currentUserId) return;

        const curChat = ChatDataManager.instance.curMsgTo;
        if (!curChat) return;

        // 获取上一条消息的msg_id
        const lastMsg = ChatDataManager.instance.getMaxLastMsgId();
        const beforeMsgId = lastMsg? Number(lastMsg) : undefined;

        const clientId =`${Date.now()}_${curChat.user_id}`;
        console.log("curChat", curChat, clientId)
        // 构建ChatMsg - user_id 应该是当前用户的ID
        const chatMsg: ChatMsg = {
            chat_id: curChat.chat_id,
            msg_id: 0,
            user_id: currentUserId,  // 修复：使用当前用户的ID
            nickname: currentUser.nickname || '',
            head_img: currentUser.headImg || '',
            msg: text,
            msg_type: 1,
            created_at: Math.floor(Date.now() / 1000),
            is_me: true,
            client_id: clientId,
            before_msg_id: beforeMsgId,
        };

        // 保存到本地
        ChatDataManager.instance.saveMessage(chatMsg);

        // 添加到UI
        this.nd_scroll.addData([chatMsg]);
        var sv = this.nd_scroll?.getComponent(ScrollView)
        var trans = sv.content.getComponent(UITransform)
        var svTrans = sv.getComponent(UITransform)
        if(trans.height > svTrans.height){
            sv.scrollToBottom()
        }
        this.ed_box.string = '';
        this.updateInputHeight();

        // 发送协议
        SocketManager.instance.sendDataWithCallback(SocketMSgId.MsgSend, {
            client_id:clientId,
            to_uid: curChat.user_id,
            msg_type: 1,
            msg: text,
        }, (res) => {
            if (res.code === 0) {
                ChatDataManager.instance.updateMessageByClientId(clientId, {
                    msg_id: res.msg_id,
                    chat_id: res.chat_id,
                    before_msg_id: undefined,
                });
                this.onEditFinish()
            }
        });
        this.updataEmo()
    }


    public onEditFinish(){
        if(!this.ed_box)return
        this.ed_box.string = "";
        this.updateInputHeight();
    }


    /**
     * 清空聊天面板
     */
    public clear(): void {
        this.clearAllCells();
    }

    public close(): void {
        this._onClose?.();
        this.node.active = false;
    }



    private scrollToBottom(): void {
        if (!this.nd_content || !this.nd_scroll) return;

        const layout = this.nd_content.getComponent(Layout);
        if (layout) {
            // 等 Layout 更新完成后再滚动
            this.scheduleOnce(() => {
                this.nd_scroll?.getComponent(ScrollView)?.scrollToBottom(0.2);
            }, 0);
        } else {
            this.nd_scroll?.getComponent(ScrollView)?.scrollToBottom(0.2);
        }
    }

    private clearAllCells(): void {
        for (const cell of this._cells) {
            if (cell && cell.node && cell.node.isValid) {
                cell.node.destroy();
            }
        }
        this._cells = [];
    }

    private updateInputHeight(): void {
        const editBox = this.ed_box;
        const textLabel = editBox.textLabel;
         if (!textLabel) return;

        const boxTrans = editBox.node.getComponent(UITransform)!;
        const lineHeight = textLabel.lineHeight;
        const widget = textLabel.node.getComponent(Widget);
        const padY = widget ? widget.top + widget.bottom : this.inputPaddingY * 2;
        const measureWidth = boxTrans.width - (widget?.left ?? 0) - (widget?.right ?? 0);

        const textHeight = this.measureTextHeight(textLabel, measureWidth);
        const maxHeight = this.minInputHeight + (this.maxInputLines - 1) * lineHeight;
        const targetHeight = Math.min(
            maxHeight,
            Math.max(this.minInputHeight, textHeight + padY)
        );

        const prevHeight = boxTrans.height;
        boxTrans.height = targetHeight;
        this.syncBottomHeight(targetHeight - prevHeight);
        // 父节点增高后 Widget(ON_WINDOW_RESIZE) 不会自动重算，需手动触发
        this.syncInputLabelWidgets();
    }

    /** 临时测量文本高度，不污染 Label 显示态（Widget + CLAMP） */
    private measureTextHeight(label: Label, width: number): number {
        const trans = label.node.getComponent(UITransform)!;
        const savedOverflow = label.overflow;
        const savedWidth = trans.width;
        const savedHeight = trans.height;

        label.overflow = Label.Overflow.RESIZE_HEIGHT;
        label.enableWrapText = true;
        trans.width = width;
        label.updateRenderData(true);
        const height = Math.max(label.lineHeight, trans.height);

        label.overflow = savedOverflow;
        trans.width = savedWidth;
        trans.height = savedHeight;
        label.updateRenderData(true);
        return height;
    }

    /** 父节点尺寸变化后，刷新 TEXT_LABEL / PLACEHOLDER_LABEL 的 Widget 对齐 */
    private syncInputLabelWidgets(): void {
        const labels = [this.ed_box.textLabel, this.ed_box.placeholderLabel];
        for (const label of labels) {
            label?.node.getComponent(Widget)?.updateAlignment();
        }
    }

    /** EditBox 增高，sp_bottom 增高、底部子节点上移、ScrollView.view 同步减小 */
    private syncBottomHeight(delta: number): void {
        if (delta === 0) return;
        if (this.sp_bottom) {
            const bottomTrans = this.sp_bottom.getComponent(UITransform);
            if (bottomTrans) {
                bottomTrans.height += delta;
            }
        }
        this.offsetNodeY(this._bottomLine, delta);
        this.offsetNodeY(this.btn_emo?.node ?? null, delta);
        if (this._scrollViewTrans) {
            this._scrollViewTrans.height -= delta;
            this.nd_scroll?.refresh();
            this.nd_scroll?.getComponent(ScrollView)?.scrollToBottom(0.2);
        }
    }

    private offsetNodeY(node: Node | null, delta: number): void {
        if (!node) return;
        const pos = node.position;
        node.setPosition(pos.x, pos.y + delta, pos.z);
    }

}