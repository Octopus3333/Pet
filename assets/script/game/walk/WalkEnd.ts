import { _decorator, Component, Node, Label, RichText, ScrollView, Sprite, UITransform, Layout, instantiate } from 'cc';
import { DispatchEvent } from '../../common/utils/DispatchEvent';
import { Common, EventType, ViewPath } from '../../common/utils/Define';
import { UIManager } from '../../common/utils/UIManager';
import { ItemConfigManager } from '../../item/ItemConfigManager';
import { loadImg, loadItem, loadItemQuality } from '../../common/utils/UiTools';
import { DataManager } from '../../Data/DataManager';
import { PetCommonComp } from '../../common/components/PetCommonComp';
import { WalkManager } from './WalkManager';

const { ccclass, property } = _decorator;

/** WalkRunEndNotify 协议回包数据结构 */
export interface WalkEndData {
    /** 队伍id */
    team_id?: number;
    /** 奖励道具id列表 */
    item_ids?: number[];
    /** 垃圾数量 */
    Rubbish?: number;
    /** 距离(米) */
    distance?: number;
    /** 获得粉爪币 */
    pink?: number;
    /** 获得照片 */
    photos?: number;
    clean:number
    energy:number
    mood:number
}

@ccclass('WalkEnd')
export class WalkEnd extends Component {
    // ========== 信息标签 ==========
    @property(RichText)
    lb_des: RichText = null

    @property(Label)
    lb_photo_num: Label = null

    @property(Label)
    lb_coin_num: Label = null
    @property(Label)
    lb_energy:Label = null
    @property(Label)
    lb_clean:Label = null
    @property(Label)
    lb_xinqing:Label = null
    @property(Label)
    lb_rubbish = null
    @property(Node)
    sp_pet: Node = null
    // ========== ScrollView相关 ==========
    @property(ScrollView)
    sv_content: ScrollView = null

    private _data: WalkEndData = null
    /** ScrollView原始高度（用于4-9个item时恢复） */
    private _svOriginalHeight: number = 0

    protected onLoad(): void {
        const btnBackTeam = this.node.getChildByPath?.('nd_content/nd_result/sp_bottom/btn_back_team')
        const btnBackHome = this.node.getChildByPath?.('nd_content/nd_result/sp_bottom/btn_back_home')
        if (btnBackTeam) {
            btnBackTeam.on(Node.EventType.TOUCH_END, this.onClickBackTeam, this)
        }
        if (btnBackHome) {
            btnBackHome.on(Node.EventType.TOUCH_END, this.onClickBackHome, this)
        }
    }

    /**
     * 初始化WalkEnd面板
     * @param data WalkRunEndNotify回包数据
     */
    async init(data: WalkEndData): Promise<void> {
        this._data = data

        // 描述文字（富文本）
        if (this.lb_des) {
            const userInfo = DataManager.ins.getUserInfo()
            const parentCall = userInfo?.parent_call || '主人'
            const distance = data.distance || 0
            this.lb_des.string = `<color=#373B40>谢谢 ${parentCall}带我玩！\n这次散步了 <b><color=#000000>${distance}</color></b>米</color>`
        }

        // 照片数量
        if (this.lb_photo_num) {
            this.lb_photo_num.string = (data.photos || 0).toString()
        }

        // 粉爪币
        if (this.lb_coin_num) {
            this.lb_coin_num.string = (data.pink || 0).toString()
        }
        if(this.lb_rubbish){
            this.lb_rubbish.string = "x" + data.Rubbish
        }
        if(this.lb_clean){
            this.lb_clean.string = data.clean.toString()
        }
        if(this.lb_xinqing){
            this.lb_xinqing.string = data.mood.toString()
        }
        if(this.lb_energy){
            this.lb_energy.string = data.energy.toString()
        }        
        // 加载宠物图片（参考HeadComp）
        if (this.sp_pet) {
            const userInfo = DataManager.ins.getUserInfo()
            var comp = this.sp_pet.getComponent(PetCommonComp)
            comp.setData(userInfo)
        }
        // 加载道具并渲染ScrollView
        await this._loadItems()
    }

    /**
     * 根据item_ids加载配置并渲染道具到ScrollView
     */
    private async _loadItems(): Promise<void> {
        const itemIds = this._data?.item_ids || []
        if (itemIds.length === 0) return

        // 确保ItemConfigManager已加载
        await ItemConfigManager.ins.load()

        const svNode = this._getScrollViewNode()
        const contentNode = this._getContentNode()
        if (!svNode || !contentNode) {
            console.warn('[WalkEnd] ScrollView或content节点未找到')
            return
        }

        // 保存原始ScrollView高度
        if (this._svOriginalHeight === 0) {
            const svTransform = svNode.getComponent(UITransform)
            this._svOriginalHeight = svTransform?.height || 250
        }

        // 清除现有item（保留模板）
        this._clearContentItems(contentNode)

        // 创建道具cell
        for (const itemId of itemIds) {
            const cfg = ItemConfigManager.ins.getConfig(itemId)
            if (!cfg) {
                console.warn('[WalkEnd] 未找到道具配置:', itemId)
                continue
            }
            const itemNode = this._createItemCell(itemId, cfg)
            if (itemNode) {
                itemNode.parent = contentNode
            }
        }

        // 根据数量调整ScrollView行为
        this._adjustScrollView(itemIds.length, svNode, contentNode)
    }

    /**
     * 创建单个道具cell
     */
    private _createItemCell(itemId: number, cfg: any): Node | null {
        const template = this._getItemTemplate()
        if (!template) return null

        const itemNode = instantiate(template)
        itemNode.active = true

        // 加载品质图标
        const spQuality = itemNode.getChildByName('sp_quality')?.getComponent(Sprite)
        if (spQuality) {
            loadItemQuality(spQuality, itemId)
        }else{

        }

        // 加载道具图标
        const spIcon = itemNode.getChildByName('sp_icon')?.getComponent(Sprite)
        if (spIcon) {
            loadItem(spIcon, itemId)
        }

        // 设置道具名称
        const lbName = itemNode.getChildByName('lb_num')?.getComponent(Label)
        if (lbName) {
            lbName.string = cfg.name || ''
        }

        return itemNode
    }

    /**
     * 清除content中除模板外的所有子节点
     */
    private _clearContentItems(contentNode: Node): void {
        const template = this._getItemTemplate()
        const children = [...contentNode.children]
        for (const child of children) {
            if (child !== template) {
                child.removeFromParent()
                child.destroy()
            }
        }
        // 隐藏模板
        if (template) {
            template.active = false
        }
    }

    /**
     * 根据道具数量调整ScrollView
     * - < 4: 不可滑动，水平排列
     * - 4~9: 拉高524px，3行3列，不可滑动
     * - > 9: 可滑动，3列网格
     */
    private _adjustScrollView(itemCount: number, svNode: Node, contentNode: Node): void {
        const scrollView = svNode.getComponent(ScrollView)
        const svTransform = svNode.getComponent(UITransform)
        const layout = contentNode.getComponent(Layout)

        if (itemCount < 4) {
            // 少于4个：不可滑动
            if (scrollView) {
                scrollView.vertical = false
                scrollView.horizontal = false
            }
        } else if (itemCount <= 9) {
            // 4~9个：拉高ScrollView 524px，显示3行3列，不可滑动
            if (svTransform) {
                svTransform.height = this._svOriginalHeight + 524
            }
            if (scrollView) {
                scrollView.vertical = false
                scrollView.horizontal = false
            }
            if (layout) {
                layout.type = Layout.Type.GRID
                layout.startAxis = Layout.AxisDirection.HORIZONTAL
                layout.constraint = (Layout as any).Constraint?.FIXED_COL ?? 2
                layout.constraintNum = 3
            }
        } else {
            // 大于9个：可滑动，3列网格
            if (svTransform) {
                svTransform.height = this._svOriginalHeight
            }
            if (scrollView) {
                scrollView.vertical = true
                scrollView.horizontal = false
            }
            if (layout) {
                layout.type = Layout.Type.GRID
                layout.startAxis = Layout.AxisDirection.HORIZONTAL
                layout.constraint = (Layout as any).Constraint?.FIXED_COL ?? 2
                layout.constraintNum = 3
            }
        }
    }

    /** 获取ScrollView节点 */
    private _getScrollViewNode(): Node | null {
        if (this.sv_content) return this.sv_content.node
        return this.node.getChildByPath?.('nd_content/nd_result/sv_content') || null
    }

    /** 获取ScrollView的content节点 */
    private _getContentNode(): Node | null {
        if (this.sv_content) return this.sv_content.content
        return this.node.getChildByPath?.('nd_content/nd_result/sv_content/view/content') || null
    }

    /** 获取item模板节点 */
    private _getItemTemplate(): Node | null {
        const contentNode = this._getContentNode()
        if (!contentNode) return null
        return contentNode.getChildByName('item')
    }

    /** 返回组队 */
    onClickBackTeam(): void {
        DispatchEvent.ins.emit(EventType.BackTeam)
        this._closeWalk()
    }

    /** 返回大厅 */
    onClickBackHome(): void {
        UIManager.ins.show(ViewPath.HomePanel)
        DispatchEvent.ins.emit(EventType.BackHome)
        this._closeWalk()
    }

    /** 关闭散步流程 */
    private _closeWalk(): void {
        WalkManager.ins.cleanupAll()
        UIManager.ins.hideView(this.node)
    }

    protected onDestroy(): void {

    }
}
