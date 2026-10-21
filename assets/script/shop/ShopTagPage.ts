import { _decorator, Button, Component, Label, Layout, Node } from 'cc';
import { createPrefab } from '../common/utils/UiTools';
import { Common, EventType, ShopTagTypeValue } from '../common/utils/Define';
import { ShopItemCell, ShopItemCellData } from './ShopItemCell';
import { ShopManager } from './ShopManager';
import { DispatchEvent } from '../common/utils/DispatchEvent';

const { ccclass, property } = _decorator;

const SHOP_ITEM_CELL_PATH = Common.prefabPath + 'shop/ShopItemCell';
export const SHOP_TAG_PAGE_CELL_MAX = 9;

@ccclass('ShopTagPage')
export class ShopTagPage extends Component {
    @property(Node)
    nd_content: Node = null;
    @property(Button)
    btn_refresh: Button = null;
    @property(Label)
    lb_refresh: Label = null;

    private _tag: ShopTagTypeValue | null = null;
    private _refreshing = false;

    protected onLoad(): void {
        this.ensureRefreshRefs();
        this.btn_refresh?.node.on(Button.EventType.CLICK, this.onClickRefresh, this);
        DispatchEvent.ins.on(EventType.ShopRefreshCount, this.refreshRefreshUI, this);
    }

    protected onDestroy(): void {
        DispatchEvent.ins.off(EventType.ShopRefreshCount, this.refreshRefreshUI, this);
    }

    /** 绑定分区类型（由 ShopPanel 在创建分页时注入） */
    initTag(tag: ShopTagTypeValue): void {
        this._tag = tag;
        this.refreshRefreshUI();
    }

    async setData(dataList: ShopItemCellData[]): Promise<void> {
        if (!this.nd_content?.isValid) {
            return;
        }
        this.clearCells();
        const list = dataList || [];
        const count = Math.min(list.length, SHOP_TAG_PAGE_CELL_MAX);
        for (let i = 0; i < count; i++) {
            const cellNode = await createPrefab(SHOP_ITEM_CELL_PATH);
            if (!cellNode?.isValid || !this.nd_content.isValid) {
                continue;
            }
            cellNode.parent = this.nd_content;
            const cell = cellNode.getComponent(ShopItemCell);
            if (cell && list[i]) {
                cell.setData(list[i]);
            }
        }
        this.nd_content.getComponent(Layout)?.updateLayout();
        this.refreshRefreshUI();
    }

    private ensureRefreshRefs(): void {
        if (!this.btn_refresh) {
            this.btn_refresh = this.node.getChildByName('btn_refresh')?.getComponent(Button) ?? null;
        }
        if (!this.lb_refresh && this.btn_refresh) {
            this.lb_refresh = this.btn_refresh.node.getChildByName('Label')?.getComponent(Label) ?? null;
        }
    }

    private refreshRefreshUI(): void {
        this.ensureRefreshRefs();
        const tag = this._tag;
        const refreshable = tag != null && ShopManager.ins.isRefreshableTag(tag);
        if (this.btn_refresh) {
            this.btn_refresh.node.active = refreshable;
        }
        if (!refreshable || !this.lb_refresh) {
            return;
        }
        const info = ShopManager.ins.getRefreshInfo(tag);
        const remain = info?.remain ?? 0;
        const max = info?.max ?? 0;
        this.lb_refresh.string = `上库存  ${remain}/${max}`;
        if (this.btn_refresh) {
            this.btn_refresh.interactable = remain > 0 && !this._refreshing;
        }
    }

    private async onClickRefresh(): Promise<void> {
        if (this._tag == null || this._refreshing) {
            return;
        }
        this._refreshing = true;
        this.refreshRefreshUI();
        try {
            const items = await ShopManager.ins.refreshTag(this._tag);
            await this.setData(items);
        } finally {
            this._refreshing = false;
            this.refreshRefreshUI();
        }
    }

    private clearCells(): void {
        if (this.nd_content?.isValid) {
            this.nd_content.removeAllChildren();
        }
    }
}
