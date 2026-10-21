import { _decorator, Component, Layout, Node, ScrollView, Sprite, UITransform } from 'cc';
import { createPrefab } from '../common/utils/UiTools';
import { Common } from '../common/utils/Define';
import { ShopItemCell, ShopItemCellData } from './ShopItemCell';
const { ccclass, property } = _decorator;

const SHOP_ITEM_CELL_PATH = Common.prefabPath + 'shop/ShopItemCell';
/** lb_text 距 sp_bg 顶边的距离（prefab 原始值 1080 高时约为 36） */
const SALE_BG_LABEL_TOP_OFFSET = 36;
/** 「特卖中」标题区占用高度（用于背景顶边计算） */
const SALE_HEADER_HEIGHT = 50;

@ccclass('ShopSalePanel')
export class ShopSalePanel extends Component {
    @property(ScrollView)
    sv_content: ScrollView = null;
    /** SaleArea/Content，商品挂载节点 */
    @property(Node)
    nd_item_content: Node = null;
    /** SaleArea 九宫格背景 sp_bg */
    @property(Node)
    nd_sale_area_bg: Node = null;
    @property({ tooltip: '商品网格与背景顶部的间距，可在编辑器中调整' })
    paddingTop = 40;
    @property({ tooltip: '商品网格与背景底部的间距，可在编辑器中调整' })
    paddingBottom = 30;

    /** 滚动条 Handle 装饰图（bar1） */
    private _scrollBarVisual: Node = null;
    /** 与装饰图一致的点击宽度，避免 Handle 过窄拖不动 */
    private static readonly SCROLL_BAR_HIT_WIDTH = 52;

    protected onLoad(): void {
        this.ensureRefs();
        const bar = this.sv_content?.node
            ?.getChildByName('scrollBar')
            ?.getChildByName('bar') ?? null;
        this._scrollBarVisual = bar?.getChildByName('bar1') ?? null;
        const barUI = bar?.getComponent(UITransform);
        if (barUI) {
            barUI.width = ShopSalePanel.SCROLL_BAR_HIT_WIDTH;
        }
    }

    /** 将滚动条装饰图固定在 Handle 几何中心，并保持可点击宽度 */
    protected lateUpdate(): void {
        const visual = this._scrollBarVisual;
        const bar = visual?.parent;
        if (!visual?.isValid || !bar?.isValid) {
            return;
        }
        const barUI = bar.getComponent(UITransform);
        if (!barUI) {
            return;
        }
        if (barUI.width !== ShopSalePanel.SCROLL_BAR_HIT_WIDTH) {
            barUI.width = ShopSalePanel.SCROLL_BAR_HIT_WIDTH;
        }
        visual.setPosition(barUI.width / 2, barUI.height / 2, 0);
    }

    async setData(dataList: ShopItemCellData[]): Promise<void> {
        this.ensureRefs();
        const itemContent = this.nd_item_content;
        if (!itemContent) {
            return;
        }
        this.clearCells();
        const list = dataList || [];
        for (let i = 0; i < list.length; i++) {
            const cellNode = await createPrefab(SHOP_ITEM_CELL_PATH);
            if (!cellNode?.isValid || !itemContent.isValid) {
                continue;
            }
            cellNode.parent = itemContent;
            const cell = cellNode.getComponent(ShopItemCell);
            if (cell && list[i]) {
                cell.setData(list[i]);
            }
        }
        this.refreshSaleAreaSize();
        this.resetScrollPosition();
    }

    /** 将特卖商品列表滚动到最顶端 */
    resetScrollPosition(): void {
        this.sv_content?.scrollToTop(0);
    }

    /** 按商品网格区域收缩 sp_bg，并同步 SaleArea 根节点高度（避免破坏 Layout spacingY） */
    private refreshSaleAreaSize(): void {
        const itemContent = this.nd_item_content;
        const saleArea = itemContent?.parent;
        if (!itemContent?.isValid || !saleArea?.isValid) {
            return;
        }
        const contentLayout = itemContent.getComponent(Layout);
        if (contentLayout) {
            contentLayout.paddingTop = this.paddingTop;
            contentLayout.paddingBottom = this.paddingBottom;
        }
        contentLayout?.updateLayout();

        const spBg = this.nd_sale_area_bg ?? this.findSaleAreaBackground(saleArea);
        if (!spBg?.isValid) {
            return;
        }

        const saleUI = saleArea.getComponent(UITransform);
        const bgUI = spBg.getComponent(UITransform);
        if (!saleUI || !bgUI) {
            return;
        }

        const contentTop = this.getNodeTopY(itemContent);
        const contentBottom = this.getNodeBottomY(itemContent);
        const bgTop = contentTop + SALE_HEADER_HEIGHT;
        const bgBottom = contentBottom;
        const bgHeight = Math.max(bgTop - bgBottom, 0);

        saleUI.height = bgHeight;

        // 将 SaleArea 内子节点整体上移，使背景顶边与 SaleArea 顶边对齐，避免商品超出背景
        const saleTopY = saleUI.height * (1 - saleUI.anchorPoint.y);
        const offsetY = saleTopY - bgTop;
        if (Math.abs(offsetY) > 0.01) {
            for (const child of saleArea.children) {
                const pos = child.position;
                child.setPosition(pos.x, pos.y + offsetY, pos.z);
            }
        }

        bgUI.setAnchorPoint(0.5, 1);
        spBg.setPosition(spBg.position.x, saleTopY, spBg.position.z);
        bgUI.height = bgHeight;

        this.syncSaleBgLabel(spBg);
        this.ensureSlicedSprite(spBg);

        this.sv_content?.content?.getComponent(Layout)?.updateLayout();
    }

    /** 背景顶对齐后，保持「特卖中」标签贴在顶边 */
    private syncSaleBgLabel(spBg: Node): void {
        const lbText = spBg.getChildByName('lb_text');
        if (!lbText) {
            return;
        }
        lbText.setPosition(lbText.position.x, -SALE_BG_LABEL_TOP_OFFSET, lbText.position.z);
    }

    private ensureSlicedSprite(bg: Node): void {
        const sprite = bg.getComponent(Sprite);
        if (!sprite) {
            return;
        }
        sprite.type = Sprite.Type.SLICED;
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    }

    private findSaleAreaBackground(saleArea: Node): Node | null {
        if (this.nd_sale_area_bg?.isValid) {
            return this.nd_sale_area_bg;
        }
        return saleArea.getChildByName('sp_bg') ?? saleArea.getChildByName('sp_sale_bg');
    }

    private getNodeTopY(node: Node): number {
        const ui = node.getComponent(UITransform);
        if (!ui) {
            return node.position.y;
        }
        return node.position.y + ui.height * (1 - ui.anchorPoint.y);
    }

    private getNodeBottomY(node: Node): number {
        const ui = node.getComponent(UITransform);
        if (!ui) {
            return node.position.y;
        }
        return node.position.y - ui.height * ui.anchorPoint.y;
    }

    private ensureRefs(): void {
        if (!this.sv_content) {
            this.sv_content = this.node.getComponentInChildren(ScrollView);
        }
        if (!this.nd_item_content) {
            const scrollContent = this.sv_content?.content;
            const saleArea = scrollContent?.getChildByName('SaleArea');
            this.nd_item_content = saleArea?.getChildByName('Content') ?? null;
        }
        if (!this.nd_sale_area_bg && this.nd_item_content?.parent) {
            this.nd_sale_area_bg = this.findSaleAreaBackground(this.nd_item_content.parent);
        }
    }

    private clearCells(): void {
        if (this.nd_item_content?.isValid) {
            this.nd_item_content.removeAllChildren();
        }
    }
}
