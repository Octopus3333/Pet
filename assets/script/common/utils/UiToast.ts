import { _decorator, Component, Label, Node, Overflow, tween, UITransform, Vec2, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('UiToast')
export class UiToast extends Component {
    @property(Label)
    lb_des:Label = null
    @property(Node)
    nd_bg:Node = null
    paddingWidth:number = 20
    paddingHeight:number = 30
    onLoad() {
    }
    show(str){
        console.log("showToast",str)
        this.lb_des.string = str
        this.lb_des.updateRenderData(true)
        if(!this.lb_des) return
        var trans = this.lb_des.node.getComponent(UITransform)||this.lb_des.node.addComponent(UITransform)
        if(trans.width > 700){
            trans.width = 700
            this.lb_des.overflow = Overflow.RESIZE_HEIGHT
        }else{
            this.lb_des.overflow = Overflow.NONE
        }
        if(!this.nd_bg)return
        this.lb_des.updateRenderData(true)
        var bgTrans = this.nd_bg.getComponent(UITransform)||this.nd_bg.addComponent(UITransform)
        bgTrans.width = trans.width + this.paddingWidth
        bgTrans.height = trans.height + this.paddingHeight

    }
}


