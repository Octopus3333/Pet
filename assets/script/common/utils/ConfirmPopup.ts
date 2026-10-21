import { _decorator, Component, Label, Button, Node } from 'cc';
import { ConfirmPopupData } from '../utils/InterfaceDefine';

const { ccclass, property } = _decorator;

@ccclass('ConfirmPopup')
export class ConfirmPopup extends Component {

    // ========== UI 绑定 ==========

    @property(Label)
    lb_title: Label = null!;

    @property(Label)
    lb_message: Label = null!;

    /** 附加说明文本（小字） */
    @property(Label)
    lb_sub_message: Label = null!;

    /** 右上角关闭按钮 */
    @property(Button)
    btn_close: Button = null!;

    /** 全屏遮罩（点击可关闭） */
    @property(Node)
    nd_mask: Node = null!;

    @property(Button)
    btn_confirm: Button = null!;

    @property(Button)
    btn_cancel: Button = null!;

    private _data: ConfirmPopupData | null = null;

    // ========== 公开方法 ==========

    public show(data: ConfirmPopupData): void {
        this._data = data;
        this.refreshUI();
        this.node.active = true;

        // 动态监听遮罩点击（避免 onLoad 时可能未绑定）
        if (this.nd_mask) {
            this.nd_mask.on(Node.EventType.TOUCH_END, this.onCancel, this);
        }
    }

    public hide(): void {
        this.node.active = false;
        if (this.nd_mask) {
            this.nd_mask.off(Node.EventType.TOUCH_END, this.onCancel, this);
        }
    }

    // ========== 私有方法 ==========

    private refreshUI(): void {
        const data = this._data;
        if (!data) return;

        if (this.lb_title) this.lb_title.string = data.title;
        if (this.lb_message) this.lb_message.string = data.message;

        // 小字：默认显示，内容为空时自动隐藏
        if (this.lb_sub_message) {
            const showSub = data.showSubMessage !== false; // 默认 true
            const hasContent = data.subMessage && data.subMessage.trim().length > 0;
            this.lb_sub_message.node.active = showSub && hasContent;
            if (showSub && hasContent) {
                this.lb_sub_message.string = data.subMessage!;
            }
        }

        const confirmText = data.confirmText || '确定';
        const cancelText = data.cancelText || '取消';

        if (this.btn_confirm) {
            const lb = this.btn_confirm.node.getChildByName('Label')?.getComponent(Label);
            if (lb) lb.string = confirmText;
        }
        if (this.btn_cancel) {
            const lb = this.btn_cancel.node.getChildByName('Label')?.getComponent(Label);
            if (lb) lb.string = cancelText;
        }
    }

    // ========== 按钮事件 ==========

    private onConfirm(): void {
        if (this._data?.onConfirm) this._data.onConfirm();
        if (this._data?.hideOnConfirm !== false) this.hide();
    }

    private onCancel(): void {
        if (this._data?.onCancel) this._data.onCancel();
        if (this._data?.hideOnCancel !== false) this.hide();
    }

    private onClose(): void {
        this.onCancel(); // 右上角关闭 = 取消
    }

    protected onLoad(): void {
        if (this.btn_confirm) this.btn_confirm.node.on(Button.EventType.CLICK, this.onConfirm, this);
        if (this.btn_cancel) this.btn_cancel.node.on(Button.EventType.CLICK, this.onCancel, this);
        if (this.btn_close) this.btn_close.node.on(Button.EventType.CLICK, this.onClose, this);
        // 遮罩监听在 show 时动态绑定，避免重复
    }

}