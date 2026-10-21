import { _decorator, Button, CCInteger, Component, Label, Node, RichText, Sprite } from 'cc';
import { addHeadPb, isObjEqual, loadAvatar, loadImg } from '../common/utils/UiTools';
import { TeamData, WalkUser } from '../common/utils/InterfaceDefine';
import { DispatchEvent } from '../common/utils/DispatchEvent';
import { Common, EventType } from '../common/utils/Define';
import { DataManager } from '../Data/DataManager';
import { SocketManager, SocketMSgId } from '../common/network/SocketManager';
import { UIManager } from '../common/utils/UIManager';
import { RecyCleCellComp } from '../common/components/RecyCleCellComp';
import { ToastManager } from '../common/utils/ToastManager';
import { TokenManager } from '../common/auth/TokenManager';
const { ccclass, property } = _decorator;

@ccclass('TeamCell')
export class TeamCell extends RecyCleCellComp {

    @property(Node)
    nd_self: Node = null;
    @property(Node)
    nd_other: Node = null;
    @property(Node)
    nd_content: Node = null;
    @property(Sprite)
    sp_team_icon: Sprite = null;
    @property(RichText)
    rt_team_text: RichText = null;
    @property(Node)
    other_pos: Node = null;
    @property(Node)
    nd_team_state: Node = null;
    @property(Button)
    btn_add_team: Button = null;
    @property(Node)
    nd_confirm:Node = null

    @property({
        type: CCInteger,
        range: [0, 1, 1], // 最小值0，最大值1，步长1
        tooltip: "0: 弹窗 | 1: 列表" // 鼠标悬浮提示
    })
    showType = 0
    joinCb = null
    private static readonly MEMBER_SLOT_COUNT = 3;

    private _teamData = null;

    onLoad() {
        this.btn_add_team.node.on(Button.EventType.CLICK, this.onClickAddTeam, this);
    }

    setData(teamData, cb?) {
        if(isObjEqual(this._teamData, teamData)) {
            console.log("is Eagle")
            return
        }        
        this._teamData = teamData;

        this._teamData.users = teamData.users || [];
        this.joinCb = cb
        this.updateUI();
    }
    cleanHead(){
        if(this.other_pos){
            for(var obj of this.other_pos.children){
                obj.removeAllChildren()
            }
        }
    }
    updateUI() {
        this.cleanHead()
        const owner = this._teamData.from_uinfo;
        const userInfo = DataManager.ins.getUserInfo();
        const isSelfOwner = owner.user_id === userInfo.userId;
        if(this.nd_self){
            this.nd_self.active = isSelfOwner;
        }
        this.nd_other.active = !isSelfOwner;
        this.updateOwnerView(isSelfOwner ? this.nd_self : this.nd_other, owner);
        loadImg(this.sp_team_icon, Common.texturePath + "common/map/map_icon_" + this._teamData.walk_address_id + "/spriteFrame");
        this.rt_team_text.string = "<b><color=#373B40>" + String(this._teamData.walk_address_name || '')+"</color><color=#768190> " + "组队玩耍~\n" + this._teamData.remark + "</color>" ;
        this.refreshTeamState();
        this.updateMemberList();
    }

    private updateOwnerView(node: Node, user: WalkUser) {
        console.log("updateOwnerView")
        if(!user || !user.head_img){
            node.active = false
        }
        addHeadPb(node, user)
        node.active = true
    }

    private refreshTeamState() {
        console.log("this._teamData", this._teamData, this._teamData.users.length)
        const isFull = this._teamData.users.length >= TeamCell.MEMBER_SLOT_COUNT;
        if(this._teamData.walk_status == 2){
            this.nd_team_state.getChildByName('has_go').active = true 
            this.nd_team_state.getChildByName('has_full').active = false
            this.nd_team_state.getChildByName('has_lose').active = false
            if(this.btn_add_team){
                this.btn_add_team.node.active = false
            }            
        }else if(this._teamData.walk_status == 4){
            this.nd_team_state.getChildByName('has_go').active = false
            this.nd_team_state.getChildByName('has_full').active = false
            this.nd_team_state.getChildByName('has_lose').active = true  
            if(this.btn_add_team){
                this.btn_add_team.node.active = false
            }            
        }else if(isFull){
            this.nd_team_state.getChildByName('has_go').active = false
            this.nd_team_state.getChildByName('has_full').active = true
            this.nd_team_state.getChildByName('has_lose').active = false  
            if(this.btn_add_team){
                this.btn_add_team.node.active = false
            }
        }else{
            this.nd_team_state.getChildByName('has_go').active = false
            this.nd_team_state.getChildByName('has_full').active = false
            this.nd_team_state.getChildByName('has_lose').active = false   
            if(this.btn_add_team){
                this.btn_add_team.node.active = true
            }
        }
    }

    private updateMemberList() {
        for (let i = 0; i < TeamCell.MEMBER_SLOT_COUNT; i++) {
            const slotIndex = i + 1;
            const posNode = this.other_pos.getChildByName(`nd_pos${slotIndex}`);
            const user = this._teamData.users[i];
            addHeadPb(posNode, user)
        }
    }

    onClickAddTeam() {
        if (this._teamData.users.length >= TeamCell.MEMBER_SLOT_COUNT){
            ToastManager.ins.showToast("队伍已满")
            return
        } ;
        if(this.showType == 1){
            this.nd_confirm.active = true
            return
        }

        this.requestJoinTeam();
    }
    onClickConfirm(){
        this.requestJoinTeam()
        if(this.nd_confirm){
            this.nd_confirm.active = false
        }
    }
    onClickRefuse(){
        this.nd_confirm.active = false
    }
    /** 预留：WalkTeamJoin 请求，成功后调用 onJoinTeamSuccess */
    private requestJoinTeam() {
        console.log("requestJoinTeam====================", this._teamData)
        if(!this._teamData || !this._teamData.team_id)return

        SocketManager.instance.sendDataWithCallback(SocketMSgId.WalkTeamJoin,{team_id:this._teamData.team_id},(res)=>{
            if(res.code != 0){
                if(res.code == 4300){
                    DispatchEvent.ins.emit(EventType.JoinTeam, this._teamData)
                    return
                }
                ToastManager.ins.showToast(res.msg || "加入房间失败")
                return
            }
            this.joinCb&&this.joinCb()
            console.log("res=======",res)
            UIManager.ins.hideView(this.node)
            DispatchEvent.ins.emit(EventType.JoinTeam, this._teamData)
        })
        // this.onJoinTeamSuccess();
    }

}
