import { _decorator, Component, Label, Sprite, CCInteger } from 'cc';
import { DispatchEvent } from '../common/utils/DispatchEvent';
import { EventType } from '../common/utils/Define';
import { getMoneyStr, loadItem } from '../common/utils/UiTools';
const { ccclass, property } = _decorator;

@ccclass('MoneyPanel')
export class MoneyPanel extends Component {
    @property(Label)
    lb_num:Label
    @property(Sprite)
    sp_icon:Sprite
    @property({
        type: CCInteger,
        range: [0, 1, 1], // 最小值0，最大值1，步长1
        tooltip: "0: 粉抓币 | 1: 金抓币" // 鼠标悬浮提示
    })
    type: number = 0// 0 粉抓币 1 金抓币

    protected onLoad(): void {
    
        if(this.type == 1){
            loadItem(this.sp_icon, 10002)       
        }else{
            loadItem(this.sp_icon, 10001)
        }
        DispatchEvent.ins.on(EventType.RefreshCoin,this.refresh, this)
        this.refresh()
    }
    refresh(){
        console.log("refresh=================")
        var money = getMoneyStr()
        if(this.lb_num)
        this.lb_num.string = this.type == 1? money.gold:money.pink
    }
}


