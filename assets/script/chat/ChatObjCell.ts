import { _decorator, Component, Label, Sprite, SpriteFrame , CCInteger} from 'cc';
import { ResLoader } from '../common/download/ResLoader';
import { ChatManager } from './ChatManager';
import { Chat } from '../common/utils/InterfaceDefine';
import { RecyCleCellComp } from '../common/components/RecyCleCellComp';
import { loadAvatar } from '../common/utils/UiTools';
import { RedPoint } from '../common/components/RedPoint';
import { getTime } from '../common/utils/TimeUtil';


const { ccclass, property } = _decorator;

/**
 * 聊天列表项组件
 * 挂在 ChatObjCell 预制体上
 *
 * 预制体结构：
 * ChatObjCell (Node)
 *   ├─ sp_icon (Sprite)      ← 头像
 *   ├─ lb_name (Label)       ← 名称
 *   ├─ lb_history (Label)    ← 互动历史
 *   └─ spriteFrame (Sprite)  ← 底部分隔线
 */
@ccclass('ChatObjCell')
export class ChatObjCell extends RecyCleCellComp {
    @property(Sprite)
    sp_icon: Sprite = null!;

    @property(Label)
    lb_name: Label = null!;

    @property(Label)
    lb_history: Label = null!;

    @property(Label)
    lb_time:Label = null;

    @property({
        type: CCInteger,
        min: 1,          
        tooltip: '消息预览最大显示字数',
    })
    maxLength: number = 18;

    private _data: Chat | null = null;
    private _loadVersion = 0;

    public get data(): Chat | null {
        return this._data;
    }

    public setData(data: Chat): void {
        this._data = data;

        if (this.lb_name) {
            this.lb_name.string = data.nickname || '';
        }
        if (this.lb_history) {
            this.lb_history.string = data.last_msg.length > this.maxLength ? data.last_msg.substring(0, this.maxLength) + '...' : data.last_msg || '';
        }
        if(this.lb_time){
            this.lb_time.string = getTime(data.created_at)
        }
        loadAvatar(this.sp_icon, data.head_img);
        this.refreshRedPoint()
    }

    refreshRedPoint(){
        var redPoint = this.node.getChildByName("RedDot")
        if(!redPoint)return
        var redComp = redPoint.getComponent(RedPoint)                
        redComp.updateRedPoint(this.data.unread_count)
    }
    onClick(){
        console.log("this.data",this.data)
        try {
            ChatManager.ins.openChat(this.data)
        } catch (e) {
            console.warn('[HomePanel] Chat test not ready:', e);
        }
    }
}