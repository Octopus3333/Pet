import { _decorator, Component, Node, Sprite, SpriteFrame } from 'cc';
import { ViewPath, Common, EventType } from '../utils/Define';
import { UIManager } from '../utils/UIManager';
import { ResLoader } from '../download/ResLoader';
import { Item } from '../utils/InterfaceDefine';
import { ItemManager } from '../../item/ItemManager';
import { SocketManager } from '../network/SocketManager';
import { BackpackSlot } from './BackpackSlot';
import { DispatchEvent } from '../utils/DispatchEvent';
import { DataManager } from '../../Data/DataManager';

const { ccclass, property } = _decorator;
/** 背包面板背景图 resources 路径 */
const BACKPACK_BG_PATH = Common.texturePath + 'storage/backpackBg/spriteFrame';

/** 单个背包格子 UI 数据（锁定状态为客户端展示逻辑） */
export interface BackpackSlotData {
    locked: boolean;
    item?: Item | null;
}

/** 背包选中变化回调：item 为 null 表示取消选中 */
export type BackpackSelectionChangeHandler = (item: Item | null) => void;



/**
 * 背包面板
 * 管理 8 个格子的锁定/选中/道具展示，数据来源于 ItemManager
 */
@ccclass('BackpackPanel')
export class BackpackPanel extends Component {
    @property(Node)
    nd_body: Node = null;

    @property(Sprite)
    sp_bg: Sprite = null;

    private _slots: BackpackSlot[] = [];
    private _selectedIndex: number = -1;
    /** 移入背包后待选中的道具 id，刷新完成后自动选中 */
    private _pendingSelectItemId = -1;
    /** 选中变化回调（由 StoragePanel 注册） */
    private _selectionChangeHandler: BackpackSelectionChangeHandler = null;
    /** 格子是否已完成 initSlots */
    private _slotsReady = false;

    /** 默认前 4 格解锁，后 4 格锁定 */
    private static readonly DEFAULT_UNLOCK_COUNT = 4;


    protected async onLoad(): Promise<void> {
        this.initBackground();
        await this.tryRequestBackpack();
        this.scheduleOnce(() => this.initSlots(), 0);
    }

    protected onEnable(): void {
        ItemManager.ins.onRefresh('backpack', this.onBackpackDataRefresh, this);
        // 重新显示时主动刷新数据，避免隐藏期间数据变化导致UI滞后
        if (this._slotsReady) {
            this.syncFromItemManager();
        }
    }
    onExpandSuccess(event, expandType){
        if( expandType != 2){
            return
        }
        this.syncFromItemManager()
    }
    protected onDisable(): void {
        ItemManager.ins.offRefresh('backpack', this.onBackpackDataRefresh, this);
        DispatchEvent.ins.off(EventType.ExpandSuccess, this.onExpandSuccess, this)
    }

    /**
     * 刷新整个背包格子数据
     * @param slots 格子数据数组，长度不足时剩余格按锁定处理
     */
    public refreshBackpack(slots: BackpackSlotData[]): void {
        const prevSelectedId = this._selectedIndex >= 0
            ? this.getSlotItem(this._selectedIndex)?.id ?? -1
            : -1;

        for (let i = 0; i < this._slots.length; i++) {
            const data = slots[i] ?? { locked: true, item: null };
            this.applySlotData(i, data);
        }

        const pendingId = this._pendingSelectItemId;
        if (pendingId >= 0) {
            this._pendingSelectItemId = -1;
            if (!this.selectItemById(pendingId)) {
                this.selectSlot(-1);
            }
            return;
        }

        if (prevSelectedId >= 0 && this.selectItemById(prevSelectedId)) {
            return;
        }

        this.selectSlot(-1);
    }

    /**
     * 从 Item 列表刷新背包（按格子索引映射）
     * @param items 服务端背包道具列表
     * @param unlockCount 解锁格子数量，默认 4
     */
    public refreshFromItems(items: Item[], unlockCount: number = BackpackPanel.DEFAULT_UNLOCK_COUNT): void {
        this.refreshBackpack(this.buildSlotDataFromItems(items, unlockCount));
    }

    /**
     * 更新单个格子数据
     * @param index 格子索引（0 起）
     * @param data 格子数据
     */

    public updateSlot(index: number, data: BackpackSlotData): void {
        if (!this.isValidIndex(index)) {
            return;
        }

        this.applySlotData(index, data);
        if (this._selectedIndex === index && data.locked) {
            this.selectSlot(-1);
        }

    }

    /**
     * 向背包放入道具，自动寻找第一个可用空格（仅更新 UI，不写回 ItemManager）
     * @param item 道具数据
     * @returns 是否放入成功
     */
    public addItem(item: Item): boolean {
        const emptyIndex = this.findFirstEmptySlot();
        if (emptyIndex < 0) {
            return false;
        }
        return this.putItem(emptyIndex, item);
    }

    /**
     * 向指定格子放入道具（仅更新 UI，不写回 ItemManager）
     * @param index 格子索引
     * @param item 道具数据
     * @returns 是否放入成功（锁定格或已有道具时失败）
     */
    public putItem(index: number, item: Item): boolean {
        if (!this.isValidIndex(index)) {
            return false;
        }

        const slot = this._slots[index];
        if (slot.isLocked() || !slot.isEmpty()) {
            return false;
        }

        slot.setItem(item);
        return true;
    }

    /**
     * 清空指定格子道具（仅更新 UI，不写回 ItemManager）
     * @param index 格子索引
     */
    public clearItem(index: number): void {
        if (!this.isValidIndex(index)) {
            return;
        }
        this._slots[index].setItem(null);
    }

    /** 获取当前选中的格子索引，未选中返回 -1 */
    public getSelectedIndex(): number {
        return this._selectedIndex;
    }

    /**
     * 注册选中变化回调
     * @param handler 选中/取消选中时触发
     */
    public setSelectionChangeHandler(handler: BackpackSelectionChangeHandler): void {
        this._selectionChangeHandler = handler;
    }

    /** 清空选中状态 */
    public clearSelection(): void {
        this.selectSlot(-1);
    }

    /**
     * 标记移入背包后需要选中的道具
     * @param itemId 道具唯一 id，传 -1 表示取消
     */
    public setPendingSelectItemId(itemId: number): void {
        this._pendingSelectItemId = itemId;
    }

    /**
     * 按道具 id 选中对应格子
     * @param itemId 道具唯一 id
     * @returns 是否选中成功
     */
    public selectItemById(itemId: number): boolean {
        if (itemId < 0) {
            return false;
        }
        for (let i = 0; i < this._slots.length; i++) {
            const item = this._slots[i].getItem();
            if (item?.id === itemId) {
                this.selectSlot(i);
                return true;
            }
        }
        return false;
    }

    /**
     * 获取指定格子的道具数据
     * @param index 格子索引
     */
    public getSlotItem(index: number): Item | null {
        if (!this.isValidIndex(index)) {
            return null;
        }
        return this._slots[index].getItem();
    }

    /** 关闭背包面板 */
    public onClickClose(): void {
        UIManager.ins.hideView(this.node);
    }

    /** ItemManager 数据刷新回调 */
    private onBackpackDataRefresh(): void {
        this.syncFromItemManager();
    }

    /** Socket 已连接时才向服务端请求背包 */
    private async tryRequestBackpack(): Promise<void> {
        if (!SocketManager.instance.isConnected) {
            return;
        }
        await ItemManager.ins.requestBackpack();
    }

    /** 从 ItemManager 读取背包并刷新 UI */
    private syncFromItemManager(): void {
        const capacity = DataManager.ins.getBackpackCapacity();
        const unlockCount = capacity > 0 ? capacity : BackpackPanel.DEFAULT_UNLOCK_COUNT;
        this.refreshFromItems(ItemManager.ins.getBackpack(), unlockCount);
    }

    /** 将 Item 列表映射为格子 UI 数据 */
    private buildSlotDataFromItems(items: Item[], unlockCount: number): BackpackSlotData[] {
        return this._slots.map((_, index) => ({
            locked: index >= unlockCount,
            item: index >= unlockCount ? null : (items[index] ?? null),
        }));
    }

    /** 运行时加载背景图，避免 Prefab 动态实例化后 SpriteFrame 引用丢失 */
    private async initBackground(): Promise<void> {
        const ndBg = this.node.getChildByName('nd_bg');
        const sp = this.sp_bg ?? ndBg?.getComponent(Sprite);
        if (!sp) {
            console.warn('[BackpackPanel] 未找到背景 Sprite 组件');
            return;
        }
        try {
            const spf = await ResLoader.ins.loadResAsync(BACKPACK_BG_PATH, SpriteFrame);
            if (sp.isValid && spf) {
                sp.spriteFrame = spf;
            }
        } catch (error) {
            console.error('[BackpackPanel] 背景图加载失败:', BACKPACK_BG_PATH, error);
        }
    }


    async synData(){
        await this.tryRequestBackpack();
        this.syncFromItemManager()
    }
    private initSlots(): void {
        const body = this.nd_body ?? this.node.getChildByName('nd_bg')?.getChildByName('nd_body');
        if (!body) {
            console.error('[BackpackPanel] 未找到 nd_body 节点');
            return;
        }

        this._slots = [];
        const children = body.children.slice().sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        children.forEach((child, index) => {
            let slot = child.getComponent(BackpackSlot);
            if (!slot) {
                slot = child.addComponent(BackpackSlot);
            }
            slot.init(index, this.onSlotClick.bind(this));
            this._slots.push(slot);
        });
        this._slotsReady = true;
        this.syncFromItemManager()
    }

    private applySlotData(index: number, data: BackpackSlotData): void {
        const slot = this._slots[index];
        slot.setSlotData(data.locked, data.locked ? null : (data.item ?? null));
    }

    private onSlotClick(index: number): void {
        if (!this.isValidIndex(index)) {
            return;
        }
        const slot = this._slots[index];
        if (slot.isLocked() || slot.isEmpty()) {
            return;
        }
        if (this._selectedIndex === index) {
            this.selectSlot(-1);
            return;
        }
        this.selectSlot(index);
    }

    private selectSlot(index: number): void {
        if (this._selectedIndex >= 0 && this._selectedIndex < this._slots.length) {
            this._slots[this._selectedIndex].setSelected(false);
        }

        this._selectedIndex = index;

        if (this._selectedIndex >= 0 && this._selectedIndex < this._slots.length) {
            this._slots[this._selectedIndex].setSelected(true);
        }

        this.notifySelectionChanged();
    }

    /** 通知外部选中状态变化 */
    private notifySelectionChanged(): void {
        const item = this._selectedIndex >= 0 ? this.getSlotItem(this._selectedIndex) : null;
        this._selectionChangeHandler?.(item);
    }

    private findFirstEmptySlot(): number {
        for (let i = 0; i < this._slots.length; i++) {
            if (this._slots[i].isEmpty()) {
                return i;
            }
        }
        return -1;
    }


    private isValidIndex(index: number): boolean {
        return index >= 0 && index < this._slots.length;
    }

}