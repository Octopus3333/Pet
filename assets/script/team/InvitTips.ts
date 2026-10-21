import { _decorator, Component, EditBox, Label, Node, RichText } from 'cc';
import { UIManager } from '../common/utils/UIManager';
import { addHeadPb } from '../common/utils/UiTools';
import { SocketManager, SocketMSgId } from '../common/network/SocketManager';
import { ToastManager } from '../common/utils/ToastManager';
import { WaitingManager } from '../common/utils/WaitingManager';
import { DataManager } from '../Data/DataManager';
const { ccclass, property } = _decorator;

@ccclass('InvitTips')
export class InvitTips extends Component {
    @property(EditBox)
    ed_zm:EditBox = null
    @property(EditBox)
    ed_invite:EditBox = null
    @property(Node)
    nd_type_1:Node = null
    @property((Node))
    nd_type_2:Node = null
    @property(Label)
    lb_btn_des:Label = null
    type = 1  // 1，招募 2邀请 
    data = null
    inviteCallBack = null
    show(type, data? ,cb?){
        this.type = type
        this.data = data
        var style = this["nd_type_" + this.type]
        if(!style){
            this.type = 1
            this.onClickClose()
            return
        }
        if(this.type == 1){
            this.nd_type_1.active = true
            this.nd_type_2.active = false
            if(this.lb_btn_des){
                this.lb_btn_des.string = "确认招募"
            }
        }else if(this.type == 2){
            this.nd_type_1.active = false
            this.nd_type_2.active = true
            var head = this.nd_type_2.getChildByName("nd_head")
            if(head){
                addHeadPb(head, data.head_img)
            }
            var lbName = this.nd_type_2.getChildByName("lb_name")?.getComponent(Label)
            lbName.string = data.nickname
            if(cb){
                this.inviteCallBack = cb
            }
            if(this.lb_btn_des){
                this.lb_btn_des.string = "确认邀请"
            }
            var lb_des2 = this.nd_type_2.getChildByName("lb_des2")?.getComponent(RichText)
            var teamData = DataManager.ins.getTeamData()
            lb_des2.string = "<b><color=#272727>一起去</color><color=#000000>"+ teamData.walk_address_name + "</color><color=#272727>散步</color>"
        }else{
            this.reset()
            this.onClickClose()
        }        
    }
    
    reset(){
        this.nd_type_1.active = false
        this.nd_type_2.active = false  
    }
    onClickInvite(){
        if(this.type == 1){
            WaitingManager.ins.show(true)
            var remark = this.ed_zm? this.ed_zm.string :""
            SocketManager.instance.sendDataWithCallback(SocketMSgId.WalkSeekMake,{remark:remark},(res)=>{
                WaitingManager.ins.hide()
                if(res.code != 0){
                    ToastManager.ins.showToast(res.msg || "发布招募失败")
                    return
                }
                ToastManager.ins.showToast("发布成功")
                UIManager.ins.hideView(this.node)
            })
        }else if(this.type == 2){
            var remark = this.ed_invite? this.ed_invite.string :""
            WaitingManager.ins.show(true)
            SocketManager.instance.sendDataWithCallback(SocketMSgId.WalkInvite,{remark:remark,user_id:this.data?.user_id},(res)=>{
                WaitingManager.ins.hide()
                if(res.code != 0){
                    ToastManager.ins.showToast(res.msg || "邀请失败")
                    return
                }
                ToastManager.ins.showToast("邀请成功")
                this.inviteCallBack && this.inviteCallBack(res)
                UIManager.ins.hideView(this.node)
            })
        }
    }
    onClickClose(){
        UIManager.ins.hideView(this.node)
    }
}


