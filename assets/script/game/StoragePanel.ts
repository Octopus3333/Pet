import { _decorator, Button, Color, Component, instantiate, Label, Node, PageView, Sprite } from 'cc';
import { createPrefab, loadImg } from '../common/utils/UiTools';
import { Common, EventType, ViewPath, WarehouseType } from '../common/utils/Define';
import { DataManager } from '../Data/DataManager';
import { UIManager } from '../common/utils/UIManager';
import { StorageSlot } from './StorageSlot';
import { BackpackPanel } from '../common/storage/BackpackPanel';
import { ItemManager } from '../item/ItemManager';
import { DispatchEvent } from '../common/utils/DispatchEvent';
import { Item } from '../common/utils/InterfaceDefine';
import { ItemDiscriptionPanel, ItemDescriptionButtonGroup } from '../common/storage/ItemDiscriptionPanel';
import { BondItemDiscriptionPanel } from '../common/storage/BondItemDiscriptionPanel';
import { SalePanel } from './SalePanel';
const { ccclass, property } = _decorator;

/** 嵌入仓库页时，背包面板的 Prefab 路径 */
const BACKPACK_PANEL_PATH = Common.prefabPath + 'storage/BackpackPanel';
/** 道具详情面板 Prefab 路径 */
const ITEM_DESCRIPTION_PANEL_PATH = Common.prefabPath + 'storage/ItemDiscriptionPanel';
/** 羁绊物详情面板 Prefab 路径 */
const BOND_ITEM_DESCRIPTION_PANEL_PATH = Common.prefabPath + 'storage/BondItemDiscriptionPanel';

@ccclass('StoragePanel')
export class StoragePanel extends Component {
    @property(Sprite)
    sp_top_btn_1:Sprite = null
    @property(Sprite)
    sp_top_btn_2:Sprite = null
    @property(PageView)
    pg_content:PageView = null
    @property(Node)
    nd_expand:Node = null
    @property(Node)
    nd_empty:Node = null
    @property(Label)
    lb_cur_num:Label = null
    @property(Label)
    lb_btn_des:Label = null
    @property(Label)
    lb_value:Label = null
    @property(Node)
    nd_add:Node = null
    @property(Node)
    btn_next:Node
    @property(Node)
    btn_pre
    /** 底部「外出背包」按钮（Prefab 节点名 btn_backpacl） */
    @property(Node)
    btn_backpack: Node = null
    /** 右下角「外出背包」数量文本（如 4/5） */
    @property(Label)
    lb_backpack_value: Label = null
    /** 仓库页底部操作栏（卖/放背包/赠送/使用） */
    @property(Node)
    nd_ware_house: Node = null
    /** 羁绊物页底部操作栏 */
    @property(Node)
    nd_bond_page: Node = null
    pageIndex:number = 1//1:仓库 2：羁绊物
    subIndex:number = WarehouseType.All
    total:number = 0
    /** 当前页码（0-based） */
    private _curPageIdx: number = 0
    /** 是否为程序化滚动（syncPageViewCount触发），用于跳过onPageTurning中的renderCurrentPage */
    private _isProgrammaticScroll: boolean = false
    /** 首次 bootstrap 完成后为 true，用于 onEnable 二次打开时刷新 */
    private _panelReady = false
    /** 仓库/羁绊全量数据是否已请求过（空列表也算，避免重复拉取） */
    private _warehouseFetched = false
    private _bondFetched = false

    /** 已创建过的 page 节点缓存（不销毁，只控制 active） */
    private _pageNodes: Node[] = []
    /** 已实例化的背包面板节点 */
    private _backpackNode: Node = null
    /** 背包面板是否处于展开状态 */
    private _backpackVisible = false

    //#region 道具选中（默认单选，批量模式为多选）

    /** 是否为批量选择模式（触发入口后续接入） */
    private _batchMode = false
    /** 单选模式下当前选中的道具唯一 id，未选中为 -1 */
    private _selectedSingleId = -1
    /** 批量模式下已选道具 id 集合 */
    private _selectedBatchIds: Set<number> = new Set()
    /** 批量模式下已选道具数据（id -> Item） */
    private _selectedBatchItems: Map<number, Item> = new Map()
    /** 背包道具移入仓库后，待选中的道具 id */
    private _pendingWarehouseSelectId = -1
    /** 背包羁绊物移入羁绊栏后，待选中的道具 id */
    private _pendingBondSelectId = -1

    /**
     * 切换批量选择模式（触发方式后续接入 UI）
     * @param enabled true=多选，false=单选
     */
    setBatchMode(enabled: boolean): void {
        if (this._batchMode === enabled) {
            return
        }
        this._batchMode = enabled
        this.clearSelection()
    }
    protected onDisable(): void {
        this.clearSelection()
    }
    /** 是否处于批量选择模式 */
    getBatchMode(): boolean {
        return this._batchMode
    }

    /**
     * 获取当前选中的道具列表
     * @returns 单选返回 0~1 项，多选返回全部已选项
     */
    getSelectedItems(): Item[] {
        if (this._batchMode) {
            return Array.from(this._selectedBatchItems.values())
        }
        if (this._selectedSingleId < 0) {
            return []
        }
        const item = this._selectedBatchItems.get(this._selectedSingleId)
            ?? this.findItemById(this._selectedSingleId)
        return item ? [item] : []
    }

    /** 清空当前选中状态 */
    clearSelection(): void {
        this._selectedSingleId = -1
        this._selectedBatchIds.clear()
        this._selectedBatchItems.clear()
        this.refreshCurrentPageSelection()
        this.refreshDescriptionPanel()
    }

    /** 格子点击：单选互斥 / 多选 toggle */
    private onStorageSlotClick(slot: StorageSlot): void {
        const item = slot.itemData
        if (!item) {
            return
        }

        if (this._batchMode) {
            this.toggleBatchSelect(item, slot)
        } else {
            this.selectSingle(item)
        }

        // 仓库选中时清除背包选中（互斥）
        if (slot.selected) {
            this._backpackNode?.getComponent(BackpackPanel)?.clearSelection()
        }

        DispatchEvent.ins.emit(EventType.StorageItemSelect, {
            item,
            selected: slot.selected,
            batchMode: this._batchMode,
            selectedItems: this.getSelectedItems(),
        })
        this.refreshDescriptionPanel()
    }

    /** 单选：再次点击同一项则取消选中 */
    private selectSingle(item: Item): void {
        if (this._selectedSingleId === item.id) {
            this._selectedSingleId = -1
            this._selectedBatchItems.delete(item.id)
            this.refreshCurrentPageSelection()
            return
        }

        if (this._selectedSingleId >= 0) {
            this._selectedBatchItems.delete(this._selectedSingleId)
        }

        this._selectedSingleId = item.id
        this._selectedBatchItems.set(item.id, item)
        this.refreshCurrentPageSelection()
    }

    /** 多选：toggle 当前项选中状态 */
    private toggleBatchSelect(item: Item, slot: StorageSlot): void {
        if (this._selectedBatchIds.has(item.id)) {
            this._selectedBatchIds.delete(item.id)
            this._selectedBatchItems.delete(item.id)
            slot.setSelected(false)
            return
        }

        this._selectedBatchIds.add(item.id)
        this._selectedBatchItems.set(item.id, item)
        slot.setSelected(true)
    }

    /** 判断道具是否处于选中状态 */
    private isItemSelected(itemId: number): boolean {
        if (this._batchMode) {
            return this._selectedBatchIds.has(itemId)
        }
        return this._selectedSingleId === itemId
    }

    /** 刷新当前页所有格子的选中视觉 */
    private refreshCurrentPageSelection(): void {
        const pageNode = this._pageNodes[this._curPageIdx]
        if (!pageNode?.isValid) {
            return
        }
        this.refreshPageSelection(pageNode)
    }

    /** 刷新指定 page 内格子的选中视觉 */
    private refreshPageSelection(pageNode: Node): void {
        for (const cell of pageNode.children) {
            if (!cell.active) {
                continue
            }
            const comp = cell.getComponent(StorageSlot)
            if (!comp?.itemData) {
                continue
            }
            comp.setSelected(this.isItemSelected(comp.itemData.id))
        }
    }

    /** 在当前已加载数据中查找道具（用于单选跨页保留） */
    private findItemById(itemId: number): Item | null {
        const list = this.getCurrentDataList()
        return list.find((item) => item.id === itemId) ?? null
    }

    /** 绑定格子点击回调 */
    private readonly onStorageSlotClickBound = (slot: StorageSlot) => this.onStorageSlotClick(slot)

    private bindStorageSlot(slot: StorageSlot): void {
        slot.init(this.onStorageSlotClickBound)
    }

    //#endregion

    //#region 道具详情面板（仓库/背包/羁绊物）

    /** 道具详情面板节点 */
    private _itemDescriptionNode: Node = null
    /** 羁绊物详情面板节点 */
    private _bondDescriptionNode: Node = null
    /** 道具详情面板当前展示来源 */
    private _itemDescSource: 'warehouse' | 'backpack' | null = null
    private readonly onBackpackItemSelectedBound = (item: Item | null) => this.onBackpackItemSelected(item)

    /**
     * 背包格子选中变化（由 BackpackPanel 回调）
     * @param item 选中的道具，null 表示取消选中
     */
    onBackpackItemSelected(item: Item | null): void {
        if (item) {
            // 背包选中时清除仓库选中（互斥）
            this.clearSelection()
            this._itemDescSource = 'backpack'
            void this.showItemDescription(item, ItemDescriptionButtonGroup.Backpack)
            this.hideBondItemDescriptionPanel()
            return
        }
        if (this._itemDescSource === 'backpack') {
            this._itemDescSource = null
            this._itemDescriptionNode?.getComponent(ItemDiscriptionPanel)?.hide()
        }
    }

    /** 根据仓库/羁绊物当前选中状态刷新详情面板 */
    private refreshDescriptionPanel(): void {
        if (this._batchMode) {
            this._itemDescriptionNode?.getComponent(ItemDiscriptionPanel)?.hide()
            this.hideBondItemDescriptionPanel()
            return
        }

        if (this.pageIndex === 2) {
            if (this._itemDescSource === 'warehouse') {
                this._itemDescSource = null
                this._itemDescriptionNode?.getComponent(ItemDiscriptionPanel)?.hide()
            }
            const selected = this.getSelectedItems()
            if (selected.length > 0) {
                void this.showBondItemDescription(selected[0])
            } else {
                this.hideBondItemDescriptionPanel()
            }
            return
        }

        this.hideBondItemDescriptionPanel()
        const selected = this.getSelectedItems()
        if (selected.length > 0) {
            this._itemDescSource = 'warehouse'
            void this.showItemDescription(selected[0], ItemDescriptionButtonGroup.Warehouse)
        } else if (this._itemDescSource === 'warehouse') {
            this._itemDescSource = null
            this._itemDescriptionNode?.getComponent(ItemDiscriptionPanel)?.hide()
        }
    }

    /**
     * 展示道具详情面板
     * @param item 道具数据
     * @param group 底部按钮组
     */
    private async showItemDescription(item: Item, group: ItemDescriptionButtonGroup): Promise<void> {
        const panel = await this.ensureItemDescriptionPanel()
        panel?.show(item, group)
    }

    /** 展示羁绊物详情面板 */
    private async showBondItemDescription(item: Item): Promise<void> {
        const panel = await this.ensureBondItemDescriptionPanel()
        panel?.show(item)
    }

    /** 隐藏羁绊物详情面板 */
    private hideBondItemDescriptionPanel(): void {
        this._bondDescriptionNode?.getComponent(BondItemDiscriptionPanel)?.hide()
    }

    /** 懒加载道具详情面板（Widget 已在 Prefab 上配置） */
    private async ensureItemDescriptionPanel(): Promise<ItemDiscriptionPanel | null> {
        if (!this._itemDescriptionNode || !this._itemDescriptionNode.isValid) {
            this._itemDescriptionNode = await createPrefab(ITEM_DESCRIPTION_PANEL_PATH)
            if (!this._itemDescriptionNode?.isValid) {
                console.error('[StoragePanel] ItemDiscriptionPanel 加载失败')
                return null
            }
            this._itemDescriptionNode.parent = this.node
            this._itemDescriptionNode.active = false
        }
        return this._itemDescriptionNode.getComponent(ItemDiscriptionPanel)
            ?? this._itemDescriptionNode.addComponent(ItemDiscriptionPanel)
    }

    /** 懒加载羁绊物详情面板 */
    private async ensureBondItemDescriptionPanel(): Promise<BondItemDiscriptionPanel | null> {
        if (!this._bondDescriptionNode || !this._bondDescriptionNode.isValid) {
            this._bondDescriptionNode = await createPrefab(BOND_ITEM_DESCRIPTION_PANEL_PATH)
            if (!this._bondDescriptionNode?.isValid) {
                console.error('[StoragePanel] BondItemDiscriptionPanel 加载失败')
                return null
            }
            this._bondDescriptionNode.parent = this.node
            this._bondDescriptionNode.active = false
        }
        return this._bondDescriptionNode.getComponent(BondItemDiscriptionPanel)
            ?? this._bondDescriptionNode.addComponent(BondItemDiscriptionPanel)
    }

    //#endregion

    protected onLoad(): void {
        console.log("onLoad==============")
        if (this.nd_expand) {
            this.nd_expand.active = false
        }
        const pageNode = this.pg_content?.node
        if (pageNode?.isValid) {
            pageNode.on(PageView.EventType.PAGE_TURNING, this.onPageTurning, this)
        }
        DispatchEvent.ins.on(EventType.ItemNotiyChange, this.refreshView, this)
        DispatchEvent.ins.on(EventType.RefreshWarehouse, this.onWarehouseRefresh, this)
        DispatchEvent.ins.on(EventType.PendingBackpackSelect, this.onPendingBackpackSelect, this)
        DispatchEvent.ins.on(EventType.PendingWarehouseSelect, this.onPendingWarehouseSelect, this)
        DispatchEvent.ins.on(EventType.PendingBondSelect, this.onPendingBondSelect, this)
        DispatchEvent.ins.on(EventType.ExpandSuccess, this.onExpandSuccess, this)
        this.initBackpackArea()
        this.refreshBottomBoxState()
        void this.bootstrapPanel()
    }

    protected onEnable(): void {
        if (this._panelReady) {
            void this.refreshView()
        }
    }

    /** 打开面板：先同步共用容量，再刷新列表 */
    private async bootstrapPanel(): Promise<void> {
        await ItemManager.ins.syncWarehouseCapacityTotals()
        await this.refreshView()
        await this.showBackpackPanel()
        this._panelReady = true
    }

    /** 仓库数据变更：刷新列表与容量（购买入库等场景） */
    private onWarehouseRefresh(): void {
        void this.refreshView()
    }

    onDestroy(): void {
        const pageNode = this.pg_content?.node
        if (pageNode?.isValid) {
            pageNode.off(PageView.EventType.PAGE_TURNING, this.onPageTurning, this)
        }
        DispatchEvent.ins.off(EventType.ItemNotiyChange, this.refreshView, this)
        DispatchEvent.ins.off(EventType.RefreshWarehouse, this.onWarehouseRefresh, this)
        DispatchEvent.ins.off(EventType.PendingBackpackSelect, this.onPendingBackpackSelect, this)
        DispatchEvent.ins.off(EventType.PendingWarehouseSelect, this.onPendingWarehouseSelect, this)
        DispatchEvent.ins.off(EventType.PendingBondSelect, this.onPendingBondSelect, this)
        DispatchEvent.ins.off(EventType.ExpandSuccess, this.onExpandSuccess, this)
    }

    onClickTab(sender, data){
        if(this.pageIndex == Number(data)){
            this.nd_expand.active = true
            return
        }

        this.pageIndex =  Number(data)||1
        this._curPageIdx = 0
        console.log("111111111111111111111111111")
        this.pg_content?.scrollToPage(this._curPageIdx, 0)
        this.clearSelection()
        this.refreshBottomBoxState()
        this.updateCapacityView()
        this.refreshView()
    }
    onClickClose(){
        // UIManager.ins.hideView(this.node)
        UIManager.ins.remove(ViewPath.StoragePanel)
    }
    onClickArrow(){
        this.nd_expand.active = true
    }
    onRefreshTabBtn(){
        var leftBtnImg = this.pageIndex == 1?"topPageSelect":"topPageUnselect"
        var rightBtnImg = this.pageIndex == 2?"jbSelect":"jbUnselect"
        loadImg(this.sp_top_btn_1, Common.texturePath + "storage/" + leftBtnImg + "/spriteFrame")
        loadImg(this.sp_top_btn_2, Common.texturePath + "storage/" + rightBtnImg + "/spriteFrame")
    }
    onClickSub(sender, data){
        this.subIndex = Number(data) || WarehouseType.All
        this.nd_expand.active = false
        this.pageIndex = 1
        this._curPageIdx = 0
        console.log("2222222222222222222222222")
        this.pg_content.scrollToPage(this._curPageIdx,0)
        switch (this.subIndex) {
            case WarehouseType.All:
                this.lb_btn_des.string = "全部道具"
                break;
            case WarehouseType.Food:
                this.lb_btn_des.string = "食物"
                break;
            case WarehouseType.Clean:
                this.lb_btn_des.string = "清洁"
                break;
            case WarehouseType.Toy:
                this.lb_btn_des.string = "玩具"
                break;
            case WarehouseType.Other:
                this.lb_btn_des.string = "其他"
                break;
            default:
                    break;
        }
        this.clearSelection()
        this.refreshBottomBoxState()
        this.refreshView()
    }

    /**
     * 根据当前标签页切换底部操作栏
     * pageIndex=1 仓库页：显示 nd_ware_house，隐藏 nd_bond_page
     * pageIndex=2 羁绊物页：显示 nd_bond_page，隐藏 nd_ware_house
     */
    private refreshBottomBoxState(): void {
        this.ensureBottomBoxRefs()
        const isWarehouse = this.pageIndex === 1
        if (this.nd_ware_house) {
            this.nd_ware_house.active = isWarehouse
        }
        if (this.nd_bond_page) {
            this.nd_bond_page.active = !isWarehouse
        }
    }

    /** 自动查找 nd_boxBottom 下的底部操作栏节点 */
    private ensureBottomBoxRefs(): void {
        const boxBottom = this.node.getChildByName('nd_bg2')?.getChildByName('nd_boxBottom')
        if (!this.nd_ware_house) {
            this.nd_ware_house = boxBottom?.getChildByName('nd_ware_house') ?? null
        }
        if (!this.nd_bond_page) {
            this.nd_bond_page = boxBottom?.getChildByName('nd_bond_page') ?? null
        }
    }

    async onClickNext(): Promise<void> {
        console.log("onClickNext")
        this._curPageIdx++
        this.pg_content.scrollToPage(this._curPageIdx, 0)
    }

    async onClickBefore(): Promise<void> {
        console.log("onClickBefore")
        if (this._curPageIdx <= 0) return
        this._curPageIdx--
        this.pg_content.scrollToPage(this._curPageIdx, 0)
    }

    /** 翻页事件（由滑动/按钮触发的PageView翻页事件进入） */
    private onPageTurning(sender: PageView, event: string): void {
        console.log("onPageTurning", event, sender, this.pg_content.curPageIdx)
        const curPage = this.pg_content.curPageIdx
        this._curPageIdx = curPage
        // 程序化滚动（syncPageViewCount触发）不重复渲染，避免递归
        if (this._isProgrammaticScroll) {
            this._isProgrammaticScroll = false
            return
        }
        if (this._curPageIdx >= this.getTotalPage()) {
            return
        }
        this.renderCurrentPage()
    }




    private getCurrentDataList(): Item[] {
        if (this.pageIndex === 2) {
            return DataManager.ins.getBondItems()
        }
        return DataManager.ins.getWarehouse(this.subIndex)
    }
    getTotalPage(){
        if (this.total <= 0) {
            return 0
        }
        return Math.ceil(this.total / ItemManager.ins.PAGE_SIZE)
    }

    /** 确保数据已加载到内存，没有则请求全量数据（仅请求一次，子分区为空不重复拉） */
    private async ensureDataLoaded(): Promise<void> {
        if (this.pageIndex === 2) {
            if (this._bondFetched) {
                return
            }
            await ItemManager.ins.fetchAllBondItems()
            this._bondFetched = true
            return
        }
        if (this._warehouseFetched) {
            return
        }
        await ItemManager.ins.fetchAllWarehouse()
        this._warehouseFetched = true
    }

    /** 从本地数据切片渲染当前页 */
    private async renderCurrentPage(): Promise<void> {
        const data = this.getCurrentDataList()
        const filteredList = data.sort((a,b)=>b.created_at - a.created_at  )
        this.total = filteredList.length
        const totalPage = this.getTotalPage()
        this.syncPageViewCount(totalPage)

        const pageSize = ItemManager.ins.PAGE_SIZE
        const startIdx = this._curPageIdx * pageSize
        const pageItems = filteredList.slice(startIdx, startIdx + pageSize)

        this.renderView(pageItems)
        this.refreshTotal()
        if (this._backpackNode) {
            const panle = this._backpackNode.getComponent(BackpackPanel)
            await panle.synData()
            this.updateBackpackCapacityView()
        }
    }

    /** 同步 PageView 页数，避免切换分类后仍显示旧页码指示点 */
    private syncPageViewCount(totalPage: number): void {
        while (this._pageNodes.length > totalPage) {
            const page = this._pageNodes.pop()
            if (page?.isValid && this.pg_content) {
                this.pg_content.removePage(page)
            }
        }

        if (totalPage <= 0) {
            console.log("totalPage===============1")
            this._curPageIdx = 0
            return
        }

        if (this._curPageIdx >= totalPage) {
            this._curPageIdx = totalPage - 1
            this._isProgrammaticScroll = true
            this.pg_content?.scrollToPage(this._curPageIdx, 0)
        }
    }

    // ========== Page 管理（创建后不销毁，只控制 active） ==========

    /** 确保有足够数量的 page 节点，返回第 index 个 page */
    private ensurePage(index: number): Node | null {
        const totalPage = this.getTotalPage()
        if (totalPage <= 0) {
            return null
        }

        if (this._pageNodes.length < totalPage) {
            for (let i = this._pageNodes.length; i < totalPage; i++) {
                const pageModel = this.pg_content.node.getChildByName("page_instance")
                if (!pageModel) return null
                const page = instantiate(pageModel)
                page.parent = this.pg_content.content
                page.active = true
                this._pageNodes.push(page)
                this.pg_content.addPage(page)
            }
        }

        if (!this._pageNodes[index]) {
            return null
        }
        this._pageNodes[index].active = true
        return this._pageNodes[index]
    }

    /** 更新指定 page 的 cell 数据，cell 不销毁只更新数据或隐藏 */
    private async updatePageCells(pageNode: Node, data: Item[]): Promise<void> {
        console.log("updatePageCells", data)
        const pageSize = ItemManager.ins.PAGE_SIZE
        // 确保 cell 数量足够（不够时创建，足够了不销毁）
        await this.ensureCells(pageNode, pageSize)
        const cells = pageNode.children
        for (let i = 0; i < pageSize; i++) {
            const cell = cells[i]
            if (!cell) continue
            const item = data[i]
            if (item) {
                cell.active = true
                const comp = cell.getComponent(StorageSlot)
                if (comp && comp.isValid) {
                    this.bindStorageSlot(comp)
                    comp.loadData(item)
                    comp.setSelected(this.isItemSelected(item.id))
                }
            } else {
                console.log("item is null")
                cell.active = false
            }
        }
    }

    /** 确保 page 下有足够数量的 cell（不够则创建，多余的不管） */
    private async ensureCells(pageNode: Node, count: number): Promise<void> {
        const existing = pageNode.children.length
        for (let i = existing; i < count; i++) {
            await this.createCell(pageNode)
        }
    }

    /** 异步创建一个 cell 并添加到 page */
    private async createCell(pageNode: Node): Promise<void> {
        const pb = await createPrefab(Common.prefabPath + "storage/StorageSlot")
        if (!pb || !pb.isValid) return
        pb.active = false
        if (pageNode && pageNode.isValid) {
            pb.parent = pageNode
            const comp = pb.getComponent(StorageSlot)
            if (comp) {
                this.bindStorageSlot(comp)
            }
        }
    }
    // ========== 核心渲染 ==========

    private async refreshView(): Promise<void> {
        console.log("refreshView")
        this.onRefreshTabBtn()
        await this.ensureDataLoaded()
        await this.renderCurrentPage()
    }

    refreshTotal() {
        var totalPage = Math.ceil(this.total / ItemManager.ins.PAGE_SIZE)
        console.log("totalpage", totalPage)
        if (this.btn_next) {
            this.btn_next.active = this._curPageIdx < (totalPage - 1) && totalPage > 1
        }
        if (this.btn_pre) {
            this.btn_pre.active = this._curPageIdx > 0 && totalPage > 1
        }
    }

    /**
     * 根据数据渲染：cell 只更新数据和控制 active，不销毁
     */
    private async renderView(data: Item[]): Promise<void> {
        if (!data || data.length === 0) {
            // 不在此处调用syncPageViewCount(0)，页面总数同步已在renderCurrentPage中完成
            this.pg_content && this.pg_content.node && (this.pg_content.node.active = false)
            if (this.nd_empty) this.nd_empty.active = true
            this.updateCapacityView()
            return
        }
        if (this.nd_empty) this.nd_empty.active = false
        this.pg_content && this.pg_content.node && (this.pg_content.node.active = true)
        console.log("this._curPageIdx", this._curPageIdx)
        const pageNode = this.ensurePage(this._curPageIdx)

        await this.updatePageCells(pageNode, data)
        this.updateCapacityView()
        await this.applyPendingWarehouseSelect(data)
        await this.applyPendingBondSelect(data)
    }



    // ========== 容量显示与扩容 ==========

    /** 扩容成功回调，刷新容量显示 */
    private onExpandSuccess(): void {
        this.updateCapacityView();
        this.updateBackpackCapacityView();
    }

    private updateCapacityView(): void {
        this.ensureCapacityRefs()
        if (this.pageIndex !== 1) {
            if (this.lb_value) {
                this.lb_value.string = ""
                this.lb_value.node.active = false
            }
            if (this.nd_add) {
                this.nd_add.active = false
            }
            return
        }
        const stock = DataManager.ins.getWarehouseStock(this.subIndex)
        const capacity = DataManager.ins.getWarehouseCapacity()
        console.log("stock====",stock, "capcity", capacity)
        if (this.lb_value) {
            this.lb_value.string = capacity > 0 ? `${stock}/${capacity}` : `${stock}`
            this.lb_value.color = stock > capacity ? new Color(245, 28, 28) : new Color(0, 0, 0)
            this.lb_value.node.active = true
        }
        if (this.nd_add) {
            this.nd_add.active = true
        }
    }

    /** 自动绑定「可收纳数」容量区域（Prefab 引用丢失时兜底） */
    private ensureCapacityRefs(): void {
        const addRoot = this.findNodeByName(this.node, 'nd_add')
        if (!addRoot) {
            return
        }
        if (!this.lb_value) {
            this.lb_value = addRoot.getChildByName('lb_value')?.getComponent(Label) ?? null
        }
        if (!this.nd_add) {
            this.nd_add = addRoot
        }
    }

    /** 按节点名深度查找子节点 */
    private findNodeByName(root: Node, name: string): Node | null {
        if (!root?.isValid) {
            return null
        }
        if (root.name === name) {
            return root
        }
        for (const child of root.children) {
            const found = this.findNodeByName(child, name)
            if (found) {
                return found
            }
        }
        return null
    }


    async onClickExpand(): Promise<void> {
        var pn = await UIManager.ins.show(ViewPath.SalePanel)
        var comp = pn.getComponent(SalePanel)
       
        if (this.pageIndex !== 1 && this.pageIndex !== 2) return
        var wareouseCapacity = DataManager.ins.getWarehouseCapacity()
        if(wareouseCapacity >= 200){
            comp.showExpandFull()
            return
        }
        comp.showExpanAdd()               
    }

    /** 打开商店面板 */
    onClickShop(): void {
        UIManager.ins.show(ViewPath.ShopPanel);
    }

    // ========== 外出背包面板 ==========

    /**
     * 点击底部背包按钮：在黄圈区域展开/收起背包面板
     */
    onClickBackpack(): void {
        // if (this._backpackVisible) {
        //     this.hideBackpackPanel()
        //     return
        // }
        // void this.showBackpackPanel()
    }

    /** 初始化背包按钮与容量显示 */
    private initBackpackArea(): void {
        if (!this.btn_backpack) {
            this.btn_backpack = this.node.getChildByName('nd_storageBottom')
                ?.getChildByName('btn_backpacl') ?? null
        }
        if (!this.lb_backpack_value) {
            this.lb_backpack_value = this.node.getChildByName('nd_rightBottom')
                ?.getChildByName('nd_textBg')
                ?.getChildByName('lb_value')
                ?.getComponent(Label) ?? null
        }
        this.bindBackpackButton()
        this.updateBackpackCapacityView()
        ItemManager.ins.requestBackpack()
    }

    /** 绑定底部背包按钮点击 */
    private bindBackpackButton(): void {
        if (!this.btn_backpack) {
            console.warn('[StoragePanel] 未找到 btn_backpacl，无法打开背包面板')
            return
        }
        const btn = this.btn_backpack.getComponent(Button)
        if (btn) {
            btn.node.on(Button.EventType.CLICK, this.onClickBackpack, this)
        } else {
            this.btn_backpack.on(Node.EventType.TOUCH_END, this.onClickBackpack, this)
        }
    }

    /** 注销背包按钮事件 */
    private unbindBackpackButton(): void {
        if (!this.btn_backpack?.isValid) {
            return
        }
        const btn = this.btn_backpack.getComponent(Button)
        const btnNode = btn?.node
        if (btnNode?.isValid) {
            btnNode.off(Button.EventType.CLICK, this.onClickBackpack, this)
            return
        }
        this.btn_backpack.off(Node.EventType.TOUCH_END, this.onClickBackpack, this)
    }

    /** 仓库/羁绊物道具移入背包后，标记背包内待选中项 */
    private onPendingBackpackSelect(itemId: number): void {
        if (itemId >= 0 && (this.pageIndex === 1 || this.pageIndex === 2)) {
            this.clearSelection()
        }
        this._backpackNode?.getComponent(BackpackPanel)?.setPendingSelectItemId(itemId)
    }

    /** 背包道具移入仓库后，标记仓库内待选中项 */
    private onPendingWarehouseSelect(itemId: number): void {
        this._pendingWarehouseSelectId = itemId
        if (itemId >= 0) {
            this._backpackNode?.getComponent(BackpackPanel)?.clearSelection()
        }
    }

    /** 背包羁绊物移入羁绊栏后，标记羁绊页待选中项并切换到羁绊页签 */
    private onPendingBondSelect(itemId: number): void {
        this._pendingBondSelectId = itemId
        if (itemId >= 0) {
            this._backpackNode?.getComponent(BackpackPanel)?.clearSelection()
            if (this.pageIndex !== 2) {
                this.pageIndex = 2
                this._curPageIdx = 0
                console.log(444444444444444444444444444)
                this.pg_content?.scrollToPage(0, 0)
                this.clearSelection()
                this.refreshBottomBoxState()
                this.onRefreshTabBtn()
            }
        }
    }

    /**
     * 刷新完成后选中刚移入仓库的道具
     * @param pageItems 当前页道具列表
     */
    private async applyPendingWarehouseSelect(pageItems: Item[]): Promise<void> {
        const pendingId = this._pendingWarehouseSelectId
        if (pendingId === -1 || this.pageIndex !== 1) {
            return
        }

        const itemOnPage = pageItems?.find((item) => item.id === pendingId)
        if (itemOnPage) {
            this._pendingWarehouseSelectId = -1
            this.selectSingle(itemOnPage)
            this.refreshDescriptionPanel()
            return
        }

        const item = ItemManager.ins.getItemById(pendingId)
        if (!item) {
            this._pendingWarehouseSelectId = -1
            return
        }

        const list = DataManager.ins.getWarehouse(this.subIndex)
        const listIndex = list.findIndex((entry) => entry.id === pendingId)
        if (listIndex < 0) {
            return
        }

        const targetPage = Math.floor(listIndex / ItemManager.ins.PAGE_SIZE)
        if (targetPage !== this._curPageIdx) {
            this._curPageIdx = targetPage
            console.log(555555555555555555555)
            this.pg_content?.scrollToPage(this._curPageIdx, 0)
            return
        }

        this._pendingWarehouseSelectId = -1
        this.selectSingle(item)
        this.refreshDescriptionPanel()
    }

    /**
     * 刷新完成后选中刚移入羁绊栏的羁绊物
     * @param pageItems 当前页羁绊物列表
     */
    private async applyPendingBondSelect(pageItems: Item[]): Promise<void> {
        const pendingId = this._pendingBondSelectId
        if (pendingId < 0 || this.pageIndex !== 2) {
            return
        }

        const itemOnPage = pageItems?.find((item) => item.id === pendingId)
        if (itemOnPage) {
            this._pendingBondSelectId = -1
            this.selectSingle(itemOnPage)
            this.refreshDescriptionPanel()
            return
        }

        const item = ItemManager.ins.getItemById(pendingId)
        if (!item) {
            this._pendingBondSelectId = -1
            return
        }

        const list = DataManager.ins.getBondItems()
        const listIndex = list.findIndex((entry) => entry.id === pendingId)
        if (listIndex < 0) {
            return
        }

        const targetPage = Math.floor(listIndex / ItemManager.ins.PAGE_SIZE)
        if (targetPage !== this._curPageIdx) {
            this._curPageIdx = targetPage
            console.log(6666666666666666)
            this.pg_content?.scrollToPage(this._curPageIdx, 0)
            return
        }

        this._pendingBondSelectId = -1
        this.selectSingle(item)
        this.refreshDescriptionPanel()
    }

    /** 实例化并显示背包面板（位置由 BackpackPanel Prefab 上的 Widget 控制） */
    private async showBackpackPanel(): Promise<void> {
        if (!this._backpackNode || !this._backpackNode.isValid) {
            this._backpackNode = await createPrefab(BACKPACK_PANEL_PATH)
            if (!this._backpackNode?.isValid) {
                console.error('[StoragePanel] BackpackPanel 加载失败')
                return
            }
            this._backpackNode.parent = this.node
            this._backpackNode.active = false
            this._backpackNode.getComponent(BackpackPanel)
                ?.setSelectionChangeHandler(this.onBackpackItemSelectedBound)
        }
        this._backpackNode.active = true
        this._backpackVisible = true
        this.updateBackpackCapacityView()
    }

    /** 刷新右下角「外出背包 x/y」容量显示 */
    private updateBackpackCapacityView(): void {
        console.log("updateBackpackCapacityView")
        if (!this.lb_backpack_value) {
            return
        }
        const stock = DataManager.ins.getBackpackStock()
        const capacity = DataManager.ins.getBackpackCapacity()
        console.log("stock capcity", stock, capacity)
        if (capacity <= 0) {
            this.lb_backpack_value.string = `${stock}`
            return
        }
        this.lb_backpack_value.string = `${stock}/${capacity}`
    }

}