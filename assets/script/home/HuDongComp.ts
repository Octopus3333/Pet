import { _decorator, BlockInputEvents, Color, Component, EventTouch, instantiate, Label, Node, ScrollView, Size, Sprite, tween, UIOpacity, UITransform, Vec3 } from 'cc';
import { DispatchEvent } from '../common/utils/DispatchEvent';
import { Common, EventType, PetAciton, ViewPath, WarehouseType } from '../common/utils/Define';
import { ItemManager } from '../item/ItemManager';
import { DataManager } from '../Data/DataManager';
import { createPrefab, loadImg, loadItem, loadItemQuality } from '../common/utils/UiTools';
import { Item } from '../common/utils/InterfaceDefine';
import { SocketManager, SocketMSgId } from '../common/network/SocketManager';
import { ToastManager } from '../common/utils/ToastManager';
import { HomePanel } from './HomePanel';
import { ItemDiscriptionPanel, ItemDescriptionButtonGroup } from '../common/storage/ItemDiscriptionPanel';
import { UIManager } from '../common/utils/UIManager';
import { ItemDescripView } from '../common/storage/ItemDescripView';
const { ccclass, property } = _decorator;

@ccclass('HuDongComp')
export class HuDongComp extends Component {
    @property(Node)
    nd_page:Node = null
    @property(ScrollView)
    sv_daojv:ScrollView = null
    @property(Node)
    nd_operage:Node = null
    @property(Node)
    nd_cancel:Node = null
    
    @property(Node)
    nd_back:Node = null
    @property(Node)
    nd_expand:Node = null
    @property(Node)
    nd_fold:Node = null
    @property(Node)
    nd_empty:Node = null
    lockTouch = false
    touchTime:number = null
    curSelectCell:Node = null
    contentStyle = 0 // 0 fold 1 expand
    showType = 0
    flyIcon:Sprite = null
    /** 长按定时器 */
    private _longPressTimer: number = -1
    /** 当前拖动的道具id */
    private _currentDragItemId: number = -1
    /** 触摸是否被屏蔽 */
    private _touchBlocked: boolean = false

    /** 道具详情面板节点 */
    private _itemDescriptionNode: Node = null
    protected onLoad(): void {
        this.reset()
        // 监听仓库数据更新事件
        DispatchEvent.ins.on(EventType.RefreshWarehouse, this.onWarehouseRefresh, this)
        DispatchEvent.ins.on(EventType.RefreshBackpack, this.onWarehouseRefresh, this)

        DispatchEvent.ins.on(EventType.PetPlaying, this.onPetPlaying, this)

        this.node.on(Node.EventType.TOUCH_START, this.onNodeTouchStart, this, true)
        this.node.on(Node.EventType.TOUCH_MOVE, this.onNodeTouchMove, this, true)
        this.node.on(Node.EventType.TOUCH_END, this.onNodeTouchEnd, this, true)
        this.node.on(Node.EventType.TOUCH_CANCEL, this.onNodeTouchEnd, this, true)
        
    }
    
    protected onDestroy(): void {
        this.destroyFlyIcon()
        DispatchEvent.ins.off(EventType.RefreshWarehouse, this.onWarehouseRefresh, this)
        DispatchEvent.ins.off(EventType.PetPlaying, this.onPetPlaying, this)
        if (this._itemDescriptionNode && this._itemDescriptionNode.isValid) {
            this._itemDescriptionNode.destroy()
            this._itemDescriptionNode = null
        }
    }
    onPetPlaying(bool){
        console.log("onPetPlaying")
        if(bool){
            this.changeUiView(false)
        }else{
            this.changeUiView(true)
        }
    }
    /** 仓库数据更新时刷新展示 */
    private onWarehouseRefresh(): void {
        console.log("onWareHouseRefresh")
        this.loadItems()
    }
    reset(){
        this.contentStyle = 0
        this.lockTouch = false
        if(this.contentStyle){
            this.nd_fold.active = true
            this.nd_expand.active = false
        }else{
            this.nd_fold.active = false
            this.nd_expand.active = true
        }
        this.curSelectCell = null
        var opacityComp = this.nd_page?.getComponent(UIOpacity);
        if(opacityComp){
            opacityComp.opacity = 255
        }
        this.showType = 0
        this.loadItems()
        this.showContentItemsStyle()
    }
    onClickHuDong(sender, data){
        console.log("onClickHuDong=========",data)
        var huDongData = {
                action:Number(data),
                loop:false,
                callBack: this.onHuDongFinish.bind(this)
        }
        DispatchEvent.ins.emit(EventType.PetTouch, huDongData|| null)
        this.changeUiView(false)
    }
    onHuDongFinish(){
        this.changeUiView(true)
    }
    async onShowFood()
    {
        if(this.showType == WarehouseType.Food){
            this.onShowNormal()
            return
        }
        this.showType = WarehouseType.Food;
        if (this.nd_page) 
        {
            this.nd_page.active = true;
        }    
        await this.requestData()
        this.loadItems();
    }
    async onShowClean()
    {
        if(this.showType == WarehouseType.Clean){
            this.onShowNormal()
            return
        }       
        this.showType = WarehouseType.Clean;
        if (this.nd_page) 
        {
            this.nd_page.active = true;  // 点击清洁按钮时恢复物品栏
        }
        await this.requestData()
        this.loadItems();
    }
    async onShowToy()
    {
        if(this.showType == WarehouseType.Toy){
            this.onShowNormal()
            return
        }    
        this.showType = WarehouseType.Toy;
        if (this.nd_page) 
        {
            this.nd_page.active = true;
        }
        await this.requestData()
        this.loadItems();
    }
    jump(item){
        if(this.sv_daojv){
            console.log("item",item)
            for(var obj of this.sv_daojv.content.children){
                if(obj.itemData && obj.itemData.id == item.id){
                    console.log("jump to item_id",item)
                    this.setCellSelect(obj)
                    var trans = this.sv_daojv.content.getComponent(UITransform)
                    if(trans){
                        var percent = Math.floor(obj.x/trans.height)
                        this.sv_daojv.scrollToPercentHorizontal(percent,0, false)
                    }
                    return
                }
            }
        }
    }
    async onShowNormal()
    {
        this.showType = 0;               
        if (this.nd_page)
        {
            this.nd_page.active = false; 
        }
        await this.requestData()
        this.loadItems();  
    }
    onClickExpand(){
        console.log("HuDongComp onClickExpand", this.contentStyle)
        if(this.contentStyle == 1)return
        this.contentStyle = 1
        console.log("HuDongComp onClickExpand2", this.contentStyle)
        this.nd_fold.active = true
        this.nd_expand.active = false
        this.showContentItemsStyle()
    }
    onClickFold(){
        console.log("HuDongComp onClickFold", this.contentStyle)
        if(this.contentStyle == 0)return
        this.contentStyle = 0
        this.nd_fold.active = false
        this.nd_expand.active = true
        this.showContentItemsStyle()

    }
    showContentItemsStyle(){
        var svNode = this.sv_daojv.node
        if(!svNode)return
        var height =  this.contentStyle? 470:148
        function adaptUi(node, height){
            if(!node)return
            var size = node.getComponent(UITransform)||node.addComponent(UITransform)
            size.setContentSize(new Size(size.contentSize.x, height))
            if(node.name == "content")return
            adaptUi(node.children[0], height)
        }
        adaptUi(svNode, height)
        if(!this.nd_page)return
        var pageSize = this.nd_page.getComponent(UITransform)||this.nd_page.addComponent(UITransform)
        var pageHeight =  this.contentStyle? 524:200
        pageSize.setContentSize(new Size(pageSize.contentSize.x, pageHeight)) 
    }
    async loadItems(){
        
        if(!this.sv_daojv?.content)return
        var cell = this.sv_daojv.content.getChildByName("nd_itemCell")
        var orignData = DataManager.ins.getWarehouse(this.showType)||[]
        var backpackData = DataManager.ins.getBackpack()
        console.log("backpackData=============",backpackData)
        var itemsData = [...orignData]
        for(var obj of backpackData){
            console.log("obj type", this.showType, obj.type)
            if(obj.type == this.showType){
                itemsData.push(obj)
            }
        }
        var btn_expand =this.nd_page.getChildByName("btn_expand")
        if(btn_expand){
            btn_expand.active = orignData.length > 15
        }
        if(itemsData.length == 0){
            this.nd_empty.active = true
            this.sv_daojv.node.active = false
            cell.active = false
            return
        }else{
            this.sv_daojv.node.active = true
            this.nd_empty.active = false
            cell.active = true
        }
        this.sortItems(itemsData)
        var curContentLen = this.sv_daojv.content.children?.length || 0
        if(curContentLen < itemsData.length){
            for(var i = curContentLen; i < itemsData.length; i++){
                var obj = instantiate(cell)
                obj.parent = this.sv_daojv.content

            }
        }else{
            for(var i = itemsData.length ; i < curContentLen ; i ++){
                var item = this.sv_daojv.content.children[i]
                item.active = false
            }
        }
        for(var j = 0; j < itemsData.length; j ++ ){
            var items = this.sv_daojv.content.children
            this.loadCell(itemsData[j] ,items[j])
            items[j].active = true
        }

    }
    
    async requestData(){
       // 检查原始仓库列表（全量），不按子类型过滤
       console.log("requestData=============")
        var data = DataManager.ins.getWarehouse(this.showType)
        var bagData = DataManager.ins.getBackpack()
       if(!data || data.length == 0){
            await ItemManager.ins.fetchAllWarehouse(this.showType)
       }
        if(!bagData || bagData.length == 0){
            await ItemManager.ins.requestBackpack()
       }
       return 
    }

    /** 判断道具对当前宠物是否可使用：animal_limit 中存在 petType 即可使用 */
    private isItemUsable(item: Item): boolean {
        var petType = DataManager.ins.getUserInfo()?.petType ?? 0
        return item.animal_limit != null && item.animal_limit.indexOf(petType) !== -1
    }

    /**
     * 排序道具：
     * 1. 可使用道具在前，不可使用道具在后
     * 2. 可使用道具内按效果分类：增益(主属性>0) -> 减益(主属性<0) -> 亲密度(主属性==0)
     * 3. 同分类内按 created_at 升序（最早获取排列在前）
     * 4. 不可使用道具内按 created_at 升序
     */
    private sortItems(items: Item[]): void {
        var isClean = this.showType === WarehouseType.Clean
        var getPrimaryVal = (item: Item) => {
            var val = isClean ? item.clean : item.energy
            return val || 0
        }
        var getEffectCategory = (item: Item) => {
            var val = getPrimaryVal(item)
            if (val > 0) return 0  // 增益
            if (val < 0) return 1  // 减益
            return 2               // 亲密度（主属性为0）
        }
        items.sort((a, b) => {
            var ua = this.isItemUsable(a)
            var ub = this.isItemUsable(b)
            // 可使用在前，不可使用在后
            if (ua !== ub) return ua ? -1 : 1
            if (ua) {
                // 可使用道具：增益 -> 减益 -> 亲密度
                var ca = getEffectCategory(a)
                var cb = getEffectCategory(b)
                if (ca !== cb) return ca - cb
            }
            // 同分类内按 created_at 升序（最早获取在前）
            return (a.created_at || 0) - (b.created_at || 0)
        })
    }
    loadCell(data:Item, cell){
        var sp_icon_1 = cell.getChildByName("sp_icon_1")
        var sp_icon_2 = cell.getChildByName("sp_icon_2")
        var lb_num_1 = cell.getChildByName("lb_num_1")
        var lb_num_2 = cell.getChildByName("lb_num_2")
        var lb_num_3 = cell.getChildByName("lb_num_3")
        var sp_quality = cell.getChildByName("sp_quality")
        var sp_item = cell.getChildByName("sp_item")
        var nd_mask = cell.getChildByName("nd_mask")
        if( sp_quality ){
            loadItemQuality(sp_quality.getComponent(Sprite), data.item_id)
        }
        if(sp_item){
            loadItem(sp_item.getComponent(Sprite), data.item_id)
            var use_count = sp_item.getChildByName("lb_use_count")
            var lb_user_count =use_count.getComponent(Label)
            if(lb_user_count){
                lb_user_count.string = data.remain_count + "/" + data.total_use_count
            }
        }

        // 不可使用道具：显示遮罩（置灰+禁止标识）
        var usable = this.isItemUsable(data)
        if(nd_mask){
            nd_mask.active = !usable
        }

        // 根据 showType 确定主属性和副属性
        // showType=clean: 主=clean, 副=food(energy)
        // showType=food:  主=food(energy), 副=clean
        var isClean = this.showType === WarehouseType.Clean
        var primaryVal = isClean ? data.clean : data.energy
        var primaryIcon = isClean
            ? (data.clean > 0 ? 'hudong/cleanUp' : 'hudong/cleanDown')
            : (data.energy > 0 ? 'hudong/foodUp' : 'hudong/foodDown')
        var secondaryVal = isClean ? data.energy : data.clean
        var secondaryIcon = isClean
            ? (data.energy > 0 ? 'hudong/foodUp' : 'hudong/foodDown')
            : (data.clean > 0 ? 'hudong/cleanUp' : 'hudong/cleanDown')

        // sp_icon_1 + lb_num_1 = 主属性
        if (sp_icon_1) {
            var sp1 = sp_icon_1.getComponent(Sprite)
            if (sp1) {
                loadImg(sp1, Common.texturePath + "home/" + primaryIcon + '/spriteFrame')
            }
        }
        if (lb_num_1) {
            var label1 = lb_num_1.getComponent(Label)
            if (label1) {
                label1.color = primaryVal > 0 ? new Color(92, 231, 146):new Color(255, 96, 62)
                label1.string = String(Math.abs(primaryVal))
            }
        }

        // sp_icon_2 + lb_num_2 = 副属性
        if (sp_icon_2) {
            var sp2 = sp_icon_2.getComponent(Sprite)
            if (sp2) {
                loadImg(sp2, Common.texturePath + "home/" + secondaryIcon + '/spriteFrame')
            }
        }
        if (lb_num_2) {
            var label2 = lb_num_2.getComponent(Label)
            if (label2) {
                label2.color = secondaryVal > 0 ? new Color(92, 231, 146):new Color(255, 96, 62)
                label2.string = String(Math.abs(secondaryVal))
            }
        }

        // lb_num_3 永远是 intimacy
        if (lb_num_3) {
            var label3 = lb_num_3.getComponent(Label)
            if (label3) {
                label3.string = "+" + String(data.intimacy)
            }
        }

        // 将道具数据存储在 cell 节点上，供 this.node 触摸判定时读取
        cell['itemData'] = data
    }
    changeUiView(bool){
        console.log("changeUiView=================", bool)
        if(this.nd_back){
            this.nd_back.active = bool
        }
        if(this.nd_operage){
            this.nd_operage.active = bool
        }
        var opacityComp = this.nd_page.getComponent(UIOpacity);
        if(!bool){
            this.sv_daojv.horizontal = false
            this.lockTouch = true
            opacityComp.opacity = 0
        }else{
            // 松手恢复
            this.sv_daojv.horizontal = true
            this.lockTouch = false
            opacityComp.opacity = 255
        }
        var parent =this.node.parent
        var bottom = parent.getChildByName("nd_bottom")
        if(bottom){
            bottom.active = bool
        }
    }
    
    showOperateView(bool:boolean){

        if(this.nd_cancel){
            this.nd_cancel.active = bool
        }
        this.changeUiView(!bool)
    }
    setCellSelect(cell){
        console.log("setSelect==================")
        if(!cell) return
        if (!this.sv_daojv?.content) return 
        var children = this.sv_daojv.content.children
        for (var i = 0; i < children.length; i++) {
            var select = children[i].getChildByName("sp_select")
            if(children[i] == cell){
                this.curSelectCell = cell
                if(!select) continue
                select.active = true
            }else{
                select.active = false
            }
        }
    }
    /** this.node 负责按下判定：根据触摸坐标找到对应 cell，启动长按 */
    private onNodeTouchStart(event: any): void {
        var touch = event.getUILocation()
        if (!this.flyIcon && this.sv_daojv?.node) {
            if (!this.isInNodeArea(new Vec3(touch.x, touch.y, 0), this.sv_daojv.node)) {
                return
            }
        }
        console.log("ontouchStart==============")
        this.clearLongPress()        
        var cell = this.findItemAtPos(touch.x, touch.y)
        if (!cell ||!cell['itemData']) return
        // 不可使用道具：不参与拖拽选中，仅记录用于点击弹窗
        var data = cell['itemData'] as Item
        console.log("cell==================",cell, this.isItemUsable(data))
        this.setCellSelect(cell)
        if (!this.isItemUsable(data)) {
            return
        }
        // 将触摸点转换为 this.node 下的本地坐标
        var uiTransform = this.node.getComponent(UITransform)
        var localPos = uiTransform.convertToNodeSpaceAR(new Vec3(touch.x, touch.y, 0))
        this._currentDragItemId = data.id
        this.touchTime = Date.now()
        this._longPressTimer = setTimeout(() => {
            this.createFlyIcon(data.item_id, localPos)
            this.showOperateView(true)
        }, 800) as unknown as number
    }

    async showItemDesCripeView(itemData){
        var panel = await UIManager.ins.show(ViewPath.ItemDescripView)
        var comp = panel.getComponent(ItemDescripView)
        comp.show(itemData)
    }
    /** 根据世界坐标在 ScrollView content 中命中检测 */
    private findItemAtPos(worldX: number, worldY: number): Node | null {
        if(this.lockTouch) return 
        if (!this.sv_daojv?.content) return null
        if(!this.nd_page?.active || !this.sv_daojv?.node?.active) return null

        var children = this.sv_daojv.content.children
        for (var i = 0; i < children.length; i++) {
            var cell = children[i]
            if (!cell.active) continue
            var trans = cell.getComponent(UITransform)
            if (!trans) continue
            var box = trans.getBoundingBoxToWorld()
            if (worldX >= box.x && worldX <= box.xMax && worldY >= box.y && worldY <= box.yMax) {
                return cell
            }
        }
        return null
    }

    /** this.node 负责拖动跟随 */
    private onNodeTouchMove(event: any): void {
        console.log("touchMove======================")
        if (!this.flyIcon) return

        // this.stopTouch(true)
        var touch = event.getUILocation()
        this.flyIcon.node.setWorldPosition(touch.x, touch.y, 0)
    }

    /** this.node 负责抬起清理 */
    private onNodeTouchEnd(event: any): void {
        var disTime = Date.now() - this.touchTime
        var itemData = this.curSelectCell && this.curSelectCell["itemData"]
        if(itemData && disTime < 500 && this.sv_daojv && !this.sv_daojv.isScrolling()){
            this.showItemDesCripeView(itemData)
        }
        var touch = event.getUILocation()
        var cell = this.findItemAtPos(touch.x, touch.y)
        if(cell && cell.itemData && cell.itemData.id){
            if(this.curSelectCell && this.curSelectCell.itemData && this.curSelectCell.itemData.id == cell.itemData.id){
                if (this.curSelectCell && this.curSelectCell["itemData"] && !this.isItemUsable(this.curSelectCell["itemData"])&& !this.sv_daojv.isScrolling()) {
                    this.showItemDesCripeView(this.curSelectCell["itemData"])
                    return
                }
            }
        }

        this.clearLongPress()
        if(!this.flyIcon) return
        // 检查是否在 pet 区域内（拖拽使用道具）
        if (this.flyIcon && itemData) {
            const worldPos = this.flyIcon.node.getWorldPosition()
            const petNode = this.node.parent.getComponent(HomePanel)
            console.log("petNode", petNode)
            if (petNode && this.isInNodeArea(worldPos, petNode.nd_pet)) {
            // if(true){
                // 在 pet 区域内，发送 ItemUse 协议
                this._currentDragItemId = -1
                this.destroyFlyIcon()
                this.showOperateView(false)
                DispatchEvent.ins.emit(EventType.ItemUse, itemData)
            } else {
                // 不在 pet 区域内，飞到 nd_cancel 位置
                if (this.nd_cancel && this.flyIcon?.node) {
                    const cancelPos = this.nd_cancel.getWorldPosition()
                    // this.flyIcon.node.setWorldPosition(cancelPos)
                    var pos = new Vec3()
                    this.node.inverseTransformPoint(pos, cancelPos)
                    tween(this.flyIcon.node).stop()
                    tween(this.flyIcon.node).to(0.3, {
                        position:pos,
                        scale:new Vec3(0.2,0.2, 1)
                    }).call(()=>{
                        this.destroyFlyIcon()
                        this.showOperateView(false)
                    }).start()
                    return
                }
            }
        }
        // 清理状态

    }
    
    /** 检查世界坐标是否在节点区域内 */
    private isInNodeArea(worldPos: Vec3, node: Node): boolean {
        if(!node)return
        const uiTransform = node.getComponent(UITransform)
        if (!uiTransform) return false
        
        const box = uiTransform.getBoundingBoxToWorld()
        return worldPos.x >= box.x && worldPos.x <= box.xMax &&
               worldPos.y >= box.y && worldPos.y <= box.yMax
    }

    private clearLongPress(): void {
        this.touchTime = 0
        if (this._longPressTimer !== -1) {
            clearTimeout(this._longPressTimer)
            this._longPressTimer = -1
        }
    }



    private async createFlyIcon(itemId: number, localPos?: Vec3): Promise<void> {
        if (this.flyIcon) return
        var node = new Node('flyIcon')
        var sp = node.addComponent(Sprite)
        node.parent = this.node
        node.scale = new Vec3(1.5, 1.5, 1)
        // 设置默认位置（触摸点在 this.node 下的本地坐标）
        if (localPos) {
            node.setPosition(localPos)
        }
        await loadItem(sp, itemId)
        if (!sp.isValid) return
        this.flyIcon = sp
    }

    private destroyFlyIcon(): void {
        if (this.flyIcon) {
            this.flyIcon.node.destroy()
            this.flyIcon = null
        }
    }


    onClickBack(){
        this.reset()
        DispatchEvent.ins.emit(EventType.BackHome)
    }
}


