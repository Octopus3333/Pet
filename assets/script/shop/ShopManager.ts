import { HttpClient } from '../common/network/HttpClient';
import { EventType, IShopDataProvider, ShopRefreshInfo, ShopTagType, ShopTagTypeValue } from '../common/utils/Define';
import {
    GoodBuyReq,
    GoodBuyResp,
    GoodIsNewResp,
    GoodItem,
    GoodListResp,
    GoodRefreshResp,
    GoodTypeGroup,
    ShopItemCellData,
} from '../common/utils/InterfaceDefine';
import { ItemConfigManager } from '../item/ItemConfigManager';
import { ToastManager } from '../common/utils/ToastManager';
import { WaitingManager } from '../common/utils/WaitingManager';
import { DispatchEvent } from '../common/utils/DispatchEvent';

/** 商店标签 -> 服务端 good_type */
const SHOP_TAG_TO_GOOD_TYPE: Partial<Record<ShopTagTypeValue, number>> = {
    [ShopTagType.Sale]: 9,
    [ShopTagType.Clean]: 1,
    [ShopTagType.Food]: 2,
    [ShopTagType.Toy]: 3,
    [ShopTagType.Other]: 4,
};

/** 服务端 good_type -> 商店标签 */
const GOOD_TYPE_TO_TAG: Record<number, ShopTagTypeValue> = {
    9: ShopTagType.Sale,
    1: ShopTagType.Clean,
    2: ShopTagType.Food,
    3: ShopTagType.Toy,
    4: ShopTagType.Other,
};

/** 支持刷新的可消耗商品分区（对应服务端 good_type 1~4） */
const REFRESHABLE_TAGS = new Set<ShopTagTypeValue>([
    ShopTagType.Food,
    ShopTagType.Clean,
    ShopTagType.Toy,
    ShopTagType.Other,
]);

const LOAD_TAGS: ShopTagTypeValue[] = [
    ShopTagType.Sale,
    ShopTagType.Food,
    ShopTagType.Clean,
    ShopTagType.Toy,
    ShopTagType.Other,
];

/** 服务端未返回 refresh_max 时的默认每日刷新上限 */
const DEFAULT_REFRESH_MAX = 3;

/**
 * 商店管理器
 * 对接 /good/list、/good/buy、/good/refresh、/good/is_new
 */
export class ShopManager implements IShopDataProvider {
    private static _ins: ShopManager = null!;

    static get ins(): ShopManager {
        if (!ShopManager._ins) {
            ShopManager._ins = new ShopManager();
        }
        return ShopManager._ins;
    }

    private _loaded = false;
    private _loading: Promise<void> | null = null;
    private _itemsByTag = new Map<ShopTagTypeValue, ShopItemCellData[]>();
    /** 刷新次数为全账号共享（服务端 refresh_count 在响应根级） */
    private _refreshInfo: ShopRefreshInfo = { remain: DEFAULT_REFRESH_MAX, max: DEFAULT_REFRESH_MAX };
    private _tagHasNew = new Map<ShopTagTypeValue, boolean>();

    async load(): Promise<void> {
        if (this._loaded) {
            return;
        }
        if (this._loading) {
            return this._loading;
        }
        this._loading = this.doLoad();
        try {
            await this._loading;
        } finally {
            this._loading = null;
        }
    }

    /** 强制重新拉取全部分区商品 */
    async reload(): Promise<void> {
        this._loaded = false;
        this._itemsByTag.clear();
        this._refreshInfo = { remain: DEFAULT_REFRESH_MAX, max: DEFAULT_REFRESH_MAX };
        this._tagHasNew.clear();
        await this.load();
    }

    getItemsByTag(tag: ShopTagTypeValue): ShopItemCellData[] {
        return this._itemsByTag.get(tag) ?? [];
    }

    getRefreshInfo(tag: ShopTagTypeValue): ShopRefreshInfo | null {
        if (!this.isRefreshableTag(tag)) {
            return null;
        }
        return this._refreshInfo;
    }

    isRefreshableTag(tag: ShopTagTypeValue): boolean {
        return REFRESHABLE_TAGS.has(tag);
    }

    hasTagNew(tag: ShopTagTypeValue): boolean {
        return this._tagHasNew.get(tag) ?? false;
    }

    async refreshTag(tag: ShopTagTypeValue): Promise<ShopItemCellData[]> {
        if (!this.isRefreshableTag(tag)) {
            return this.getItemsByTag(tag);
        }
        const goodType = this.getGoodType(tag);
        if (goodType == null) {
            return [];
        }
        const res = await this.post<GoodRefreshResp>('/good/refresh', { good_type: goodType }, true);
        if (!res) {
            return this.getItemsByTag(tag);
        }
        this.applyGoodTypeGroups(res.good_types ?? [], goodType);
        this.updateRefreshInfo(res.refresh_count);
        return this.getItemsByTag(tag);
    }

    async clearTagIsNew(tag: ShopTagTypeValue): Promise<void> {
        const goodType = this.getGoodType(tag);
        // 服务端 GoodIsNew 仅支持 good_type 1~4（proto 注释），特卖区 9 不在范围内
        if (goodType == null || goodType === 9 || goodType > 4 || !this.hasTagNew(tag)) {
            return;
        }
        const res = await this.post<GoodIsNewResp>('/good/is_new', { good_type: goodType }, false);
        if (res) {
            this._tagHasNew.set(tag, false);
            this.clearItemsNewFlag(tag);
        }
    }

    /** 购买商品 */
    async buy(item: ShopItemCellData, payType: 1 | 2): Promise<GoodBuyResp | null> {
        const req = this.buildBuyReq(item, payType);
        if (!req) {
            ToastManager.ins.showToast('商品信息异常');
            return null;
        }
        console.log('[ShopManager] /good/buy req:', req);
        const res = await this.post<GoodBuyResp>('/good/buy', { ...req }, true);
        if (!res) {
            return null;
        }
        return res;
    }

    /** 标记本地缓存中某商品已售出 */
    markSold(goodId: string): void {
        if (!goodId) {
            return;
        }
        for (const [tag, items] of this._itemsByTag) {
            const target = items.find((item) => item.good_id === goodId);
            if (target) {
                target.sold = true;
                this._itemsByTag.set(tag, [...items]);
                break;
            }
        }
    }

    private async doLoad(): Promise<void> {
        await ItemConfigManager.ins.load();
        const res = await this.post<GoodListResp>('/good/list', {}, false);
        if (!res) {
            for (const tag of LOAD_TAGS) {
                this._itemsByTag.set(tag, []);
            }
            this._loaded = true;
            return;
        }
        this.applyGoodTypeGroups(res.good_types ?? []);
        this.updateRefreshInfo(res.refresh_count);
        this._loaded = true;
    }

    /** 解析 good_types，refresh 时仅更新请求的 good_type 分区 */
    private applyGoodTypeGroups(groups: GoodTypeGroup[], targetGoodType?: number): void {
        for (const group of groups) {
            if (targetGoodType != null && group.good_type !== targetGoodType) {
                continue;
            }
            this.applyGoodTypeGroup(group);
        }
    }

    private applyGoodTypeGroup(group: GoodTypeGroup): void {
        const tag = GOOD_TYPE_TO_TAG[group.good_type];
        if (tag == null) {
            return;
        }
        const items = (group.goods ?? [])
            .map((good) => this.toCellData(good, tag, group.good_type))
            .filter((item) => this.isValidShopItem(item));
        this._itemsByTag.set(tag, items);
        this._tagHasNew.set(tag, !!group.is_new);
    }

    private toCellData(good: GoodItem, tag: ShopTagTypeValue, goodType: number): ShopItemCellData {
        const itemId = Number(good.item_id);
        const cfg = ItemConfigManager.ins.getConfig(itemId);
        const { price1, price2 } = this.resolvePrices(good, cfg);
        const cell: ShopItemCellData = {
            item_id: itemId,
            good_id: good.good_id,
            good_type: goodType,
            name: cfg?.name,
            price1,
            price2,
            discount: good.discount,
            sold: good.bought,
        };
        if (tag === ShopTagType.Sale && (cell.discount == null || cell.discount <= 0)) {
            cell.discount = undefined;
        }
        return cell;
    }

    /** 本地有配置、有 good_id 且能解析出价格的商品才展示 */
    private isValidShopItem(item: ShopItemCellData): boolean {
        if (!item.good_id) {
            console.warn('[ShopManager] 服务端未返回 good_id，跳过商品 item_id:', item.item_id);
            return false;
        }
        const cfg = ItemConfigManager.ins.getConfig(item.item_id);
        if (!cfg) {
            console.warn('[ShopManager] 本地缺少 itemConfig，跳过商品 item_id:', item.item_id);
            return false;
        }
        if (item.price1 == null && item.price2 == null) {
            console.warn('[ShopManager] 无法解析商品价格，跳过商品 item_id:', item.item_id);
            return false;
        }
        return true;
    }

    /** 解析商品价格：list 不返回价格，用 itemConfig；特卖区 discount=20 表示八折 */
    private resolvePrices(
        good: GoodItem,
        cfg: ReturnType<typeof ItemConfigManager.ins.getConfig>,
    ): { price1?: number; price2?: number } {
        const configRaw = cfg as (typeof cfg) & { sale_pink?: number; sale_gold?: number };
        let price1 = configRaw?.sale_pink ?? cfg?.sale_money;
        let price2 = configRaw?.sale_gold;

        if (price1 == null && price2 == null && cfg?.sale_money != null) {
            if (cfg.sale_type === 2) {
                price2 = cfg.sale_money;
            } else {
                price1 = cfg.sale_money;
            }
        }

        const discount = good.discount;
        if (discount != null && discount > 0) {
            // 与服务端 (price*4+4)/5 整数八折公式保持一致，避免舍入差异导致「价格有误」
            if (price1 != null) {
                price1 = Math.floor((price1 * 4 + 4) / 5);
            }
            if (price2 != null) {
                price2 = Math.floor((price2 * 4 + 4) / 5);
            }
        }

        return { price1, price2 };
    }

    private buildBuyReq(item: ShopItemCellData, payType: 1 | 2): GoodBuyReq | null {
        if (!item.item_id || !item.good_id || item.good_type == null) {
            return null;
        }
        const price = payType === 1 ? item.price1 : item.price2;
        if (price == null || price <= 0) {
            return null;
        }
        const req: GoodBuyReq = {
            item_id: item.item_id,
            good_id: item.good_id,
            good_type: item.good_type,
        };
        if (payType === 1) {
            req.pink = price;
        } else {
            req.gold = price;
        }
        return req;
    }

    /** 更新共享刷新剩余次数（服务端字段 refresh_count） */
    private updateRefreshInfo(refreshCount?: number): void {
        if (refreshCount == null) {
            return;
        }
        this._refreshInfo = {
            remain: Math.max(0, refreshCount),
            max: DEFAULT_REFRESH_MAX,
        };
        DispatchEvent.ins.emit(EventType.ShopRefreshCount, this._refreshInfo);
    }

    private clearItemsNewFlag(tag: ShopTagTypeValue): void {
        const items = this.getItemsByTag(tag).map((item) => ({ ...item, is_new: false }));
        this._itemsByTag.set(tag, items);
    }

    private getGoodType(tag: ShopTagTypeValue): number | null {
        const goodType = SHOP_TAG_TO_GOOD_TYPE[tag];
        return goodType == null ? null : goodType;
    }

    private async post<T extends { code?: number; msg?: string }>(
        path: string,
        body: Record<string, unknown>,
        showWaiting: boolean,
    ): Promise<T | null> {
        try {
            if (showWaiting) {
                WaitingManager.ins.show(true);
            }
            const response = await HttpClient.instance.post<T>(path, body);
            const res = response.data;
            if (res?.code !== 0) {
                ToastManager.ins.showToast(res?.msg || '请求失败');
                return null;
            }
            return res;
        } catch (err) {
            console.error(`[ShopManager] ${path} 失败:`, err);
            ToastManager.ins.showToast('网络异常，请重试');
            return null;
        } finally {
            if (showWaiting) {
                WaitingManager.ins.hide();
            }
        }
    }
}
