import { SocketManager, SocketMSgId } from '../common/network/SocketManager';
import { ToastManager } from '../common/utils/ToastManager';
import { WaitingManager } from '../common/utils/WaitingManager';
import { DataManager } from '../Data/DataManager';
import { DispatchEvent } from '../common/utils/DispatchEvent';
import { EventType, ItemChangeType, ItemPosition, WarehouseType } from '../common/utils/Define';
import {
    Item,
    ItemChange,
    ItemChangeNotify,
    ServerItem,
    ItemConfig,
    WarehouseInfoReq,
    WarehouseInfoResp,
    WarehouseExpandReq,
    WarehouseExpandResp,
    BondInfoReq,
    BondInfoResp,
    BackpackInfoReq,
    BackpackInfoResp,
    BackpackExpandResp,
    ItemMoveReq,
    ItemMoveResp,
    SellToShopDogReq,
    SellToShopDogResp,
} from '../common/utils/InterfaceDefine';
import { ItemConfigManager } from './ItemConfigManager';

/**
 * 道具请求结果
 */
export interface ItemRequestResult {
    list: Item[];
    page: number;
    page_size: number;
    total: number;
    has_more: boolean;
}

/**
 * 道具管理器（单例）
 * 负责背包、羁绊物、仓库三个列表的数据请求、服务器同步与增删改查。
 */
export class ItemManager {
    private static _ins: ItemManager = null!;

    static get ins(): ItemManager {
        if (!ItemManager._ins) {
            ItemManager._ins = new ItemManager();
        }
        return ItemManager._ins;
    }

    /** 每页数量 */
    readonly PAGE_SIZE: number = 12;

    // ========== 分页请求状态 ==========
    private _warehouseLoadedPage: number = 0;
    private _warehouseHasMore: boolean = false;
    private _bondLoadedPage: number = 0;
    private _bondHasMore: boolean = false;

    /** 仓库已加载页数 */
    getWarehouseLoadedPage(): number { return this._warehouseLoadedPage; }
    /** 仓库是否还有更多 */
    getWarehouseHasMore(): boolean { return this._warehouseHasMore; }
    /** 羁绊物已加载页数 */
    getBondLoadedPage(): number { return this._bondLoadedPage; }
    /** 羁绊物是否还有更多 */
    getBondHasMore(): boolean { return this._bondHasMore; }

    private constructor() {
        this.registerSocketEvents();
    }

    destroy(): void {
        this.unregisterSocketEvents();
    }
    clear(){
        // 清空内存缓存的道具数据
        DataManager.ins.clearAllItems();
        // 重置分页状态
        this._warehouseLoadedPage = 0;
        this._warehouseHasMore = false;
        this._bondLoadedPage = 0;
        this._bondHasMore = false;
    }

    // ========== Promise 封装 ==========

    /** 将 sendDataWithCallback 封装为 Promise，统一错误处理 */
    private _sendAsync<T = any>(msgType: string, data: unknown, responseType?: string, timeoutMs?: number): Promise<T> {
        return new Promise((resolve, reject) => {
            SocketManager.instance.sendDataWithCallback(
                msgType,
                data,
                (res: any, error?: string) => {
                    if (error) {
                        reject(new Error(error));
                    } else {
                        resolve(res as T);
                    }
                },
                responseType || msgType,
                timeoutMs
            );
        });
    }

    // ========== 服务器数据与本地配置合并 ==========

    private _mergeItem(serverItem: ServerItem): Item {
        const cfg: ItemConfig | null = ItemConfigManager.ins.getConfig(serverItem.item_id);
        const remainCount = serverItem.remain_count ?? 0;
        return {
            id: serverItem.id ?? 0,
            item_id: serverItem.item_id ?? 0,
            remain_count: remainCount,
            num: remainCount,
            name: cfg?.name ?? '',
            type: cfg?.type ?? 0,
            des: cfg?.des ?? '',
            can_send: cfg?.can_send ?? false,
            sale_pink: cfg?.sale_pink ?? 0,
            sale_type: cfg?.sale_type ?? 0,
            recycle_pink: cfg?.recycle_pink ?? 0,
            can_sale: cfg?.can_sale ?? false,
            use_des: cfg?.use_condition ?? '',
            total_use_count: cfg?.total_use_count ?? 0,
            intimacy: cfg?.intimacy ?? 0,
            clean: cfg?.clean ?? 0,
            pink: cfg?.pink ?? 0,
            energy: cfg?.energy ?? 0,
            animal_limit:cfg?.animal_limit ??[],
            created_at:serverItem.created_at
        };
    }

    private _mergeItems(serverItems: ServerItem[]): Item[] {
        return (serverItems || []).map(s => this._mergeItem(s));
    }

    // ========== Socket 监听 ==========

    private registerSocketEvents(): void {
        SocketManager.instance.on(SocketMSgId.ItemChangeNotify, this.onItemChangeNotify.bind(this));
    }

    private unregisterSocketEvents(): void {
        SocketManager.instance.off(SocketMSgId.ItemChangeNotify, this.onItemChangeNotify.bind(this));
    }

    /**
     * 服务器道具变更通知
     * 根据 change_type 在三个列表中增/减/改，做好容错
     */
    private onItemChangeNotify(event: string, data: ItemChangeNotify): void {
        console.log('[ItemManager] ItemChangeNotify:', data);
        if (!data || !data.changes || !Array.isArray(data.changes)) return;

        for (const change of data.changes) {
            if (!change || change.change_type == null) continue;

            try {
                switch (change.change_type) {
                    case ItemChangeType.Add: {
                        this._handleItemAdd(change);
                        break;
                    }
                    case ItemChangeType.Decrease: {
                        this._handleItemDecrease(change);
                        break;
                    }
                    case ItemChangeType.Remove: {
                        this._handleItemRemove(change);
                        break;
                    }
                    default:
                        console.warn('[ItemManager] 未知的 change_type:', change.change_type);
                }
            } catch (err) {
                console.error('[ItemManager] 处理 ItemChange 失败:', change, err);
            }
        }
        DispatchEvent.ins.emit(EventType.ItemNotiyChange,data)
    }

    /** 新增道具：在所有列表中查找，存在则更新并迁移列表，否则按 position 加入 */
    private _handleItemAdd(change: ItemChange): void {
        const targetList = this._getListByPosition(change.position);
        const existing = DataManager.ins.findItemById(change.id);

        if (existing) {
            DataManager.ins.updateItem(change.id, {
                remain_count: change.remain_count ?? 0,
                num: change.remain_count ?? 0,
            });
            DataManager.ins.moveItemToList(change.id, targetList);
            return;
        }

        const item = this._mergeItem({
            id: change.id ?? 0,
            item_id: change.item_id ?? 0,
            remain_count: change.remain_count ?? 0,
            created_at:change.created_at
        });
        item.num = change.remain_count ?? 0;
        DataManager.ins.addItem(item, targetList);
    }

    /** 根据 position 获取对应的道具列表 */
    private _getListByPosition(position?: number): Item[] {
        switch (position) {
            case ItemPosition.Warehouse:
                return DataManager.ins._getWareHouse();
            case ItemPosition.Bond:
                return DataManager.ins._getBoneItems();
            case ItemPosition.Backpack:
            default:
                return DataManager.ins._getBackPack();
        }
    }

    /** 次数减少：在所有列表中查找并更新 */
    private _handleItemDecrease(change: ItemChange): void {
        if (!change.id) return;
        const updated = DataManager.ins.updateItem(change.id, {
            remain_count: change.remain_count ?? 0,
            num: change.remain_count ?? 0,
        });
        if (!updated) {
            console.warn('[ItemManager] Decrease 未找到道具 id:', change.id);
        }
    }

    /** 移除道具：在所有列表中查找并删除 */
    private _handleItemRemove(change: ItemChange): void {
        if (!change.id) return;
        const removed = DataManager.ins.removeItem(change.id);
        if (!removed) {
            console.warn('[ItemManager] Remove 未找到道具 id:', change.id);
        }
    }

    // ========== 数据请求（async/await） ==========

    /** 请求背包数据（无分页，整体覆盖） */
    async requestBackpack(): Promise<Item[]> {
        WaitingManager.ins.show(true);
        try {
            const res = await this._sendAsync<BackpackInfoResp>(SocketMSgId.BackpackInfo, {});
            if (res.code !== 0) {
                ToastManager.ins.showToast(res.msg || '请求背包失败');
                return [];
            }
            DataManager.ins.updateBackpackCapacity(
                res.backpack_stock ?? 0,
                res.backpack_capacity ?? 0,
                res.backpack_expand_pink ?? 0
            );
            const items = this._mergeItems(res.items || []);
            DataManager.ins.updateBackpack(items);
            return items;
        } catch (err) {
            console.error('[ItemManager] requestBackpack 失败:', err);
            return [];
        } finally {
            WaitingManager.ins.hide();
        }
    }

    /** 请求羁绊物数据（分页） */
    async requestBondItems(page: number, pageSize: number, hideMask: boolean = false): Promise<BondInfoResp | void> {
        const req: BondInfoReq = { page, page_size: pageSize };
        await WaitingManager.ins.show(hideMask);
        try {
            const res = await this._sendAsync<BondInfoResp>(SocketMSgId.BondInfo, req);
            if (res.code !== 0) {
                ToastManager.ins.showToast(res.msg || '请求羁绊物失败');
                return;
            }
            DataManager.ins.updateWarehouseBondTotal(res.total ?? 0);
            DataManager.ins.updateWarehouseCapacity(
                res.warehouse_stock ?? null,
                res.warehouse_capacity ?? null,
                res.warehouse_expand_pink ?? null,
            );
            const items = this._mergeItems(res.items || res.list || []);
            DataManager.ins.updateBondItems(items);
            console.log("requestBondItems", items)
            return res;
        } catch (err) {
            console.error('[ItemManager] requestBondItems 失败:', err);
            return;
        } finally {
            WaitingManager.ins.hide();
        }
    }

    /** 静默同步羁绊物总数与共用仓库容量（打开仓库页时补拉） */
    async syncWarehouseCapacityTotals(): Promise<void> {
        try {
            const res = await this._sendAsync<BondInfoResp>(SocketMSgId.BondInfo, { page: 1, page_size: 1 });
            if (!res || res.code !== 0) {
                return;
            }
            DataManager.ins.updateWarehouseBondTotal(res.total ?? 0);
            DataManager.ins.updateWarehouseCapacity(
                res.warehouse_stock ?? null,
                res.warehouse_capacity ?? null,
                res.warehouse_expand_pink ?? null,
            );
        } catch (err) {
            console.warn('[ItemManager] syncWarehouseCapacityTotals 失败:', err);
        }
    }

    /** 请求仓库数据（分页） */
    async requestWarehouse(warehouseType: number, page: number, pageSize: number, hideMask: boolean = false): Promise<any> {
        const req: WarehouseInfoReq = { warehouse_type: warehouseType, page, page_size: pageSize };
        console.log("requestWarehouse", hideMask)
        await WaitingManager.ins.show(hideMask);
        try {
            console.log("send requestWarehouse", req)
            const res = await this._sendAsync<WarehouseInfoResp>(SocketMSgId.WarehouseInfo, req);
            if (res.code !== 0) {
                ToastManager.ins.showToast(res.msg || '请求仓库失败');
                return ;
            }
            DataManager.ins.updateWarehouseCapacity(
                res.warehouse_stock ?? 0,
                res.warehouse_capacity ?? 0,
                res.warehouse_expand_pink ?? 0
            );
            if (warehouseType === WarehouseType.All) {
                DataManager.ins.updateWarehousePropTotal(res.total ?? 0);
            }
            const items = this._mergeItems(res.items || []);
            DataManager.ins.updateWarehouse(items);
 
            console.log("requestWarehouse", items)
            return res;
        } catch (err) {
            console.error('[ItemManager] requestWarehouse 失败:', err);
            return ;
        } finally {
            WaitingManager.ins.hide();
        }
    }

    /** 仓库扩容请求 */
    async requestWarehouseExpand(): Promise<boolean> {
        await WaitingManager.ins.show(true);
        try {
            const res = await this._sendAsync<WarehouseExpandResp>(SocketMSgId.WarehouseExpand, {});
            if (res.code !== 0) {
                ToastManager.ins.showToast(res.msg || '仓库扩容失败');
                return false;
            }
            var capacity = DataManager.ins.getWarehouseCapacity()
            ToastManager.ins.showToast('「扩容成功，仓库收纳上限+' + ( res.warehouse_capacity - capacity )+'」');

            DataManager.ins.updateWarehouseCapacity(
                res.warehouse_stock ?? null,
                res.warehouse_capacity ?? 0,
                res.warehouse_expand_pink ?? 0
            );
            DispatchEvent.ins.emit(EventType.ExpandSuccess, 2)
            return true;
        } catch (err) {
            console.error('[ItemManager] requestWarehouseExpand 失败:', err);
            return false;
        } finally {
            WaitingManager.ins.hide();
        }
    }

    /** 背包扩容请求 */
    async requestBackpackExpand(): Promise<boolean> {
        await WaitingManager.ins.show(true);
        try {
            const res = await this._sendAsync<BackpackExpandResp>(SocketMSgId.BackpackExpand, {});
            if (res.code !== 0) {
                ToastManager.ins.showToast(res.msg || '背包扩容失败');
                return false;
            }
            DataManager.ins.updateBackpackCapacity(
                res.backpack_stock ?? null,
                res.backpack_capacity ?? 0,
                res.backpack_expand_pink ?? 0
            );
            ToastManager.ins.showToast('扩容成功，背包收纳上限+1');
            DispatchEvent.ins.emit(EventType.ExpandSuccess, 2)
            return true;
        } catch (err) {
            console.error('[ItemManager] requestBackpackExpand 失败:', err);
            return false;
        } finally {
            WaitingManager.ins.hide();
        }
    }

    /** 移动道具到指定位置（仓库/羁绊/背包） */
    async requestItemMove(ids: number[], position: number): Promise<boolean> {
        await WaitingManager.ins.show(true);
        try {
            const req: ItemMoveReq = { ids, position };
            const res = await this._sendAsync<ItemMoveResp>(SocketMSgId.ItemMove, req);
            if (res.code !== 0) {
                ToastManager.ins.showToast(res.msg || '移动道具失败');
                return false;
            }
            return true;
        } catch (err) {
            console.error('[ItemManager] requestItemMove 失败:', err);
            return false;
        } finally {
            WaitingManager.ins.hide();
        }
    }

    /**
     * 解析道具放入仓库时的目标位置（羁绊物 → 羁绊栏，普通道具 → 仓库）
     * @param item 道具数据
     * @returns ItemPosition.Warehouse 或 ItemPosition.Bond
     */
    resolveStoragePosition(item: Item): number {
        if (item && ItemConfigManager.ins.isBondItem(item.item_id)) {
            return ItemPosition.Bond;
        }
        return ItemPosition.Warehouse;
    }

    /** 道具卖给狗店长 */
    async requestSellToShopDog(ids: number[]): Promise<SellToShopDogResp | null> {
        await WaitingManager.ins.show(true);
        try {
            const req: SellToShopDogReq = { ids };
            const res = await this._sendAsync<SellToShopDogResp>(SocketMSgId.SellToShopDog, req);
            console.log("res=====",res)
            if (res.code !== 0) {
                ToastManager.ins.showToast(res.msg || '出售道具失败');
                return null;
            }
            return res;
        } catch (err) {
            console.error('[ItemManager] requestSellToShopDog 失败:', err);
            return null;
        } finally {
            WaitingManager.ins.hide();
        }
    }

    // ========== 分页请求便捷方法（界面直接调用） ==========

    /** 请求仓库第一页（整体覆盖），返回请求结果 */
    async fetchWarehousePage(warehouseType: number,pageIndex:number): Promise<any> {
        const res = await this.requestWarehouse(warehouseType, pageIndex, this.PAGE_SIZE, true);
        if(!res)return
        console.log("fetchWarehousePage", res)
        return {items:this.getItemsByItemIds(res.items), total:res.total};
        
    }

    /** 请求全部仓库数据（全量，page_size 为 0） */
    async fetchAllWarehouse(type?): Promise<void> {
        console.log("fetchAllWareHouse")
        const localOnlyItems = DataManager.ins._getWareHouse().filter((item) => item.id < 0);
        DataManager.ins.clearWarehouse();
        await this.requestWarehouse(type ? type : WarehouseType.All, 0, 0, true);
        const warehouse = DataManager.ins._getWareHouse();
        for (const item of localOnlyItems) {
            DataManager.ins.addItem(item, warehouse);
        }
    }

    /** 请求全部羁绊物数据（全量，page_size 为 0） */
    async fetchAllBondItems(): Promise<void> {
        DataManager.ins.clearBondItems();
        await this.requestBondItems(1, 0, true);
    }
    getItemsByItemIds(items: ServerItem[]): Item[] | null {
        console.log("getItemsByItemIds", items)
        if(!items || items.length === 0) return null;
        var result = []
        for (const item of items) {
            const itemData = this.getItemById(item.id);
            if(itemData){
                result.push(itemData)
            }
        }
        return result;
    }
    /** 请求羁绊物第一页（整体覆盖），返回请求结果 */
    async fetchBondPage(pageIndex:number): Promise<any> {
        const res = await this.requestBondItems(pageIndex, this.PAGE_SIZE, true);
        if(!res)return
        return {items:this.getItemsByItemIds(res.items), total:res.total};
    }

    // ========== 本地增删改查 ==========

    getBackpack(): Item[] { return DataManager.ins.getBackpack(); }
    getBondItems(): Item[] { return DataManager.ins.getBondItems(); }
    getWarehouse(): Item[] { return DataManager.ins.getWarehouse(); }

    getItemById(id: number): Item | null {
        return DataManager.ins.findItemById(id);
    }

    getItemByItemId(itemId: number): Item | null {
        return this.getBackpack().find(i => i.item_id === itemId)
            || this.getBondItems().find(i => i.item_id === itemId)
            || this.getWarehouse().find(i => i.item_id === itemId)
            || null;
    }

    updateItem(id: number, data: Partial<Item>): boolean {
        return DataManager.ins.updateItem(id, data);
    }

    decreaseItemRemain(id: number, delta: number): boolean {
        const item = this.getItemById(id);
        if (!item) return false;
        const remain = Math.max(0, (item.remain_count || 0) - delta);
        return this.updateItem(id, { remain_count: remain, num: remain });
    }

    removeItem(id: number): boolean {
        return DataManager.ins.removeItem(id);
    }

    clearAll(): void {
        DataManager.ins.clearAllItems();
    }

    /**
     * 仓库（含羁绊栏）是否已满
     */
    isWarehouseStorageFull(): boolean {
        const capacity = DataManager.ins.getWarehouseCapacity();
        if (capacity <= 0) {
            return false;
        }
        return DataManager.ins.getWarehouseUsageStock() >= capacity;
    }

    private _localItemIdSeq = 0;

    private _generateLocalItemId(): number {
        this._localItemIdSeq = (this._localItemIdSeq + 1) % 1000;
        return -(Date.now() * 1000 + this._localItemIdSeq);
    }

    /**
     * 购买成功后写入仓库/羁绊栏
     * 服务端购买接口接入后，可改由 ItemChangeNotify 同步
     */
    async addPurchasedItemToStorage(itemId: number): Promise<Item | null> {
        await ItemConfigManager.ins.load();
        const cfg = ItemConfigManager.ins.getConfig(itemId);
        if (!cfg) {
            console.warn('[ItemManager] addPurchasedItemToStorage 未找到配置:', itemId);
            return null;
        }
        const remainCount = cfg.total_use_count ?? 0;
        const item = this._mergeItem({
            id: this._generateLocalItemId(),
            item_id: itemId,
            remain_count: remainCount,
            created_at: Math.floor(Date.now() / 1000),
        });
        const targetList = this._getListByPosition(this.resolveStoragePosition(item));
        if (!DataManager.ins.addItem(item, targetList)) {
            return null;
        }
        DispatchEvent.ins.emit(EventType.ItemNotiyChange, { changes: [] });
        return item;
    }

    onRefresh(category: 'backpack' | 'bond' | 'warehouse', cb: () => void, target?: any): void {
        const eventType = category === 'backpack'
            ? EventType.RefreshBackpack
            : category === 'bond'
                ? EventType.RefreshBondItems
                : EventType.RefreshWarehouse;
        DispatchEvent.ins.on(eventType, cb, target);
    }

    offRefresh(category: 'backpack' | 'bond' | 'warehouse', cb: () => void, target?: any): void {
        const eventType = category === 'backpack'
            ? EventType.RefreshBackpack
            : category === 'bond'
                ? EventType.RefreshBondItems
                : EventType.RefreshWarehouse;
        DispatchEvent.ins.off(eventType, cb, target);
    }
}