import { _decorator, Color, Component, Label, Node, Sprite } from 'cc';
import { Item } from '../../common/utils/InterfaceDefine';
import { loadImg, loadItem, loadItemQuality } from '../../common/utils/UiTools';
import { Common, EventType, ViewPath } from '../../common/utils/Define';
import { DispatchEvent } from '../../common/utils/DispatchEvent';
import { UIManager } from '../../common/utils/UIManager';
import { ConfirmPopup } from '../../common/utils/ConfirmPopup';

const { ccclass } = _decorator;

@ccclass('BagItem')
export class BagItem extends Component {
    private _itemData: Item = null;
    private _sp_item: Sprite = null;
    private _lb_use_count: Label = null;
    private _sp_quality: Sprite = null;
    private _sp_icon_1: Sprite = null;
    private _lb_num_1: Label = null;
    private _sp_icon_2: Sprite = null;
    private _lb_num_2: Label = null;
    private _lb_num_3: Label = null;
    private _nd_mask: Node = null;

    protected onLoad(): void {
        this.ensureRefs();
        this.bindTouchEvent();
    }

    private ensureRefs(): void {
        const nd_itemCell = this.node.getChildByName('nd_itemCell');
        if (!nd_itemCell) {
            console.warn('[BagItem] 未找到 nd_itemCell 节点');
            return;
        }

        const sp_item_node = nd_itemCell.getChildByName('sp_item');
        if (sp_item_node) {
            this._sp_item = sp_item_node.getComponent(Sprite);
            const lb_use_count_node = sp_item_node.getChildByName('lb_use_count');
            if (lb_use_count_node) {
                this._lb_use_count = lb_use_count_node.getComponent(Label);
            }
        }

        const sp_quality_node = nd_itemCell.getChildByName('sp_quality');
        if (sp_quality_node) {
            this._sp_quality = sp_quality_node.getComponent(Sprite);
        }

        const sp_icon_1_node = nd_itemCell.getChildByName('sp_icon_1');
        if (sp_icon_1_node) {
            this._sp_icon_1 = sp_icon_1_node.getComponent(Sprite);
        }

        const lb_num_1_node = nd_itemCell.getChildByName('lb_num_1');
        if (lb_num_1_node) {
            this._lb_num_1 = lb_num_1_node.getComponent(Label);
        }

        const sp_icon_2_node = nd_itemCell.getChildByName('sp_icon_2');
        if (sp_icon_2_node) {
            this._sp_icon_2 = sp_icon_2_node.getComponent(Sprite);
        }

        const lb_num_2_node = nd_itemCell.getChildByName('lb_num_2');
        if (lb_num_2_node) {
            this._lb_num_2 = lb_num_2_node.getComponent(Label);
        }

        const lb_num_3_node = nd_itemCell.getChildByName('lb_num_3');
        if (lb_num_3_node) {
            this._lb_num_3 = lb_num_3_node.getComponent(Label);
        }

        const nd_mask_node = nd_itemCell.getChildByName('nd_mask');
        if (nd_mask_node) {
            this._nd_mask = nd_mask_node;
        }
    }

    private bindTouchEvent(): void {
        this.node.on(Node.EventType.TOUCH_END, this.onItemClick, this);
    }

    onDestroy(): void {
        this.node.off(Node.EventType.TOUCH_END, this.onItemClick, this);
    }

    private async onItemClick(): Promise<void> {
        if (!this._itemData) return;
        const node = await UIManager.ins.show(ViewPath.ConfirmPopup);
        const popup = node?.getComponent(ConfirmPopup);
        if (popup)
        {
            popup.show({
                title: '使用道具',
                message: '是否使用该道具?',
                confirmText: '确认',
                cancelText: '取消',
                onConfirm: () => { 
                    DispatchEvent.ins.emit(EventType.ItemUse, this._itemData)
                },
            });
        }
        // 直接使用道具，通过MainController的ItemUse流程处理
    }

    public loadData(item: Item): void {
        this._itemData = item;
        this.ensureRefs();
        this.refreshView();
    }

    private refreshView(): void {
        if (!this._itemData) {
            this.node.active = false;
            return;
        }
        this.node.active = true;

        const data = this._itemData;

        if (this._sp_quality) {
            loadItemQuality(this._sp_quality, data.item_id);
        }

        if (this._sp_item) {
            loadItem(this._sp_item, data.item_id);
        }

        if (this._lb_use_count) {
            const remain = data.remain_count ?? 0;
            const total = data.total_use_count ?? 0;
            this._lb_use_count.string = `${remain}/${total}`;
        }

        if (this._nd_mask) {
            this._nd_mask.active = false;
        }

        const isCleanItem = data.type === 1;
        const primaryVal = isCleanItem ? data.clean : data.energy;
        const primaryIcon = isCleanItem
            ? (data.clean > 0 ? 'hudong/cleanUp' : 'hudong/cleanDown')
            : (data.energy > 0 ? 'hudong/foodUp' : 'hudong/foodDown');
        const secondaryVal = isCleanItem ? data.energy : data.clean;
        const secondaryIcon = isCleanItem
            ? (data.energy > 0 ? 'hudong/foodUp' : 'hudong/foodDown')
            : (data.clean > 0 ? 'hudong/cleanUp' : 'hudong/cleanDown');

        if (this._sp_icon_1) {
            loadImg(this._sp_icon_1, Common.texturePath + 'home/' + primaryIcon + '/spriteFrame');
        }
        if (this._lb_num_1) {
            this._lb_num_1.color = primaryVal > 0
                ? new Color(92, 231, 146)
                : new Color(255, 96, 62);
            this._lb_num_1.string = String(Math.abs(primaryVal || 0));
        }

        if (this._sp_icon_2) {
            loadImg(this._sp_icon_2, Common.texturePath + 'home/' + secondaryIcon + '/spriteFrame');
        }
        if (this._lb_num_2) {
            this._lb_num_2.color = secondaryVal > 0
                ? new Color(92, 231, 146)
                : new Color(255, 96, 62);
            this._lb_num_2.string = String(Math.abs(secondaryVal || 0));
        }

        if (this._lb_num_3) {
            this._lb_num_3.string = '+' + String(data.intimacy || 0);
        }
    }

    public getItemData(): Item | null {
        return this._itemData;
    }
}
