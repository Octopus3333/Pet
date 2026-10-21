import { _decorator, Color, Component, Label, Node, Sprite, tween, UITransform, Vec3 } from 'cc';
import { DispatchEvent } from '../utils/DispatchEvent';
import { Common, EventType } from '../utils/Define';
import { RefreshBtnStruct } from '../utils/InterfaceDefine';
import { DataManager } from '../../Data/DataManager';
import { loadImg } from '../utils/UiTools';
const { ccclass, property } = _decorator;

@ccclass('BtnProgress')
export class BtnProgress extends Component {
    @property(Sprite)
    sp_progress:Sprite = null
    @property(Label)
    lb_percent:Label = null
    @property(Sprite)
    sp_top:Sprite = null
    @property({type:Number,min:0,max:10})
    type = 0  // 1 clean 2 food
    onLoad() {
        DispatchEvent.ins.on(EventType.RefreshBtnProgress, this.refreshProgress, this)
        this.loadData()
    }
    loadData(needAnima?){
        var userInfo = DataManager.ins.getUserInfo()
        var trans =this.node.getComponent(UITransform)
        var totalValue = this.type == 1 ? 100 : userInfo.energyMax || 100
        var curValue = this.type == 1 ? userInfo.clean: userInfo.energy
        var height = trans.height * curValue/totalValue
        this.loadColor(curValue/totalValue*100)
        if(!needAnima){
            this.sp_progress.node.y = height - (trans.height/2)
            return
        }
        tween(this.sp_progress.node).stop()
        tween(this.sp_progress.node).to(0.2,{
            position:new Vec3(0, height - (trans.height/2))            
        }).start()
    }
    refreshProgress(data:RefreshBtnStruct){
        if(this.type != data.type)return
        if(!this.sp_progress)return
        if(!this.sp_progress.node)return
        this.loadData(data.needAnima)
    }
    loadColor(percent){
        var spColor = new Color()
        var lbColor = new Color()
        if(percent == 0){
            this.node.getComponent(Sprite).color = Color.fromHEX(spColor, "#FCAEA1")
            this.lb_percent.color = Color.fromHEX(lbColor,"#E95B5B")
            this.sp_progress.node.active = false
        }else if(percent < 20){
            this.node.getComponent(Sprite).color = Color.fromHEX(spColor, "#FA8787")
            this.lb_percent.color = Color.fromHEX(lbColor,"#E95B5B")
            this.sp_progress.node.active = true
        }else if(percent < 80){
            this.node.getComponent(Sprite).color = this.type == 1? Color.fromHEX(spColor, "#57D5FF"): Color.fromHEX(spColor, "#FFDB5D")
            this.lb_percent.color = this.type == 1?Color.fromHEX(lbColor,"#18B2E5"):Color.fromHEX(lbColor,"#DEAD00")
            this.sp_progress.node.active = true
        }else{
            this.node.getComponent(Sprite).color = this.type == 1? Color.fromHEX(spColor, "#449AF3"): Color.fromHEX(spColor, "#FFC424")
            this.lb_percent.color = this.type == 1?Color.fromHEX(lbColor,"#267ED8"):Color.fromHEX(lbColor,"#CA9504")
            this.sp_progress.node.active = true
        }
        this.lb_percent.string = Math.floor(percent) + (this.type == 1?"%":"")
        var typeName = this.type == 1 ? "clean":"food"
        var indexName = percent == 0 ? 0 : 1
        loadImg(this.sp_top, Common.texturePath + "home/progress/" + typeName + "_top_" + indexName + "/spriteFrame")
    }
}


