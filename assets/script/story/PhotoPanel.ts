import { _decorator, Component, instantiate, Node, PageView, Sprite, Color, UITransform, Layout, SpriteFrame, Label } from 'cc';
import { UIManager } from '../common/utils/UIManager';
import { PhotoCellLayer } from './PhotoCellLayer';
import { PhotoDetailPanel } from './PhotoDetailPanel';
import { AlbumDataProvider } from './AlbumDataProvider';
import { AlbumCategory, AlbumCategoryValue} from '../common/utils/Define';
import { PhotoItem } from '../common/utils/InterfaceDefine';
import { PhotoConfigManager } from './PhotoConfigManager';

const { ccclass, property } = _decorator;

@ccclass('PhotoPanel')
export class PhotoPanel extends Component {
    @property(Node)
    btn_back: Node = null;

    @property(PageView)
    pg_content: PageView = null;

    @property(Node)
    btn_pre: Node = null;

    @property(Node)
    btn_next: Node = null;

    @property(Node)
    nd_tabs: Node = null;

    @property(Node)
    nd_indicator: Node = null; // Indicator 容器节点

    @property(Sprite)
    sp_indicator_normal: Sprite = null; // 正常状态 Sprite 模板

    @property(Sprite)
    sp_indicator_selected: Sprite = null; // 选中状态 Sprite 模板

    @property(Label)
    lb_collected: Label = null; // 已收集文本

    private readonly PAGE_SIZE = 6;
    private readonly MAX_INDICATORS = 6;
    private readonly PRELOAD_RANGE = 2;

    private _currentCategory: number = 0;
    private _curPageIdx: number = 0;
    private _tabNodes: Node[] = [];
    private _tabOriginY: number[] = [];
    private _pageNodes: Node[] = [];
    private _loadedPages: Set<number> = new Set();
    private _indicatorNodes: Node[] = [];

    // ========== 数据层 ==========
    private _albumProvider: AlbumDataProvider = new AlbumDataProvider();

    /** 前端 tab 索引 → 后端 category（按 tab 图标物种，非节点名） */
    private readonly TAB_TO_CATEGORY: Record<number, AlbumCategoryValue> = {
        0: AlbumCategory.Daily,
        2: AlbumCategory.Cat,
        3: AlbumCategory.Dog,
        4: AlbumCategory.Rabbit,
        1: AlbumCategory.Friend,
    };

    /** 后端 category → 前端 tab 索引 */
    private readonly CATEGORY_TO_TAB: Record<number, number> = {
        [AlbumCategory.Daily]: 0,
        [AlbumCategory.Friend]: 1,
        [AlbumCategory.Cat]: 2,
        [AlbumCategory.Dog]: 3,
        [AlbumCategory.Rabbit]: 4,
    };

    // ========== 生命周期 ==========

    protected async onLoad(): Promise<void> {
        console.log('[PhotoPanel] onLoad 开始');
        await PhotoConfigManager.ins.load();
        this.btn_back?.on(Node.EventType.TOUCH_END, this.onClickBack, this);
        this.btn_pre?.on(Node.EventType.TOUCH_END, this.onClickPrev, this);
        this.btn_next?.on(Node.EventType.TOUCH_END, this.onClickNext, this);

        const pageNode = this.pg_content?.node;
        if (pageNode?.isValid) {
            pageNode.on(PageView.EventType.PAGE_TURNING, this.onPageTurning, this);
        }

        const tabNames = ['btn_daily', 'btn_friend', 'btn_dog', 'btn_cat', 'btn_rabbit'];
        tabNames.forEach((name, index) => {
            const tab = this.nd_tabs?.getChildByName(name);
            if (tab) {
                this._tabNodes.push(tab);
                this._tabOriginY.push(tab.position.y);
                tab.on(Node.EventType.TOUCH_END, () => this.onClickTab(index), this);
            }
        });

        this.initIndicators();
        this.refreshTabLocks();
        this.updateCollectedText();
        await this.selectTab(0);
        console.log('[PhotoPanel] onLoad 完成');
    }

    onDestroy(): void {
        const pageNode = this.pg_content?.node;
        if (pageNode?.isValid) {
            pageNode.off(PageView.EventType.PAGE_TURNING, this.onPageTurning, this);
        }
    }

    // ========== Indicator 初始化 ==========

    private initIndicators(): void {
        if (!this.nd_indicator) return;

        this.nd_indicator.removeAllChildren();
        this._indicatorNodes = [];

        for (let i = 0; i < this.MAX_INDICATORS; i++) {
            const dot = new Node(`indicator_${i}`);

            const sprite = dot.addComponent(Sprite);
            sprite.spriteFrame = this.sp_indicator_normal?.spriteFrame || null;
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;

            const uiTransform = dot.getComponent(UITransform);
            uiTransform.setContentSize(12, 12);

            dot.parent = this.nd_indicator;
            this._indicatorNodes.push(dot);
        }

        let layout = this.nd_indicator.getComponent(Layout);
        if (!layout) {
            layout = this.nd_indicator.addComponent(Layout);
        }
    }

    // ========== Indicator 更新 ==========

    private updateIndicators(): void {
        const totalPage = this.totalPages;
        if (totalPage <= 0) {
            this.nd_indicator && (this.nd_indicator.active = false);
            return;
        }

        this.nd_indicator && (this.nd_indicator.active = true);

        const maxIndicators = this.MAX_INDICATORS;
        let startIdx: number;
        let endIdx: number;

        if (totalPage <= maxIndicators) {
            startIdx = 0;
            endIdx = totalPage - 1;
        } else {
            const windowSize = maxIndicators;
            startIdx = this._curPageIdx - 2;
            endIdx = startIdx + windowSize - 1;

            if (startIdx < 0) {
                startIdx = 0;
                endIdx = windowSize - 1;
            }
            if (endIdx >= totalPage) {
                endIdx = totalPage - 1;
                startIdx = totalPage - windowSize;
            }
        }

        for (let i = 0; i < this._indicatorNodes.length; i++) {
            const dot = this._indicatorNodes[i];
            const pageIndex = startIdx + i;

            dot.active = true;

            const sprite = dot.getComponent(Sprite);
            const uiTransform = dot.getComponent(UITransform);

            if (pageIndex <= endIdx && pageIndex >= 0) {
                if (sprite) {
                    const color = sprite.color.clone();
                    color.a = 255;
                    sprite.color = color;

                    if (pageIndex === this._curPageIdx) {
                        sprite.spriteFrame = this.sp_indicator_selected?.spriteFrame || null;
                        dot.setScale(1.2, 1.2, 1);
                    } else {
                        sprite.spriteFrame = this.sp_indicator_normal?.spriteFrame || null;
                        dot.setScale(1, 1, 1);
                    }
                }
                if (uiTransform) {
                    uiTransform.setContentSize(12, 12);
                }
            } else {
                if (sprite) {
                    const color = sprite.color.clone();
                    color.a = 0;
                    sprite.color = color;
                }
                if (uiTransform) {
                    uiTransform.setContentSize(0, 0);
                }
            }
        }
    }

    // ========== 分类映射 ==========

    /** 获取当前分类对应的后端 category 值 */
    private getApiCategory(): AlbumCategoryValue {
        return this.TAB_TO_CATEGORY[this._currentCategory] ?? AlbumCategory.Daily;
    }

    // ========== 标签 ==========

    private onClickTab(index: number): void {
        if (this._currentCategory === index) return;
        if (this.isTabLocked(index)) return;
        this.selectTab(index);
    }

    private async selectTab(index: number): Promise<void> {
        console.log('[PhotoPanel] selectTab 开始, index:', index);
        // 还原旧标签位置
        const old = this._tabNodes[this._currentCategory];
        if (old) {
            old.setPosition(old.position.x, this._tabOriginY[this._currentCategory], old.position.z);
        }

        // 上移新标签
        const cur = this._tabNodes[index];
        if (cur) {
            cur.setPosition(cur.position.x, this._tabOriginY[index] + 33.5, cur.position.z);
        }

        this._currentCategory = index;
        this._curPageIdx = 0;

        // 清理旧页面
        this.clearAllPages();
        console.log('[PhotoPanel] 页面已清理');

        // ★ 先请求第1页，获取总数和各分类数量
        const apiCategory = this.getApiCategory();
        console.log('[PhotoPanel] 请求第1页, category:', apiCategory);

        console.log('[PhotoPanel] _albumProvider:', !!this._albumProvider);

        await this._albumProvider.loadPage(apiCategory, 1);
         console.log('[PhotoPanel] 第1页加载完成');
         console.log('[PhotoPanel] total:', this.total);
        console.log('[PhotoPanel] totalPages:', this.totalPages);

        // 刷新锁状态和已收集文本
        this.refreshTabLocks();
        this.updateCollectedText();

        // 有了总数后创建占位页面
        this.createPlaceholderPages();

        // 加载当前页数据
        await this.loadPageData(this._curPageIdx);

        this.scheduleOnce(() => {
            this.preloadAdjacentPagesData();
        }, 0.1);

        this.updateView();
    }

    // ========== 已收集文本 ==========

    private updateCollectedText(): void {
        if (!this.lb_collected) return;

        const apiCategory = this.getApiCategory();
        const counts = this._albumProvider.getCategoryCounts();
        const count = counts[apiCategory] || 0;
        this.lb_collected.string = `已收集：${count}张照片`;
    }

    // ========== 锁定 ==========

    private isTabLocked(index: number): boolean {
        const apiCategory = this.TAB_TO_CATEGORY[index];
        if (apiCategory === undefined) return true;
        const counts = this._albumProvider.getCategoryCounts();
        return (counts[apiCategory] || 0) <= 0;
    }

    private refreshTabLocks(): void {
        this._tabNodes.forEach((tab, index) => {
            const lock = tab.getChildByName('sp_lock');
            if (lock) lock.active = this.isTabLocked(index);
        });
    }

    // ========== 翻页 ==========

    private onClickPrev(): void {
        if (this._curPageIdx <= 0) return;
        this._curPageIdx--;
        this.pg_content?.scrollToPage(this._curPageIdx, 0.3);
        this.updateIndicators();
    }

    private onClickNext(): void {
        if (this._curPageIdx >= this.totalPages - 1) return;
        this._curPageIdx++;
        this.pg_content?.scrollToPage(this._curPageIdx, 0.3);
        this.updateIndicators();
    }

    private async onPageTurning(): Promise<void> {
        this._curPageIdx = this.pg_content?.curPageIdx ?? 0;

        await this.loadPageData(this._curPageIdx);

        this.scheduleOnce(() => {
            this.preloadAdjacentPagesData();
            this.cleanupDistantPagesData();
        }, 0.2);

        this.updateNavButtons();
        this.updateIndicators();
    }

    // ========== 数据 ==========

    /** 当前分类总照片数 */
    private get total(): number {
        const apiCategory = this.getApiCategory();
        const counts = this._albumProvider.getCategoryCounts();
        return counts[apiCategory] || 0;
    }

    /** 当前分类总页数 */
    private get totalPages(): number {
        if (this.total <= 0) return 0;
        return Math.ceil(this.total / this.PAGE_SIZE);
    }

    // ========== 页面管理 ==========

    private createPlaceholderPages(): void {
        const totalPage = this.totalPages;
        if (totalPage <= 0) return;

        const pageModel = this.pg_content.node.getChildByName('page_instance');
        if (!pageModel) return;

        pageModel.active = false;

        for (let i = 0; i < totalPage; i++) {
            const page = instantiate(pageModel);
            page.name = `page_${i}`;
            page.active = true;
            page.parent = this.pg_content.content;

            const layer = page.getComponentInChildren(PhotoCellLayer);
            if (layer) {
                layer.clearAllCells();
                layer.setClickCallback((data, photoIndex) => {
                    this.openDetail(data, photoIndex);
                });
            }

            this._pageNodes.push(page);
            this.pg_content.addPage(page);
        }

        this._loadedPages.clear();
    }

    // ========== 详情页 ==========

    private async openDetail(photoItem: PhotoItem, photoIndex: number): Promise<void> {
        if (!photoItem) return;
        const apiCategory = this.getApiCategory();

        const node = await UIManager.ins.show('prefabs/photo/PhotoDetailPanel');
        if (!node) return;
        const detailPanel = node.getComponent(PhotoDetailPanel);
        if (!detailPanel) return;

        detailPanel.setData(photoItem.user_photo_id, apiCategory, photoIndex);

        detailPanel.setBackCallback((lastIndex: number) => {
            this.jumpToPageByPhotoIndex(lastIndex);
        });
    }

    private async jumpToPageByPhotoIndex(photoIndex: number): Promise<void> {
        const pageIdx = Math.floor(photoIndex / this.PAGE_SIZE);
        console.log(`[PhotoPanel] 跳转：photoIndex=${photoIndex}, pageIdx=${pageIdx}`);

        if (this._curPageIdx !== pageIdx) {
            this._curPageIdx = pageIdx;
            await this.loadPageData(pageIdx, true);
            this.scheduleOnce(() => {
                this.pg_content?.scrollToPage(pageIdx, 0);
                this.updateIndicators();
                this.updateNavButtons();
                this.updateCollectedText();
            }, 0);
        } else {
            await this.loadPageData(pageIdx, true);
            this.updateIndicators();
            this.updateNavButtons();
            this.updateCollectedText();
        }
    }

    // ========== 数据加载 ==========

    private async loadPageData(pageIndex: number, force: boolean = false): Promise<void> {
        if (pageIndex < 0 || pageIndex >= this._pageNodes.length) return;
        if (!force && this._loadedPages.has(pageIndex)) return;

        const pageNode = this._pageNodes[pageIndex];
        if (!pageNode?.isValid) return;

        const layer = pageNode.getComponentInChildren(PhotoCellLayer);
        if (!layer) return;

        const apiCategory = this.getApiCategory();
        const apiPage = pageIndex + 1;  // 前端0开始 → 后端1开始

        // 优先从缓存取
        let photoList = this._albumProvider.getCachedPage(apiCategory, apiPage);
        console.log("photoList===", photoList.length)
        try {
            if (!photoList || force) {
                const resp = await this._albumProvider.loadPage(apiCategory, apiPage);
                photoList = resp?.photos || [];
            }
            const startIndex = pageIndex * this.PAGE_SIZE;
            await layer.setData(photoList, startIndex, this.total);
            this._loadedPages.add(pageIndex);
        } catch (error) {
            console.log("photo erro", error)
        }

    }

    private preloadAdjacentPagesData(): void {
        const start = Math.max(0, this._curPageIdx - this.PRELOAD_RANGE);
        const end = Math.min(this.totalPages - 1, this._curPageIdx + this.PRELOAD_RANGE);

        let currentIdx = start;

        const loadNext = () => {
            if (currentIdx > end) return;

            this.loadPageData(currentIdx);
            currentIdx++;

            if (currentIdx <= end) {
                this.scheduleOnce(loadNext, 0.05);
            }
        };

        this.scheduleOnce(loadNext, 0.05);
    }

    private cleanupDistantPagesData(): void {
        const minKeep = Math.max(0, this._curPageIdx - this.PRELOAD_RANGE - 1);
        const maxKeep = Math.min(this.totalPages - 1, this._curPageIdx + this.PRELOAD_RANGE + 1);

        this._loadedPages.forEach((pageIndex) => {
            if (pageIndex < minKeep || pageIndex > maxKeep) {
                const pageNode = this._pageNodes[pageIndex];
                if (pageNode?.isValid) {
                    const layer = pageNode.getComponentInChildren(PhotoCellLayer);
                    if (layer) {
                        layer.setData([], 0, 0);
                    }
                }
                this._loadedPages.delete(pageIndex);
            }
        });
    }

    private clearAllPages(): void {
        this._pageNodes.forEach((page) => {
            if (page?.isValid) {
                this.pg_content?.removePage(page);
                page.removeFromParent();
                page.destroy();
            }
        });
        this._pageNodes = [];
        this._loadedPages.clear();
    }

    // ========== 视图更新 ==========

    private updateView(): void {
        if (this.totalPages <= 0) {
            if (this.btn_pre) this.btn_pre.active = false;
            if (this.btn_next) this.btn_next.active = false;
            this.nd_indicator && (this.nd_indicator.active = false);
            return;
        }

        if (this._curPageIdx >= this.totalPages) {
            this._curPageIdx = 0;
        }

        this.scheduleOnce(() => {
            this.pg_content?.scrollToPage(this._curPageIdx, 0);
        }, 0);

        this.updateNavButtons();
        this.updateIndicators();
    }

    private updateNavButtons(): void {
        if (this.btn_pre) this.btn_pre.active = this._curPageIdx > 0;
        if (this.btn_next) this.btn_next.active = this._curPageIdx < this.totalPages - 1;
    }

    // ========== 关闭 ==========

    private onClickBack(): void {
        UIManager.ins.hideView(this.node);
    }
}