import { _decorator, BlockInputEvents, Component, Node } from 'cc';
import { ToastManager } from '../common/utils/ToastManager';

const { ccclass, property } = _decorator;

@ccclass('ReportPopup')
export class ReportPopup extends Component
{
    @property(Node)
    nd_mask: Node = null;

    @property(Node)
    btn_close: Node = null;

    @property(Node)
    btn_confirm: Node = null;

    protected onLoad(): void
    {
        this.nd_mask?.on(Node.EventType.TOUCH_END, (e) =>
        {
            e.propagationStopped = true;
        });

        this.btn_close?.on(Node.EventType.TOUCH_END, this.onClickClose, this);
        this.btn_confirm?.on(Node.EventType.TOUCH_END, this.onClickConfirm, this);
    }

    show(): void
    {
        this.node.active = true;
    }

    hide(): void
    {
        this.node.active = false;
    }

    private onClickClose(): void
    {
        this.hide();
    }

    private onClickConfirm(): void
    {
        this.hide();
        ToastManager.ins.showToast('已收到您的举报，我们将会尽快核实。');
    }
}