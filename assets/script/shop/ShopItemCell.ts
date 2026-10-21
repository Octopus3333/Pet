import { _decorator, Component, Label, Node, Sprite } from 'cc';
import { EventType, ViewPath } from '../common/utils/Define';
import { loadItem } from '../common/utils/UiTools';
import { ShopItemCellData } from '../common/utils/InterfaceDefine';
import { UIManager } from '../common/utils/UIManager';
import { ItemConfigManager } from '../item/ItemConfigManager';
import { ShopItemDisPanel } from './ShopItemDisPanel';
import { DispatchEvent } from '../common/utils/DispatchEvent';
const { ccclass, property } = _decorator;

export type { ShopItemCellData };
@ccclass('ShopItemCell')
export class ShopItemCell extends Component {
    @property(Sprite)
    sp_item_icon: Sprite = null;
    @property(Label)
    lb_item_name: Label = null;
    @property(Label)
    lb_item_coin1: Label = null;
    @property(Label)
    lb_item_coin2: Label = null;
    @property(Node)
    sp_redpoint: Node = null;
    @property(Label)
    lb_discount: Label = null;
    @property(Node)
    content: Node = null;
    @property(Node)
    sp_sold: Node = null;
    @property(Node)
    nd_item_bg: Node = null;

    private _data: ShopItemCellData = null;

    protected onLoad(): void {
        this.ensureSoldRefs();
        this.node.on(Node.EventType.TOUCH_END, this.onClickCell, this);
        DispatchEvent.ins.on(EventType.ShopItemSold, this.onShopItemSold, this);
    }

    protected onDestroy(): void {
        DispatchEvent.ins.off(EventType.ShopItemSold, this.onShopItemSold, this);
    }

    setData(data: ShopItemCellData): void {
        this._data = data;
        this.ensureSoldRefs();
        this.ensureDiscountRefs();
        const cfg = ItemConfigManager.ins.getConfig(data.item_id);
        this.lb_item_name.string = data.name ?? cfg?.name ?? '';
        loadItem(this.sp_item_icon, data.item_id);
        this.lb_item_coin1.string = String(data.price1 ?? '');
        this.lb_item_coin2.string = String(data.price2 ?? '');
        this.lb_item_coin2.node.active = data.price2 != null;
        this.refreshQualityBg(data.item_id, cfg?.quality);
        this.refreshDiscountUI();
        this.refreshSoldUI();
    }

    /** 按 itemConfig.quality 显示 nd_item_bg 下对应稀有度背景 */
    private refreshQualityBg(itemId: number, quality?: number): void {
        if (!this.nd_item_bg) {
            this.nd_item_bg = this.node.getChildByName('nd_item_bg');
        }
        if (!this.nd_item_bg) {
            return;
        }
        const q = quality ?? ItemConfigManager.ins.getQuality(itemId) ?? 1;
        const activeQuality = Math.min(4, Math.max(1, q));
        for (let i = 1; i <= 4; i++) {
            const bg = this.nd_item_bg.getChildByName(`bg_quality_${i}`);
            if (bg) {
                bg.active = i === activeQuality;
            }
        }
    }

    private ensureDiscountRefs(): void {
        if (!this.sp_redpoint) {
            this.sp_redpoint = this.node.getChildByName('sp_redpoint');
        }
        if (!this.lb_discount && this.sp_redpoint) {
            this.lb_discount = this.sp_redpoint.getChildByName('lb_value')?.getComponent(Label) ?? null;
        }
    }

    private refreshDiscountUI(): void {
        const discount = this._data?.discount;
        const hasDiscount = discount != null && discount > 0 && !this._data?.sold;
        if (this.sp_redpoint) {
            this.sp_redpoint.active = hasDiscount;
        }
        if (this.lb_discount) {
            this.lb_discount.string = hasDiscount ? `-${discount}%` : '';
        }
    }

    private ensureSoldRefs(): void {
        if (!this.content) {
            this.content = this.node.getChildByName('content');
        }
        if (!this.sp_sold) {
            this.sp_sold = this.node.getChildByName('sp_sold');
        }
    }

    private refreshSoldUI(): void {
        const sold = !!this._data?.sold;
        if (this.content) {
            this.content.active = !sold;
        }
        if (this.sp_sold) {
            this.sp_sold.active = sold;
        }
        this.refreshDiscountUI();
    }

    private onShopItemSold(data: ShopItemCellData): void {
        if (!data || data !== this._data) {
            return;
        }
        this.refreshSoldUI();
    }

    private async onClickCell(): Promise<void> {
        if (this._data?.sold) {
            return;
        }
        const node = await UIManager.ins.show(ViewPath.ShopItemDisPanel);
        node.getComponent(ShopItemDisPanel).show(this._data);
    }
}
