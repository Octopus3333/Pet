import { _decorator, Component, EditBox, instantiate, Label, Node } from 'cc';
import { ToastManager } from './ToastManager';
import { SocketManager, SocketMSgId } from '../network/SocketManager';
import { UIManager } from './UIManager';
import { ItemManager } from '../../item/ItemManager';
import { ItemConfigManager } from '../../item/ItemConfigManager';
const { ccclass, property } = _decorator;

@ccclass('Gm')
export class Gm extends Component {
    @property(EditBox)
    ed_item_id:EditBox = null
    @property(EditBox)
    ed_item_num:EditBox = null
    @property(Node)
    nd_item_info:Node = null
    protected onLoad(): void {
        this.node.on(Node.EventType.TOUCH_END, this.onClickClose,this)
        this.loadItemInfo()
    }
    loadItemInfo(){
        var cfg = ItemConfigManager.ins.getAllConfigs()
        var nd_info = this.nd_item_info.getChildByName("nd_info")
        for (const element of cfg) {
            var node = instantiate(nd_info)
            node.getChildByName("lb_name").getComponent(Label).string = element.name
            node.getChildByName("lb_id").getComponent(Label).string = element.item_id + ""
            node.parent = this.nd_item_info
        }
        nd_info.active = false
    }
    onClickAdd(){
        if(!this.ed_item_id.string ||!Number(this.ed_item_id.string)){
            ToastManager.ins.showToast("item id 错误")
            return
        }
        if(!this.ed_item_num.string ||!Number(this.ed_item_num.string)){
            ToastManager.ins.showToast("item num 错误")
            return
        }
        var content_str = JSON.stringify({item_id:Number(this.ed_item_id.string), count:Number(this.ed_item_num.string)})
        SocketManager.instance.send({message_type:SocketMSgId.GmAddItems,content_str:content_str})
    }
    onClickClose(){
        UIManager.ins.hideView(this.node)
    }
    onClickEndGame(){
        SocketManager.instance.sendData("WalkEnd",{})
    }
}


