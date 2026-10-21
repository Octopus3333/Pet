import { _decorator, Component, Label, Node } from 'cc';
import { DispatchEvent } from '../utils/DispatchEvent';
import { EventType } from '../utils/Define';
const { ccclass, property } = _decorator;

@ccclass('RedPoint')
export class RedPoint extends Component {
    @property(Label)
    lb_num:Label = null
    onLoad() {
        DispatchEvent.ins.on(EventType.RedPointUpdate, this.updateRedPoint, this)
    }
    updateRedPoint(unReadCount:number){
        console.log("RedPoint Update unReadCount",unReadCount)
        if(!unReadCount){
            this.node.active = false
            return
        }
        this.node.active = true
        this.lb_num.string = unReadCount > 99? unReadCount + "+":unReadCount + ""
    }
    protected onDestroy(): void {
        DispatchEvent.ins.off(EventType.RedPointUpdate, this.updateRedPoint, this)
    }
}


