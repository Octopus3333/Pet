import { _decorator, Component, Label, Node, Sprite, UITransform, Widget } from 'cc';
import { loadItem } from '../utils/UiTools';
import { ViewPath } from '../utils/Define';
import { Item } from '../utils/InterfaceDefine';
import { UIManager } from '../utils/UIManager';
import { SalePanel } from '../../game/SalePanel';

const { ccclass, property } = _decorator;

/** 格子点击回调：(格子索引) => void */
export type BackpackSlotClickHandler = (slotIndex: number) => void;

/**
 * 背包单个格子组件
 * 负责锁定/解锁、选中/非选中、道具展示等视觉状态
 */
@ccclass('BackpackSlot')
export class BackpackSlot extends Component {

    @property(Node)
    sp_chooseBox: Node = null;

    @property(Node)
    sp_chooseIcon: Node = null;

    @property(Sprite)
    sp_lockState: Sprite = null;

    @property(Sprite)
    sp_unLockState: Sprite = null;

    @property(Sprite)
    sp_itemIcon: Sprite = null;

    @property(Label)
    lb_itemName: Label = null;

    private _slotIndex: number = -1;
    private _locked: boolean = true;
    private _selected: boolean = false;
    private _item: Item | null = null;
    private _clickHandler: BackpackSlotClickHandler | null = null;
    /** 空格时的「+」提示节点（可选，部分 Prefab 有 add 子节点） */
    private nd_add: Node = null
    /** nd_bg 节点，作为点击热区 */
    private nd_bg: Node = null
    /** 是否已绑定触摸事件 */
    private _touchBound = false
    /** 图标异步加载序号，用于丢弃过期回调 */
    private _iconLoadSeq = 0
    /** 已成功加载到 Sprite 上的 item_id，用于面板重开时复用贴图 */
    private _loadedItemId = -1
    /** 道具图标显示尺寸（与 Prefab UITransform 一致） */
    private static readonly ICON_SIZE = 112
    /** Prefab 上 sp_itemIcon 的设计位置（勿用代码覆盖，交给 Widget） */
    private static readonly ICON_DESIGN_POS = { x: 0.2, y: 12, z: 0 }

    protected onLoad(): void {
        this.ensureRefs()
        this.bindTouchTargets()
    }

    protected onDestroy(): void {
        // this.unbindTouchTargets()
    }

    /**
     * 初始化格子索引与点击回调
     * @param slotIndex 格子在背包中的索引
     * @param clickHandler 点击回调
     */
    public init(slotIndex: number, clickHandler: BackpackSlotClickHandler): void {
        this._slotIndex = slotIndex;
        this._clickHandler = clickHandler;
        this.ensureRefs();
        this.bindTouchTargets();
    }

    /**
     * 一次性设置锁定状态与道具（避免分步刷新导致图标被误隐藏）
     * @param locked 是否锁定
     * @param item 道具数据，null 表示空
     */
    public setSlotData(locked: boolean, item: Item | null): void {
        this.ensureRefs();
        this._locked = locked;
        this._item = locked ? null : item;
        if (locked) {
            this._selected = false;
        }
        this.refreshView();
    }

    /**
     * 设置格子锁定状态
     * @param locked true=锁定（不可存放物品）
     */
    public setLocked(locked: boolean): void {
        this.setSlotData(locked, locked ? null : this._item);
    }

    /**
     * 设置选中状态
     * @param selected true=显示选中框与角标
     */
    public setSelected(selected: boolean): void {
        if (this._locked) {
            this._selected = false;
        } else {
            this._selected = selected;
        }
        this.refreshChooseState();
    }

    /**
     * 设置格子中的道具数据
     * @param item 道具数据，传 null 表示清空
     */
    public setItem(item: Item | null): void {
        if (this._locked) {
            return;
        }
        this.setSlotData(false, item);
    }

    /** 是否锁定 */
    public isLocked(): boolean {
        return this._locked;
    }

    /** 是否为空格 */
    public isEmpty(): boolean {
        return !this._locked && this._item == null;
    }

    /** 获取当前道具数据 */
    public getItem(): Item | null {
        return this._item;
    }

    /** 获取格子索引 */
    public getSlotIndex(): number {
        return this._slotIndex;
    }

    /** 绑定/刷新节点引用（每次刷新前调用，防止 Prefab 实例引用失效） */
    private ensureRefs(): void {
        this.sp_chooseBox = this.node.getChildByName('backpack_chooseState_box');
        this.sp_chooseIcon = this.node.getChildByName('backpack_chooseState_icon');

        this.nd_bg = this.node.getChildByName('nd_bg');
        if (!this.nd_bg) {
            console.warn(`[BackpackSlot] ${this.node.name} 未找到 nd_bg`);
            return;
        }

        this.sp_lockState = this.nd_bg.getChildByName('sp_lockState')?.getComponent(Sprite) ?? null;
        this.sp_unLockState = this.nd_bg.getChildByName('sp_unLockState')?.getComponent(Sprite) ?? null;
        this.sp_itemIcon = this.nd_bg.getChildByName('sp_itemIcon')?.getComponent(Sprite) ?? null;
        this.lb_itemName = this.nd_bg.getChildByName('lb_itemName')?.getComponent(Label) ?? null;
        this.nd_add = this.nd_bg.getChildByName('add') ?? null;
    }

    /** 绑定点击热区：捕获阶段监听，避免子节点 Sprite/Label 拦截触摸 */
    private bindTouchTargets(): void {
        if (this._touchBound) {
            return
        }
        this.node.on(Node.EventType.TOUCH_END, this.onSlotClick, this, true)
        this._touchBound = true
    }

    private unbindTouchTargets(): void {
        if (!this._touchBound) {
            return
        }
        this.node.off(Node.EventType.TOUCH_END, this.onSlotClick, this, true)
        this._touchBound = false
    }

    private async onSlotClick(): Promise<void> {
        if (this._locked) {
            const salePn = await UIManager.ins.show(ViewPath.SalePanel);
            if (!salePn) {
                return;
            }
            salePn.getComponent(SalePanel)?.showUnLockBag();
            return;
        }
        if (this.isEmpty()) {
            return;
        }
        this._clickHandler?.(this._slotIndex);
    }

    private refreshView(): void {
        this.ensureRefs();
        this.refreshLockState();
        this.refreshItemView();
        this.refreshChooseState();
    }

    private refreshLockState(): void {
        if (this.sp_lockState?.node) {
            this.sp_lockState.node.active = this._locked;
        }
        if (this.sp_unLockState?.node) {
            this.sp_unLockState.node.active = !this._locked;
        }
    }

    private refreshItemView(): void {
        if (this._locked || !this._item) {
            this.hideItemView();
            return;
        }

        if (this.lb_itemName) {
            this.lb_itemName.node.active = true;
            this.lb_itemName.string = this._item.name;
        }

        if (this.nd_add) {
            this.nd_add.active = false;
        }

        if (this.sp_itemIcon) {
            this.sp_itemIcon.enabled = true
            // 同一 item_id 且贴图仍在，直接复用（避免面板关闭再打开重复异步加载互相覆盖）
            if (this.sp_itemIcon.spriteFrame && this._loadedItemId === this._item.item_id) {
                this.sp_itemIcon.node.active = true
                this.applyIconLayout()
                return
            }
            this.sp_itemIcon.node.active = true
            this.applyIconLayout()
            void this.loadItemIcon(this._item.item_id)
        }
    }

    /** 固定图标尺寸，并刷新 Widget 对齐（禁止 setPosition 覆盖 Prefab 布局） */
    private applyIconLayout(): void {
        if (!this.sp_itemIcon?.isValid) {
            return
        }
        const iconNode = this.sp_itemIcon.node
        this.sp_itemIcon.sizeMode = Sprite.SizeMode.CUSTOM
        const ui = iconNode.getComponent(UITransform)
        if (ui) {
            ui.setContentSize(BackpackSlot.ICON_SIZE, BackpackSlot.ICON_SIZE)
        }
        this.refreshIconWidget(iconNode)
    }

    /**
     * 刷新 sp_itemIcon 的 Widget 对齐
     * 换图/改尺寸后 Widget 不会自动重算（alignMode=ON_WINDOW_RESIZE），需手动触发
     */
    private refreshIconWidget(iconNode: Node): void {
        const widget = iconNode.getComponent(Widget)
        if (widget?.enabled) {
            widget.updateAlignment()
            return
        }
        iconNode.setPosition(
            BackpackSlot.ICON_DESIGN_POS.x,
            BackpackSlot.ICON_DESIGN_POS.y,
            BackpackSlot.ICON_DESIGN_POS.z,
        )
    }

    private async loadItemIcon(itemId: number): Promise<void> {
        if (!this.sp_itemIcon) {
            return;
        }
        const seq = ++this._iconLoadSeq
        await loadItem(this.sp_itemIcon, itemId)
        if (seq !== this._iconLoadSeq || !this._item || this._item.item_id !== itemId) {
            // 过期请求：不要清空当前已显示的贴图（避免慢请求覆盖快请求结果）
            return
        }
        if (this.sp_itemIcon?.isValid) {
            this._loadedItemId = itemId
            this.applyIconLayout()
            this.sp_itemIcon.node.active = true
            this.scheduleOnce(() => {
                if (this.sp_itemIcon?.isValid && this._item?.item_id === itemId) {
                    this.refreshIconWidget(this.sp_itemIcon.node)
                }
            }, 0)
        }
    }

    private hideItemView(): void {
        ++this._iconLoadSeq
        this._loadedItemId = -1
        this.unscheduleAllCallbacks()
        if (this.sp_itemIcon?.node) {
            this.sp_itemIcon.node.active = false
        }
        if (this.lb_itemName?.node) {
            this.lb_itemName.node.active = false
            this.lb_itemName.string = ''
        }
        if (this.nd_add) {
            this.nd_add.active = !this._locked
        }
    }

    private refreshChooseState(): void {
        const showChoose = !this._locked && this._selected;
        if (this.sp_chooseBox) {
            this.sp_chooseBox.active = showChoose;
        }
        if (this.sp_chooseIcon) {
            this.sp_chooseIcon.active = showChoose;
        }
    }
}
