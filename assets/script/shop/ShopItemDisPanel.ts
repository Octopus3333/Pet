import { _decorator, Button, Component, Label, Node, Sprite } from 'cc';
import { Common, EventType, ViewPath, WarehouseType } from '../common/utils/Define';
import { ShopItemCellData, ItemConfig } from '../common/utils/InterfaceDefine';
import { getMoneyStr, loadImg, popupRewardsLayer } from '../common/utils/UiTools';
import { DispatchEvent } from '../common/utils/DispatchEvent';
import { UIManager } from '../common/utils/UIManager';
import { ItemConfigManager } from '../item/ItemConfigManager';
import { DataManager } from '../Data/DataManager';
import { ToastManager } from '../common/utils/ToastManager';
import { ItemManager } from '../item/ItemManager';
import { ShopManager } from './ShopManager';

const { ccclass, property } = _decorator;

@ccclass('ShopItemDisPanel')
export class ShopItemDisPanel extends Component {
    @property(Node)
    sp_mask: Node = null;
    @property(Node)
    nd_icon_group_1: Node = null;
    @property(Label)
    lb_itemName: Label = null;
    @property(Label)
    lb_discription: Label = null;
    @property(Label)
    lb_times: Label = null;
    @property(Button)
    btn_coin1: Button = null;
    @property(Button)
    btn_coin2: Button = null;
    @property(Label)
    lb_pink_coin: Label = null;
    @property(Label)
    lb_gold_coin: Label = null;

    private _data: ShopItemCellData = null;

    protected onLoad(): void {
        this.sp_mask.on(Node.EventType.TOUCH_END, this.hide, this);
        this.btn_coin1.node.on(Button.EventType.CLICK, this.onClickBuyPink, this);
        this.btn_coin2.node.on(Button.EventType.CLICK, this.onClickBuyGold, this);
        this.refreshMoney();
        DispatchEvent.ins.on(EventType.RefreshCoin, this.refreshMoney, this);
    }

    protected onDestroy(): void {
        DispatchEvent.ins.off(EventType.RefreshCoin, this.refreshMoney, this);
    }

    show(data: ShopItemCellData): void {
        this._data = data;
        this.refreshMoney();
        const cfg = ItemConfigManager.ins.getConfig(data.item_id);
        this.lb_itemName.string = data.name ?? cfg.name ?? '';
        this.lb_discription.string = cfg.des ?? '';
        this.lb_times.string = `${cfg.total_use_count}/${cfg.total_use_count}`;
        this.refreshPetLimit(cfg.animal_limit);
        this.refreshStatGroup(cfg);
        this.refreshPriceButtons(data);
        this.node.active = true;
    }

    hide(): void {
        UIManager.ins.hide(ViewPath.ShopItemDisPanel);
    }

    private refreshMoney(): void {
        const money = getMoneyStr();
        this.lb_pink_coin.string = money.pink;
        this.lb_gold_coin.string = money.gold;
    }

    private refreshPetLimit(animalLimit: number[]): void {
        for (let i = 1; i <= 3; i++) {
            const sp = this.nd_icon_group_1.getChildByPath(`nd_pet_${i}/sp_can_use`).getComponent(Sprite);
            const path = animalLimit.indexOf(i) !== -1 ? 'gou' : 'cha';
            loadImg(sp, `${Common.texturePath}storage/${path}/spriteFrame`);
        }
    }

    private refreshStatGroup(cfg: ItemConfig): void {
        const group = this.node.getChildByPath('nd_bg/nd_iconGroup_2');
        this.refreshStatNode(group.getChildByName('nd_clean'), cfg.clean);
        this.refreshStatNode(group.getChildByName('nd_energy'), cfg.energy);
        this.refreshStatNode(group.getChildByName('nd_intimacy'), cfg.intimacy);
    }

    private refreshStatNode(node: Node, value: number | null | undefined): void {
        if (!node) {
            return;
        }
        const num = value ?? 0;
        const unchanged = num === 0;
        node.getChildByName('sp_down_red').active = num < 0;
        node.getChildByName('sp_up_green').active = num > 0;
        node.getChildByName('sp_unchanged').active = unchanged;
        const lbValue = node.getChildByName('lb_value')?.getComponent(Label);
        if (lbValue) {
            lbValue.node.active = !unchanged;
            if (!unchanged) {
                lbValue.string = String(Math.abs(num));
            }
        }
    }

    private refreshPriceButtons(data: ShopItemCellData): void {
        this.btn_coin1.node.active = data.price1 != null;
        const pinkPriceLabel = this.btn_coin1.node.getChildByName('lb_coin1')?.getComponent(Label);
        if (pinkPriceLabel) {
            pinkPriceLabel.string = String(data.price1 ?? '');
        }

        const hasPrice2 = data.price2 != null;
        this.btn_coin2.node.active = hasPrice2;
        const goldPriceLabel = this.btn_coin2.node.getChildByName('lb_coin2')?.getComponent(Label);
        if (goldPriceLabel) {
            goldPriceLabel.string = hasPrice2 ? String(data.price2) : '';
        }
    }

    onClickBuyPink(): void {
        void this.tryPurchase(this._data.price1, 1);
    }

    onClickBuyGold(): void {
        void this.tryPurchase(this._data.price2, 2);
    }

    private async tryPurchase(price: number | undefined, payType: 1 | 2): Promise<void> {
        if (price == null || !this._data) {
            return;
        }
        if (ItemManager.ins.isWarehouseStorageFull()) {
            ToastManager.ins.showToast('您的仓库放不下了');
            return;
        }
        const userInfo = DataManager.ins.getUserInfo();
        if (payType === 1 && userInfo.pink < price) {
            ToastManager.ins.showToast('粉爪币不足');
            return;
        }
        if (payType === 2 && userInfo.gold < price) {
            ToastManager.ins.showToast('金爪币不足');
            return;
        }

        const res = await ShopManager.ins.buy(this._data, payType);
        if (!res) {
            return;
        }

        // HTTP 购买成功后，MoneyChangeNotify 可能稍后才到；先本地扣款并刷新 UI
        const latest = DataManager.ins.getUserInfo();
        const nextPink = payType === 1 ? Math.max(0, (latest.pink ?? 0) - price) : (latest.pink ?? 0);
        const nextGold = payType === 2 ? Math.max(0, (latest.gold ?? 0) - price) : (latest.gold ?? 0);
        DataManager.ins.updateUserData({ pink: nextPink, gold: nextGold });
        this.refreshMoney();

        ShopManager.ins.markSold(this._data.good_id);
        void ItemManager.ins.requestWarehouse(WarehouseType.All, 0, 0, true);
        void this.showPurchaseRewards();
    }

    private async showPurchaseRewards(): Promise<void> {
        if (this._data) {
            this._data.sold = true;
            DispatchEvent.ins.emit(EventType.ShopItemSold, this._data);
        }
        this.hide();
        await popupRewardsLayer([{ itemId: this._data.item_id, num: 1 }]);
    }
}
