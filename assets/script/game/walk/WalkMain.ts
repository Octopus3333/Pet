import { _decorator, Component, instantiate, Node, Prefab, Sprite, SpriteFrame, ScrollView, tween, UITransform } from 'cc';
import { SocketManager, SocketMSgId } from '../../common/network/SocketManager';
import { MapContent } from './MapContent';
import { DataManager } from '../../Data/DataManager';
import { MapEventBar } from './MapEventBar';
import { ResLoader } from '../../common/download/ResLoader';
import { Common, EventType, ViewPath } from '../../common/utils/Define';
import {  WalkUserInfo } from './WalkUser';
import { BagItem } from './BagItem';
import { DispatchEvent } from '../../common/utils/DispatchEvent';
import { ItemManager } from '../../item/ItemManager';
import { PetWalkComp } from './PetWalkComp';
import { UIManager } from '../../common/utils/UIManager';
import { ToastManager } from '../../common/utils/ToastManager';
import { ConfirmPopup } from '../../common/utils/ConfirmPopup';
import { WalkManager } from './WalkManager';
const { ccclass, property } = _decorator;

@ccclass('WalkMain')
export class WalkMain extends Component {
    @property(Node)
    nd_loading:Node = null

    @property(MapContent)
    mapContent:MapContent = null
    @property(MapEventBar)
    mapEventBar:MapEventBar = null
    @property(Node)
    nd_player_content:Node = null
    @property(ScrollView)
    sv_items:ScrollView = null
    @property(Node)
    nd_box:Node = null
    @property(Node)
    nd_rewars_info:Node = null

    @property(Node)
    nd_pet_1: Node = null
    @property(Node)
    nd_pet_2: Node = null
    @property(Node)
    nd_pet_3: Node = null
    @property(Node)
    nd_pet_4: Node = null

    @property({ tooltip: '宠物节点之间的间距(px)' })
    petSpacing: number = 10

    private _bagItemPb: Prefab = null
    private _isBoxOpen: boolean = false
    private _petComps: PetWalkComp[] = []
    private _walkUserInfos: WalkUserInfo[] = []
    loadingTime:number
    delayTimer:number
    private _loadingTimeoutId: number = null

    protected onLoad(): void {
        DispatchEvent.ins.on(EventType.RefreshBackpack, this.refreshBackpack, this)
    }

    protected onDestroy(): void {
        DispatchEvent.ins.off(EventType.RefreshBackpack, this.refreshBackpack, this)
    }

    async showLoading(){
        if(!this.nd_loading)return
        this.clearTimer()
        this.loadingTime = Date.now()
        this.nd_loading.active = true
        this.startRotation()
        // 兜底：10秒后如果还没隐藏loading，自动退出回大厅
        this._clearLoadingTimeout()
        this._loadingTimeoutId = setTimeout(() => {
            console.warn('[WalkMain] loading超时10秒，兜底退出')
            this.hideLoading()
            UIManager.ins.show(ViewPath.HomePanel)
            UIManager.ins.hide(ViewPath.WalkMain)
        }, 10000)
    }
    onClickBox(){
        this._isBoxOpen = !this._isBoxOpen
        this.updateBoxView()
    }

    private updateBoxView(): void {
        if (!this.nd_box) return

        const sp = this.nd_box.getComponent(Sprite)
        if (sp) {
            const imageName = this._isBoxOpen ? 'boxOpen' : 'box'
            const path = Common.texturePath + 'walk/' + imageName + '/spriteFrame'
            ResLoader.ins.loadResAsync(path, SpriteFrame).then((spf) => {
                if (sp.isValid) {
                    sp.spriteFrame = spf
                }
            }).catch((err) => {
                console.error('[WalkMain] 加载box图片失败:', err)
            })
        }
        if (this.nd_rewars_info) {
            this.nd_rewars_info.active = this._isBoxOpen
        }
    }
    async loadUser(){
        if(!this.nd_player_content)return
        var data = DataManager.ins.getWalkData()
        var users = data.users
        var children = this.nd_player_content.children
        this._walkUserInfos = []

        if(children.length < users.length){
            var pb = await ResLoader.ins.loadResAsync(Common.prefabPath + "walk/WalkUserInfo", Prefab)
            for(var i = children.length; i < users.length; i++){
                if(!users[i])continue
                var node = instantiate(pb)
                node.parent = this.nd_player_content
                var comp = node.getComponent(WalkUserInfo)
                comp.loadData(users[i])
            }

        }else if(children.length > users.length){
            for(var i = users.length; i < children.length; i++){
                if(!children[i])continue
                children[i].active = false
            }
        }else{
            for(var i = users.length; i < children.length; i++){
                if(!children[i])continue
                var comp = children[i].getComponent(WalkUserInfo)
                if(!comp)continue
                children[i].active = true
                comp.loadData(users[i])
            }
        }

        // 收集所有活跃的 WalkUserInfo 组件
        for (const child of this.nd_player_content.children) {
            if (child?.active) {
                const comp = child.getComponent(WalkUserInfo)
                if (comp) {
                    this._walkUserInfos.push(comp)
                }
            }
        }
    }

    async loadPetWalk(){
        const data = DataManager.ins.getWalkData()
        const users = data.users || []
        const petNodes = [this.nd_pet_1, this.nd_pet_2, this.nd_pet_3, this.nd_pet_4]

        this._petComps = []

        for (let i = 0; i < petNodes.length; i++) {
            const nd = petNodes[i]
            if (!nd) continue

            if (i < users.length) {
                nd.active = true
                let comp = nd.getComponent(PetWalkComp)
                if (!comp) {
                    comp = nd.addComponent(PetWalkComp)
                }
                await comp.load(users[i])
                this._petComps.push(comp)
            } else {
                nd.active = false
            }
        }

        this._arrangePetNodes()
    }

    /**
     * 排列宠物节点：从右到左，整体居中
     * 布局示意： [pet_4] [pet_3] [pet_2] [pet_1]  → 整体居中
     * nd_pet_1 在最右侧，nd_pet_4 在最左侧
     */
    private _arrangePetNodes(): void {
        const petNodes = [this.nd_pet_1, this.nd_pet_2, this.nd_pet_3, this.nd_pet_4]
        const activeNodes: Node[] = []

        for (const nd of petNodes) {
            if (nd && nd.active) {
                activeNodes.push(nd)
            }
        }

        if (activeNodes.length === 0) return

        const count = activeNodes.length
        const petWidth = 160//activeNodes[0].getComponent(UITransform)?.width || 200 * activeNodes[0].scale.x
        const spacing = this.petSpacing
        console.log("petWidth", petWidth,activeNodes[0].scale.x)
        const totalWidth = count * petWidth + (count - 1) * spacing

        // 最右侧节点 X = (totalWidth - petWidth) / 2
        const startX = (totalWidth - petWidth) / 2

        for (let i = 0; i < count; i++) {
            activeNodes[i].setPosition(startX - i * (petWidth + spacing), 0)
        }
    }

    async loadGameData(){
        await this.loadMapContent()
        if(this.mapContent){
            this.mapEventBar.loadContent()
        }
        await this.loadUser()
        await this.loadPetWalk()
        await this.loadBagItemPrefab()
        await this.requestBackpackIfNeeded()
        this.refreshBackpack()
    }

    private async requestBackpackIfNeeded(): Promise<void> {
        const items = DataManager.ins.getBackpack()
        if (!items || items.length === 0) {
            await ItemManager.ins.requestBackpack()
        }
    }

    private async loadBagItemPrefab(): Promise<void> {
        if (this._bagItemPb) return
        try {
            this._bagItemPb = await ResLoader.ins.loadResAsync(Common.prefabPath + 'walk/BagItem', Prefab)
        } catch (e) {
            console.error('[WalkMain] 加载 BagItem 预制体失败:', e)
        }
    }

    public refreshBackpack(): void {
        if (!this.sv_items || !this.sv_items.content) return
        const items = DataManager.ins.getBackpack()
        const content = this.sv_items.content
        const curItemCount = content.children.length

        if (curItemCount < items.length) {
            for (let i = curItemCount; i < items.length; i++) {
                this.addBagItemNode()
            }
        } else if (curItemCount > items.length) {
            for (let i = items.length; i < curItemCount; i++) {
                if (content.children[i]) {
                    content.children[i].active = false
                }
            }
        }

        for (let i = 0; i < items.length; i++) {
            const child = content.children[i]
            if (!child) continue
            let comp = child.getComponent(BagItem)
            if (!comp) {
                comp = child.addComponent(BagItem)
            }
            comp.loadData(items[i])
        }
    }

    private addBagItemNode(): void {
        if (!this._bagItemPb || !this.sv_items?.content) return
        const node = instantiate(this._bagItemPb)
        node.parent = this.sv_items.content
        if (!node.getComponent(BagItem)) {
            node.addComponent(BagItem)
        }
    }

    loadCurrentLocation(time){
        if(this.mapContent){
            this.mapContent.loadCurrentLocation(time)
            this.mapEventBar.loadCurrentDistance(time)
        }
    }
    loadRunTime(time,index, eventIdx){
        if(this.mapContent){
            this.mapContent.loadRunTime(time,index, eventIdx)
        }
    }
    startRotation(){
        const spLoadingNode = this.nd_loading?.getChildByName("sp_loading")
        if(!spLoadingNode)return
        spLoadingNode.angle = 0
        tween(spLoadingNode)
            .by(1, { angle: 360  })
            .repeatForever()
            .start()
    }
    async onClickClose(){
        const node = await UIManager.ins.show(ViewPath.ConfirmPopup);
        const popup = node?.getComponent(ConfirmPopup);
        if (popup)
        {
            popup.show({
                title: '确定要离开吗？',
                message: '离开后，本次散步将结束',
                confirmText: '离开',
                cancelText: '取消',
                onConfirm: () => { 
                    SocketManager.instance.sendDataWithCallback("WalkEnd",{},(res)=>{
                        if(res.code != 0){
                            if(res.code == 4296){
                                WalkManager.ins.cleanupAll()
                                UIManager.ins.show(ViewPath.HomePanel)
                                UIManager.ins.hideView(this.node)
                            }
                            ToastManager.ins.showToast(res.msg || "退出失败")
                        }
                    })
                 },
            });
        }


    }
    startGame(){
        var data = DataManager.ins.getWalkData()
        console.log("walkData==================",data)
        if(this.mapContent){
            this.mapContent.run()
        }
        if(this.mapEventBar){
            this.mapEventBar.startBar()
        }
        this._setPetsRunning(true)
        this._startEnergyTimers()
    }

    /** 停止散步游戏 */
    stopGame(): void {
        this._pauseEnergyTimers()
        this._setPetsRunning(false)
        if (this.mapContent) {
            this.mapContent.stop()
        }
        if (this.mapEventBar) {
            this.mapEventBar.stopBar()
        }
    }

    private _setPetsRunning(running: boolean): void {
        for (const comp of this._petComps) {
            if (running) {
                comp.switchToSanbu()
            } else {
                comp.switchToSit()
            }
        }
    }

    /** 开始所有队伍成员的体力定时器 */
    private _startEnergyTimers(): void {
        for (const info of this._walkUserInfos) {
            info.startEnergyTimer()
        }
    }

    /** 暂停所有队伍成员的体力定时器 */
    private _pauseEnergyTimers(): void {
        for (const info of this._walkUserInfos) {
            info.pauseEnergyTimer()
        }
    }

    /** 恢复所有队伍成员的体力定时器 */
    private _resumeEnergyTimers(): void {
        for (const info of this._walkUserInfos) {
            info.resumeEnergyTimer()
        }
    }

    private _onMapPause(paused: boolean): void {
        if (paused) {
            this._setPetsRunning(false)
            this._pauseEnergyTimers()
        } else {
            this._setPetsRunning(true)
            this._resumeEnergyTimers()
        }
    }

    stopRotation(){
        const spLoadingNode = this.nd_loading?.getChildByName("sp_loading")
        if(!spLoadingNode)return
        tween(spLoadingNode).stop()
    }

    async loadMapContent(){
        console.log("loadMapContent")
        if(this.mapContent){
            this.mapContent.pauseCallback = (paused: boolean) => this._onMapPause(paused)
            await new Promise((resolve)=>{
                this.mapContent.load(()=>{
                    resolve(null)
                })
            })
        }
    }

    clearTimer(){
        if(this.delayTimer){
            console.log("clearTimer============")
            clearTimeout(this.delayTimer)
            this.delayTimer = null
        }
    }
    hideLoading(){
        this._clearLoadingTimeout()
        var disTime = Date.now() - this.loadingTime
        console.log("distime==================",disTime)
        if(disTime <= 1000){
            this.clearTimer()
            this.delayTimer = setTimeout(()=>{
                this.stopRotation()
                this.nd_loading.active = false
            },1000 - disTime)
        }else{
            this.stopRotation()
            this.nd_loading.active = false  
        }

    }

    /** 清理 WalkMain 运行时数据，在退出游戏时调用 */
    cleanupGameData(): void {
        this.clearTimer()
        this._clearLoadingTimeout()
        this.stopRotation()
        this.unscheduleAllCallbacks()

        this._petComps = []
        this._walkUserInfos = []
        this._bagItemPb = null
        this._isBoxOpen = false
        this.loadingTime = undefined
        this.delayTimer = undefined

        if (this.mapContent) {
            this.mapContent.cleanup()
        }
        if (this.mapEventBar) {
            this.mapEventBar.cleanup()
        }
    }

    private _clearLoadingTimeout(): void {
        if (this._loadingTimeoutId) {
            clearTimeout(this._loadingTimeoutId)
            this._loadingTimeoutId = null
        }
    }
}
