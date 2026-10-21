import { _decorator, Button, Component, Label, Node } from 'cc';
import { Item } from '../utils/InterfaceDefine';
import { ItemManager } from '../../item/ItemManager';
import { DataManager } from '../../Data/DataManager';
import { ToastManager } from '../utils/ToastManager';
import { DispatchEvent } from '../utils/DispatchEvent';
import { EventType, ItemPosition } from '../utils/Define';
import { getTime } from '../utils/TimeUtil';

const { ccclass, property } = _decorator;

/**
 * 羁绊物详情浮层
 */
@ccclass('BondItemDiscriptionPanel')
export class BondItemDiscriptionPanel extends Component {
    @property(Label)
    lb_itemName: Label = null
    @property(Label)
    lb_discription: Label = null
    @property(Label)
    lb_itemDate: Label = null
    /** 放入背包按钮 */
    @property(Button)
    btn_putIntoStorage: Button = null

    /** 当前展示的羁绊物 */
    private _item: Item = null

    protected onLoad(): void {
        this.ensureRefs()
        this.bindPutIntoBackpackButton()
        this.node.active = false
    }

    protected onDestroy(): void {
        const btnNode = this.btn_putIntoStorage?.node
        if (btnNode?.isValid) {
            btnNode.off(Button.EventType.CLICK, this.onClickPutIntoBackpack, this)
        }
    }

    /**
     * 展示羁绊物详情
     * @param item 羁绊物数据
     */
    show(item: Item): void {
        if (!item) {
            this.hide()
            return
        }
        this._item = item
        this.ensureRefs()
        this.refreshContent(item)
        this.node.active = true
    }

    /** 隐藏详情面板 */
    hide(): void {
        this.node.active = false
        this._item = null
    }

    /**
     * 点击「放入背包」：移入外出背包并保持选中
     */
    onClickPutIntoBackpack(): void {
        if (!this._item) {
            return
        }

        const stock = DataManager.ins.getBackpackStock()
        const capacity = DataManager.ins.getBackpackCapacity()
        if (stock >= capacity) {
            ToastManager.ins.showToast('背包已满')
            return
        }

        const itemId = this._item.id
        DispatchEvent.ins.emit(EventType.PendingBackpackSelect, itemId)
        void ItemManager.ins.requestItemMove([itemId], ItemPosition.Backpack).then((success) => {
            if (!success) {
                DispatchEvent.ins.emit(EventType.PendingBackpackSelect, -1)
            }
        })
    }

    /** 刷新文案区域 */
    private refreshContent(item: Item): void {
        if (this.lb_itemName) {
            this.lb_itemName.string = item.name ?? ''
        }
        if (this.lb_discription) {
            this.lb_discription.string = item.des || item.use_des || ''
        }
        if (this.lb_itemDate && item.created_at) {
            var time = new Date(item.created_at*1000)
            this.lb_itemDate.string = time.getFullYear() + "-" + (time.getMonth() + 1) + "-" + time.getDate() + "获得"
            console.log(" this.lb_itemDate.string",  this.lb_itemDate.string)
        }
    }

    /** 绑定放入背包按钮 */
    private bindPutIntoBackpackButton(): void {
        const btn = this.btn_putIntoStorage
            ?? this.node.getChildByName('nd_bg')?.getChildByName('btn_putIntoStorage')?.getComponent(Button)
            ?? null
        if (!btn) {
            console.warn('[BondItemDiscriptionPanel] 未找到 btn_putIntoStorage，请在 Inspector 绑定')
            return
        }
        this.btn_putIntoStorage = btn
        btn.node.off(Button.EventType.CLICK, this.onClickPutIntoBackpack, this)
        btn.node.on(Button.EventType.CLICK, this.onClickPutIntoBackpack, this)
    }

    /** 按节点名绑定引用 */
    private ensureRefs(): void {
        const ndBg = this.node.getChildByName('nd_bg')
        if (!ndBg) {
            return
        }
        if (!this.btn_putIntoStorage) {
            this.btn_putIntoStorage = ndBg.getChildByName('btn_putIntoStorage')?.getComponent(Button) ?? null
        }
        const descArea = ndBg.getChildByName('nd_discriptionArea')
        if (!descArea) {
            return
        }
        if (!this.lb_itemName) {
            this.lb_itemName = descArea.getChildByName('lb_itemName')?.getComponent(Label) ?? null
        }
        if (!this.lb_discription) {
            this.lb_discription = descArea.getChildByName('nd_textBg')
                ?.getChildByName('lb_discription')
                ?.getComponent(Label) ?? null
        }
        if (!this.lb_itemDate) {
            this.lb_itemDate = descArea.getChildByName('lb_itemDate')?.getComponent(Label) ?? null
        }
    }
}
