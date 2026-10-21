import { _decorator, Component, instantiate, Node, Prefab, UITransform } from 'cc';
import { MapCell } from './MapCell';
import { createPrefab } from '../../common/utils/UiTools';
import { Common, EventType } from '../../common/utils/Define';
import { WalkMapInfo } from '../../common/utils/InterfaceDefine';
import { DispatchEvent } from '../../common/utils/DispatchEvent';
import { SocketMSgId } from '../../common/network/SocketManager';
import { DataManager } from '../../Data/DataManager';
const { ccclass, property } = _decorator;

@ccclass('MapContent')
export class MapContent extends Component {
    @property(Prefab)
    pb_map_cell:Prefab = null
    mapCaches:MapCell[] = []
    itemCaches:any[] = []
    gridSize:number = 10
    routeSize:number = 10
    mapCacheSize:number = 3
    routeMete:number = 1000
    speed:number = 1
    mapIndex:number = 0
    pause:boolean = false
    pauseCallback: (paused: boolean) => void = null
    rateTimeDis:number = 1/60
    curGridIndex:number = 0
    curDistance = 0
    private _isRunning: boolean = false
    protected onLoad(): void {
    }

    async load(cb){
        await this.loadMapBgRes()
        if(cb)cb()
    }
    loadMapBgRes(){

    }
    clean(){
        this.mapIndex = 0
    }
    //事件间隔多少米
    getEventsDis(){
        return this.routeMete/this.routeSize
    }
    
    //每秒多少米
    getSecondMeter(){
        return this.speed*this.getGridMeter()
    }
    //每个格子多少米
    getGridMeter(){
        return this.routeMete/this.routeSize/this.gridSize
    }
    //一个格子多少像素
    getPixcel(){
        var width = this.node.getComponent(UITransform).width||750
        return width/this.gridSize
    }
    //每像素多少米
    getPixcelGridRate(){
        var num = Number((this.getGridMeter()/this.getPixcel()).toFixed(2))
        return num
    }
    
    loadLocation(distance){
        // if(!this.mapInfos)return
        console.log("当前距离",distance)
        var mapData = DataManager.ins.getWalkData()
        if(!mapData || !mapData.map_cell_info)return
        var eventMeter = this.getEventsDis()
        console.log("每个格子多少米",this.getGridMeter(), "事件间隔格子数", this.getEventsDis())
        var curRoute = Math.floor((distance%this.routeMete)/eventMeter)
        var curGird = (Math.floor(distance%this.routeMete)/this.getGridMeter())%this.gridSize
        var round = Math.floor(distance/this.routeMete)
        console.log("第" + curRoute +"个事件", "当前格子",curGird, "当前回合",round)

        this.mapIndex = DataManager.ins.findWalkCellIndex(curRoute)
        this.curGridIndex = curGird
        this.relocateMap(this.mapIndex,this.curGridIndex)

        console.log("当前位置", this.mapIndex, this.curGridIndex)
    }
    setDefaultSpeed(){
        this.rateTimeDis =  this.speed*this.getPixcel()/60
    }
    loadCurrentLocation(time){
        var distans = DataManager.ins.getWalkDistanceByTime(time)
        console.log("distans",distans)
        this.curDistance = distans
        this.loadLocation(distans)
        this.loadMapCaches()
    }
    loadRunTime(time,index, eventsIndex){
        if(time == 0){
            console.error("time is zero")
            this.setDefaultSpeed()
            return
        }
        var curIndex = this.mapIndex //mapIndex从0开始转成从1开始
        var distance = 0
        var mapData = DataManager.ins.getWalkData()
        console.log( "到达下一事件事件",time,"当前所在的地图",curIndex, "到达第" + index + "地图", "第" + eventsIndex + "事件")

        if(!mapData)return
        var cellInfo = mapData.map_cell_info
        var perDis = this.getEventsDis()
        console.log("一个格子多少像素", this.getPixcel(), "perDis",perDis,"每个格子多少米",this.getGridMeter(),"m每像素多少米",this.getPixcelGridRate())
        for(var i = 0; i < index ; i ++){
            if(!cellInfo[i]||!cellInfo[i].events)continue
            distance += cellInfo[i].events.length*perDis
            console.log("检测一个地图",distance)
        }
        distance += (eventsIndex + 1)*perDis    
        var restDistance = distance -  this.curDistance        
        console.log("目的地距离",distance, "当前位置", this.curDistance,"剩余距离",restDistance)
        var restWidth = restDistance/this.getPixcelGridRate()
        console.log("剩余多少像素",restWidth)

        this.rateTimeDis = Number((restWidth/time/60).toFixed(2))
        console.log("速度为每帧", this.rateTimeDis,"像素")
        this.scheduleOnce(()=>{  //复原速度
            this.setDefaultSpeed()
        },time)
    }

    createMapCell(){
        if(!this.pb_map_cell){
            return
        }
        var cell = instantiate(this.pb_map_cell)
        console.log("createCell")
        return cell?.getComponent(MapCell)
    }
    async loadMapCaches(){
        console.log("loadCaches", this.mapCaches, this.mapCacheSize)
        if(this.mapCaches.length < this.mapCacheSize){
            var curX = this.getLastPosX()
            var curMapInfoData =  DataManager.ins.getWalkData()
            for(var i = this.mapCaches.length ; i <  this.mapCacheSize ; i ++){
                this.mapIndex += i
                console.log("curMapInfoData", curMapInfoData)
                if(!curMapInfoData||!curMapInfoData?.map_cell_info[this.mapIndex])continue
                
                var mapCell = this.createMapCell()
                if(!mapCell)continue
                var curCellData = curMapInfoData.map_cell_info[this.mapIndex]
                mapCell.node.x = curX 
                mapCell.node.y = 0
                await mapCell.init(curCellData)
                curX = curX + (mapCell.getWidth() || 0)

                mapCell.node.parent = this.node
                this.mapCaches.push(mapCell)
            }
        }

    }
    getLastPosX(){
        var lastPosX = 0
        for(var obj of this.mapCaches){
            var objWidth = obj.getWidth()||0
            if(obj?.node?.x + objWidth > lastPosX){
                lastPosX = obj?.node?.x + objWidth
                console.log("lastPos")
            }
        }
        return lastPosX
    }
    async setLastCell(cell:MapCell){
        console.log("setLastCell")
        cell.node.x = this.getLastPosX()
        cell.node.y = 0  
        this.mapIndex = this.mapIndex + 1
        var curMapInfoData = DataManager.ins.getWalkData()
        if(!curMapInfoData){
            console.log("thismapinfo", curMapInfoData)
            return
        }
        var curCellData = curMapInfoData.map_cell_info[this.mapIndex]
        await cell.init(curCellData)
    }

    checkOutView(cell:MapCell){
        if(!cell || !cell.node){
            return 
        }
        var cellWidth = cell.getComponent(UITransform)?.width||0
        if(cell.node.x + cellWidth < 0){
            return true
        }
        return false
    }
    /**
     * 根据mapIndex和gridIndex重新定位地图
     * 复用现有mapCaches缓存，从指定位置重新加载地图数据并渲染
     * @param mapIndex 目标地图格子索引（对应map_cell_info数组下标）
     * @param gridIndex 格子内偏移索引，范围 0 ~ gridSize-1
     */
    async relocateMap(mapIndex: number, gridIndex: number) {
        const mapData = DataManager.ins.getWalkData()
        if (!mapData || !mapData.map_cell_info) return

        const cellList = mapData.map_cell_info
        if (mapIndex < 0 || mapIndex >= cellList.length) {
            console.warn('[MapContent] relocateMap: mapIndex out of range', mapIndex)
            return
        }

        this.pause = true
        this.pauseCallback?.(true)

        // 更新索引
        this.mapIndex = mapIndex
        this.curGridIndex = gridIndex

        // 计算grid偏移像素（向左偏移）
        const gridPixelWidth = this.getPixcel()
        const gridOffsetX = -(gridIndex * gridPixelWidth)
        console.log("gridOffsetX", gridOffsetX)
        // 复用现有缓存，不足则创建
        let curX = 0
        for (let i = 0; i < this.mapCacheSize; i++) {
            const curIdx = this.mapIndex + i
            if (curIdx >= cellList.length) break

            const cellData = cellList[curIdx]
            if (!cellData) continue

            let mapCell = this.mapCaches[i]
            if (!mapCell) {
                mapCell = this.createMapCell()
                if (!mapCell) continue
                mapCell.node.parent = this.node
                this.mapCaches.push(mapCell)
            }

            mapCell.node.x = curX + gridOffsetX
            mapCell.node.y = 0
            await mapCell.init(cellData)
            curX += (mapCell.getWidth() || 0)
        }

        this.pause = false
        this.pauseCallback?.(false)
    }

    run(){
        if(!this.mapCaches)return
        if (this._isRunning) return
        this._isRunning = true
        this.schedule(()=>{
            if(this.pause) return
            for(var obj of this.mapCaches){
                obj.node.x = obj.node.x - this.rateTimeDis
                if(this.checkOutView(obj)){
                    this.setLastCell(obj)
                }
            }
        },1/60)

    }

    /** 停止地图滚动 */
    stop(): void {
        this.unscheduleAllCallbacks()
        this._isRunning = false
    }

    /** 清理所有运行时数据，重置为默认值 */
    cleanup(): void {
        this.unscheduleAllCallbacks()
        for (const cell of this.mapCaches) {
            if (cell?.node?.isValid) {
                cell.node.removeFromParent()
                cell.node.destroy()
            }
        }
        this.mapCaches = []
        this.itemCaches = []
        this.mapIndex = 0
        this.pause = false
        this.pauseCallback = null
        this.rateTimeDis = 1 / 60
        this.curGridIndex = 0
        this.curDistance = 0
        this._isRunning = false
    }
}


