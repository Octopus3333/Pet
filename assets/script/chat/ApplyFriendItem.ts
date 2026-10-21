import { _decorator, Component, Label, Node, Sprite } from 'cc';
import { loadAvatar } from '../common/utils/UiTools';
import { FriendApply } from '../common/utils/InterfaceDefine';
import { RecyCleCellComp } from '../common/components/RecyCleCellComp';
import { SocketManager, SocketMSgId } from '../common/network/SocketManager';
import { ToastManager } from '../common/utils/ToastManager';
import { DispatchEvent } from '../common/utils/DispatchEvent';
import { WaitingManager } from '../common/utils/WaitingManager';
import { DataManager } from '../Data/DataManager';
import { EventType } from '../common/utils/Define';
const { ccclass, property } = _decorator;

@ccclass('ApplyFriendItem')
export class ApplyFriendItem extends RecyCleCellComp {
    @property(Sprite)
    sp_icon:Sprite = null
    @property(Label)
    lb_name:Label = null
    @property(Label)
    lb_des:Label = null
    @property(Label)
    lb_ret:Label = null
    @property(Node)
    nd_operate:Node = null
    data = null

    protected onDestroy(): void {
        
    }
    setData(data: FriendApply): void {
        console.log("load ApplyFriendItem",data)
        this.data = data
        this.lb_name.string = data.nickname
        this.lb_des.string = data.note
        loadAvatar(this.sp_icon, data.head_img)
        this.refreshView()
    }

    refreshView(){
        var data = this.data
        console.log("this data", this.data)
        this.nd_operate&&(this.nd_operate.active = data.status == 0 && !data.isMe)
        if(data.status != 0){
            this.lb_ret.node.active = true
            switch (data.status) {
                case 1:
                    this.lb_ret.string = "已同意"
                    break
                case 2:
                    this.lb_ret.string = "已拒绝"                
                    break
                case 1:
                    this.lb_ret.string = "已过期"
                    break;            
                default:
                    break;
            }
        } else{
            if(data.isMe){
                this.lb_ret.string = "等待中"
            } else{
                this.lb_ret.node.active = false
            }
        }       
    }
    clickOperate(sender, operate:string){
        if(!this.data){
            ToastManager.ins.showToast("数据异常")
            return
        }
        var status = operate == "agree" ? 1 : 2
        SocketManager.instance.sendDataWithCallback(SocketMSgId.FriendApplyUpdate,{user_id:this.data.user_id, status:status},(res)=>{
                // this.refreshView()
            SocketManager.instance.sendDataWithCallback(SocketMSgId.FriendApplyList,{},(res)=>{
                WaitingManager.ins.hide()
                if(res.code!=0){
                    ToastManager.ins.showToast(res.msg)
                    return
                }
                DataManager.ins.updateApplyList(res.add_mes)
                DataManager.ins.updateAddList(res.me_adds)
                // this.showNewFriend()
                DispatchEvent.ins.emit(EventType.RefreshApplyList)
            })
        })

    }
}


