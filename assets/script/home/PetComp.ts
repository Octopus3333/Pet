import { _decorator, Component, Node, sp, EventTouch, SpriteFrame, Sprite, Vec3, CCInteger, CCFloat } from 'cc';
import { DataManager } from '../Data/DataManager';
import { ResLoader } from '../common/download/ResLoader';
import { AnimationGreyName, ColorPetAnimaName, ColorSkin, Common, EventType, GreyPetAnimaName, PetAciton } from '../common/utils/Define';
import { DispatchEvent } from '../common/utils/DispatchEvent';
import { changeBone, getItemSpf, loadItem } from '../common/utils/UiTools';
import { Item } from '../common/utils/InterfaceDefine';
import { SocketManager, SocketMSgId } from '../common/network/SocketManager';
const { ccclass, property } = _decorator;




@ccclass('PetComp')
export class PetComp extends Component {
    @property(Node)
    nd_item:Node = null
    petType = 0
    skeleton: sp.Skeleton = null!;

    @property({ tooltip: '是否启用双击进入互动' })
    doubleTapEnabled: boolean = true;
    @property({type:CCFloat})
    greyScale = 0
    @property({type:CCFloat})
    colorScale = 0
    // 双击检测
    private _lastTapTime: number = 0;
    private _doubleTapThreshold: number = 300; // 毫秒

    protected async onLoad(): Promise<void> {
        console.log("load pet")
        this.skeleton = this.node.getComponent(sp.Skeleton) 
        this.loadPet()
        SocketManager.instance.on(SocketMSgId.Clean100Notify, this.onChangePet.bind(this))
        DispatchEvent.ins.on(EventType.PetRun, this.onPlayAnima, this)
        // 监听触摸开始，用于双击检测
        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
    }
    
    onChangePet(){
        DataManager.ins.updateUserData({reach_clean100:true})
        this.loadPet()
    }
    protected onDestroy(): void {
        DispatchEvent.ins.off(EventType.PetRun, this.onPlayAnima, this)
        SocketManager.instance.off(SocketMSgId.Clean100Notify, this.onChangePet.bind(this))
    }

    // 触摸回调
    private onTouchStart(event: EventTouch) {
        
        if (!this.doubleTapEnabled) return;

        const now = Date.now();
        const delta = now - this._lastTapTime;
        this._lastTapTime = now;

        if (delta > 0 && delta < this._doubleTapThreshold) {
            // 双击
            event.propagationStopped = true; // 阻止冒泡，防止触发场景滑动或按钮
            this.onDoubleTap();
            this._lastTapTime = 0;
        }
    }
    
    // 双击响应：派发事件
    private onDoubleTap() {
        console.log('[PetComp] 双击宠物');
        DispatchEvent.ins.emit(EventType.PetDoubleTap);
    }
    async loadGreyPet(){
        console.log("c")
        var userInfo = DataManager.ins.getUserInfo()
        try {
            var res = await ResLoader.ins.loadResAsync(Common.AnimaPath + "petAnima/" + GreyPetAnimaName[userInfo.petType -1], sp.SkeletonData)
            if(!res){
                console.log("load pet ske erro============",res)
                return
            }
            if(! this.skeleton )return
            this.skeleton.skeletonData = res
            this.skeleton.loop = true
            this.skeleton.setAnimation(0,AnimationGreyName[userInfo.petType].Idle, true)
            this.skeleton.node.scale = new Vec3(this.greyScale, this.greyScale,1) 
        } catch (error) {
            console.log("erro===",error)
        }

    }
    async loadColorPet(){
        try {
            var userInfo = DataManager.ins.getUserInfo()
            var res = await ResLoader.ins.loadResAsync(Common.AnimaPath + "petAnima/pet_" +  this.petType, sp.SkeletonData)

            if(!res){
                console.log("load pet ske erro============")
                return
            }
            if(! this.skeleton )return
            this.skeleton.skeletonData = res
            this.skeleton.loop = true
            var color = userInfo.color - 1 
            color = color > 0 ? color:1
            var colorSkin = ColorSkin[this.petType] && ColorSkin[this.petType][color]    
            console.log("colorSkin", colorSkin)
            if(colorSkin){
                this.skeleton.setSkin(colorSkin)
            }else{
                console.error("not find  color ", userInfo.color)
            }
            this.skeleton.node.scale = new Vec3(this.colorScale, this.colorScale, 1)

            this.playIdle()
            } catch (error) {
                console.log("erro",error)
        }
    }
    async loadPet(){
        var userInfo = DataManager.ins.getUserInfo()

        this.petType = userInfo.petType
        // userInfo.reach_clean100 = false
        if(!userInfo.reach_clean100){
            this.loadGreyPet()
            return
        }
        this.loadColorPet()
    }
    onPlayAnima(playData){
        console.log("onPlayAnima=================")
        var type = playData.type || this.petType
        var action = playData.action || 0
        console.log("onplayAnima", playData.action)
        var loop = playData.loop || false
        var cb = playData.callBack
        if(action == PetAciton.Idle){
            this.playIdle()
        }else if(action == PetAciton.stroke_face){
            this.playStrockFace(type, loop , cb)
        }else if(action == PetAciton.stroke_head){
            this.playStrockHead(type, loop , cb)
        }else if(action == PetAciton.stroke_xiaba){
            this.playStrockXiaBa(type, loop , cb)
        }else if(action == PetAciton.clean){
            this.playClean(playData.data, this.petType, loop,cb)
        }else if(action == PetAciton.eat){
            this.playEat(playData.data, this.petType, loop,cb)
        }else if(action == PetAciton.toy){
            this.playToy(playData.data, this.petType, loop,cb)
        }else if(action == PetAciton.refuse){
            this.playRefuse(this.petType, loop,cb)
        }else if(action == PetAciton.dianTou){
            this.playDianTou(this.petType, loop, cb)
        }else if(action == PetAciton.naoTou){
            this.playNaoTou(this.petType, loop, cb)
        }
    }

    async bone(Path, spinePath){
        if(!this.nd_item)return
        console.log("bone==========================")
        try {
            var spf = await ResLoader.ins.loadResAsync(Path,SpriteFrame)
            var sprite = this.nd_item.getComponent(Sprite)||this.nd_item.addComponent(Sprite)
            sprite.spriteFrame = spf
            var socket = new sp.SpineSocket(spinePath, this.nd_item); // 第一个参数传入的是挂点的目标骨骼。第二个参数传入的是挂点的节点
            this.skeleton!.sockets.push(socket);
            this.skeleton!.sockets = this.skeleton!.sockets;
            this.nd_item.active = true
        } catch (error) {
            console.log("bone error", error)
        }
    }
    async hideBone(){
        this.nd_item.active = false
        this.skeleton!.sockets = []
    }
    async test(path){
        console.log("test==========")
        var spf = await ResLoader.ins.loadResAsync(path,SpriteFrame)

        var nd = new Node()
        var sp = nd.addComponent(Sprite)
        sp.spriteFrame = spf
        nd.setSiblingIndex(9999999999999)
        nd.parent = this.node
    }
    async playDianTou(petType, loop, cb){
        if (petType && this.petType != petType){
            this.petType = petType
            await this.loadPet()
        }
        if(!this.skeleton) return
        this.play("diantou", loop, cb)
        if(!loop){
            DispatchEvent.ins.emit(EventType.PetPlaying,true)
            console.log("skeleton",this.skeleton)
            this.skeleton.setAnimation(0, "diantou", false)     
            this.skeleton.setCompleteListener(()=>{
                DispatchEvent.ins.emit(EventType.PetPlaying,false)
                this.hideBone()
                this.playIdle()
                this.skeleton.setCompleteListener(null)
                cb&&cb()
            })
        }else{
            this.skeleton.setAnimation(0, "wan_qiu", true)       
            DispatchEvent.ins.emit(EventType.PetPlaying, false)
        }      
    }
    async playNaoTou(petType, loop, cb){
        if (petType && this.petType != petType){
            this.petType = petType
            await this.loadPet()
        }
        if(!this.skeleton) return
        this.play("naotou", loop, cb)
        if(!loop){
            DispatchEvent.ins.emit(EventType.PetPlaying,true)
            this.skeleton.setAnimation(0, "naotou", false)     
            this.skeleton.setCompleteListener(()=>{
                DispatchEvent.ins.emit(EventType.PetPlaying,false)
                this.hideBone()
                this.playIdle()
                this.skeleton.setCompleteListener(null)
                cb&&cb()
            })
        }else{
            this.skeleton.setAnimation(0, "wan_qiu", true)       
            DispatchEvent.ins.emit(EventType.PetPlaying, false)
        }    
    }
    async playToy(item:Item , petType, loop, cb){
        if (petType && this.petType != petType){
            this.petType = petType
            await this.loadPet()
        }
        if(!this.skeleton) return
        this.play("wan_qiu", loop, cb, "root/qiu", item.item_id)
        if(!loop){
            DispatchEvent.ins.emit(EventType.PetPlaying,true)
            this.skeleton.setAnimation(0, "wan_qiu", false)     
            this.skeleton.setCompleteListener(()=>{
                DispatchEvent.ins.emit(EventType.PetPlaying,false)
                this.hideBone()
                this.playIdle()
                this.skeleton.setCompleteListener(null)
                cb&&cb()
            })
        }else{
            this.skeleton.setAnimation(0, "wan_qiu", true)       
            DispatchEvent.ins.emit(EventType.PetPlaying, false)
        }
    }
    play(name, loop ,cb, boneName?, itemId?){
        if(!this.skeleton) return
        if(boneName && itemId){
            var path = Common.texturePath + "items/item_" + itemId + "/spriteFrame"
            this.bone(path, boneName)
        }
        if(!loop){
            try {
                DispatchEvent.ins.emit(EventType.PetPlaying,true)
                this.skeleton.setAnimation(0, name, false)     
                this.skeleton.setCompleteListener(()=>{
                    DispatchEvent.ins.emit(EventType.PetPlaying,false)
                    this.playIdle()
                    this.skeleton.setCompleteListener(null)
                    this.hideBone()
                    cb&&cb()
                })
            } catch (error) {
                this.playIdle()
                DispatchEvent.ins.emit(EventType.PetPlaying, false)
                this.hideBone()
            }

        }else{
            this.skeleton.setAnimation(0, name, true)        
            DispatchEvent.ins.emit(EventType.PetPlaying, false)
        }    
    }
    async playRefuse(petType, loop, cb){
        if (petType && this.petType != petType){
            this.petType = petType
            await this.loadPet()
        }
        this.play("yaotou", loop, cb)
    }
    async playClean(item:Item , petType, loop, cb){
        if (petType && this.petType != petType){
            this.petType = petType
            await this.loadPet()
        }
        if(!this.skeleton) return
        this.play("clean", loop, cb, "root/bone", item.item_id)
    }
    async playEat(item:Item , petType, loop, cb){
        if (petType && this.petType != petType){
            this.petType = petType
            await this.loadPet()
        }
        if(!this.skeleton) return
        this.play("eat", loop, cb)
    }
    async playIdle(petType?){
        if (petType && this.petType != petType){
            this.petType = petType
            await this.loadPet()
        }
        if(!this.skeleton) return
        this.skeleton.setAnimation(0, ColorPetAnimaName[this.petType].Idle, true)
    }
    async playStrockFace(petType?: number, loop?: boolean, cb?: () => void){
        console.log("playStrockFace")
        if (petType && this.petType != petType){
            this.petType = petType
            await this.loadPet()
        }

        if(!this.skeleton) return
        this.play( ColorPetAnimaName[this.petType].stroke_face, loop, cb)
    }
    async playStrockHead(petType?: number, loop?: boolean, cb?: () => void){
        console.log("playStrockHead")
        if (petType && this.petType != petType){
            this.petType = petType
            await this.loadPet()
        }
        if(!this.skeleton) return
        this.play( ColorPetAnimaName[this.petType].stroke_head, loop, cb)
    }
    async playStrockXiaBa(petType?: number, loop?: boolean, cb?: () => void){
        console.log("playStrockXiaBa")
        if (petType && this.petType != petType){
            this.petType = petType
            await this.loadPet()
        }
        if(!this.skeleton) return
        this.play( ColorPetAnimaName[this.petType].stroke_xiaba, loop, cb)
    }
}