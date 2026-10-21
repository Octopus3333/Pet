import { _decorator, Component, Label, Sprite } from 'cc';
import { loadItem } from '../utils/UiTools';
import { ItemConfigManager } from '../../item/ItemConfigManager';
const { ccclass, property } = _decorator;

@ccclass('Item')
export class Item extends Component {
    @property(Sprite)
    sp_icon:Sprite = null
    @property(Label)
    lb_num:Label = null
    @property(Label)
    lb_name:Label = null

    setData(item_id: number, num: number): void {
        const cfg = ItemConfigManager.ins.getConfig(item_id);
        loadItem(this.sp_icon, item_id);
        this.lb_num.string = 'x' + num;
        this.lb_name.string = cfg?.name ?? '';
    }
}


