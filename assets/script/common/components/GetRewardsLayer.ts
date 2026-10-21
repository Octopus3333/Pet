import { _decorator, Component, Node, Sprite } from 'cc';
import { createItem, loadImg, loadItem } from '../utils/UiTools';
import { UIManager } from '../utils/UIManager';
const { ccclass, property } = _decorator;

@ccclass('GetRewardsLayer')
export class GetRewardsLayer extends Component {
    @property(Node)
    nd_content:Node = null
    protected onLoad(): void {
        this.node.on(Node.EventType.TOUCH_END, this.close, this)
    }
    close(){
        UIManager.ins.hideView(this.node)
    }
    async loadDatas(data){
        this.nd_content.removeAllChildren()
        for(var obj of data){
            var item = await createItem(obj.itemId, obj.num)
            item.parent = this.nd_content
        }      
    }

}


