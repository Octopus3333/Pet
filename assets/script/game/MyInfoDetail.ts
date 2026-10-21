import { _decorator, Button, Component, Label, Node, Sprite } from 'cc';
import { ToastManager } from '../common/utils/ToastManager';
import { UserInfo } from '../common/utils/InterfaceDefine';
import { loadAvatar, getMoneyStr } from '../common/utils/UiTools';
import { EventType } from '../common/utils/Define';
import { DispatchEvent } from '../common/utils/DispatchEvent';
import { SocketManager, SocketMSgId } from '../common/network/SocketManager';
import { UIManager } from '../common/utils/UIManager';
import { ChatManager } from '../chat/ChatManager';
import { DataManager } from '../Data/DataManager';
import { QuizConfigManager } from '../Data/QuizConfigManager';
import { ViewPath } from '../common/utils/Define';
import { PetComp } from '../home/PetComp';
import { PetCommonComp } from '../common/components/PetCommonComp';
const { ccclass, property } = _decorator;

@ccclass('MyInfoDetail')
export class MyInfoDetail extends Component {

    /** 玩家信息 */
    @property(Sprite)
    sp_my_icon:Sprite = null
    @property(Label)
    lb_my_name:Label = null
    @property(Label)
    lb_my_id:Label = null
    @property(Label)
    lb_my_frinds_num:Label = null
    @property(Label)
    lb_my_distance_value:Label = null


    @property(Label)
    lb_my_pink_coin:Label = null
    @property(Label)
    lb_my_gold_coin:Label = null

    /** 宠物信息 */
    @property(Label)
    lb_pet_name:Label = null
    @property(Sprite)
    sp_pet_icon:Sprite = null
    @property(Label)
    lb_pet_personnality:Label = null
    @property(Label)
    lb_pet_kind:Label = null
    @property(Label)
    lb_pet_firstdate:Label = null

    /** 宠物状态 */
    @property(Label)
    lb_pet_albums:Label = null
    @property(Label)
    lb_pet_love:Label = null
    @property(Label)
    lb_pet_hungry:Label = null
    @property(Label)
    lb_pet_clean:Label = null
    @property(Node)
    nd_pet:Node = null
    @property(Button)
    btn_camera:Button = null
    @property(Button)
    btn_copyid:Button = null
    @property(Button)
    btn_pet_home:Button = null

    protected onLoad(): void {
        this.btn_pet_home?.node.on(Button.EventType.CLICK, this.onClickHome, this)
        DispatchEvent.ins.on(EventType.RefreshCoin, this.refreshUI, this)
        DispatchEvent.ins.on(EventType.RefreshPlayerInfo, this.refreshUI, this)
    }

    protected onEnable(): void {
        this.refreshUI()
    }

    protected onDestroy(): void {
        DispatchEvent.ins.off(EventType.RefreshCoin, this.refreshUI, this)
        DispatchEvent.ins.off(EventType.RefreshPlayerInfo, this.refreshUI, this)
    }

    refreshUI(): void {
        void this._doRefreshUI()
    }

    private async _doRefreshUI(): Promise<void> {
        await QuizConfigManager.ins.ready()
        var userInfo = DataManager.ins.getUserInfo()
        if (!userInfo) return
        const money = getMoneyStr()
        this.lb_my_name.string = userInfo.nickname
        this.lb_my_id.string = userInfo.userId
        //loadAvatar(this.sp_my_icon, userInfo.headImg);
        this.lb_my_distance_value.string = this.formatWalkDistance(userInfo.distance)
        this.lb_my_pink_coin.string = money.pink
        this.lb_my_gold_coin.string = money.gold
        this.lb_pet_name.string = "名字: " + userInfo.petName
        const quizConfig = QuizConfigManager.ins
        this.lb_pet_personnality.string = "性格: " + quizConfig.getNatureName(userInfo.nature)
        this.lb_pet_kind.string = "种类: " + quizConfig.getPetTypeName(userInfo.petType)
        // this.lb_pet_firstdate.string = userInfo.pet_firstdate
        this.lb_pet_clean.string = userInfo.clean + "%"
        this.lb_pet_albums.string = userInfo.photoCount.toString()
        this.lb_pet_love.string = userInfo.intimacy.toString()
        this.lb_pet_hungry.string = userInfo.energy.toString()
        var date = new Date(userInfo.pet_created_at *1000)
        this.lb_my_frinds_num.string = userInfo.friend_count.toString()
        this.lb_pet_firstdate.string = "相遇日期: " + date.getFullYear() + "-" + (date.getMonth()+1) + "-" + date.getDate()  
        if(this.nd_pet){
            var petComp = this.nd_pet.getComponent(PetCommonComp)
            petComp.setData(userInfo)
        }
    }

    onClickCamera():void{
        //打开相册或者相机
        ToastManager.ins.showToast("暂未开放")
    }

    onClickCopyid():void{
        //复制id到剪贴板
        ToastManager.ins.showToast("暂未开放")
    }

    onClickHome():void{
        this.node.active = false
        UIManager.ins.show(ViewPath.HomePanel)
    }

    /** 累计散步距离：服务端单位为米，界面显示 km */
    private formatWalkDistance(meters: number): string {
        const m = meters || 0
        if (m <= 0) return '0km'
        if (m < 1000) return `${m}m`
        const km = m / 1000
        return Number.isInteger(km) ? `${km}km` : `${parseFloat(km.toFixed(1))}km`
    }

}
