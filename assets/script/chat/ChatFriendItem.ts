import { _decorator, Component, Label, Node, Sprite } from 'cc';
import { Friend } from '../common/utils/InterfaceDefine';
import { RecyCleCellComp } from '../common/components/RecyCleCellComp';
import { loadAvatar } from '../common/utils/UiTools';
import { ToastManager } from '../common/utils/ToastManager';
import { UIManager } from '../common/utils/UIManager';
import { ViewPath } from '../common/utils/Define';
import { UserInfoDetail } from '../game/UserInfoDetail';
import { SocketManager, SocketMSgId } from '../common/network/SocketManager';
const { ccclass, property } = _decorator;

@ccclass('ChatFriendItem')
export class ChatFriendItem extends RecyCleCellComp {
    @property(Label)
    lb_name:Label
    @property(Sprite)
    sp_icon:Sprite
    data = null
    setData(data:Friend, index:number){
        this.data = data
        this.lb_name.string = data.nickname
        loadAvatar(this.sp_icon, data.head_img)
    }
    onVisitClick(){
        ToastManager.ins.showToast("敬请期待")
    }
    async onClickUser(){

        SocketManager.instance.sendDataWithCallback(SocketMSgId.UserInfo,{user_id:this.data?.user_id},async (res)=>{
            console.log("res==========",res)
            if(res.code != 0){
                ToastManager.ins.showToast(res.msg)
                return
            }
            var userInfo = await UIManager.ins.show(ViewPath.UserInfoDetail)
            var detail = userInfo.getComponent(UserInfoDetail)
            detail.setData(res)
        })
    }
}


