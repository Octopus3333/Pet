import { _decorator, Component, Label, Node, Sprite } from 'cc';
import { MapEvent } from '../../common/utils/InterfaceDefine';
import { loadImg } from '../../common/utils/UiTools';
import { Common } from '../../common/utils/Define';
const { ccclass, property } = _decorator;

@ccclass('MapEventItems')
export class MapEventItems extends Component {
    @property(Node)
    lb_distance:Node = null

    @property(Sprite)
    sp_icon:Sprite = null

    private _eventIndex:number = -1
    private _event:MapEvent = null

    start() {

    }

    update(deltaTime: number) {

    }

    setEventIndex(idx:number){
        this._eventIndex = idx
    }

    getEventIndex():number{
        return this._eventIndex
    }
    getData(){
        return this._event
    }
    setData(event:MapEvent){
        this._event = event
        this._eventIndex = event ? event.id : -1
        this.updateDistance(event.distance)
        this.updateIcon(event.id)
    }

    updateDistance(meters:number){
        if(!this.lb_distance) return
        var lb = this.lb_distance.getComponent(Label)
        if(!lb) return
        lb.string = Math.round(meters) + "m"
    }

    /**
     * 根据event.id加载sp_icon图片
     * -1 -> sp_small_box
     * -2 -> sp_big_box
     * 其他 -> walk/event/items/event_{id}
     */
    updateIcon(id:number){
        if(!this.sp_icon) return
        var imgName = ''
        if(id == -1){
            imgName = 'sp_small_box'
        }else if(id == -2){
            imgName = 'sp_big_box'
        }else{
            imgName = 'event_' + id
        }
        var path = Common.texturePath + 'walk/event/items/' + imgName + '/spriteFrame'
        loadImg(this.sp_icon, path)
    }

    getEvent():MapEvent{
        return this._event
    }
}
