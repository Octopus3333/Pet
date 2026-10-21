import { Node } from "cc"
import { SocketManager, SocketMSgId } from "../../common/network/SocketManager"
import { EventType, ViewPath } from "../../common/utils/Define"
import { UIManager } from "../../common/utils/UIManager"
import { WalkMain } from "./WalkMain"
import { WalkEnd, WalkEndData } from "./WalkEnd"
import { WalkMapCfgManager } from "./WalkMapCfgManager"
import { DataManager } from "../../Data/DataManager"
import { DispatchEvent } from "../../common/utils/DispatchEvent"
import { WalkMapInfo } from "../../common/utils/InterfaceDefine"

export class WalkManager {
    static _ins: WalkManager = null

    static get ins(): WalkManager {
        if (!this._ins) {
            this._ins = new WalkManager()
        }
        return this._ins
    }
    walkNode:Node = null
    loadingMinTime = 1000
    clientTime = 0
    private _initialized: boolean = false
    /** 绑定的回调引用，确保 on/off 使用同一个函数引用 */
    private _onCompleteNotiyBound = this.onCompleteNotiy.bind(this)
    private _onWalkEndBound = this.onWalkEnd.bind(this)
    private _onWalkNextBound = this.onWalkNext.bind(this)

    init(){
        console.log("walkManager init=====================")
        SocketManager.instance.on(SocketMSgId.WalkLoadingCompleteNotify, this._onCompleteNotiyBound)
        SocketManager.instance.on(SocketMSgId.WalkRunEndNotify, this._onWalkEndBound)
        SocketManager.instance.on(SocketMSgId.WalkRunNextNotify, this._onWalkNextBound)
    }
    async relogin(data){
        console.log("relogin=================",data)
        await this.enterGame(data,true)
        this.onCompleteNotiy("",data)
        // this.showGameLayer()
    }
    checkTime(serverTime, distime){
        var clientTime = Date.now()
        var offset = clientTime - serverTime*1000
        return distime - offset
    }
    clean(){
        this.closeGame()
    }
    /** 清理所有运行时数据，防止与下次游戏数据混淆 */
    cleanupAll(): void {
        console.log("cleanALL walkManager")
        // 1. 清理 WalkMain 及其子组件(MapContent, MapEventBar)的运行时数据
        if (this.walkNode) {
            const walkMain = this.walkNode.getComponent(WalkMain)
            if (walkMain) {
                walkMain.cleanupGameData()
            }
        }
        // 2. 销毁 WalkMain 节点
        this.closeGame()
        // 3. 清理 WalkManager 自身状态
        this.clientTime = 0
        // 4. 清理 MapCfg 配置缓存
        WalkMapCfgManager.ins.cleanup()
        // 5. 清理 walkData 游戏数据
        DataManager.ins.cleanWalkData()
        // 6. 取消 Socket 监听（使用存储的绑定引用才能正确取消）
        SocketManager.instance.off(SocketMSgId.WalkLoadingCompleteNotify, this._onCompleteNotiyBound)
        SocketManager.instance.off(SocketMSgId.WalkRunEndNotify, this._onWalkEndBound)
        SocketManager.instance.off(SocketMSgId.WalkRunNextNotify, this._onWalkNextBound)
    }
    closeGame(){
        if(this.walkNode){
            this.walkNode.destroy()
            this.walkNode = null
        }
    }

    async onWalkEnd(msgId: string, data: WalkEndData){
        console.log("onWalkEnd=================", data)
        // 停止散步
        if (this.walkNode) {
            const walkMain = this.walkNode.getComponent(WalkMain)
            if (walkMain) {
                walkMain.stopGame()
            }
        }
        // 弹出WalkEnd预制体
        const walkEndNode = await UIManager.ins.show(ViewPath.WalkEnd)
        if (walkEndNode) {
            const walkEndComp = walkEndNode.getComponent(WalkEnd)
            if (walkEndComp) {
                await walkEndComp.init(data)
            }
        }
    }
    onWalkNext(msgId, res){
        console.log("onWalkNext=========================", res)
        DataManager.ins.appendWalkNextData(res)
        DispatchEvent.ins.emit(EventType.LoadNextWalk)
    }
    onCompleteNotiy(msgId, data){
        console.log("onCompleteNotiy",msgId, data)
        var walkMain = this.walkNode.getComponent(WalkMain)
        if(!walkMain){
            this.closeGame()
            return
        }        
        walkMain.hideLoading()
        
        var walkData:WalkMapInfo = DataManager.ins.loadWalkingData(data)
        var runTime = walkData.system_time - walkData.begin_at
        walkMain.loadCurrentLocation(runTime)  // 定位到当前位置
        var curNodeIndex = 0
        var curEventsIndex = 0
        var restTime = 0
        if(!walkData.map_cell_info)return
        for(var i = 0; i < walkData.map_cell_info.length; i ++){
            var events = walkData.map_cell_info[i].events
            if(!events)continue
            var find = false
            for(var j = 0; j < events.length; j ++){
                if(events[j].second && events[j].second > runTime){
                    curNodeIndex = i
                    curEventsIndex = j 
                    restTime = events[j].second - runTime
                    find = true
                    break
                }
            }
            if(find){
                break
            }
        }
        console.log("剩余时间",restTime, "第" + curNodeIndex + "个地图","第" + curEventsIndex + "事件")
        walkMain.loadRunTime(restTime, curNodeIndex, curEventsIndex) //算出规定时间到下一个宝箱所需要的速度
        walkMain.startGame()
        // this.showGameLayer()
    }
    async loading(gameInfo,relogin?){
        if(!this.walkNode )return
        var walkMain = this.walkNode.getComponent(WalkMain)
        if(!walkMain)return
        walkMain.showLoading()

        await WalkMapCfgManager.ins.load()                
        if(!DataManager.ins.updateWalkData(gameInfo)){
            console.error("checkDataFailed")
            walkMain.hideLoading()
            UIManager.ins.hide(ViewPath.WalkMain)
            return
        }
        try {
            await walkMain.loadGameData()
            if(!relogin){
                await this.sendWalkLoadingComplete()
            }

        } catch (err) {
            walkMain.hideLoading()
            UIManager.ins.hide(ViewPath.WalkMain)
            console.error("walk complete not finish", err)
        }
    }
    async enterGame(gameInfo:any, relogin?){
        console.log("onEnterGame")
        if(!this.walkNode ){
            this.walkNode = await UIManager.ins.show(ViewPath.WalkMain)
        }
        this.walkNode.active = true
        await this.loading(gameInfo, relogin)
 
    }
    showGameLayer(){
        console.log("showGameLayer")
        if(!this.walkNode)return
        var walkMain = this.walkNode.getComponent(WalkMain)
        if(!walkMain){
            this.closeGame()
            return
        }
        walkMain.startGame()
        walkMain.hideLoading()
    }
    async sendWalkLoadingComplete(){
        return new Promise((resolve)=>{
            SocketManager.instance.sendDataWithCallback(SocketMSgId.WalkLoadingComplete,{},(res)=>{
                console.log("WalkLoadingComplete response:", res)
                resolve(res)
            })
        })
    }


}