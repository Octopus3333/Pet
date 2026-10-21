import { _decorator, Component, Node, Button, UITransform, EventTouch, Vec2, Vec3, view, Label, tween, Sprite, UIOpacity, sp, Color } from 'cc';
import { DispatchEvent } from '../common/utils/DispatchEvent';
import { Common, EventType, ViewPath } from '../common/utils/Define';
import { UIManager } from '../common/utils/UIManager';
import { ChatManager } from '../chat/ChatManager';
import { HttpClient } from '../common/network/HttpClient';
import { DataManager } from '../Data/DataManager';
import { SocketManager, SocketMSgId } from '../common/network/SocketManager';
import { RedPoint } from '../common/components/RedPoint';
import { ToastManager } from '../common/utils/ToastManager';
import { createPrefab, loadImg, loadItem } from '../common/utils/UiTools';
import { HuDongComp } from './HuDongComp';
import { BirdComp } from './BirdComp';
import { ResLoader } from '../common/download/ResLoader';
const { ccclass, property } = _decorator;

@ccclass('HomePanel')
export class HomePanel extends Component {

    // ========== Node References ==========

    @property(Node)
    nd_game: Node = null;
    @property(Node)
    nd_top_left:Node = null
    @property(Node)
    nd_top_right:Node = null

    @property(Node)
    nd_bottom:Node = null
    @property(Node)
    nd_info:Node = null
    @property(Node)
    nd_pinks:Node = null
    @property(Node)
    nd_gold:Node = null

    @property(Node)
    nd_hudong:Node = null
    @property(Node) 
    nd_bird:Node = null

    
    @property(Node)
    nd_setting:Node = null
    @property(Node)
    nd_pet: Node = null;

    // ---- Right panel buttons (nd_top_right, except fold/expand) ----
    @property(Button)
    btn_story: Button = null;
    @property(Button)
    btn_bag: Button = null;
    @property(Button)
    btn_shop: Button = null;

    // ---- Left panel buttons (nd_top_left, except fold/expand) ----
    @property(Button)
    btn_friend: Button = null;

    // ---- RedDot on btn_friend ----
    @property(Node)
    nd_reddot: Node = null;

    // ---- Bottom panel buttons (nd_bottom) ----
    @property(Button)
    btn_clean: Button = null;
    @property(Button)
    btn_eat: Button = null;
    @property(Button)
    btn_phone: Button = null;
    @property(Button)
    btn_map: Button = null;
        // ---- Top buttons ----
    @property(Button)
    btn_setting: Button = null;

    // ========== Touch Slide State ==========

    private _touchStartPos: Vec2 = new Vec2();
    private _ndGameStartPos: Vec3 = new Vec3();
    private _minX: number = 0;
    private _maxX: number = 0;
    private _gameMoveLock: boolean = true 
    private state = 1 //
    // ========== Lifecycle ==========
    loadState(){
        switch (this.state) {
            case 0:
                this.nd_top_left.active = false
                this.nd_top_right.active = false
                this.nd_info.active = false
                this.nd_pinks.active = false
                this.nd_gold.active = false
                this.nd_hudong.active = false
                this.nd_setting.active = true
                this.refreshBird(false)
                break;
            case 1:
                this.nd_top_left.active = true
                this.nd_top_right.active = true                
                this.nd_info.active = true
                this.nd_pinks.active = true
                this.nd_gold.active = true
                this.nd_hudong.active = false
                this.nd_setting.active = true  
                this.refreshBird(true)
                break;
            case 2:
                this.nd_top_left.active = false
                this.nd_top_right.active = false                 
                this.nd_info.active = false
                this.nd_pinks.active = false
                this.nd_gold.active = false
                this.nd_hudong.active = true
                this.nd_setting.active = false      
                this.refreshBird(false)
                break;    
            default:
                break;
        }
    }
    refreshBird(bool){
        if(!this.nd_bird){
            return
        }
        var userInfo = DataManager.ins.getUserInfo()
        console.log("userInfo.sparrowStatuse", userInfo.sparrowStatus)
        if(!userInfo ||  userInfo.sparrowStatus != 2){
           this.nd_bird.active = false
           return
        }
        this.nd_bird.active = bool
    }
    protected onLoad(): void {
        this.loadState()
        this.registerButtonEvents();
        this.initTouchSlide();
        DispatchEvent.ins.on(EventType.RedPointUpdate, this.refreshRedPoint, this);
        DispatchEvent.ins.on(EventType.RefreshPlayerInfo, this.updateInfo, this);
        DispatchEvent.ins.on(EventType.PetPlaying, this.onPetPlaying, this);

        DispatchEvent.ins.on(EventType.BackHome, this.onBackHome, this)
        DispatchEvent.ins.on(EventType.PetDoubleTap, this.onPetDoubleTap, this);
        DispatchEvent.ins.on(EventType.EnterHuDong,this.showHudongView,this)
        SocketManager.instance.on(SocketMSgId.SparrowFlybackNotify , this.onBirdFlyBack.bind(this))
        this.refreshRedPoint();
    }
    onPetPlaying(bool){
        this._gameMoveLock = bool
    }
    updateInfo(){
        DispatchEvent.ins.emit(EventType.RefreshBtnProgress,{type:1,needAnima:false})
        DispatchEvent.ins.emit(EventType.RefreshBtnProgress,{type:2,needAnima:false})
    }
    // type: 1=clean 2=food 3=亲密度 4=粉抓币
    async showDogRewardsTips(type:number, num:number){
        // 粉爪币为0不提示；亲密度为0时仍显示+0，提示已达上限
        if(num == 0 && type != 3) return
        var pb = await createPrefab(Common.prefabPath + "home/DogRewardsTips")
        if(!pb || !pb.isValid)return
        pb.parent = this.node
        // 位置：pet 上方 100 像素，x 在 -60~60 区间随机
        var trans = this.nd_pet.getComponent(UITransform)
        var randomX = (Math.random() * 2 - 1) * 60
        pb.setPosition(randomX, trans.height*this.nd_pet.scale.y/2 , 0)

        // 根据 type 和 num 正负加载对应图标
        var iconName = ""
        if(type == 1){
            iconName = num > 0 ? "hudong/cleanUp" : "hudong/cleanDown"
        }else if(type == 2){
            iconName = num > 0 ? "hudong/foodUp" : "hudong/foodDown"
        }else if(type == 3){
            iconName = "hudong/heartM"
        }else if(type == 4){
            iconName = "hudong/pinkM"
        }
        var sp_icon = pb.getChildByName("sp_icon")
        if(sp_icon){
            var sp = sp_icon.getComponent(Sprite)
            if(sp){
                loadImg(sp, Common.texturePath + "home/" + iconName + "/spriteFrame")
            }
        }
        var lb_num = pb.getChildByName("lb_num")
        if(lb_num){
            var lb = lb_num.getComponent(Label)
            if(lb){
                // 亲密度为0时显示+0，其余类型保持原有正负号规则
                lb.string = type == 3 ? (num >= 0 ? "+" : "") + num : (num > 0 ? "+" : "") + num
            }
        }

        // 缓慢向上运动 + 渐隐，完成后移除
        var opacity = pb.getComponent(UIOpacity) || pb.addComponent(UIOpacity)
        var endY = pb.position.y + 200
        tween(pb).to(2, { position: new Vec3(pb.position.x, endY, 0) }).start()
        tween(opacity).to(1.5, { opacity: type == 4 ? 255: 0 }).call(() => {
            DispatchEvent.ins.emit(EventType.RefreshBtnProgress,{type:type,needAnima:true})
            if(pb.isValid){
                if(type == 4){
                    if(lb_num){
                        lb_num.active = false
                    }
                    this.flyCoinToInfo(pb, num)
                }else{
                    pb.destroy()
                }
            }
        }).start()
    }
    // 处理服务器返回的奖励协议，按 增益>减益>亲密度>粉抓币 顺序依次显示，间隔 0.5 秒
    onDogRewardsTips(data:any){
        if(!data)return
        var delta_clean = data.delta_clean || 0
        var delta_energy = data.delta_energy || 0
        var delta_intimacy = data.delta_intimacy || 0
        var delta_pink = data.delta_pink || 0

        // 收集显示项，顺序：增益 > 减益 > 亲密度 > 粉抓币
        var gains:{type:number, num:number}[] = []
        var losses:{type:number, num:number}[] = []
        if(delta_clean > 0) gains.push({type:1, num:delta_clean})
        else if(delta_clean < 0) losses.push({type:1, num:delta_clean})
        if(delta_energy > 0) gains.push({type:2, num:delta_energy})
        else if(delta_energy < 0) losses.push({type:2, num:delta_energy})

        var list:{type:number, num:number}[] = [...gains, ...losses]
        if(delta_intimacy != 0){
            list.push({type:3, num:delta_intimacy})
        }else if(gains.length === 0 && losses.length === 0){
            // 无清洁/饱食变化时（如抚摸已达上限），显示亲密度+0
            list.push({type:3, num:0})
        }
        if(delta_pink != 0) list.push({type:4, num:delta_pink})
        console.log("list========",list)
        for(let i = 0; i < list.length; i++){
            let item = list[i]
            this.scheduleOnce(()=>{
                this.showDogRewardsTips(item.type, item.num)
            }, i * 0.5)
        }
    }

    //@param coinType 金币类型 1粉抓币 2金抓币
    flyCoinToInfo(node, coinNum){
        if(!node || !this.nd_pinks)return
        this.nd_pinks.active = true
        var icon =  this.nd_pinks.getChildByName("cloudIcon") || this.nd_pinks
        var position = icon.getWorldPosition()
        var pos = new Vec3() 
        this.node.inverseTransformPoint(pos, position)
        tween(node).to(1,{
            position:pos,
        }).call(()=>{
                node.destroy()
                var lbNd = new Node()
                var lb =  lbNd.getComponent(Label)||lbNd.addComponent(Label)
                lb.string = " + " + coinNum
                var lbPos = this.nd_pinks.position
                lbNd.setPosition(new Vec3(lbPos.x, lbPos.y + 20, 0))
                lb.fontSize = 20
                lbNd.parent = this.node
                lb.color = new Color( 95, 106, 158)
                lb.isBold = true
                tween(lbNd).to(1,{
                    position:new Vec3(lbNd.x, lbNd.y + 50, 0),
                }).call(()=>{
                    lbNd.destroy()
                    var updateData = {pink:0, gold:0}
                    var userInfo = DataManager.ins.getUserInfo()
                    updateData = {pink:userInfo.pink + coinNum, gold:0}  
                    console.log("updateData", updateData)
                    DataManager.ins.updateUserData(updateData)
                }).delay(0.5).call(()=>{
                    if(this.nd_pinks){
                        this.nd_pinks.active = false
                    }
                }).start()            
        }).start()
    }
    onBackHome(){
        if(this.state == 2){
            this.state = 1
            this.hideHudongView()
            this.loadState()
        }       
    }

    onPetDoubleTap() {
        console.log('[HomePanel] 宠物双击，进入互动界面');
        if (!this.nd_hudong) return;
        // 切换到互动状态
        this.state = 2;
        this.showHudongView(0)
        const hudong = this.nd_hudong.getComponent(HuDongComp);
        if (hudong) {
            hudong.onShowNormal(); // 让 HuDongComp 隐藏 nd_page 并加载数据
        }
        this.enterInteractionMode();
    }

    protected onEnable(): void {
        // this.loadPetAnima()
    }

    protected onBirdFlyBack(){
        var data = DataManager.ins.getUserInfo()
        SocketManager.instance.sendDataWithCallback(SocketMSgId.UserInfo,{user_id:data.userId},async (res)=>{
            if(res.code != 0){
                ToastManager.ins.showToast(res.msg)
                return
            }
            console.log("onBirdFlyBack=============", res)
            DataManager.ins.updateUserData(res)
            this.checkIphoneReadPoint()
        })
    }
    protected onDestroy(): void {
        console.log("destroy==========================")

        DispatchEvent.ins.off(EventType.RedPointUpdate, this.refreshRedPoint, this);
        DispatchEvent.ins.off(EventType.BackHome, this.onBackHome, this)
        DispatchEvent.ins.off(EventType.PetDoubleTap, this.onPetDoubleTap, this);
        DispatchEvent.ins.off(EventType.PetPlaying, this.onPetPlaying, this);
        DispatchEvent.ins.off(EventType.EnterHuDong,this.showHudongView,this)
    }
    /** 锁定/解锁触摸滑动，供 HuDongComp 拖动道具时调用 */
    setGameTouchLock(locked: boolean){
        this._gameMoveLock = locked
    }

    // ========== Button Click Handlers ==========

    private registerButtonEvents(): void {
        this.bindButton(this.btn_story, this.onStoryClick);
        this.bindButton(this.btn_bag, this.onBagClick);
        this.bindButton(this.btn_shop, this.onShopClick);
        this.bindButton(this.btn_friend, this.onFriendClick);
        this.bindButton(this.btn_clean, this.onCleanClick);
        this.bindButton(this.btn_eat, this.onEatClick);
        this.bindButton(this.btn_phone, this.onPhoneClick);
        this.bindButton(this.btn_map, this.onMapClick);
        this.bindButton(this.btn_setting, this.onSettingClick);
    }

    private bindButton(btn: Button, callback: Function): void {
        if (btn) {
            btn.node.on(Button.EventType.CLICK, callback, this);
        }
    }
    private enterInteractionMode() {
        this.state = 2;
        this.loadState();
        tween(this.nd_game).stop();
        tween(this.nd_game).to(0.5, {
            scale: new Vec3(1.2, 1.2, 1.2),
            position: new Vec3(0, 300, 0)
        }).start();
        DispatchEvent.ins.emit(EventType.RefreshBtnProgress, { type: 1, needAnima: true });
        DispatchEvent.ins.emit(EventType.RefreshBtnProgress, { type: 2, needAnima: true });
    }
    loginOut(){
        DispatchEvent.ins.emit(EventType.LoginOut)
    }
    // ---- Right panel ----
    private onStoryClick(): void { 
        UIManager.ins.show(ViewPath.TreasureNotes)
    }
    private onBagClick(): void {
        UIManager.ins.show(ViewPath.StoragePanel);
    }
    onShopClick(): void {
        UIManager.ins.show(ViewPath.ShopPanel);
    }
    onClickGm(){
        UIManager.ins.show(ViewPath.GmLayer)
    }
    // ---- Left panel ----
    private onFriendClick(): void { 
        ChatManager.ins.showChatList()
    }

    checkIphoneReadPoint(){
        var userData =DataManager.ins.getUserInfo()
        if(userData && this.btn_phone && this.btn_phone.node){
            var redPoint = this.btn_phone.node.getChildByName("redPoint")
            if(!redPoint)return
            if(userData.unreadCount > 0){
                redPoint.active = true
                var num = redPoint.getChildByName("lb_num")
                if(!num)return
                if(userData.unreadCount > 1){
                    num.active = true
                    num.getComponent(Label).string = userData.unreadCount.toString()
                }else{
                    num.active = false
                }
            }else{
                redPoint.active = false
            }
        }
    }
    // ---- Chat test handlers ----
    onClickGet(){
        SocketManager.instance.sendDataWithCallback(SocketMSgId.SparrowClaim,{msg_id:8},(res)=>{
            console.log("msgId set", res)
        })
    }

    onClickTest(){
        SocketManager.instance.sendDataWithCallback(SocketMSgId.UserInfoUpdate,{new_user_lead:8},(res)=>{
            console.log("new_user_lead set", res)
            var userInfo = DataManager.ins.getUserInfo()

        })
    }
    async loadPetAnima(){
        var userInfo = DataManager.ins.getUserInfo()
        if(!this.nd_pet)return
        try {
            var res = await ResLoader.ins.loadResAsync(Common.AnimaPath + "petAnima/pet_" +  userInfo.petType, sp.SkeletonData)
            if(!res){
                console.log("load pet ske erro============")
                return
            }
            var Skeleton = this.nd_pet.getComponent(sp.Skeleton) 
            Skeleton.skeletonData = res
        } catch (error) {
            console.log("load pet anima erro")
        }
    }
    refreshRedPoint(){
        this.checkIphoneReadPoint()
    }
    // ---- Bottom panel ----
    private onCleanClick(): void { 
        DispatchEvent.ins.emit(EventType.EnterHuDong, 1)
    }
    private onEatClick(): void { 
        DispatchEvent.ins.emit(EventType.EnterHuDong, 2)
    }

    hideHudongView(){
        this.state = 1
        tween(this.nd_game).stop()
        tween(this.nd_game).to(0.5,{
            scale:new Vec3(1, 1, 1),
            position:new Vec3(0, 0, 0)
        }).start()
    }
    //type 0:默认 1:清洁，2:喂食/
    async showHudongView(type: number, item?) {
        console.log("hudong type", type);
        if (!this.nd_hudong) return;
        const hudong = this.nd_hudong.getComponent(HuDongComp);
        if (!hudong) return;

        if (type === 1) {
           await hudong.onShowClean();
        } else if (type === 2) {
           await hudong.onShowFood();
        } else if (type === 3) {
           await hudong.onShowToy();
        } else {
            // type === 0 或其它默认值 → 双击模式
           await hudong.onShowNormal();
        }
        if(item){
            DispatchEvent.ins.emit(EventType.ItemUse, item)
            hudong.jump(item)
        }
        this.enterInteractionMode();
    }
    
    private async onPhoneClick(): Promise<void> {
        try {
            // ChatTestLauncher.ins.testClose();
        await ChatManager.ins.showChatList()
        var userInfo = DataManager.ins.getUserInfo()
        if(userInfo.newUserLead < 4){
            UIManager.ins.show(ViewPath.CreateNamePanel)
        }
            console.log("onPhoneClick=====")
        } catch (e) {
            console.warn('[HomePanel] Chat close failed:', e);
        }
     }
    private onMapClick(): void {
        DispatchEvent.ins.emit(EventType.WalkTeamMake)
    }

    // ---- Top ----
    private onSettingClick(): void 
    {
        UIManager.ins.show(ViewPath.SettingPanel);
    }

    // ========== Touch Slide for nd_game ==========

    private initTouchSlide(): void {
        const screenWidth = view.getVisibleSize().width;
        const ndGameTransform = this.nd_game?.getComponent(UITransform);
        const ndGameWidth = ndGameTransform ? ndGameTransform.width : 1600;
        const halfDiff = (ndGameWidth - screenWidth) / 2;
        this._minX = -halfDiff;
        this._maxX = halfDiff;

        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
    }

    private onTouchStart(event: EventTouch): void {
        if(this._gameMoveLock)return
        this._touchStartPos.set(event.getLocationX(), event.getLocationY());
        this._ndGameStartPos.set(this.nd_game.position);
    }

    private onTouchMove(event: EventTouch): void {
        if(this._gameMoveLock)return
        if (!this.nd_game) return;

        let newX = this.nd_game.position.x + event.getDeltaX();

        // Clamp to phone screen boundary
        newX = Math.max(this._minX, Math.min(this._maxX, newX));

        this.nd_game.setPosition(newX, this.nd_game.position.y, this.nd_game.position.z);
    }

    private onTouchEnd(event: EventTouch): void {
        // Reserved for inertia effect
    }
}