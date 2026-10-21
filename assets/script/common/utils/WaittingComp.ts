import { _decorator, Component, Node, tween, Tween } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('WaittingComp')
export class WaittingComp extends Component {
    @property(Node)
    waittingItem: Node = null!;
    private _tw: Tween<Node> | null = null;

    onLoad() {

        if (!this.waittingItem || !this.waittingItem.isValid) {
            console.warn('[WaittingComp] WaittingItem not found in waitingLayer');
            return;
        }

        // 每秒旋转一圈，无限循环
        this._tw = tween(this.waittingItem)
            .by(1, { angle: -360 })
            .repeatForever()
            .start();
    }

    onDestroy() {
        if (this._tw) {
            this._tw.stop();
            this._tw = null;
        }
    }
}
