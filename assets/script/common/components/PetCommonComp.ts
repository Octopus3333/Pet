import { _decorator, Component, sp, Vec3 } from 'cc';
import { OtherUserDetail, UserInfo } from '../utils/InterfaceDefine';
import { GreyPetAnimaName, AnimationGreyName, ColorPetAnimaName, ColorSkin, Common } from '../utils/Define';
import { ResLoader } from '../download/ResLoader';
const { ccclass, property } = _decorator;

@ccclass('PetCommonComp')
export class PetCommonComp extends Component {
    skeleton:sp.Skeleton = null
    data:OtherUserDetail
    petType:number
    protected onLoad(): void {
        console.log("1111111111111111111111111111",this.data)
        this.node.active = false
        this.skeleton = this.node.getComponent(sp.Skeleton)
        if(this.data){
            this.loadPet()
        }
    }

    async setData(data){
        this.data = data
        this.petType = this.data?.pet_type || data.petType
        await this.loadPet()
    }
    play(){
        
    }
    async loadPet(){
        console.log("loadPet",this.data)
        if(!this.data)return
        if(!this.data.reach_clean100){
            await this.loadPetGrey()
        }else{
            await this.loadPetColor()
        }
        this.node.active = true
    }
    async loadPetGrey(){
        if(!this.data || !this.petType)return
        try {
            var res = await ResLoader.ins.loadResAsync(Common.AnimaPath + "petAnima/" + GreyPetAnimaName[this.petType -1], sp.SkeletonData)
            console.log("res===", res,Common.AnimaPath + "petAnima/" + GreyPetAnimaName[this.petType -1])
            if(!res){
                console.log("load pet ske erro============",res)
                return
            }
            if(! this.skeleton )return
            this.skeleton.skeletonData = res
            this.skeleton.loop = true
            this.skeleton.setAnimation(0,AnimationGreyName[this.petType].Idle, true)
            this.skeleton.node.scale = new Vec3(0.25,0.25,1) 
        } catch (error) {
            console.log("erro===",error)
        }
    }
    async loadPetColor(){
        try {
            var userInfo = this.data
            var res = await ResLoader.ins.loadResAsync(Common.AnimaPath + "petAnima/pet_" +  this.petType , sp.SkeletonData)
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
            this.skeleton.node.scale = new Vec3(0.25, 0.25, 1)
            console.log("color animaName", ColorPetAnimaName[this.petType].Idle)
            this.skeleton.setAnimation(0, ColorPetAnimaName[this.petType].Idle, true)
            } catch (error) {
                console.log("erro",error)
        }
    }
    playReadyAnimation(isReady:boolean){
        console.log("playReadyAnimation")
        if(!this.skeleton || !this.petType)return
        if(isReady){
            this.playAnima("idle", true)
            return
        }
        this.playReady()
    }
    playReady(){
        var idleName = this.data?.reach_clean100?AnimationGreyName[this.petType].Idle:ColorPetAnimaName[this.petType].Idle
        var headName = this.data?.reach_clean100?AnimationGreyName[this.petType].StrokeHead:ColorPetAnimaName[this.petType].StrokeHead
        this.playAnima(idleName,false,()=>{
            console.log("play call back")
            this.playAnima(headName, false,  this.playReady.bind(this))
        })
    }
    playAnima(name, loop, cb?){
        console.log("play=================", name)
        this.skeleton.clearTrack(0)
        this.skeleton.setAnimation(0, name, loop)
        // if(loop){
        if(cb){
            this.skeleton.setCompleteListener(()=>{
                cb&&cb()
            })   
        }
        // }else{
        //     if(cb){
        //         console.log("setCallBack===")
        //         this.skeleton.setEndListener(()=>{
        //             cb&&cb()
        //         })
        //     }
        // }
    }

}


