import { _decorator, Component, Label, Node } from 'cc';
import { UIManager } from './UIManager';
import { ViewPath } from './Define';

const { ccclass, property } = _decorator;

@ccclass('WarehouseFullPopup')
export class WarehouseFullPopup extends Component
{
    @property(Label)
    lb_title: Label = null;

    @property(Label)
    lb_desc: Label = null;

    @property(Node)
    btn_close: Node = null;

    @property(Node)
    btn_goto: Node = null;

    protected onLoad(): void
    {
         // 绑定关闭按钮
        this.btn_close?.on(Node.EventType.TOUCH_END, this.onClickClose, this);
         // 绑定前往仓库按钮
        this.btn_goto?.on(Node.EventType.TOUCH_END, this.onClickGoto, this);
    }

    /**
     * 显示弹窗
     * @param title 标题文字
     * @param desc 描述文字
     */

    show(title?: string, desc?: string): void
    {
        if (this.lb_title)
        {
            this.lb_title.string = title || '仓库已满';
        }
        if (this.lb_desc)
        {
            this.lb_desc.string = desc || '仓库容量已满，请前往仓库整理或扩容';
        }
        this.node.active = true;
    }
    /** 隐藏弹窗 */
    hide(): void
    {
        this.node.active = false;
    }
    /** 点击关闭 */
    private onClickClose(): void
    {
        this.hide();
    }
     /** 点击前往仓库 */
    private onClickGoto(): void
    {
        this.hide();
        UIManager.ins.show(ViewPath.StoragePanel);
    }

    protected onDestroy(): void
    {
        this.btn_close?.off(Node.EventType.TOUCH_END, this.onClickClose, this);
        this.btn_goto?.off(Node.EventType.TOUCH_END, this.onClickGoto, this);
    }

    /*
    const node = await UIManager.ins.show(ViewPath.WarehouseFullPopup);
    node?.getComponent(WarehouseFullPopup)?.show();
    *///在需要的地方调用
}