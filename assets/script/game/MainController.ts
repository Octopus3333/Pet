import { EventType, LoginEvent, PetAciton, ViewPath } from "../common/utils/Define"
import { DispatchEvent } from "../common/utils/DispatchEvent"
import { LoginManager } from "../login/LoginManager"
import { CodeManager } from "../login/CodeManager"
import { ToastManager } from "../common/utils/ToastManager"
import { UIManager } from "../common/utils/UIManager"
import { DataManager } from '../Data/DataManager';
import { StoryManager } from '../common/story/StoryManager';
import { SocketManager, SocketMSgId } from '../common/network/SocketManager';
import { GetRewardsLayer } from '../common/components/GetRewardsLayer';
import { popupRewardsLayer } from '../common/utils/UiTools';
import { GameData } from '../Data/GameData';
import { ItemManager } from '../item/ItemManager';
import { ItemConfigManager } from '../item/ItemConfigManager';
import { HomePanel } from '../home/HomePanel';
import { ChatDataManager } from '../chat/ChatDataManager';
import { WalkTeamManager } from './WalkTeamManager';
import { WaitingManager } from '../common/utils/WaitingManager';
import { InviteTeamPanel } from '../team/InviteTeamPanel';
import { WalkMain } from './walk/WalkMain';
import { WalkManager } from "./walk/WalkManager"

/**
 * 主控制器
 * 负责登录主流程的编排和调度，具体操作委托给各 Manager
 */
export class MainController {
    private static _ins: MainController = null
    reduceEnergyTimer:number
    reduceCleanTimer:number
    static get ins(): MainController {
        if (!this._ins) {
            this._ins = new MainController()
        }
        return this._ins
    }
    lockPopRewards = false
    ui_home = null
    init() {
        // 监听 UI 层发来的事件
        if(this.ui_home){
            this.ui_home.destroy()
            this.ui_home = null
        }
        this.lockPopRewards = false
        DispatchEvent.ins.on(EventType.ClickGetPhoneCode, this.onGetPhoneCode, this)
        DispatchEvent.ins.on(EventType.ClickLogin, this.onLogin, this)
        DispatchEvent.ins.on(EventType.ItemUse, this.onItemUse, this)
        DispatchEvent.ins.on(EventType.PetTouch, this.onPetTouch, this)
        DispatchEvent.ins.on(EventType.StoryFinish, this.onStoryFinish, this)

        // 监听登录成功事件，做场景跳转
        DispatchEvent.ins.on(EventType.LoginSuccess, this.onLoginSuccess, this)
        DispatchEvent.ins.on(EventType.LoginOut, this.logout, this)
    }


    updateMyUserInfo(){
        console.log("updateMyUserInfo=====")
        SocketManager.instance.sendDataWithCallback(SocketMSgId.UserInfo,{},async (res)=>{
            console.log("res==========",res)
            if(res.code != 0){
                ToastManager.ins.showToast(res.msg)
                return
            }
            DataManager.ins.updateUserData(res)
        })
    }
    clearInterval(){
        
        if(this.reduceCleanTimer){
            console.log("clean timer stop")
            clearInterval(this.reduceCleanTimer)
        }
        if(this.reduceEnergyTimer){
            console.log("reduce energy stop")
            clearInterval(this.reduceEnergyTimer)
        }
    }
    async onStoryFinish(){
        this.ui_home = await UIManager.ins.show(ViewPath.HomePanel)
        this.updateMyUserInfo()
        this.clearInterval()
        this.reduceEnergyTimer = setInterval(() => {
            this.updateMyUserInfo()
        }, 25000);
        this.reduceCleanTimer = setInterval(()=>{
            this.updateMyUserInfo()
        },25000)
    }
    onPetTouch(huDongData){
        DispatchEvent.ins.emit(EventType.PetRun, huDongData)
        SocketManager.instance.sendDataWithCallback(
            SocketMSgId.PetTouch,
            {  },
            (res) => {
                console.log('ItemUse response:', res)
                if(!res || res.code){
                    ToastManager.ins.showToast(res ? res.msg : "道具使用错误")
                    return
                }
                this.popItemUserRewards(res)

            }
        )
    }
    offSocketLister(){
        console.log("offSocketLister mainController")
        SocketManager.instance.off(SocketMSgId.UserInfoUpdate,this.updateUserInfo.bind(this))
        SocketManager.instance.off(SocketMSgId.MoneyChangeNotify, this.getRewards.bind(this))
        SocketManager.instance.off(SocketMSgId.CloseConnNotify, this.onCloseConnNotify.bind(this))
        SocketManager.instance.off(SocketMSgId.PetChangeNotify, this.onPetChangeNotify.bind(this))        
        SocketManager.instance.off(SocketMSgId.WalkRunNotify, this.onEnterGame.bind(this))  
    }
    initSocketListener(){
        console.log("initSocketListen mainController")
        SocketManager.instance.on(SocketMSgId.WalkRunNotify, this.onEnterGame.bind(this))
        SocketManager.instance.on(SocketMSgId.UserInfoUpdate,this.updateUserInfo.bind(this))
        SocketManager.instance.on(SocketMSgId.MoneyChangeNotify, this.getRewards.bind(this))
        SocketManager.instance.on(SocketMSgId.CloseConnNotify, this.onCloseConnNotify.bind(this))
        SocketManager.instance.on(SocketMSgId.WalkInviteNotify, this.onInviteNotify.bind(this))
        SocketManager.instance.on(SocketMSgId.PetChangeNotify, this.onPetChangeNotify.bind(this))
        // 初始化道具管理器，注册 ItemChangeNotify 监听
        ItemManager.ins;
    }
    async onInviteNotify(msgid, data){
        console.log("onInviteNotify====",data)
        try {
            var panel = await UIManager.ins.show(ViewPath.InviteTeamPanel)
            var comp = panel.getComponent(InviteTeamPanel) 
            comp.setData(data)
        } catch (error) {
            console.log("erro",error)
        }

    }
    onPetChangeNotify(msgId, data){
        if(!data)return
        console.log("on pet update  changeNotify",data)
        DataManager.ins.updateUserData({energy:data.total_energy,intimacy:data.total_intimacy, clean: data.total_clean})
    }
    onItemUse(itemInfo){
        SocketManager.instance.sendDataWithCallback(
            SocketMSgId.ItemUse,
            { id:  itemInfo.id},
            (res) => {
                console.log('ItemUse response:', res)
                if(!res || res.code){
                    ToastManager.ins.showToast(res ? res.msg : "道具使用错误")
                    DispatchEvent.ins.emit(EventType.PetRun, {action:PetAciton.refuse})
                    return
                }
                this.popItemUserRewards(res)
                if(!itemInfo)return
                console.log("itemType",itemInfo.type)
                var actionType = 1
                switch (itemInfo.type) {
                    case 1:
                        actionType = PetAciton.clean
                        break;
                    case 2:
                        actionType = PetAciton.eat
                        break;
                    case 3:
                        actionType = PetAciton.toy
                        break;                    
                    default:
                        return;
                }
                var animaData = {
                    loop:false,
                    action:actionType,
                    data: itemInfo
                }
                console.log("animaData",animaData)
                DispatchEvent.ins.emit(EventType.PetRun, animaData)
            }
        )
    }
    popItemUserRewards(data){
        if(!this.ui_home)return
        console.log("popItemUserRewards")
        var comp = this.ui_home.getComponent(HomePanel)
        comp.onDogRewardsTips(data)
    }
    getRewards(msgId, res){
        console.log("getRewards======",res)
        if (res.total_pink != null || res.total_gold != null) {
            DataManager.ins.updateUserData({
                pink: res.total_pink ?? DataManager.ins.getUserInfo().pink,
                gold: res.total_gold ?? DataManager.ins.getUserInfo().gold,
            });
        }
        if(res.delta_pink > 0 && !res.hide_toast){
            popupRewardsLayer([{itemId:10001,num:res.delta_pink}])
        }
    }
    updateUserInfo(msg, data){
    }
    /**
     * 收到服务端 CloseConnNotify 协议，执行登出
     */
    private onCloseConnNotify() {
        console.log('[MainController] 收到 CloseConnNotify，执行登出');
        ToastManager.ins.showToast('连接已断开，请重新登录');
        this.logout();
    }
    /**
     * 启动流程：尝试自动登录，失败则显示登录页
     */
    async startApp() {

        const success = await LoginManager.instance.autoLogin()
        console.log("success",success)
        if (success) {
            return 
        }
        // 无 Token 或自动登录失败，显示登录页
        UIManager.ins.show(ViewPath.LoginPanel)
    }

    /**
     * 发送验证码（委托给 CodeManager）
     */
    private async onGetPhoneCode(data: { phone: string , type? :number}) {
        await CodeManager.instance.sendCode(data.phone, data.type)
    }

    /**
     * 登录流程（委托给 LoginManager）
     */
    private async onLogin(data?: { phone: string, code: string }) {
        const result = await LoginManager.instance.login(data?.phone, data?.code)
        console.log("result",result)
        if (!result.success) {
            // 根据错误码显示对应 Toast
            const msg = this.getLoginErrorMsg(result.errorCode, result.errorMsg)
            ToastManager.ins.showToast(msg)
            DispatchEvent.ins.emit(LoginEvent.LOGIN_FAILED, result)
        }
    }

    /**
     * 登录成功后的场景跳转
     */
    private async onLoginSuccess() {
        console.log("onLoginSuccess")
        // 登录账号可能切换，按当前账号重新加载本地聊天缓存，避免多账号数据污染
        ChatDataManager.instance.reloadCacheForCurrentUser();
        // UIManager.ins.show(ViewPath.StoryFullAnima)
        // 连接 Socket
        await SocketManager.instance.connect().catch((err) => {
            console.error('[MainController] socket connect failed:', err);
        });
        // 预加载道具配置表（不阻塞主流程，失败仅打印日志）
        await ItemConfigManager.ins.load().catch((err) => {
            console.error('[MainController] itemConfig load failed:', err);
        });
        MainController.ins.initSocketListener();
        WalkTeamManager.ins.init()

        // 关闭登录页
        UIManager.ins.hide(ViewPath.LoginPanel)
        // 进入游戏主界面
        if(DataManager.ins.isNewUser()){
            this.enterGuide()
        }else{
            this.onStoryFinish()
        }
    }
    enterGuide(){
        console.log("enterGuide============")
        StoryManager.ins.startStory("story_1")
    }
    /**
     * 根据后端错误码返回用户可读的提示信息
     */
    private getLoginErrorMsg(errorCode: number, fallback: string): string {
        switch (errorCode) {
            case 2001: return '验证码错误，请重新输入'
            case 2002: return '验证码已过期，请重新获取'
            case 4001: return '登录状态无效，请重新登录'
            case 4003: return '您的账号已在其他设备登录'
            default:   return fallback || '登录失败，请重试'
        }
    }

    /**
     * 退出登录
     */
    async logout() {
        await LoginManager.instance.logout()
        ItemManager.ins.clear()
        this.clearInterval()
        WalkTeamManager.ins.clean()
        UIManager.ins.removeAll()
        UIManager.ins.show(ViewPath.LoginPanel)
    }

    async onEnterGame(msgId, res){
        console.log("onEntergame=========================")
        console.log(msgId + "Data:",res)

        WalkManager.ins.init()
        WalkManager.ins.enterGame(res)
    }
    clean() {
        DispatchEvent.ins.off(EventType.ClickGetPhoneCode, this.onGetPhoneCode, this)
        DispatchEvent.ins.off(EventType.ClickLogin, this.onLogin, this)
        DispatchEvent.ins.off(EventType.LoginSuccess, this.onLoginSuccess, this)
        DispatchEvent.ins.off(EventType.LoginOut, this.logout, this)
        DispatchEvent.ins.off(EventType.EnterGame, this.onEnterGame, this)
        
    }
}
