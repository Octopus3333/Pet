import { _decorator, Component, Label, Node, Sprite } from 'cc';
import { Item } from '../common/utils/InterfaceDefine';
import { loadItem, loadItemQuality } from '../common/utils/UiTools';

const { ccclass, property } = _decorator;

/** 格子点击回调 */
export type StorageSlotClickHandler = (slot: StorageSlot) => void;

@ccclass('StorageSlot')
export class StorageSlot extends Component {
    @property(Sprite)
    sp_icon: Sprite = null
    /** 选中框（sp_choosState_box） */
    @property(Sprite)
    sp_choose_box: Sprite = null
    /** 选中角标（sp_choosState_icon） */
    @property(Sprite)
    sp_choose: Sprite = null
    @property(Sprite)
    sp_quality:Sprite = null
    @property(Label)
    lb_name: Label = null
    @property(Label)
    lb_id: Label = null

    private _data: Item = null
    private _selected: boolean = false
    private _clickHandler: StorageSlotClickHandler = null

    protected onLoad(): void {
        this.ensureRefs()
        this.refreshChooseState()
        this.node.on(Node.EventType.TOUCH_END, this.onCellTouch, this)
    }

    /**
     * 注册格子点击回调（由 StoragePanel 统一管理单选/多选）
     * @param clickHandler 点击回调
     */
    init(clickHandler: StorageSlotClickHandler): void {
        this._clickHandler = clickHandler
    }
    loadData(data:Item){
        this.ensureRefs()
        this._data = data
        if (this.lb_name) {
            this.lb_name.string = data.name
        }
        if (this.lb_id) {
            this.lb_id.string = data.id.toString()
        }
        if (this.sp_icon) {
            loadItem(this.sp_icon, data.item_id)
        }
        if(this.sp_quality){
            loadItemQuality(this.sp_quality , data.item_id)
        }
    }

    protected onDestroy(): void {
        // this.node.off(Node.EventType.TOUCH_END, this.onCellTouch, this)
    }


    /** 设置选中状态 */
    setSelected(selected: boolean): void {
        this._selected = selected
        this.refreshChooseState()
    }

    get selected(): boolean {
        return this._selected
    }

    get itemData(): Item {
        return this._data
    }

    private onCellTouch(): void {
        if (!this._data || !this._clickHandler) {
            return
        }
        this._clickHandler(this)
    }

    /** 同步选中框与角标显隐 */
    private refreshChooseState(): void {
        const show = this._selected
        if (this.sp_choose_box?.node) {
            this.sp_choose_box.node.active = show
        }
        if (this.sp_choose?.node) {
            this.sp_choose.node.active = show
        }
    }

    /** 绑定/刷新节点引用，防止 Prefab 实例化后引用失效 */
    private ensureRefs(): void {
        if (!this.sp_icon) {
            this.sp_icon = this.node.getChildByName('nd_bg')
                ?.getChildByName('sp_itemIcon')
                ?.getComponent(Sprite) ?? null
        }
        if (!this.sp_choose_box) {
            this.sp_choose_box = this.node.getChildByName('sp_choosState_box')?.getComponent(Sprite) ?? null
        }
        if (!this.sp_choose) {
            this.sp_choose = this.node.getChildByName('sp_choosState_icon')?.getComponent(Sprite) ?? null
        }
        if (!this.lb_name) {
            this.lb_name = this.node.getChildByName('nd_bg')
                ?.getChildByName('lb_itemName')
                ?.getComponent(Label) ?? null
        }
        if (!this.lb_id) {
            this.lb_id = this.node.getChildByName('lb_item_id')?.getComponent(Label) ?? null
        }
    }
}
