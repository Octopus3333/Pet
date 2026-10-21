import { _decorator, Button, Component, Label } from 'cc';
import { TeamData } from '../common/utils/InterfaceDefine';
import { DispatchEvent } from '../common/utils/DispatchEvent';
import { Common, EventType } from '../common/utils/Define';
import { UIManager } from '../common/utils/UIManager';
import { TeamCell } from './TeamCell';
const { ccclass, property } = _decorator;

@ccclass('InviteTeamPanel')
export class InviteTeamPanel extends Component {

    @property(TeamCell)
    teamCell: TeamCell = null;
    @property(Button)
    btn_refuse: Button = null;
    @property(Label)
    lb_name:Label = null
    private _teamData = null;

    onLoad() {
        this.btn_refuse.node.on(Button.EventType.CLICK, this.onClickRefuse, this);
        DispatchEvent.ins.on(EventType.WalkTeamGo, this.onJoinTeam, this);
    }

    onDestroy() {
        DispatchEvent.ins.off(EventType.WalkTeamGo, this.onJoinTeam, this);
    }

    setData(teamData) {
        this._teamData = teamData;
        this.lb_name.string = teamData?.from_uinfo?.nickname
        this.teamCell.setData(teamData, this.joinCallBack.bind(this));
    }

    static async show(teamData: TeamData) {
        const node = await UIManager.ins.show(Common.prefabPath + 'team/InviteTeamPanel');
        node.getComponent(InviteTeamPanel).setData(teamData);
    }

    onClickRefuse() {
        this.requestRefuseInvite();
    }
    joinCallBack(){
        UIManager.ins.hideView(this.node);
    }
    /** 预留：拒绝邀请请求，成功后调用 onRefuseSuccess */
    private requestRefuseInvite() {
        // TODO: SocketManager.instance.sendDataWithCallback(...)
        this.onRefuseSuccess();
    }

    /** 拒绝成功后关闭面板 */
    onRefuseSuccess() {
        UIManager.ins.hideView(this.node);
    }

    private onJoinTeam(teamId: unknown) {
        if (teamId === this._teamData.team_id) {
            UIManager.ins.hideView(this.node);
        }
    }
}
