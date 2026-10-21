import { _decorator, Component, ScrollView, Prefab, Node, instantiate, UITransform, Vec2 } from 'cc';
import { RecyCleCellComp } from './RecyCleCellComp';
const { ccclass, property } = _decorator;

/** Cell 渲染回调：业务方在此回调中把 data 填入 cellNode */
export type CellRenderer<T = any> = (cellNode: Node, data: T, index: number) => void;

/**
 * 通用循环复用 ScrollView 组件
 *
 * 使用方式：
 * 1. 在编辑器中，将此组件挂到 ScrollView 所在节点（或父节点）
 * 2. 绑定 scrollView、cellPrefab 属性
 * 3. 调用 setData() 传入数据，并通过 setCellRenderer() 设置渲染回调
 *
 * 示例：
 * ```ts
 * recycleScroll.setCellRenderer((node, data, index) => {
 *     node.getChildByName('lb_name').getComponent(Label).string = data.name;
 * });
 * recycleScroll.setData(myDataList);
 * ```
 *
 * 特点：
 * - 不继承 ScrollView，以引用方式接入，不改动现有 UI 结构
 * - 复用池最大数量由 maxItemCount 控制
 * - 滚动时根据可见区域从池中取 Cell 循环复用，不会无限创建节点
 * - 支持泛型数据，通过回调解耦 Cell 渲染逻辑
 * - 双游标控制可视区域Cell映射，首尾复用策略适配前后滚动填充
 */
@ccclass('RecycleScrollView')
export class RecycleScrollView<T = any> extends Component {
    // ========== 编辑器属性 ==========

    @property({ type: ScrollView, tooltip: '关联的 ScrollView 组件' })
    scrollView: ScrollView = null!;

    @property({ type: Prefab, tooltip: 'Item 预制体' })
    cellPrefab: Prefab = null!;

    @property({ tooltip: '复用池最大数量，同时也是界面上同时存在的最大 Item 数' })
    maxItemCount: number = 8;

    @property({ tooltip: '每个 Item 的固定高度（px）' })
    cellHeight: number = 150;

    @property({ tooltip: '相邻 Item 之间的上下间距（px）' })
    spacing: number = 0;

    @property({ tooltip: 'Content 顶部留白高度（px），第一个 Item 之前的空间' })
    topPadding: number = 0;

    @property({ tooltip: '可见区域外的缓冲行数（避免快速滑动时出现空白）' })
    bufferRows: number = 1;

    @property({ tooltip: '是否开启下拉刷新' })
    enablePullRefresh: boolean = false;

    @property({ tooltip: '触发下拉刷新的阈值（px）' })
    pullRefreshThreshold: number = 80;

    @property({ tooltip: '是否开启上拉加载更多（当前可视区域最后一个 cell 为数据末尾时触发）' })
    enableLoadMore: boolean = false;

    @property({ tooltip: '触发加载更多的提前量（cell 个数）。0=看到最后一个才触发，2=距末尾还有 2 个时触发' })
    loadMoreAhead: number = 0;

    // ========== 内部状态 ==========

    /** 数据源 */
    private _data: T[] = [];
    /** 复用池 */
    private _cellPool: Node[] = [];

    /** 已初始化标记 */
    private _inited: boolean = false;

    /** 缓存的节点引用 */
    private _content: Node | null = null;
    private _contentTrans: UITransform | null = null;
    private _viewTrans: UITransform | null = null;

    /** cell 预制体锚点 Y，用于精确定位 item 顶部 */
    private _cellAnchorY: number = 0.5;

    /** 下拉刷新回调 */
    private _onPullRefresh?: () => void;

    /** 是否已触发过本次下拉，防止同一次拖拽重复触发 */
    private _pullTriggered: boolean = false;


    /** 可视区域Cell映射的起始/结束数据索引（双游标核心） */
    private _visibleStartIdx: number = 0;
    private _visibleEndIdx: number = 0;
    private _itemHeights: number[] = [];

    // ========== 生命周期 ==========

    protected onLoad(): void {
        this.init();
    }

    setPrefab(pb: Prefab) {
        this.cellPrefab = pb;
        this.cleanCellPool();
        this.createCellPool();
        // 重置可视区域游标
        this._visibleStartIdx = 0;
        this._visibleEndIdx = 0;
        // this.updateVisibleCells();
    }

    private init(): void {
        if (this._inited) return;
        if (!this.scrollView) {
            console.error('[RecycleScrollView] scrollView not assigned');
            return;
        }

        this._content = this.scrollView.content;
        if (!this._content) {
            console.error('[RecycleScrollView] ScrollView.content is null');
            return;
        }

        this._contentTrans = this._content.getComponent(UITransform);
        this._viewTrans = this.scrollView.view?.getComponent(UITransform) || null;

        this.createCellPool();
        this.registerScrollEvent();

        this._inited = true;
    }

    cleanCellPool() {
        for (const obj of this._cellPool) {
            if (obj) {
                obj.destroy();
            }
        }
        this._cellPool = [];
    }

    /**
     * 预创建复用池中的所有 Item
     */
    private createCellPool(): void {
        if (!this.cellPrefab || !this._content) return;

        // 清空旧池（防止重复创建）
        this.cleanCellPool();
        console.log("池子长度", this.maxItemCount)
        for (let i = 0; i < this.maxItemCount; i++) {
            const cellNode = instantiate(this.cellPrefab);
            cellNode.parent = this._content;
            cellNode.active = false;
            (cellNode as any)._recycleScroll = this;
            this._cellPool.push(cellNode);

            // 缓存第一个 cell 的锚点，用于后续精确定位
            if (i === 0) {
                const cellTrans = cellNode.getComponent(UITransform);
                if (cellTrans) {
                    this._cellAnchorY = cellTrans.anchorY;
                }
            }
        }
    }

    private registerScrollEvent(): void {
        this.scrollView?.node?.on(ScrollView.EventType.SCROLLING, this.onScroll, this);
        this.scrollView?.node?.on(ScrollView.EventType.SCROLL_ENDED, this.onScrollEnded, this);
    }

    protected onDestroy(): void {
        this.scrollView?.node?.off(ScrollView.EventType.SCROLLING, this.onScroll, this);
        this.scrollView?.node?.off(ScrollView.EventType.SCROLL_ENDED, this.onScrollEnded, this);
        this._cellPool = [];
        this._data = [];
    }

    // ========== 公共 API ==========

    /**
     * 设置数据源并刷新列表
     * @param data 数据列表
     * @param scrollToTop 是否滚动到顶部，默认 true
     */
    public setData(data: T[], scrollToTop: boolean = true): void {
        this._data = data || [];
        this._itemHeights = new Array(this._data.length).fill(this.cellHeight);
        this.resetCellDataIndices();
        this.refreshContentHeight();

        if (scrollToTop) {
            this.scrollView?.scrollToTop(0);
        }
        // 重置可视区域游标
        this._visibleStartIdx = 0;
        this._visibleEndIdx = 0;
        this.updateVisibleCells();
    }

    public addData(data: T[]) {
        this._data = this._data.concat(data);
        for (let i = 0; i < data.length; i++) {
            this._itemHeights.push(this.cellHeight);
        }
        this.refreshContentHeight();
        // 新数据追加到末尾后，重置加载更多标记，允许下一次触发
        this.updateVisibleCells();
    }

    /**
     * 在数据头部插入新数据（用于增量数据放到最前面）
     * 会保持当前可视区域所看到的内容不变（仅当 scrollToBottomAfter=false 时）
     * @param data 要插入到头部的新数据列表
     */
    public unshiftData(data: T[]): void {
        if (!data || data.length === 0) return;
        const insertCount = data.length;
        this._data = [...data, ...this._data];
        const newHeights = new Array(insertCount).fill(this.cellHeight);
        this._itemHeights = [...newHeights, ...this._itemHeights];
        // 数据前移后，原可视区域索引同步偏移，保持用户视觉位置不跳变
        this._visibleStartIdx += insertCount;
        this._visibleEndIdx += insertCount;
        // 复用池中 Cell 的 _lastDataIdx 已与实际数据索引不对应，强制重渲染
        this.resetCellDataIndices();
        this.refreshContentHeight();
        this.updateVisibleCells();
    }

    /**
     * 刷新整个列表（保留当前滚动位置）
     */
    public refresh(): void {
        this.resetCellDataIndices();
        this.refreshContentHeight();
        this.updateVisibleCells();
    }

    /**
     * 重置所有 cell 缓存的数据索引，确保数据变化后重新渲染
     */
    private resetCellDataIndices(): void {
        for (const cell of this._cellPool) {
            cell['_lastDataIdx'] = -1;
        }
    }

    /**
     * 刷新指定索引的 Item（仅当该 Item 当前可见时生效）
     * @param index 数据索引
     */
    public refreshItem(index: number): void {
        if (index < 0 || index >= this._data.length) return;
        this.updateVisibleCells();
    }

    /**
     * 滚动到指定索引的 Item
     * @param index 数据索引
     * @param timeInSeconds 动画时间（秒）
     */
    public scrollToIndex(index: number, timeInSeconds: number = 0.3): void {
        if (index < 0 || index >= this._data.length) return;
        if (!this.scrollView || !this._contentTrans) return;

        // 计算目标偏移量
        const contentHeight = this._contentTrans.height;
        const viewHeight = this._viewTrans?.height || 0;
        const targetOffset = this.getItemOffset(index);

        // 限制滚动范围
        const maxOffset = Math.max(0, contentHeight - viewHeight);
        const clampedOffset = Math.min(targetOffset, maxOffset);

        this.scrollView.scrollToOffset(new Vec2(0, clampedOffset), timeInSeconds);
    }

    /**
     * 获取当前数据
     */
    public get data(): T[] {
        return this._data;
    }

    /**
     * 获取当前数据条数
     */
    public get dataCount(): number {
        return this._data.length;
    }

    /**
     * 获取当前复用池中的 Cell 节点列表（只读）
     */
    public get cellPool(): readonly Node[] {
        return this._cellPool;
    }

    // ========== 内部逻辑 ==========

    /**
     * 根据数据量更新 content 高度
     */
    public setItemHeight(index: number, height: number): void {
    if (index < 0 || index >= this._data.length) return;
    const oldHeight = this._itemHeights[index];
    if (Math.abs(oldHeight - height) < 0.5) return;

    const delta = height - oldHeight;                      // 高度变化量
    const itemTop = this.getItemOffset(index);             // 这个 item 在 content 里的位置

    this._itemHeights[index] = height;
    this.refreshContentHeight();

    // 如果变化发生在当前可视区域上方，补偿滚动偏移
    const currentOffset = this.scrollView.getScrollOffset();
    if (itemTop < currentOffset.y) {
        this.scrollView.scrollToOffset(
            new Vec2(0, currentOffset.y + delta),
            0 
        );
    }

    this.updateVisibleCells();
}

    private getItemHeight(index: number): number {
        return this._itemHeights[index] ?? this.cellHeight;
    }

    private getItemOffset(index: number): number {
        // 起始 offset 包含 topPadding，确保所有 item 在 content 顶部下移 topPadding 距离
        let offset = this.topPadding;
        for (let i = 0; i < index; i++) {
            offset += this.getItemHeight(i) + this.spacing;
        }
        return offset;
    }

    private getTotalContentHeight(): number {
        const n = this._data.length;
        if (n === 0) return 0;
        let total = 0;
        for (let i = 0; i < n; i++) {
            total += this.getItemHeight(i);
        }
        // 总高度 = 顶部留白 + 所有 item 高度 + item 间距
        return total + Math.max(0, n - 1) * this.spacing + this.topPadding;
    }

    private findVisibleRange(viewTop: number, viewBottom: number): { start: number, end: number } {
        const dataLen = this._data.length;
        let start = 0;
        let end = dataLen - 1;
        for (let i = 0; i < dataLen; i++) {
            if (this.getItemOffset(i) + this.getItemHeight(i) > viewTop) {
                start = i;
                break;
            }
        }
        for (let i = start; i < dataLen; i++) {
            if (this.getItemOffset(i) >= viewBottom) {
                end = i - 1;
                break;
            }
            end = i;
        }
        return {
            start: Math.max(0, start - this.bufferRows),
            end: Math.min(dataLen - 1, end + this.bufferRows),
        };
    }

    private refreshContentHeight(): void {
        if (this._contentTrans) {
            this._contentTrans.height = this.getTotalContentHeight();
        }
    }

    /**
     * 滚动事件处理
     */
    private onScroll(): void {
        this.updateVisibleCells();
        this.checkPullRefresh();
    }

    /**
     * 滚动结束处理
     */
    private onScrollEnded(): void {
        this._pullTriggered = false;
    }

    /**
     * 检测下拉刷新触发
     */
    private checkPullRefresh(): void {
        if (!this.enablePullRefresh) return;
        if (this._pullTriggered) return;
        if (!this.scrollView || !this._contentTrans || !this._viewTrans) return;

        const contentTrans = this._contentTrans;
        const viewTrans = this._viewTrans;

        // 1. 正常滚动能到达的最大y（列表刚好到底，无空白）
        const maxNormalContentY = contentTrans.height - viewTrans.height;
        // 当前content顶部y坐标
        const curContentY = this.scrollView.content.position.y;

        // 2. 超过底部边界的拖拽距离（下拉偏移，正数=拉过底部）
        const pullOffset = curContentY - maxNormalContentY;
        if (pullOffset > this.pullRefreshThreshold) {
            console.error("下拉刷新")
            this._pullTriggered = true;
            this._onPullRefresh?.();
        }
    }
    /**
     * 设置下拉刷新回调
     * @param callback 触发下拉刷新时调用
     */
    public setOnPullRefresh(callback: () => void): void {
        this._onPullRefresh = callback;
    }

    /**
     * 设置是否开启下拉刷新
     */
    public setPullRefreshEnabled(enabled: boolean): void {
        this.enablePullRefresh = enabled;
    }

    /**
     * 核心：双游标+首尾复用策略更新可视区域Cell
     * 1. 初始化时：数据量≤池大小则只渲染对应数量，多余Cell隐藏；数据量>池大小则只渲染池大小的Cell
     * 2. 向前滚动（需显示前面数据）：池不足时从池末尾取Cell放到头部填充
     * 3. 向后滚动（需显示后面数据）：池不足时从池头部取Cell放到尾部填充
     */
    private updateVisibleCells(): void {
        if (!this.scrollView || !this._viewTrans || !this._contentTrans) return;
        if (this._cellPool.length === 0) return;

        const dataLen = this._data.length;
        // 无数据：隐藏所有 Cell
        if (dataLen === 0) {
            this._cellPool.forEach(cell => cell.active = false);
            return;
        }

        const scrollOffset = this.scrollView.getScrollOffset();
        const viewHeight = this._viewTrans.height;
        const contentHeight = this._contentTrans.height;

        // 可见区域 Y 范围（content 坐标系）
        const viewTop = scrollOffset.y;
        const viewBottom = viewTop + viewHeight;

        const visibleRange = this.findVisibleRange(viewTop, viewBottom);
        let targetStart = visibleRange.start;
        let targetEnd = visibleRange.end;

        // 初始化/数据不足时的边界处理：可视区域不超过数据长度
        const maxVisibleEnd = Math.min(targetStart + this.maxItemCount - 1, dataLen - 1);
        targetEnd = Math.min(targetEnd, maxVisibleEnd);
        if (targetStart > targetEnd) targetStart = targetEnd;

        // ========== 核心：双游标+首尾复用逻辑 ==========
        // 1. 计算需要的可视Cell数量
        const needCellCount = targetEnd - targetStart + 1;
        // 2. 处理向前滚动（需要显示更前面的数据）
        if (targetStart < this._visibleStartIdx) {
            const lackCount = this._visibleStartIdx - targetStart;
            // 池不足时，从池末尾取Cell放到头部
            if (lackCount > 0 && this._cellPool.length > 0) {
                for (let i = 0; i < lackCount; i++) {
                    if (this._cellPool.length === 0) break;
                    const lastCell = this._cellPool.pop()!;
                    this._cellPool.unshift(lastCell);
                }
            }
        }
        // 3. 处理向后滚动（需要显示更后面的数据）
        else if (targetEnd > this._visibleEndIdx) {
            const lackCount = targetEnd - this._visibleEndIdx;
            // 池不足时，从池头部取Cell放到尾部
            if (lackCount > 0 && this._cellPool.length > 0) {
                for (let i = 0; i < lackCount; i++) {
                    if (this._cellPool.length === 0) break;
                    const firstCell = this._cellPool.shift()!;
                    this._cellPool.push(firstCell);
                }
            }
        }

        // 更新可视区域游标
        this._visibleStartIdx = targetStart;
        console.log("targetEnd", targetEnd)
        this._visibleEndIdx = targetEnd;

        // ========== 渲染可视区域Cell ==========
        // content 顶部在自身坐标系中的 y（适配 content 锚点）
        const contentTop = contentHeight * (1 - this._contentTrans.anchorY);

        const usedCellIndices = new Set<number>();
        for (let i = 0; i < needCellCount; i++) {
            const dataIdx = targetStart + i;
            if (dataIdx > targetEnd || dataIdx >= dataLen) break;

            const cellNode = this._cellPool[i];
            if (!cellNode) continue;

            usedCellIndices.add(i);

            const itemHeight = this.getItemHeight(dataIdx);
            const cellOffsetY = -itemHeight * (1 - this._cellAnchorY);
            const y = contentTop + cellOffsetY - this.getItemOffset(dataIdx);
            cellNode.setPosition(0, y, 0);
            // 数据索引变化或节点未激活时重新渲染
            const lastDataIdx = cellNode['_lastDataIdx'];
            if (!cellNode.active || lastDataIdx !== dataIdx) {
                cellNode.active = true;
                cellNode['_lastDataIdx'] = dataIdx;
                const cellComp = cellNode.getComponent(RecyCleCellComp);
                if (cellComp) {
                    cellComp.setData(this._data[dataIdx], dataIdx);
                }
            } else {
                cellNode.active = true;
            }
        }

        // ========== 隐藏未使用的Cell ==========
        // 规则：数据量≤池大小 → 只显示数据对应数量，其余隐藏；数据量>池大小 → 只显示可视区域数量，其余隐藏
        const maxShowCount = Math.min(dataLen, this.maxItemCount);
        for (let i = 0; i < this._cellPool.length; i++) {
            const cellNode = this._cellPool[i];
            // 未被使用 或 超过需要显示的最大数量 → 隐藏
            if (!usedCellIndices.has(i) || i >= maxShowCount) {
                cellNode.active = false;
            }
        }

        // console.log(`可视区域：[${targetStart}, ${targetEnd}]，复用池长度：${this._cellPool.length}，数据总量：${dataLen}`);
    }
}