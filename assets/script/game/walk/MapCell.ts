import { _decorator, Color, Component, Node, Sprite, UIOpacity, UITransform, Vec2 } from 'cc';
import { loadImg } from '../../common/utils/UiTools';
import { Common } from '../../common/utils/Define';
import { MapCellData } from '../../common/utils/InterfaceDefine';
import { DataManager } from '../../Data/DataManager';
const { ccclass, property } = _decorator;

@ccclass('MapCell')
export class MapCell extends Component {
    mapData:MapCellData = null
    initBg(bgData){

    }
    async init(data){
        console.log("loadMapCell", data)
        this.mapData = data
        // this.sp_bg.color = colors[Math.round(Math.random()*5)]
        await this.createMapBgs()
    }

    async createMapBgs(){
        if(!this.mapData|| !this.mapData.mapBgs)return
        var walkData = DataManager.ins.getWalkData()
        var locationId = walkData?.walk_address_id || 1
        console.log("mapData===1111", this.mapData.mapBgs)
        if(this.node.children.length < this.mapData.mapBgs.length){
            for(var i = this.node.children.length; i < this.mapData.mapBgs.length; i++){
                var index = this.mapData.mapBgs[i]
                var node = new Node()
                var trans = node.addComponent(UITransform)
                trans.anchorPoint = new Vec2(0, 0.5)
                var sp = node.addComponent(Sprite)
                // var opt = node.addComponent(UIOpacity)
                // opt.opacity = 100
                console.log("创建图片", this.mapData.mapBgs[i])
                await loadImg(sp, Common.texturePath + "walk/walkBg/location_" + locationId + "/bg_" + index + "/spriteFrame")
                trans = node.getComponent(UITransform)
                node.x = i * trans.width
                var selfTrans = this.node.getComponent(UITransform)
                selfTrans.width = (i + 1)*trans.width
                node.parent = this.node

            }
        }else {
            for(var i = this.node.children.length - 1; i >= 0 ; i--){
                if(!this.mapData.mapBgs[i]){
                    this.node.children[i].destroy()
                    continue
                }
                var node = this.node.children[i]
                var sp = node.getComponent(Sprite)
                var index = this.mapData.mapBgs[i]  
                console.log("创建图片", this.mapData.mapBgs[i])
                await loadImg(sp, Common.texturePath + "walk/walkBg/location_" + locationId + "/bg_" + index + "/spriteFrame")                
            }
        }
    }
    getWidth(){
        return this.node.getComponent(UITransform).width
    }
}


