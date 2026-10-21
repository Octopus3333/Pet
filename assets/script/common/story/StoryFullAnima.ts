import { _decorator, Component, Node, Sprite, SpriteFrame, tween } from 'cc';
import { ResLoader } from '../download/ResLoader';
import { Common, EventType } from '../utils/Define';
import { DispatchEvent } from '../utils/DispatchEvent';
const { ccclass, property } = _decorator;

@ccclass('StoryFullAnima')
export class StoryFullAnima extends Component {
    @property(Sprite)
    sp_test = null 
    start() {

    }

    update(deltaTime: number) {
        
    }
    async init(path){
        console.log("add================")
        try {
            var spf = await ResLoader.ins.loadResAsync(Common.texturePath + path + "/spriteFrame",SpriteFrame)
            this.sp_test.spriteFrame = spf
        } catch (error) {
            console.error("error=======",error)            
        }
        DispatchEvent.ins.emit(EventType.StoryLoadFinish)
        tween(this.node).delay(5).call(()=>{
            DispatchEvent.ins.emit(EventType.StoryNext)
        }).start()
    }
}


