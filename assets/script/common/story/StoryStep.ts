import { Vec2 } from "cc"

export class StoryStep {
    step:number // 故事阶段步骤
    content:StepContent[] // 阶段内一次展示的内容

}

export class StepContent{
    showType:number //展示的方式  1.播放全屏动画， 2.弹出某个界面 
    animaPath:string // 播放动画时 动画的路径
    imagePath:string  //传递参数时需要的图片地址 不需要可不传
    panelName:string //弹出某个界面，弹出界面时对应的界面预制体名称
    descrip:string //传递参数时需要的描述内容 不需要可不传
    needMask:boolean //是否需要展示引导蒙版
    maskTarget:string //需要镂空的节点路径（相对于StoryMain根节点，如 "nd_game/btn_eat"）
}
export class StoryData{
    steps:StoryStep[]
}