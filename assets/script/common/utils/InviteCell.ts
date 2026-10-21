import { _decorator, Component, Label, Node, Sprite, Button } from 'cc';
import { addHeadPb, loadAvatar } from './UiTools';
import { UserInfo, WalkFriend, WalkStatus } from './InterfaceDefine';
import { RecyCleCellComp } from '../components/RecyCleCellComp';
import { SocketManager, SocketMSgId } from '../network/SocketManager';
import { ToastManager } from './ToastManager';
import { WaitingManager } from './WaitingManager';
import { UIManager } from './UIManager';
import { ViewPath } from './Define';
import { InvitTips } from '../../team/InvitTips';

const { ccclass, property } = _decorator;

/**
 * 邀请好友列表 Cell 组件
 * 挂在 InviteCell.prefab 根节点上，配合 RecycleScrollView 使用
 *
 * 预制体结构（需在编辑器中绑定对应节点引用）：
 * InviteCell (Node)
 *   ├─ HeadPrefab          → sp_icon (Sprite)
 *   ├─ lb_name             → lb_name (Label)
 *   ├─ btn_invite          → btn_invite (Button)
 *   │    └─ Label          (按钮文字)
 *   └─ lb_des              → lb_des (Label，展示不可邀请原因)
 */
const canNotTips = [
    "",
    "Ta在散步队伍中"

]

@ccclass('InviteCell')
export class InviteCell extends RecyCleCellComp {
    @property(Node)
    nd_icon: Node = null;

    @property(Label)
    lb_name: Label = null;

    @property(Label)
    lb_des: Label = null;

    @property(Button)
    btn_invite: Button = null;

    /** 当前 Cell 绑定的数据 */
    private _data: WalkFriend | null = null;

    /** 是否已邀请（避免重复点击） */
    private _invited: boolean = false;

    protected onLoad(): void {
        if (this.btn_invite) {
            this.btn_invite.node.on(Button.EventType.CLICK, this.onClickInvite, this);
        }
    }

    protected onDestroy(): void {

    }

    setData(data: WalkFriend): void {
        this._data = data;
        this._invited = false;
        this.refreshView();
    }

    private refreshView(): void {
        const data = this._data;
        console.log("invietCell refreshView",data)
        if (!data) return;

        // 昵称
        if (this.lb_name) {
            this.lb_name.string = data.nickname || '';
        }

        // 头像
        if (this.nd_icon) {
            addHeadPb(this.nd_icon, data)
        }

        // 不可邀请原因（可邀请时为空，隐藏节点）
        const reason = this.getInviteReason(data);
        if (this.lb_des) {
            this.lb_des.string = reason;
            this.lb_des.node.active = !!reason;
        }

        // 邀请按钮：可邀请时启用，不可邀请时置灰
        if (this.btn_invite) {
            this.btn_invite.interactable = this.canInvite(data);
            var sp = this.btn_invite.getComponent(Sprite)
            if(sp){
                sp.grayscale = !this.canInvite(data)
            }
            const btnSp = this.btn_invite.node.getChildByName('sp_button');
            const btLabel = this.btn_invite.node.getChildByName('Label');
            if(btLabel){
                btLabel.x = this.canInvite(data)? -22.5:0
            }
            if(btnSp){
                btnSp.active = this.canInvite(data)
            }
        }
    }

    /** 是否可邀请：空闲且未锁定目的地 */
    private canInvite(data: WalkFriend): boolean {
        return data.walk_status === WalkStatus.Idle && data.reason_status == 0 && data.online_status == 1;
    }

    /** 获取不可邀请原因文案（按优先级返回） */
    private getInviteReason(data: WalkFriend): string {
        if (data.walk_status === WalkStatus.InTeam) return '组队中';
        if (data.walk_status === WalkStatus.Walking) return '散步中';
        if (data.reason_status == 1) return 'Ta还未解锁当前目的地';
        if (data.reason_status == 2) return 'Ta的宠物状态不太好';
        if (data.reason_status == 3) return 'Ta的仓库已经装不下了'
        if (data.reason_status == 4) return 'Ta的宠物状态不太好'
        if (data.online_status == 2) return 'Ta不在线'
        return '';
    }
    updateData(data){
        this._data.user_id = data.user_id
        this._data.nickname = data.nickname
        this._data.pet_type = data.pet_type
        this._data.clean = data.clean
        this._data.color = data.color
        this._data.energy = data.energy
        this._data.head_img = data.head_img
        this._data.walk_status = data.walk_status
        this._data.reason_status = data.reason_status
    }
    invitCallBack(data){
        this.updateData(data)
        this.refreshView()
    }
    private async onClickInvite(): Promise<void> {
        if (!this._data) {
            ToastManager.ins.showToast('数据异常');
            return;
        }
        // if (this._invited) return;
        if (!this.canInvite(this._data)) return;

        // this._invited = true;
        var tips:Node = await UIManager.ins.show(ViewPath.InvitTips)
        var tipsComp:InvitTips = tips.getComponent(InvitTips)
        tipsComp.show(2,this._data)
    }
}
