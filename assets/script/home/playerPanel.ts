import { _decorator, Component, Label, Node, Sprite } from 'cc';
import { DataManager } from '../Data/DataManager';
import { DispatchEvent } from '../common/utils/DispatchEvent';
import { EventType } from '../common/utils/Define';
import { loadAvatar } from '../common/utils/UiTools';
const { ccclass, property } = _decorator;

@ccclass('playerPanel')
export class playerPanel extends Component {
    @property(Sprite)
    sp_head:Sprite = null
    @property(Label)
    lb_name:Label = null
    @property(Label)
    lb_heart_count = null
    @property(Label)
    lb_user_id = null
    protected onLoad(): void {
        DispatchEvent.ins.on(EventType.RefreshPlayerInfo,this.refreshPlayerInfo,this)
        this.refreshPlayerInfo()
    }

    refreshPlayerInfo(){
        var userInfo = DataManager.ins.getUserInfo()
        this.lb_name.string = userInfo.nickname
        this.lb_user_id.string = userInfo.userId
        this.lb_heart_count.string = userInfo.intimacy
        loadAvatar(this.sp_head, userInfo.headImg)        
    }
}


