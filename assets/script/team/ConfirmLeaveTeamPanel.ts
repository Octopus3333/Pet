import { _decorator, Button, Component } from 'cc';
import { DispatchEvent } from '../common/utils/DispatchEvent';
import { EventType } from '../common/utils/Define';
import { UIManager } from '../common/utils/UIManager';
import { SocketManager, SocketMSgId } from '../common/network/SocketManager';
import { ToastManager } from '../common/utils/ToastManager';
import { DataManager } from '../Data/DataManager';
const { ccclass, property } = _decorator;

@ccclass('ConfirmLeaveTeamPanel')
export class ConfirmLeaveTeamPanel extends Component {
    @property(Button)
    btn_leave_temporary: Button = null;
    @property(Button)
    btn_leave: Button = null;
    @property(Button)
    btn_close: Button = null;

    onClickLeaveTemporary() {
        this.requestLeaveTemporary();
    }

    onClickLeave() {
        this.requestLeaveTeam();
    }

    onClickClose() {
        UIManager.ins.hideView(this.node);
    }

    /** 预留：暂时离开请求，成功后调用 onLeaveTemporarySuccess */
    private requestLeaveTemporary() {
        var teamData = DataManager.ins.getTeamData()
        var userData = DataManager.ins.getUserInfo()
        var isOwner = false
        if(teamData.owner && teamData.owner.user_id == userData.userId){
            isOwner = true
        }
        console.log("leave by ready")
        if(!isOwner && teamData.ready_status == 2){
            SocketManager.instance.sendDataWithCallback(SocketMSgId.WalkReady,{ready_status:1},(res)=>{
                if(res.code != 0){
                    ToastManager.ins.showToast(res.msg || "取消准备失败")
                    return
                }
                this.onLeaveTemporarySuccess();
            })
        }else{
            this.onLeaveTemporarySuccess();
        }
    }

    /** 预留：离开队伍请求，成功后调用 onLeaveSuccess */
    private requestLeaveTeam() {
        console.log("leave room")
        SocketManager.instance.sendDataWithCallback(SocketMSgId.WalkTeamLeave,{},(res)=>{
            if(res.code != 0){
                ToastManager.ins.showToast(res.msg || "离开队伍失败")
                return
            }
            this.onLeaveSuccess();
        })
    }

    onLeaveTemporarySuccess() {
        DispatchEvent.ins.emit(EventType.WalkTeamLeave);
        UIManager.ins.hideView(this.node);

    }

    onLeaveSuccess() {
        DispatchEvent.ins.emit(EventType.WalkTeamLeave);
        UIManager.ins.hideView(this.node);
    }
}
