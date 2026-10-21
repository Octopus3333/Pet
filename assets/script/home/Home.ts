import { _decorator, Component, Node, Skeleton, sp, Sprite, UIOpacity, UITransform, Vec3, Label, tween, Color } from 'cc';
import { DataManager } from '../Data/DataManager';
import { ChatManager } from '../chat/ChatManager';
import { Common, EventType, ViewPath } from '../common/utils/Define';
import { UIManager } from '../common/utils/UIManager';
import { DispatchEvent } from '../common/utils/DispatchEvent';
import { ResLoader } from '../common/download/ResLoader';
import { loadItem, createPrefab, loadImg } from '../common/utils/UiTools';
import { StoryManager } from '../common/story/StoryManager';
import { ItemConfigManager } from '../item/ItemConfigManager';
const { ccclass, property } = _decorator;
const AnimaName = ["cat","dog","rabbit"]
const AnimationName = {
    [1]: {
        Idle:"dirty2",
    },
    [2]: {
        Idle:"idle",
    },
    [3]: {
        Idle:"1",
    },
}
@ccclass('Home')
export class Home extends Component {
    @property(Node)
    nd_pet:Node = null
    @property(Node)
    nd_step_1:Node = null
    @property(Node)
    nd_step_2:Node = null
    @property(Sprite)
    sp_mask:Sprite = null
    @property(Node)
    nd_item:Node = null

    @property(Label)
    lb_times:Label = null
    @property(Label)
    lb_descrip:Label = null
    @property(Label)
    lb_name:Label = null

    @property(Node)
    nd_iconGroup_1:Node = null
    @property(Node)
    nd_iconGroup_2:Node = null

    step = 1
    flyIcon:Sprite = null
    data = null
    private _longPressTimer: number;
    protected async onLoad(): Promise<void> {
        if(!StoryManager.ins.curPlayData){
            DispatchEvent.ins.emit(EventType.StoryNext)
            return
        }
        console.log("StoryManager.ins.curPlayData", StoryManager.ins.curPlayData)
        if(StoryManager.ins.curPlayData.curStep == 2 && StoryManager.ins.curPlayData.curIndex == 0){
            console.log("itemConfig",  ItemConfigManager.ins.getConfig(1) )
            this.data = ItemConfigManager.ins.getConfig(1)
            if(this.nd_item){
                this.nd_item.on(Node.EventType.TOUCH_START, this.onTouchStart, this)
                this.nd_item.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this)
                this.nd_item.on(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this)
                this.nd_item.on(Node.EventType.TOUCH_END, this.onTouchEnd, this)  
            }
        }else{
            this.step = 0

        }

        this.loadPet()
        this.loadStep()
        this._loadRubbishItemData()
    }

    async loadPet(){
        var userInfo = DataManager.ins.getUserInfo()
        console.log("userInfo",userInfo)
        if(!this.nd_pet)return
        if(userInfo.petType <= 0) {
            console.error("宠物类型错误")
            return

        }
        try {
            var res = await ResLoader.ins.loadResAsync(Common.AnimaPath + "petAnima/" + AnimaName[userInfo.petType -1], sp.SkeletonData)
            if(!res){
                console.log("load pet ske erro============")
                return
            }
            var skeleton = this.nd_pet.getComponent(sp.Skeleton) 
            skeleton.skeletonData = res
            skeleton.loop = true
            console.log("anima===",AnimationName[userInfo.petType])
            skeleton.setAnimation(0,AnimationName[userInfo.petType].Idle, true)
        } catch (error) {
            console.log("load pet anima erro")
        }
    }
    reset(){
        this.step = 1
    }
    async onPhoneClick(){
        try {
            await ChatManager.ins.showDogPanel()
            var userInfo = DataManager.ins.getUserInfo()
            if(userInfo.newUserLead < 4){
                UIManager.ins.show(ViewPath.CreateNamePanel)
            }
            console.log("onPhoneClick=====")
        } catch (e) {
            console.warn('[HomePanel] Chat close failed:', e);
        }    
    }
    onEatClick(): void { 
        console.log("eat click", this.step)
        if(this.step != 1)return
        this.step = 2
        this.loadStep()
        // console.log("onEatClick============")
        // DispatchEvent.ins.emit(EventType.StoryNext)
    }
    loadStep(){
        console.log("loadStep", this.step)
        if(this.sp_mask && this.sp_mask._customMaterial){
            this.sp_mask._customMaterial.setProperty('radius', 0)
        }
        console.log("step=========", this.step)
        if(this.step == 1){
            this.nd_step_1.active = true
            this.nd_step_2.active = false
        }else if(this.step == 2){
            this.nd_step_1.active = false
            this.nd_step_2.active = true
            this.nd_step_2.getChildByName("index_1").active = true
            this.nd_step_2.getChildByName("index_2").active = false
            this.nd_step_2.getChildByName("index_3").active = false

        }else if(this.step == 3){
            this.nd_step_1.active = false
            this.nd_step_2.active = true            
            this.nd_step_2.getChildByName("index_2").active = true
            this.nd_step_2.getChildByName("index_1").active = false
            this.nd_step_2.getChildByName("index_3").active = false
        }else if(this.step == 4){
            this.nd_step_1.active = false
            this.nd_step_2.active = true            
            this.nd_step_2.getChildByName("index_3").active = true
            this.nd_step_2.getChildByName("index_2").active = false
            this.nd_step_2.getChildByName("index_1").active = false
            this.clipPet()
        }else{
            this.nd_step_1.active = false
            this.nd_step_2.active = false
        }
    }
    onTouchStart(touch){
        if(this.step < 4) return
        this._longPressTimer = setTimeout(() => {
            this.createFlyIcon(this.data.item_id, touch.getUILocation())
            this.showDragView()
        }, 500)
    }
    onTouchMove(event){
        if(this.step < 4) return
        if (!this.flyIcon) return

        // this.stopTouch(true)
        var touch = event.getUILocation()
        this.flyIcon.node.setWorldPosition(touch.x, touch.y, 0)
    }
    onTouchEnd(){
        if(this.step < 4){
            this.step ++
            this.loadStep()
            return
        }
        this.clearLongPress()
        if(this.flyIcon){
            const worldPos = this.flyIcon.node.getWorldPosition()
            if(this.isInNodeArea(worldPos, this.nd_pet)){
                this.destroyFlyIcon()
                this.onDogRewardsTips(this.data)
            }else{
                this.restoreDragView()
                this.destroyFlyIcon()
            }
        }
    }

    /** 检查世界坐标是否在节点区域内 */
    private isInNodeArea(worldPos: Vec3, node: Node): boolean {
        if(!node) return false
        const uiTransform = node.getComponent(UITransform)
        if (!uiTransform) return false
        const box = uiTransform.getBoundingBoxToWorld()
        return worldPos.x >= box.x && worldPos.x <= box.xMax &&
               worldPos.y >= box.y && worldPos.y <= box.yMax
    }

    private destroyFlyIcon(): void {
        if (this.flyIcon) {
            this.flyIcon.node.destroy()
            this.flyIcon = null
        }
    }

    /** 恢复拖拽前的视图状态 */
    private restoreDragView(): void {
        if(this.nd_step_2){
            var opacityComp = this.nd_step_2.getComponent(UIOpacity)
            if(opacityComp){
                opacityComp.opacity = 255
            }
        }
    }

    // type: 1=clean 2=food 3=亲密度 4=粉抓币
    async showDogRewardsTips(type:number, num:number){
        if(num == 0)return
        var pb = await createPrefab(Common.prefabPath + "home/DogRewardsTips")
        if(!pb || !pb.isValid)return
        pb.parent = this.nd_pet
        // 位置：pet 上方 100 像素，x 在 -60~60 区间随机
        var trans = this.nd_pet.getComponent(UITransform)
        var randomX = (Math.random() * 2 - 1) * 60
        pb.setPosition(randomX, trans.height*this.nd_pet.scale.y + 200, 0)

        // 根据 type 和 num 正负加载对应图标
        var iconName = ""
        if(type == 1){
            iconName = num > 0 ? "hudong/cleanUp" : "hudong/cleanDown"
        }else if(type == 2){
            iconName = num > 0 ? "hudong/foodUp" : "hudong/foodDown"
        }else if(type == 3){
            iconName = "hudong/heartM"
        }else if(type == 4){
            iconName = "hudong/pinkM"
        }
        var sp_icon = pb.getChildByName("sp_icon")
        if(sp_icon){
            var sp = sp_icon.getComponent(Sprite)
            if(sp){
                loadImg(sp, Common.texturePath + "home/" + iconName + "/spriteFrame")
            }
        }
        var lb_num = pb.getChildByName("lb_num")
        if(lb_num){
            var lb = lb_num.getComponent(Label)
            if(lb){
                lb.string = (num > 0 ? "+" : "") + num
            }
        }

        // 缓慢向上运动 + 渐隐，完成后移除
        var opacity = pb.getComponent(UIOpacity) || pb.addComponent(UIOpacity)
        var endY = pb.position.y + 200
        tween(pb).to(2, { position: new Vec3(pb.position.x, endY, 0) }).start()
        tween(opacity).to(1.5, { opacity: 0 }).call(() => {
            DispatchEvent.ins.emit(EventType.RefreshBtnProgress,{type:type,needAnima:true})
            if(pb.isValid){
                pb.destroy()
            }
        }).start()
    }

    /** 处理道具配置中的奖励数据，按 增益>减益>亲密度>粉抓币 顺序依次显示，间隔 0.5 秒 */
    onDogRewardsTips(data:any){
        if(!data)return
        var delta_clean = data.clean || 0
        var delta_energy = data.energy || 0
        var delta_intimacy = data.intimacy || 0
        var delta_pink = data.pink || 0

        // 收集显示项，顺序：增益 > 减益 > 亲密度 > 粉抓币
        var gains:{type:number, num:number}[] = []
        var losses:{type:number, num:number}[] = []

        if(delta_energy > 0) gains.push({type:2, num:delta_energy})
        else if(delta_energy < 0) losses.push({type:2, num:delta_energy})

        var list:{type:number, num:number}[] = [...gains, ...losses]
        if(delta_intimacy != 0) list.push({type:3, num:delta_intimacy})
        for(let i = 0; i < list.length; i++){
            let item = list[i]
            this.scheduleOnce(()=>{
                this.showDogRewardsTips(item.type, item.num)
            }, i * 0.5)
        }
        if(list.length > 0){
            var totalDelay = (list.length - 1) * 0.5 + 2
            this.scheduleOnce(()=>{
                DispatchEvent.ins.emit(EventType.StoryNext)
            }, totalDelay)
        }else{
            DispatchEvent.ins.emit(EventType.StoryNext)
        }
    }
    private clearLongPress(): void {
        if (this._longPressTimer !== -1) {
            clearTimeout(this._longPressTimer)
            this._longPressTimer = -1
        }
    }
    showDragView(){
        if(this.nd_step_2){
            var opacityComp = this.nd_step_2.getComponent(UIOpacity)||this.nd_step_2.addComponent(UIOpacity)
            opacityComp.opacity = 0
        }
        this.nd_step_1.active = false

    }
    private async createFlyIcon(itemId: number, localPos?: Vec3): Promise<void> {
        if (this.flyIcon) return
        var node = new Node('flyIcon')
        var sp = node.addComponent(Sprite)
        node.parent = this.node
        node.scale = new Vec3(1.5, 1.5, 1)
        // 设置默认位置（触摸点在 this.node 下的本地坐标）
        if (localPos) {
           node.setWorldPosition(localPos.x, localPos.y, 0)
        }
        await loadItem(sp, itemId)
        if (!sp.isValid) return
        this.flyIcon = sp
    }
    clipPet(){
        var padding = 10
        if(!this.sp_mask || !this.sp_mask.node || !this.sp_mask.node.parent)return
        const maskTransform = this.sp_mask.node.parent.getComponent(UITransform);
        if (!maskTransform) return;
        const maskSize = maskTransform.contentSize;
        const targetWorldPos = this.nd_pet.getWorldPosition();
        const localPos = maskTransform.convertToNodeSpaceAR(targetWorldPos);
        const targetTransform = this.nd_pet.getComponent(UITransform);
        const tw = targetTransform ? targetTransform.contentSize.width : 100;
        const th = targetTransform ? targetTransform.contentSize.height : 100;
        console.log("SIZE==========", maskSize, localPos)
        
        // 计算目标节点在 mask 坐标系下的 UV 百分比 (0,0 = 左下, 1,1 = 右上)
        const uvX = (localPos.x + maskSize.width / 2) / maskSize.width;
        const uvY = (localPos.y + maskSize.height / 2) / maskSize.height;

        // 取 targetNode 长宽最大值 + padding 作为半径，计算与 maskSize 的比例
        const maxDim = Math.max(tw, th) + padding * 2;
        const radius = (maxDim / 2) / maskSize.width; // 归一化到 0~1 范围

        // 获取 mask 节点的 Sprite 材质并设置参数
        const sprite = this.sp_mask;
        console.log("sprite", sprite)
        if (sprite && sprite._customMaterial) {
            console.log("use Mask mat")
            const mat = sprite._customMaterial;
            mat.setProperty("x", 0.5);         // 圆心 X
            mat.setProperty("y", 0.5);    
            mat.setProperty('radius', 0.3);
            var aspectRatio = parseFloat((this.node.getComponent(UITransform).contentSize.width/this.node.getComponent(UITransform).contentSize.height).toFixed(3));
            mat.setProperty('aspectRatio', aspectRatio);
            console.log("uvX", uvX, "uvY", uvY,"radius",radius, "aspectRatio", aspectRatio)
            
        }
    }

    /** 加载 RubbishHomePanel 道具数据（item_id=9） */
    private async _loadRubbishItemData(): Promise<void> {
        if (!this.nd_step_2) return
        const index2 = this.nd_step_2.getChildByName('index_2')
        if (!index2) {
            console.warn('[Home] nd_step_2下未找到index_2节点')
            return
        }
        const ndItemCell = this.nd_step_2.getChildByName('nd_itemCell')
        if (!ndItemCell) {
            console.warn('[Home] index_2下未找到nd_itemCell节点')
            return
        }
        await ItemConfigManager.ins.load()
        const cfg = ItemConfigManager.ins.getConfig(9)
        if (!cfg) {
            console.warn('[Home] 未找到item_id=9的道具配置')
            return
        }
        const sp = ndItemCell?.getChildByName('sp_item')?.getComponent(Sprite)
        loadItem(sp, cfg.item_id)

        // lb_num_1 → clean
        const lbNum1 = ndItemCell.getChildByName('lb_num_1')?.getComponent(Label)
        if (lbNum1) {
            lbNum1.string = (Math.abs(cfg.clean) || 0).toString()
        }
        // lb_num_2 → energy
        const lbNum2 = ndItemCell.getChildByName('lb_num_2')?.getComponent(Label)
        if (lbNum2) {
            lbNum2.string = (Math.abs(cfg.energy) || 0).toString()
        }
        // lb_num_3 → 好感度
        const lbNum3 = ndItemCell.getChildByName('lb_num_3')?.getComponent(Label)
        if (lbNum3) {
            lbNum3.string = '+' + (cfg.intimacy || 0)
        }
        // lb_times → 使用次数
        const lbTimes = this.lb_times
        if (lbTimes) {
            lbTimes.string = (cfg.total_use_count || 0).toString()
        }
        // lb_itemName → 道具名称
        const lbItemName = this.lb_name
        if (lbItemName) {
            lbItemName.string = cfg.name || ''
        }
        // lb_discription → 描述
        const lbDiscription = this.lb_descrip
        if (lbDiscription) {
            lbDiscription.string = cfg.des || ''
        }
        console.log("this.nd_iconGroup_1", this.nd_iconGroup_1)
        if(this.nd_iconGroup_1){
            for(var i = 1 ; i < 4; i ++){
                console.log("1111111111111111111111")
                var petNode = this.nd_iconGroup_1.getChildByName("nd_pet_" + i)
                if(!petNode)continue
                var spNode = petNode.getChildByName("sp_can_use")
                var sp1 = spNode.getComponent(Sprite)
                var path = cfg.animal_limit.indexOf(i) != -1 ? "gou":"cha"
                loadImg(sp1, Common.texturePath + "storage/" + path + "/spriteFrame")
            }
        }
        var group = this.nd_iconGroup_2
        if(group){
            group.getChildByPath("nd_clean/sp_down_red").active =  cfg.clean < 0
            group.getChildByPath("nd_clean/sp_up_green").active =  cfg.clean > 0
            group.getChildByPath("nd_clean/sp_unchanged").active = cfg.clean == 0
            var cleanVal = group.getChildByPath("nd_clean/lb_value")
            var cleanLb = cleanVal.getComponent(Label)
            cleanLb.string =  Math.abs(cfg.clean).toString()
            group.getChildByPath("nd_energy/sp_down_red").active =  cfg.energy < 0
            group.getChildByPath("nd_energy/sp_up_green").active =  cfg.energy > 0
            group.getChildByPath("nd_energy/sp_unchanged").active = cfg.energy == 0
            var intimacyVal = group.getChildByPath("nd_energy/lb_value")
            var intimacyLb = intimacyVal.getComponent(Label)
            intimacyLb.string = Math.abs(cfg.energy).toString()

            group.getChildByPath("nd_intimacy/sp_down_red").active =  cfg.intimacy < 0
            group.getChildByPath("nd_intimacy/sp_up_green").active =  cfg.intimacy > 0
            group.getChildByPath("nd_intimacy/sp_unchanged").active = cfg.intimacy == 0
            var energyVal = group.getChildByPath("nd_intimacy/lb_value")
            var energyLb = energyVal.getComponent(Label)
            energyLb.string =  Math.abs(cfg.intimacy).toString()
        }
        console.log('[Home] RubbishHomePanel数据加载完成', cfg)
    }
}


