import { _decorator, Component, Label, Node, Sprite } from 'cc';
import { RecyCleCellComp } from '../common/components/RecyCleCellComp';
import { loadAvatar } from '../common/utils/UiTools';
import { UIManager } from '../common/utils/UIManager';
import { ViewPath } from '../common/utils/Define';
import { UserInfoDetail } from '../game/UserInfoDetail';
import { SocketManager, SocketMSgId } from '../common/network/SocketManager';
import { ToastManager } from '../common/utils/ToastManager';
const { ccclass, property } = _decorator;

@ccclass('SearchFriendItem')
export class SearchFriendItem extends RecyCleCellComp {
    @property(Sprite)
    sp_icon:Sprite = null
    @property(Label)
    lb_name:Label = null
    @property(Label)
    lb_des:Label = null
    @property(Label)
    lb_id:Label = null
    data = null
    setData(data: any, index: number): void {
        console.log("load searchItem")
        this.data = data
        this.lb_name.string = data.nickname
        this.lb_id.string = "ID:" + data.user_id
        loadAvatar(this.sp_icon, data.head_img)
    }
    async onClickItem(){
        if(!this.data?.user_id) return
        SocketManager.instance.sendDataWithCallback(SocketMSgId.UserInfo,{user_id:this.data.user_id}, async (res)=>{
            if(res.code != 0){
                ToastManager.ins.showToast(res.msg)
                return
            }
            var nd = await UIManager.ins.show(ViewPath.UserInfoDetail)
            var comp = nd.getComponent(UserInfoDetail)
            comp.setData(res)
        })
    }
}


