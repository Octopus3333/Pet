import { _decorator, Component, Label, Node, Sprite } from 'cc';
import { UserInfo, WalkUser } from '../common/utils/InterfaceDefine';
import { loadAvatar } from '../common/utils/UiTools';
import { UIManager } from '../common/utils/UIManager';
import { ViewPath } from '../common/utils/Define';
import { SocketManager, SocketMSgId } from '../common/network/SocketManager';
import { ToastManager } from '../common/utils/ToastManager';
import { UserInfoDetail } from './UserInfoDetail';
import { WaitingManager } from '../common/utils/WaitingManager';
const { ccclass, property } = _decorator;

@ccclass('RoomPlayer')
export class RoomPlayer extends Component {
    @property(Sprite)
    sp_icon:Sprite = null
    @property(Node)
    nd_agree:Node = null
    @property(Label)
    lb_name:Label = null
    @property(Label)
    lb_pic_num:Label = null
    @property(Label)
    lb_energy_num:Label = null
    @property(Label)
    lb_clean_num:Label = null
    data:WalkUser = null;
    setData(data:WalkUser){
        console.log("WalkUser",data)
        this.data = data
        if(!data)return
        if(this.sp_icon){
            loadAvatar(this.sp_icon, data.head_img)
        }
        if(this.lb_name){
            this.lb_name.string = data.nickname || ''
        }
        if(this.lb_pic_num){
            this.lb_pic_num.string = ''
        }
        if(this.lb_energy_num){
            this.lb_energy_num.string = (data.energy ?? 0).toString()
        }
        if(this.lb_clean_num){
            this.lb_clean_num.string = (data.clean ?? 0).toString()
        }
        if(this.nd_agree){
            this.nd_agree.active = data.ready_status == 2
        }
    }
    onClickInfo(){
        WaitingManager.ins.show(true)        
        SocketManager.instance.sendDataWithCallback(SocketMSgId.UserInfo,{user_id:this.data?.user_id},async (res)=>{
            WaitingManager.ins.hide()        
            if(res.code != 0){
                ToastManager.ins.showToast(res.msg)
                return
            }
            var userInfo = await UIManager.ins.show(ViewPath.UserInfoDetail)
            var detail = userInfo.getComponent(UserInfoDetail)
            detail.setData(res, true)
        })
    }
}


