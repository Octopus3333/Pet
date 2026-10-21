import { _decorator, Component, instantiate, Label, Node, Prefab, UITransform, Vec3 } from 'cc';
import { MapEvent } from '../../common/utils/InterfaceDefine';
import { DataManager } from '../../Data/DataManager';
import { MapEventItems } from './MapEventItems';
const { ccclass, property } = _decorator;

@ccclass('MapEventBar')
export class MapEventBar extends Component {

    @property(Node)
    nd_my:Node = null
    @property(Node)
    nd_box:Node = null
    @property(Node)
    nd_mask:Node = null
    @property(Node)
    nd_progress:Node = null
    @property(Prefab)
    pb_item_cell:Prefab = null
    @property(Node)
    node_content:Node = null
    curDistance:number = 0
    curItemList:Node[] = []
    info:MapEvent[] = []
    eventsDis:number = 100
    spacing:number = 87
    speed:number = 0
    curEventIndex:number = 0
    nextLoadIndex:number = 0
    /** 首次加载的事件总数，用于增量加载时判断 */
    private _loadedEventCount: number = 0

    addEvents(info:MapEvent[]){
        for(var obj of info){
            this.info.push(obj)
        }
        this._loadedEventCount = this.info.length
    }
    //每像素多少米
    getPerPixcelMete():number{
        if(this.eventsDis <= 0) return 0
        return this.spacing/this.eventsDis
    }

    getSpeed():number{
        if(this.curEventIndex >= this.info.length) return 0
        var second = this.info[this.curEventIndex].second || 1
        return this.eventsDis/second
    }


    startBar(){
        this.updateMy()
        this.updateProgress()
        this.schedule(()=>{
            this.onTick()
        }, 1/60)
    }

    /** 停止事件条 */
    stopBar(): void {
        this.unscheduleAllCallbacks()
    }

    /** 清理所有运行时数据，重置为默认值 */
    cleanup(): void {
        this.unscheduleAllCallbacks()
        for (const node of this.curItemList) {
            if (node?.isValid) {
                node.removeFromParent()
                node.destroy()
            }
        }
        this.curDistance = 0
        this.curItemList = []
        this.info = []
        this.curEventIndex = 0
        this.nextLoadIndex = 0
        this._loadedEventCount = 0
        this.speed = 0
    }

    onTick(){
        var speed = this.getSpeed()
        if(speed <= 0){
            var last = this.info[this.info.length-1]
            var lastSecond = last ? (last.second || 1) : 1
            speed = this.eventsDis/lastSecond
        }
        var pixelPerSec = speed * this.getPerPixcelMete()
        var dx = pixelPerSec/60
        this.curDistance = this.curDistance + speed/60
        for(var obj of this.curItemList){
            obj.x = obj.x - dx
        }
        var target = this.getCellByEventIndex(this.curEventIndex)
        while(target && target.x <= 0){
            this.curEventIndex++
            target = this.getCellByEventIndex(this.curEventIndex)
        }
        this.recycleExitedCells()
        this.updateMy()
        this.updateProgress()
        // 不再停止定时器：即使没有cell也可继续推进，等待新数据到达后继续播放
    }

    loadEvents(){
        var walkData = DataManager.ins.getWalkData()
        if(!walkData || !walkData.map_cell_info) return
        for(var i = 0; i < walkData.map_cell_info.length; i++){
            this.addEvents(walkData.map_cell_info[i].events)
        }
    }

    loadCurrentDistance(time){
        var distans = DataManager.ins.getWalkDistanceByTime(time)
        this.setDistance(distans)
    }
    updateContent(){
        for(var obj of this.curItemList){
            if(!obj)continue
            var comp = obj.getComponent(MapEventItems)
            if(!comp)continue
            var data =comp.getData()
            obj.x = (data.distance - this.curDistance)/this.getPerPixcelMete()
        }
    }
    loadContent(){
        if(!this.node_content || !this.pb_item_cell) return
        this.loadEvents()
        if(this.info.length <= 0) return
        var maskWidth = this.nd_mask?.getComponent(UITransform)?.width || 750
        var visibleCount = Math.ceil(maskWidth/this.spacing) + 1
        var count = Math.min(visibleCount, this.info.length)
        var distance = this.eventsDis
        for(var i = 0; i < count; i++){
            var cell = instantiate(this.pb_item_cell)
            cell.parent = this.node_content
            cell.x = (distance*i - this.curDistance)/this.getPerPixcelMete()
            this.setCellData(cell, i, this.info[i])
            this.curItemList.push(cell)
        }
        this.nextLoadIndex = count
        this.curEventIndex = 0

    }

    setCellData(cell:Node, eventIndex:number, evt:MapEvent){
        var itemComp = cell.getComponent(MapEventItems)
        if(itemComp){
            itemComp.setEventIndex(eventIndex)
            itemComp.setData(evt)
        }
    }

    calcMetersFromX(x:number):number{
        var per = this.getPerPixcelMete()
        if(per <= 0) return 0
        return Math.max(0, Math.round(x / per))
    }

    getCellByEventIndex(idx:number):Node|null{
        for(var obj of this.curItemList){
            var comp = obj.getComponent(MapEventItems)
            if(comp && comp.getEventIndex() === idx) return obj
        }
        return null
    }

    getLastCellX():number{
        var maxX:number = null
        for(var obj of this.curItemList){
            if(maxX === null || obj.x > maxX) maxX = obj.x
        }
        return maxX === null ? 0 : maxX
    }

    getMaskLeftXInContent():number{
        if(!this.nd_mask || !this.node_content) return -this.spacing
        var maskTrans = this.nd_mask.getComponent(UITransform)
        var contentTrans = this.node_content.getComponent(UITransform)
        if(!maskTrans || !contentTrans) return -this.spacing
        var leftLocal = new Vec3(-maskTrans.width * maskTrans.anchorX, 0, 0)
        var leftWorld = new Vec3()
        maskTrans.convertToWorldSpaceAR(leftLocal, leftWorld)
        var leftInContent = new Vec3()
        contentTrans.convertToNodeSpaceAR(leftWorld, leftInContent)
        return leftInContent.x
    }

    recycleExitedCells(){
        var maskLeftX = this.getMaskLeftXInContent()
        var exited:Node[] = []
        var remaining:Node[] = []
        for(var cell of this.curItemList){
            var cellWidth = cell.getComponent(UITransform)?.width || 0
            if(cell.x + cellWidth/2 < maskLeftX){
                exited.push(cell)
            }else{
                remaining.push(cell)
            }
        }
        this.curItemList = remaining
        for(var cell of exited){
            // 先尝试加载新增事件
            if(this.nextLoadIndex >= this.info.length){
                // this.loadNewEvents()
            }
            if(this.nextLoadIndex < this.info.length){
                var lastX = this.getLastCellX()
                cell.x = lastX + this.spacing
                this.setCellData(cell, this.nextLoadIndex, this.info[this.nextLoadIndex])
                this.curItemList.push(cell)
                this.nextLoadIndex++
                cell.active = true
            }else{
                // 数据已耗尽但不要隐藏cell，继续等待新数据
                var lastX = this.getLastCellX()
                cell.x = lastX + this.spacing
                cell.active = true
                this.curItemList.push(cell)
            }
        }
    }
    setDistance(distance){
        this.curDistance = distance
        this.updateMy()
        this.updateProgress()
        this.updateContent()
    }

    updateProgress(){
        if(!this.nd_progress) return
        var spCur = this.nd_progress.getChildByName("sp_cur")
        if(!spCur) return
        var spTrans = spCur.getComponent(UITransform) || spCur.addComponent(UITransform)
        var target = this.getCellByEventIndex(this.curEventIndex)
        if(!target){
            spTrans.width = 0
            return
        }
        var contentTrans = this.node_content?.getComponent(UITransform)
        var progressTrans = this.nd_progress.getComponent(UITransform)
        var targetTrans = target.getComponent(UITransform)
        if(!contentTrans || !progressTrans || !targetTrans){
            spTrans.width = 0
            return
        }
        var zeroWorld = new Vec3()
        contentTrans.convertToWorldSpaceAR(new Vec3(0,0,0), zeroWorld)
        var cellWorld = new Vec3()
        targetTrans.convertToWorldSpaceAR(new Vec3(0,0,0), cellWorld)
        var zeroLocal = new Vec3()
        var cellLocal = new Vec3()
        progressTrans.convertToNodeSpaceAR(zeroWorld, zeroLocal)
        progressTrans.convertToNodeSpaceAR(cellWorld, cellLocal)
        spTrans.width = Math.max(0, cellLocal.x - zeroLocal.x)
    }

    updateMy(){
        if(!this.nd_my) return
        var lb = this.nd_my.getChildByName("lb_distance")?.getComponent(Label)
        if(!lb) return


        lb.string = Math.floor(this.curDistance) + "m"
    }
}
