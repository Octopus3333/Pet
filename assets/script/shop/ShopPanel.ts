import { _decorator, Button, Color, Component, EventTouch, Label, Node, PageView, tween, Tween, Vec3 } from 'cc';
import { createPrefab } from '../common/utils/UiTools';
import { Common, IShopDataProvider, ShopTagItemsMap, ShopTagType, ShopTagTypeValue } from '../common/utils/Define';
import { ShopManager } from './ShopManager';
import { ShopSalePanel } from './ShopSalePanel';
import { SHOP_TAG_PAGE_CELL_MAX, ShopTagPage } from './ShopTagPage';
import { UIManager } from '../common/utils/UIManager';
import { ToastManager } from '../common/utils/ToastManager';
import { ShopItemCellData } from '../common/utils/InterfaceDefine';
const { ccclass, property } = _decorator;

/** 子标签按钮名 -> 标签类型 */
const SHOP_TAG_BTN_MAP: Record<string, ShopTagTypeValue> = {
    btn_sale: ShopTagType.Sale,
    btn_food: ShopTagType.Food,
    btn_clean: ShopTagType.Clean,
    btn_toy: ShopTagType.Toy,
    // TODO: 服饰/家具分区暂未开放
    // btn_cloth: ShopTagType.Cloth,
    // btn_furniture: ShopTagType.Furniture,
    btn_other: ShopTagType.Other,
};

/** PageView 页顺序：首页为特卖区 */
const SHOP_TAG_ORDER: ShopTagTypeValue[] = [
    ShopTagType.Sale,
    ShopTagType.Food,
    ShopTagType.Clean,
    ShopTagType.Toy,
    // TODO: 服饰/家具分区暂未开放
    // ShopTagType.Cloth,
    // ShopTagType.Furniture,
    ShopTagType.Other,
];

const SHOP_TAG_LABEL_MAP: Record<ShopTagTypeValue, string> = {
    [ShopTagType.Sale]: '每日特卖区',
    [ShopTagType.Food]: '食物区',
    [ShopTagType.Clean]: '清洁区',
    [ShopTagType.Toy]: '玩具区',
    [ShopTagType.Cloth]: '服饰区',
    [ShopTagType.Furniture]: '家具区',
    [ShopTagType.Other]: '其他',
};

const SHOP_TAG_SPRITE_MAP: Record<ShopTagTypeValue, string> = {
    [ShopTagType.Sale]: 'sp_sale',
    [ShopTagType.Food]: 'sp_food',
    [ShopTagType.Clean]: 'sp_clean',
    [ShopTagType.Toy]: 'sp_toy',
    [ShopTagType.Cloth]: 'sp_cloth',
    [ShopTagType.Furniture]: 'sp_furniture',
    [ShopTagType.Other]: 'sp_other',
};

const SHOP_SALE_PAGE_PATH = Common.prefabPath + 'shop/ShopSalePage';
const SHOP_TAG_PAGE_PATH = Common.prefabPath + 'shop/ShopTagPage';

@ccclass('ShopPanel')
export class ShopPanel extends Component {

    @property(Button)
    btn_close: Button = null;
    @property(Button)
    btn_tag: Button = null;
    @property(Button)
    btn_pre: Button = null;
    @property(Button)
    btn_next: Button = null;

    @property(Node)
    nd_content: Node = null;
    @property(Node)
    nd_bottom: Node = null;
    @property(Node)
    nd_tags: Node = null;

    @property(PageView)
    pv_content: PageView = null;
    
    @property(Label)
    lb_tag: Label = null;

    private _curTag: ShopTagTypeValue = ShopTagType.Sale;
    private _curPageIdx = 0;
    private _pagesLoaded = false;
    /** 各子标签在 Prefab 中配置的文字颜色 */
    private _tagLabelColors: Partial<Record<ShopTagTypeValue, Color>> = {};
    /** 商店数据源 */
    private _dataProvider: IShopDataProvider = ShopManager.ins;
    /** 外部直接传入的商品数据，优先级高于 DataProvider */
    private _manualItems: ShopTagItemsMap | null = null;

    private sp_dog1: Node = null;
    private sp_dog2: Node = null;
    private sp_tag: Node = null;
    private _dogMoved = false;
    private _dog1InitPos: Vec3 = null;
    private readonly _onDogIdle = (): void => {
        this.tryPlayDogMove();
    };
    private readonly _onPanelTouchEnd = (event: EventTouch): void => {
        this.tryCollapseTagList(event);
        this.tryPlayDogMove();
    };

    protected onLoad(): void {
        this.ensureTagRefs();
        this.ensureBottomRefs();
        this.cacheTagLabelColors();
        this.bindButtons();
        this.pv_content.node.on(PageView.EventType.PAGE_TURNING, this.onPageTurning, this);
        this.refreshTagUI();
        void this.bootstrapPages();
    }

    protected onEnable(): void {
        this.resetDogState();
        this.resetToDefaultTag();
        this.node.on(Node.EventType.TOUCH_END, this._onPanelTouchEnd, this, true);
        this.startDogIdleTimer();
    }

    protected onDisable(): void {
        this.node.off(Node.EventType.TOUCH_END, this._onPanelTouchEnd, this, true);
        this.stopDogTween();
        this.unschedule(this._onDogIdle);
    }

    private async bootstrapPages(): Promise<void> {
        if (this._dataProvider === ShopManager.ins) {
            await ShopManager.ins.reload();
        } else {
            await this._dataProvider.load();
        }
        await this.loadAllPages();
    }

    protected onDestroy(): void {
        this.stopDogTween();
        this.unschedule(this._onDogIdle);
    }

    /**
     * 注入商店数据源（接入服务端数据时使用）
     * @param provider 实现 IShopDataProvider 的数据源
     */
    setDataProvider(provider: IShopDataProvider): void {
        this._dataProvider = provider;
        this._manualItems = null;
    }

    /**
     * 直接传入各标签商品数据（优先级高于 DataProvider）
     * @param data 各标签对应的商品列表
     * @param refresh 是否立即刷新全部分区页
     */
    async setShopData(data: ShopTagItemsMap, refresh = true): Promise<void> {
        this._manualItems = { ...this._manualItems, ...data };
        if (refresh) {
            await this.loadAllPages();
        }
    }

    /**
     * 传入单个标签的商品数据
     * @param tag 标签类型
     * @param items 商品列表
     * @param refresh 是否刷新对应分区页
     */
    async setTagItems(tag: ShopTagTypeValue, items: ShopItemCellData[], refresh = true): Promise<void> {
        if (!this._manualItems) {
            this._manualItems = {};
        }
        this._manualItems[tag] = items;
        if (refresh) {
            await this.refreshPageData(tag);
        }
    }

    /** 补齐 Prefab 未绑定的标签节点引用 */
    private ensureTagRefs(): void {
        if (!this.nd_tags) {
            this.nd_tags = this.node.getChildByName('nd_tags');
        }
        if (!this.lb_tag && this.btn_tag) {
            this.lb_tag = this.btn_tag.node.getChildByName('lb_text')?.getComponent(Label) ?? null;
        }
        if (!this.sp_tag && this.btn_tag) {
            this.sp_tag = this.btn_tag.node.getChildByName('sp_tag');
        }
    }

    /** 从下拉标签按钮读取各标签文字颜色 */
    private cacheTagLabelColors(): void {
        if (!this.nd_tags) {
            return;
        }
        for (const child of this.nd_tags.children) {
            const tagType = SHOP_TAG_BTN_MAP[child.name];
            if (tagType == null) {
                continue;
            }
            const label = child.getComponentInChildren(Label);
            if (label) {
                this._tagLabelColors[tagType] = label.color.clone();
            }
        }
    }

    /** 绑定顶部标签按钮与子标签列表 */
    private bindButtons(): void {
        this.btn_close?.node.on(Button.EventType.CLICK, this.onClose, this);
        this.btn_tag?.node.on(Button.EventType.CLICK, this.onClickTag, this);
        this.btn_pre?.node.on(Button.EventType.CLICK, this.onClickPre, this);
        this.btn_next?.node.on(Button.EventType.CLICK, this.onClickNext, this);
        if (!this.nd_tags) {
            return;
        }
        for (const child of this.nd_tags.children) {
            const tagType = SHOP_TAG_BTN_MAP[child.name];
            if (tagType == null) {
                continue;
            }
            this.bindSubTagButton(child, tagType);
        }
    }

    private bindSubTagButton(tagNode: Node, tagType: ShopTagTypeValue): void {
        const handler = () => this.onClickSubTag(tagType);
        const btn = tagNode.getComponent(Button);
        if (btn) {
            btn.node.on(Button.EventType.CLICK, handler, this);
            return;
        }
        const innerBtn = tagNode.getComponentInChildren(Button);
        if (!innerBtn) {
            return;
        }
        innerBtn.node.on(Button.EventType.CLICK, handler, this);
        tagNode.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
            if (event.target === tagNode) {
                handler.call(this);
            }
        }, this);
    }

    onClickTag(): void {
        if (!this.nd_tags) {
            return;
        }
        const expanded = !this.nd_tags.active;
        this.nd_tags.active = expanded;
        this.refreshTagArrow(expanded);
    }

    /** 收起分区下拉列表 */
    private collapseTagList(): void {
        if (!this.nd_tags?.active) {
            return;
        }
        this.nd_tags.active = false;
        this.refreshTagArrow(false);
    }

    /** 分区列表展开时，点击列表外区域自动收起 */
    private tryCollapseTagList(event: EventTouch): void {
        if (!this.nd_tags?.active) {
            return;
        }
        const target = event.target as Node;
        if (this.isNodeUnderAncestor(target, this.nd_tags)) {
            return;
        }
        if (this.isNodeUnderAncestor(target, this.btn_tag?.node ?? null)) {
            return;
        }
        this.collapseTagList();
    }

    private isNodeUnderAncestor(node: Node | null, ancestor: Node | null): boolean {
        if (!node || !ancestor) {
            return false;
        }
        let current: Node | null = node;
        while (current) {
            if (current === ancestor) {
                return true;
            }
            current = current.parent;
        }
        return false;
    }

    /** 展开/收起标签列表时旋转箭头 */
    private refreshTagArrow(expanded: boolean): void {
        this.ensureTagRefs();
        if (!this.sp_tag) {
            return;
        }
        this.sp_tag.angle = expanded ? -90 : 0;
    }

    onClickSubTag(tagType: ShopTagTypeValue | string): void {
        const tag = Number(tagType) as ShopTagTypeValue;
        this.collapseTagList();
        if (tag === this._curTag) {
            return;
        }
        this.switchToTag(tag);
    }

    /** 上一分区 */
    onClickPre(): void {
        if (this._curPageIdx <= 0) {
            return;
        }
        this.switchToPage(this._curPageIdx - 1);
    }

    /** 下一分区 */
    onClickNext(): void {
        if (this._curPageIdx >= SHOP_TAG_ORDER.length - 1) {
            return;
        }
        this.switchToPage(this._curPageIdx + 1);
    }

    private onPageTurning(): void {
        this.syncTagFromPage(this.pv_content.curPageIdx);
    }

    private switchToTag(tag: ShopTagTypeValue): void {
        const pageIdx = SHOP_TAG_ORDER.indexOf(tag);
        if (pageIdx < 0) {
            return;
        }
        this.switchToPage(pageIdx);
    }

    private switchToPage(pageIdx: number, duration = 0.3): void {
        if (!this.pv_content || pageIdx < 0 || pageIdx >= SHOP_TAG_ORDER.length) {
            return;
        }
        this._curPageIdx = pageIdx;
        this._curTag = SHOP_TAG_ORDER[pageIdx];
        this.pv_content.scrollToPage(pageIdx, duration);
        this.refreshTagUI();
        this.refreshPageButtons();
        void this.onTagShown(this._curTag);
    }

    private syncTagFromPage(pageIdx: number): void {
        if (pageIdx < 0 || pageIdx >= SHOP_TAG_ORDER.length) {
            return;
        }
        this._curPageIdx = pageIdx;
        this._curTag = SHOP_TAG_ORDER[pageIdx];
        this.refreshTagUI();
        this.refreshPageButtons();
        void this.onTagShown(this._curTag);
    }

    /** 进入某分区时清除 new 标签并刷新角标 */
    private async onTagShown(tag: ShopTagTypeValue): Promise<void> {
        if (tag === ShopTagType.Sale) {
            this.resetSaleScrollPosition();
        }
        await this._dataProvider.clearTagIsNew(tag);
        this.refreshTagNewBadges();
    }

    /** 特卖区商品列表回到最顶端 */
    private resetSaleScrollPosition(): void {
        const salePageIdx = SHOP_TAG_ORDER.indexOf(ShopTagType.Sale);
        if (salePageIdx < 0) {
            return;
        }
        const pages = this.pv_content?.getPages() ?? [];
        pages[salePageIdx]?.getComponent(ShopSalePanel)?.resetScrollPosition();
    }

    private refreshTagNewBadges(): void {
        if (!this.nd_tags) {
            return;
        }
        for (const child of this.nd_tags.children) {
            const tagType = SHOP_TAG_BTN_MAP[child.name];
            if (tagType == null) {
                continue;
            }
            const spNew = child.getChildByName('sp_new');
            if (spNew) {
                spNew.active = this._dataProvider.hasTagNew(tagType);
            }
        }
    }

    private refreshTagUI(): void {
        this.refreshTagLabel();
        this.refreshTagSprite();
    }

    private refreshTagLabel(): void {
        if (!this.lb_tag) {
            return;
        }
        this.lb_tag.string = SHOP_TAG_LABEL_MAP[this._curTag] || '';
        const color = this._tagLabelColors[this._curTag];
        if (color) {
            this.lb_tag.color = color;
        }
    }

    private refreshTagSprite(): void {
        const tagSpritesRoot = this.btn_tag?.node.parent;
        if (!tagSpritesRoot) {
            return;
        }
        const activeSpriteName = SHOP_TAG_SPRITE_MAP[this._curTag];
        for (const child of tagSpritesRoot.children) {
            if (!child.name.startsWith('sp_')) {
                continue;
            }
            child.active = child.name === activeSpriteName;
        }
    }

    private refreshPageButtons(): void {
        const totalPage = SHOP_TAG_ORDER.length;
        this.btn_pre.node.active = this._curPageIdx > 0;
        this.btn_next.node.active = this._curPageIdx < totalPage - 1;
    }

    /** 每次进入商店默认展示「每日特卖区」，不保留上次离开时的分区 */
    private resetToDefaultTag(): void {
        if (!this._pagesLoaded || !this.pv_content) {
            return;
        }
        this.collapseTagList();
        this._curPageIdx = 0;
        this._curTag = ShopTagType.Sale;
        this.pv_content.scrollToPage(0, 0);
        this.refreshTagUI();
        this.refreshPageButtons();
        this.refreshTagNewBadges();
        void this.onTagShown(ShopTagType.Sale);
    }

    private async getTagItems(tag: ShopTagTypeValue): Promise<ShopItemCellData[]> {
        let items: ShopItemCellData[];
        if (this._manualItems?.[tag]) {
            items = this._manualItems[tag];
        } else {
            await this._dataProvider.load();
            items = this._dataProvider.getItemsByTag(tag);
        }
        return items;
    }

    /** 一次性加载全部分区页，首页为特卖区 */
    private async loadAllPages(): Promise<void> {
        if (!this.pv_content?.content) {
            return;
        }
        this.clearPages();
        this._pagesLoaded = false;
        this.pv_content.horizontal = true;
        this.pv_content.vertical = false;

        for (const tag of SHOP_TAG_ORDER) {
            if (tag === ShopTagType.Sale) {
                await this.loadSalePage();
            } else {
                await this.loadTagPage(tag);
            }
            if (!this.isValid || !this.pv_content?.content) {
                return;
            }
        }

        this._pagesLoaded = true;
        this._curTag = ShopTagType.Sale;
        this._curPageIdx = 0;
        this.pv_content.scrollToPage(0, 0);
        this.refreshTagUI();
        this.refreshPageButtons();
        this.refreshTagNewBadges();
        void this.onTagShown(ShopTagType.Sale);
    }

    private async loadSalePage(): Promise<void> {
        const pageNode = await createPrefab(SHOP_SALE_PAGE_PATH);
        if (!pageNode?.isValid || !this.pv_content?.content) {
            return;
        }
        pageNode.parent = this.pv_content.content;
        this.pv_content.addPage(pageNode);
        const panel = pageNode.getComponent(ShopSalePanel);
        await panel?.setData(await this.getTagItems(ShopTagType.Sale));
    }

    /** 每个普通分区仅一页，最多 9 个商品 */
    private async loadTagPage(tag: ShopTagTypeValue): Promise<void> {
        const pageNode = await createPrefab(SHOP_TAG_PAGE_PATH);
        if (!pageNode?.isValid || !this.pv_content?.content) {
            return;
        }
        pageNode.parent = this.pv_content.content;
        this.pv_content.addPage(pageNode);
        const page = pageNode.getComponent(ShopTagPage);
        page?.initTag(tag);
        const items = (await this.getTagItems(tag)).slice(0, SHOP_TAG_PAGE_CELL_MAX);
        await page?.setData(items);
    }

    /** 刷新已加载分区上的商品数据 */
    private async refreshPageData(tag: ShopTagTypeValue): Promise<void> {
        if (!this._pagesLoaded) {
            await this.loadAllPages();
            return;
        }
        const pageIdx = SHOP_TAG_ORDER.indexOf(tag);
        const pages = this.pv_content?.getPages() ?? [];
        const pageNode = pages[pageIdx];
        if (!pageNode?.isValid) {
            return;
        }
        const items = await this.getTagItems(tag);
        if (tag === ShopTagType.Sale) {
            await pageNode.getComponent(ShopSalePanel)?.setData(items);
            return;
        }
        const tagPage = pageNode.getComponent(ShopTagPage);
        tagPage?.initTag(tag);
        await tagPage?.setData(items.slice(0, SHOP_TAG_PAGE_CELL_MAX));
    }

    private clearPages(): void {
        if (!this.pv_content) {
            return;
        }
        const pages = [...this.pv_content.getPages()];
        for (const page of pages) {
            this.pv_content.removePage(page);
            if (page?.isValid) {
                page.destroy();
            }
        }
    }

    /** 补齐 Prefab 未绑定的底部节点引用 */
    private ensureBottomRefs(): void {
        if (!this.nd_bottom) {
            this.nd_bottom = this.node.getChildByName('nd_bottom');
        }
        if (!this.nd_bottom) {
            return;
        }
        if (!this.sp_dog1) {
            this.sp_dog1 = this.nd_bottom.getChildByName('sp_dog1');
        }
        if (!this.sp_dog2) {
            this.sp_dog2 = this.nd_bottom.getChildByName('sp_dog2');
        }
        if (this.sp_dog1 && !this._dog1InitPos) {
            this._dog1InitPos = this.sp_dog1.position.clone();
        }
    }

    private resetDogState(): void {
        this.ensureBottomRefs();
        this._dogMoved = false;
        this.stopDogTween();
        if (this.sp_dog1 && this._dog1InitPos) {
            this.sp_dog1.setPosition(this._dog1InitPos);
            this.sp_dog1.active = true;
        }
        if (this.sp_dog2) {
            this.sp_dog2.active = false;
        }
    }

    private startDogIdleTimer(): void {
        this.unschedule(this._onDogIdle);
        if (!this._dogMoved) {
            this.scheduleOnce(this._onDogIdle, 5);
        }
    }

    private tryPlayDogMove(): void {
        if (this._dogMoved) {
            return;
        }
        this.unschedule(this._onDogIdle);
        this.playDogMove();
    }

    /** sp_dog1 先右移再下移，到位后切换为 sp_dog2 */
    private playDogMove(): void {
        this.ensureBottomRefs();
        if (!this.sp_dog1?.isValid || !this.sp_dog2?.isValid) {
            return;
        }
        this._dogMoved = true;
        this.stopDogTween();

        const target = this.sp_dog2.position;
        const current = this.sp_dog1.position;

        tween(this.sp_dog1)
            .to(0.4, { position: new Vec3(target.x, current.y, current.z) }, { easing: 'quadOut' })
            .to(0.3, { position: new Vec3(target.x, target.y, target.z) })
            .call(() => {
                this.sp_dog1.active = false;
                this.sp_dog2.active = true;
            })
            .start();
    }

    private stopDogTween(): void {
        if (this.sp_dog1?.isValid) {
            Tween.stopAllByTarget(this.sp_dog1);
        }
    }

    onClose(): void {
        UIManager.ins.hideView(this.node);
    }

    /** 合成（btn_yellow） */
    onClickCompose(): void {
        ToastManager.ins.showToast('敬请期待');
    }

    /** 集市（btn_green） */
    onClickMarket(): void {
        ToastManager.ins.showToast('敬请期待');
    }
}
