import { _decorator, Component, Label, Node, Sprite } from 'cc';
import { Item } from '../utils/InterfaceDefine';
import { UIManager } from '../utils/UIManager';
import { Common, ViewPath, EventType, ItemPosition } from '../utils/Define';
import { DispatchEvent } from '../utils/DispatchEvent';
import { SalePanel } from '../../game/SalePanel';
import { ConfirmPopupData } from '../utils/InterfaceDefine';
import { ConfirmPopup } from '../utils/ConfirmPopup';
import { loadImg } from '../utils/UiTools';
import { ItemManager } from '../../item/ItemManager';
import { DataManager } from '../../Data/DataManager';
import { ToastManager } from '../utils/ToastManager';

const { ccclass, property } = _decorator;

/** ItemDiscriptionPanel 底部按钮组类型 */
export enum ItemDescriptionButtonGroup {
    /** 外出背包上下文：nd_buttonGroup_1 */
    Backpack = 1,
    /** 仓库道具上下文：nd_buttonGroup_2 */
    Warehouse = 2,
}

/**
 * 道具详情浮层
 * 根据来源切换 nd_buttonGroup_1 / nd_buttonGroup_2 按钮组
 */
@ccclass('ItemDiscriptionPanel')
export class ItemDiscriptionPanel extends Component {
    @property(Node)
    nd_buttonGroup_1: Node = null
    @property(Node)
    nd_icon_group_1: Node = null
    @property(Node)
    nd_buttonGroup_3: Node = null
    @property(Label)
    lb_itemName: Label = null
    @property(Label)
    lb_discription: Label = null
    @property(Label)
    lb_times: Label = null
    data:Item = null
    group:ItemDescriptionButtonGroup = null
    protected onLoad(): void {
        this.ensureRefs()
        this.node.active = false
    }

    /**
     * 展示道具详情并激活对应按钮组
     * @param item 道具数据
     * @param group 按钮组类型
     */
    show(item: Item, group?: ItemDescriptionButtonGroup): void {
        if (!item) {
            this.hide()
            return
        }
        this.group = group
        this.data = item
        this.ensureRefs()
        this.refreshContent(item)
        this.setButtonGroup(group)
        this.node.active = true
    }
    async onClickSale(){
        var pb = await UIManager.ins.show(ViewPath.SalePanel)
        if(!pb)return
        var slpn = pb.getComponent(SalePanel)

        slpn.showSaleState(this.data)
        pb.once(Node.EventType.ACTIVE_IN_HIERARCHY_CHANGED, () => {
        if (!pb.activeInHierarchy) 
        {
            this.hide();
        }
    });
    }
    onClickMove(){
        const isToBackpack = this.group === ItemDescriptionButtonGroup.Warehouse
        const targetPosition = isToBackpack
            ? ItemPosition.Backpack
            : ItemManager.ins.resolveStoragePosition(this.data)

        if (targetPosition === ItemPosition.Warehouse || targetPosition === ItemPosition.Bond) {
            const stock = DataManager.ins.getWarehouseUsageStock()
            const capacity = DataManager.ins.getWarehouseCapacity()
            if (capacity > 0 && stock >= capacity) {
                ToastManager.ins.showToast("仓库已满")
                return
            }
            if (targetPosition === ItemPosition.Warehouse) {
                DispatchEvent.ins.emit(EventType.PendingWarehouseSelect, this.data.id)
            } else {
                DispatchEvent.ins.emit(EventType.PendingBondSelect, this.data.id)
            }
        }

        if (targetPosition === ItemPosition.Backpack) {
            const stock = DataManager.ins.getBackpackStock()
            const capacity = DataManager.ins.getBackpackCapacity()
            if (stock >= capacity) {
                ToastManager.ins.showToast("背包已满")
                return
            }
            DispatchEvent.ins.emit(EventType.PendingBackpackSelect, this.data.id)
        }

        void ItemManager.ins.requestItemMove([this.data.id], targetPosition).then((success) => {
            if (!success) {
                if (targetPosition === ItemPosition.Backpack) {
                    DispatchEvent.ins.emit(EventType.PendingBackpackSelect, -1)
                } else if (targetPosition === ItemPosition.Bond) {
                    DispatchEvent.ins.emit(EventType.PendingBondSelect, -1)
                } else {
                    DispatchEvent.ins.emit(EventType.PendingWarehouseSelect, -1)
                }
            }
        })
    }
    /** 隐藏详情面板 */
    hide(): void {
        this.node.active = false
    }

    /** 刷新文案区域 */
    private refreshContent(item: Item): void {
        if (this.lb_itemName) {
            this.lb_itemName.string = item.name ?? ''
        }
        if (this.lb_discription) {
            this.lb_discription.string = item.des || item.use_des || ''
        }
        if (this.lb_times) {
            this.lb_times.string = `${item.remain_count ?? 0}/`+ item.total_use_count
        }
        if(this.nd_icon_group_1){
            for(var i = 1 ; i < 4; i ++){
                var petNode = this.nd_icon_group_1.getChildByName("nd_pet_" + i)
                if(!petNode)continue
                var spNode = petNode.getChildByName("sp_can_use")
                var sp = spNode.getComponent(Sprite)
                var path = item.animal_limit.indexOf(i) != -1 ? "gou":"cha"
                loadImg(sp, Common.texturePath + "storage/" + path + "/spriteFrame")
            }
        }
        var group = this.node.getChildByPath("nd_bg/nd_iconGroup_2")
        if(group){
            group.getChildByPath("nd_clean/sp_down_red").active =  this.data.clean < 0
            group.getChildByPath("nd_clean/sp_up_green").active =  this.data.clean > 0
            group.getChildByPath("nd_clean/sp_unchanged").active = this.data.clean == 0
            var cleanVal = group.getChildByPath("nd_clean/lb_value")
            var cleanLb = cleanVal.getComponent(Label)
            cleanLb.string =  Math.abs(this.data.clean).toString()
            group.getChildByPath("nd_energy/sp_down_red").active =  this.data.energy < 0
            group.getChildByPath("nd_energy/sp_up_green").active =  this.data.energy > 0
            group.getChildByPath("nd_energy/sp_unchanged").active = this.data.energy == 0
            var intimacyVal = group.getChildByPath("nd_energy/lb_value")
            var intimacyLb = intimacyVal.getComponent(Label)
            intimacyLb.string = Math.abs(this.data.energy).toString()

            group.getChildByPath("nd_intimacy/sp_down_red").active =  this.data.intimacy < 0
            group.getChildByPath("nd_intimacy/sp_up_green").active =  this.data.intimacy > 0
            group.getChildByPath("nd_intimacy/sp_unchanged").active = this.data.intimacy == 0
            var energyVal = group.getChildByPath("nd_intimacy/lb_value")
            var energyLb = energyVal.getComponent(Label)
            energyLb.string =  Math.abs(this.data.intimacy).toString()
        }
    }

    /** 切换底部按钮组显隐 */
    private setButtonGroup(group: ItemDescriptionButtonGroup): void {
        if (this.nd_buttonGroup_1) {
            this.nd_buttonGroup_1.active = true
            var text = this.nd_buttonGroup_1.getChildByPath("btn_store/lb_text")
            var lb = text.getComponent(Label)
            lb.string = group == ItemDescriptionButtonGroup.Warehouse? "放背包":"放仓库"
        }

        if (this.nd_buttonGroup_3) {
            this.nd_buttonGroup_3.active = false
        }
    }

    /** 按节点名绑定引用，避免 Prefab 未挂脚本时引用丢失 */
    private ensureRefs(): void {
        const ndBg = this.node.getChildByName('nd_bg')
        if (!ndBg) {
            return
        }
        if (!this.nd_buttonGroup_1) {
            this.nd_buttonGroup_1 = ndBg.getChildByName('nd_buttonGroup_1')
        }
        if (!this.nd_buttonGroup_3) {
            this.nd_buttonGroup_3 = ndBg.getChildByName('nd_buttonGroup_3')
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
        if (!this.lb_times) {
            this.lb_times = descArea.getChildByName('nd_usesLeftBg')
                ?.getChildByName('lb_times')
                ?.getComponent(Label) ?? null
        }
    }
    async onClickUse() {
        if (!this.data) return;
        const confirmData: ConfirmPopupData = {
            title: '使用道具',
            message: `确定要使用 ${this.data.name} 吗？`,
            subMessage: '使用后将消耗该道具，效果立即生效',   // 小字说明（想隐藏可传空字符串或不传）
            confirmText: '使用',
            cancelText: '取消',
            onConfirm: () => {
                // 确认后的原有逻辑：隐藏仓库面板，进入互动界面
                UIManager.ins.hide(ViewPath.StoragePanel);
                DispatchEvent.ins.emit(EventType.EnterHuDong, this.data.type, this.data);
            },
            onCancel: () => {
                // 取消时不做任何额外操作（仅关闭弹窗，保留道具详情面板）
            }
        };
        const node = await UIManager.ins.show(ViewPath.ConfirmPopup);
        const popup = node?.getComponent(ConfirmPopup);
        if (popup) {
            popup.show(confirmData);
        }
    }
}
