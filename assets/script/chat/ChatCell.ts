import { _decorator, Component, Node, Label, UITransform, Sprite, Button } from 'cc';
import { ChatMessage } from './ChatData';
import { fitSpWithWithLabelStr,  loadAvatar,  loadImg,  loadItem, setBtnEnable } from '../common/utils/UiTools';
import { SocketManager, SocketMSgId } from '../common/network/SocketManager';
import { DispatchEvent } from '../common/utils/DispatchEvent';
import { EventType } from '../common/utils/Define';
import { RecyCleCellComp } from '../common/components/RecyCleCellComp';
import { RecycleScrollView } from '../common/components/RecycleScrollView';
import { ChatDataManager } from './ChatDataManager';
import { ToastManager } from '../common/utils/ToastManager';
const { ccclass, property } = _decorator;

/** 气泡最大宽度 */
const BUBBLE_MAX_WIDTH = 500;
/** Cell 最小高度 */
const  CELL_MIN_HEIGHT = 146;


@ccclass('ChatCell')
export class ChatCell extends RecyCleCellComp {
    // ========== 自己（右侧） ==========

    @property(Node)
    nd_self: Node = null!;

    // ========== 对方（左侧） ==========

    @property(Node)
    nd_other: Node = null!;


    @property(Label)
    txt_name: Label = null!;

    // ========== 配置 ==========

    @property({ tooltip: '气泡文字字体大小' })
    fontSize: number = 20;

    @property({ tooltip: '气泡左右内边距（文本与气泡左右边缘的距离）' })
    bubblePaddingX: number = 20;

    @property({ tooltip: '气泡上下内边距（文本与气泡上下边缘的距离）' })
    bubblePaddingY: number = 30;

    contentText:Label = null
    bg:Node = null
    private _dataIndex = -1;
    // ========== 状态 ==========

    private _message: ChatMessage | null = null;
    private _typewriterIndex = 0;
    private _typewriterCallback?: () => void;

    public get message(): ChatMessage | null {
        return this._message;
    }

    // ========== 生命周期 ==========

    protected onLoad(): void {
        // this.reset();
        // console.log("onload")
    }

    protected onDestroy(): void {
        this.stopTypewriter();
    }

    // ========== 设置数据 ==========
    onClickGet(sender){
        console.log("_message", this._message)
        if(this._message.msg_type == 2){
            SocketManager.instance.sendDataWithCallback(SocketMSgId.SparrowClaim,{msg_id:this._message.msg_id},(res)=>{
                console.log("msgId set", res)
                if(res.code == 0){
                    var btn = sender.target
                    ChatDataManager.instance.updateChatMsg(this._message.msg_id, {is_claimed:true})
                    if(btn)
                    setBtnEnable(sender.target.getComponent(Button), false)
                    DispatchEvent.ins.emit(EventType.GetMaQueRewardFinish)
                }else{
                    ToastManager.ins.showToast(res.msg)
                }
            })
        }

    }
    public setData(message: ChatMessage, index: number): void {
        this._dataIndex = index;
        this._message = message;
        this.reset();
        this.showMessage(message, false, 30);
    }

    private showMessage(message:ChatMessage,
        typewriter?: boolean,
        typeSpeed?: number,
    ){
        var node = message.is_me ? this.nd_self:this.nd_other
        node.active = true
        var style = node.getChildByName("nd_style_" + message.msg_type)

        if(!style){
           return
        }
        var headImg = node.getChildByName("sp_icon")?.getComponent(Sprite)
        loadAvatar(headImg, message.head_img)
        style.active = true
        if(message.msg_type == 2){
            this.contentText = style.getChildByPath("nd_content/lb_text")?.getComponent(Label)
            var spIcon = style.getChildByName("sp_icon")?.getComponent(Sprite)
            if(spIcon){
                loadItem(spIcon, 10001)
            }
            this.bg = style
            var btnNode = style.getChildByPath("nd_content/btn")
            if(btnNode){
                setBtnEnable(btnNode.getComponent(Button), !message.is_claimed)
            }
            this.scheduleOnce(() => {
                const content = style.getChildByName("nd_content")
                const uitrans = content?.getComponent(UITransform)
                if (uitrans) this.notifyCellHeight(uitrans.height);
            }, 0);
        }else{
            this.contentText = style.getChildByName("lb_text")?.getComponent(Label)
            this.bg = style.getChildByName("Sp_text")
            this.updateBubbleSize(message, this.contentText, this.bg)
        }
        this.contentText.string = message.msg;     
    }

 
    // ========== 气泡尺寸计算 ==========

    /**
     * 应用字体大小
     */
    private applyLabelFontSize(label: Label): void {
        label.fontSize = this.fontSize;
        label.lineHeight = Math.round(this.fontSize * 1.5);
    }

    /**
     * 设置文字位置
     */
    private setFontPos(): void {
        if (!this.contentText || !this.bg) return;

        const txtNode = this.contentText.node;
        const txtTrans = txtNode.getComponent(UITransform);
        const bgTrans = this.bg.getComponent(UITransform);

        const bgPos = this.bg.position;
        const cx = bgPos.x + bgTrans.width * (0.5 - bgTrans.anchorX);
        const cy = bgPos.y + bgTrans.height * (0.5 - bgTrans.anchorY);

        // 文本块整体居中，块内各行左对齐
        this.contentText.horizontalAlign = Label.HorizontalAlign.LEFT;
        this.contentText.verticalAlign = Label.VerticalAlign.CENTER;
        txtTrans.setAnchorPoint(0.5, 0.5);
        txtNode.setPosition(cx, cy, 0);
    }

    /**
     * 根据消息内容动态调整气泡尺寸
     * 注意：Cocos Label 赋值后不会立即刷新尺寸，需延迟一帧后测量
     */
    private updateBubbleSize(msg: ChatMessage, txtComp: Label, bgNode: Node): void 
    {
        if (!txtComp || !bgNode || !msg) return;

        this.applyLabelFontSize(txtComp);

        const txtTrans = txtComp.node.getComponent(UITransform);
        const bgTrans = bgNode.getComponent(UITransform);
        if (!txtTrans || !bgTrans) return;

        // 1. 先赋值文本内容
        txtComp.string = msg.msg;

        // 2. 立即强制刷新 Label 尺寸，不等下一帧，避免高度突变导致抖动
        const maxTextWidth = BUBBLE_MAX_WIDTH - this.bubblePaddingX * 2;

        // 3. 测量单行实际宽度：临时关闭换行
        txtComp.enableWrapText = false;
        txtComp.overflow = Label.Overflow.NONE;
        txtComp.updateRenderData(true);
        const singleLineWidth = txtTrans.width;

        let textWidth: number;
        let textHeight: number;

        if (singleLineWidth <= maxTextWidth) 
        {
            // 单行：使用实际文本宽度
            textWidth = singleLineWidth;
            textHeight = txtTrans.height;
        } 
        else 
        {
            // 多行：限制宽度并开启换行
            txtComp.overflow = Label.Overflow.RESIZE_HEIGHT;
            txtComp.enableWrapText = true;
            txtTrans.width = maxTextWidth;
            txtComp.updateRenderData(true);
            textWidth = maxTextWidth;
            textHeight = txtTrans.height;
        }

        // 4. 设置气泡背景尺寸 = 文本尺寸 + 间距
        //    确保 Sprite 使用自定义尺寸模式（覆盖 TRIMMED 等）
        const bgSprite = bgNode.getComponent(Sprite);
        if (bgSprite) 
        {
            bgSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        }
        bgTrans.width = textWidth + this.bubblePaddingX;
        bgTrans.height = textHeight + this.bubblePaddingY;
        this.notifyCellHeight(bgTrans.height);

        // 5. 设置文本位置
        this.setFontPos();
    }
    private notifyCellHeight(height: number): void {
        const rootTrans = this.node.getComponent(UITransform);
        if (!rootTrans) return;
        rootTrans.height = Math.max(height, CELL_MIN_HEIGHT);
        const scroll = (this.node as any)._recycleScroll as RecycleScrollView;
        scroll?.setItemHeight(this._dataIndex, rootTrans.height);
    }

    // ========== 打字效果 ==========

    private startTypewriter(
        label: Label,
        text: string,
        speed: number,
        onDone?: () => void
    ): void {
        this.stopTypewriter();
        this._typewriterIndex = 0;
        this._typewriterCallback = onDone;
        label.string = '';

        const interval = 1.0 / speed;

        this.schedule(
            () => this._typewriterTick(label, text),
            interval,
            text.length - 1,
            0
        );
    }

    private _typewriterTick(label: Label, text: string): void {
        this._typewriterIndex++;
        if (this._typewriterIndex >= text.length) {
            label.string = text;
            this.stopTypewriter();
            this._typewriterCallback?.();
            this._typewriterCallback = undefined;
            return;
        }
        label.string = text.substring(0, this._typewriterIndex + 1);
    }

    public stopTypewriter(): void {
        this.unschedule(this._typewriterTick);
    }

    /** 立即完成打字效果 */
    public finishTypewriter(): void {
        if (this._typewriterIndex <= 0) return;
        this.stopTypewriter();
        const msg = this._message;
        if (msg) {
            const isSelf = msg.is_me;
            const label = this.contentText
            if (label) label.string = msg.msg;
        }
        this._typewriterCallback?.();
        this._typewriterCallback = undefined;
    }

    // ========== 内部 ==========

    private reset(): void {
        if (this.nd_self) {
            this.nd_self.active = false
            for(var i = 1; i < 3; i++){
                this.nd_self.getChildByName("nd_style_" + i).active = false
            }
        };
        if (this.nd_other) {
            this.nd_other.active = false
            for(var i = 1; i < 3; i++){
                this.nd_other.getChildByName("nd_style_" + i).active = false
            }
        };
        if (this.contentText) this.contentText.string = '';
        if (this.txt_name) this.txt_name.string = '';
    }

}