import { _decorator, Component, Label } from 'cc';
import { DispatchEvent } from '../utils/DispatchEvent';
import { EventType } from '../utils/Define';
import { RefreshBtnStruct } from '../utils/InterfaceDefine';

const { ccclass, property } = _decorator;

/**
 * 新手教程 RubbishHomePanel：喂食奖励动画播完后，更新 btn_eat/lb_food 显示。
 * 挂载在 RubbishHomePanel 根节点即可，lb_food 未绑定时会自动查找。
 */
@ccclass('TutorialFeedFoodLabel')
export class TutorialFeedFoodLabel extends Component {
    @property(Label)
    lb_food: Label = null;

    @property
    targetText = '20';

    private _updated = false;

    protected onLoad(): void {
        if (!this.lb_food) {
            this.lb_food = this.node.getChildByPath('nd_bottom/btn_eat/lb_food')?.getComponent(Label) ?? null;
        }
        DispatchEvent.ins.on(EventType.RefreshBtnProgress, this.onFeedRewardAnimDone, this);
    }

    protected onDestroy(): void {
        DispatchEvent.ins.off(EventType.RefreshBtnProgress, this.onFeedRewardAnimDone, this);
    }

    /** Home.showDogRewardsTips 中 food(+energy) 飘字动画结束后会派发 type=2 */
    private onFeedRewardAnimDone(data: RefreshBtnStruct): void {
        if (this._updated || data.type !== 2 || !data.needAnima) {
            return;
        }
        this._updated = true;
        if (this.lb_food) {
            this.lb_food.string = this.targetText;
        }
    }
}
