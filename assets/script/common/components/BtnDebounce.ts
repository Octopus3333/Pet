import { _decorator, Component, Button, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('BtnDebounce')
export class BtnDebounce extends Component {
    @property({ tooltip: '防抖间隔(毫秒)' })
    debounceTime: number = 800;

    private _btn: Button | null = null;
    private _isLocked: boolean = false;

    onLoad() {
        this._btn = this.node.getComponent(Button);
        if (!this._btn) {
            console.warn(`节点 ${this.node.name} 未挂载 Button 组件，防抖失效`);
            return;
        }
        // 注册节点原生 click 事件
        this.node.on(Node.EventType.TOUCH_START, this._onBtnClick, this);
    }

    private _onBtnClick() {
        if (this._isLocked) {
            console.log("触发防抖，点击被拦截");
            return;
        }

        this._isLocked = true;
        this._btn!.interactable = false;

        // 延时解锁 + 恢复按钮
        this.scheduleOnce(() => {
            this._isLocked = false;
            this._btn!.interactable = true;
        }, this.debounceTime / 1000);
    }

    onDestroy() {
        // 移除事件、清空定时器，防止内存泄漏
        this.node.off('click', this._onBtnClick, this);
        this.unscheduleAllCallbacks();
    }
}