import { _decorator, Component, Node } from 'cc';
import { ItemDiscriptionPanel } from './ItemDiscriptionPanel';
import { UIManager } from '../utils/UIManager';
const { ccclass, property } = _decorator;

@ccclass('ItemDescripView')
export class ItemDescripView extends ItemDiscriptionPanel {
    onLoad() {
        this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd,this)
    }
    onTouchEnd(){
        UIManager.ins.hideView(this.node)
    }

}


