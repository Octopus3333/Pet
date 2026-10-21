import { _decorator, Component, Label, Node, RichText, Sprite, tween, Tween, Vec3 } from 'cc';
import { ItemManager } from '../item/ItemManager';

import { ToastManager } from '../common/utils/ToastManager';
import { Item } from '../common/utils/InterfaceDefine';
import { loadImg, loadItem } from '../common/utils/UiTools';
import { UIManager } from '../common/utils/UIManager';
import { DataManager } from '../Data/DataManager';
import { Common } from '../common/utils/Define';
const { ccclass, property } = _decorator;

@ccclass('SalePanel')
export class SalePanel extends Component {
    @property(Node)
    nd_state_0:Node = null
    @property(Node)
    nd_state_1:Node = null
    @property(Node)
    nd_state_2:Node = null    
    @property(Node)
    nd_anima:Node = null
    data:any = null
    expandType = 1 //1 仓库 2背包

    protected onEnable(): void {
        if(!this.nd_anima)return
        tween(this.nd_anima).stop()
        this.nd_anima.y = -500
        tween(this.nd_anima).to(0.2,{
            position:new Vec3(0,0,0)
        }).start()
    }
    onClickExpand(){
        if(this.expandType == 1){
            var pinkNeed = DataManager.ins.getWarehouseExpandPink()
            var curPink = DataManager.ins.getUserInfo()?.pink
            if(curPink < pinkNeed){
                ToastManager.ins.showToast("粉爪币不足")
                return
            }
        }else{
            var pinkNeed = DataManager.ins.getBackpackExpandPink()
            var curPink = DataManager.ins.getUserInfo()?.pink
            if(curPink < pinkNeed){
                ToastManager.ins.showToast("粉爪币不足")
                return
            }
        }

        this.showConfirm(true)
    }
    showConfirm(bool){
        if(this.nd_state_2 && this.nd_state_2.active){
            var btn_cancel = this.nd_state_2.getChildByName("btn_cancel")
            var btn_confirm = this.nd_state_2.getChildByName("btn_confirm")
            btn_cancel.active = bool
            btn_confirm.active = bool
        }
    }
    async onClickAgree(){
        this.showConfirm(false)
        if(this.expandType == 1){
            await ItemManager.ins.requestWarehouseExpand()
        }else{
            await ItemManager.ins.requestBackpackExpand()  
        }
        this.onClickClose()
    }
    refreshUserInfo(){
        if(!this.data)return
    }
    onClickCancel(){
        this.showConfirm(false)
    }
    async onClickSale(){
        var res = await ItemManager.ins.requestSellToShopDog([this.data.id])
        if(!res)return
        // 出售成功，关闭面板（奖励由MoneyChangeNotify推送的GetRewardsLayer展示）
        this.onClickClose()
    }
    reset(){
        console.log("reset==================")
        this.nd_state_1.active = false
        this.nd_state_0.active = false
        this.nd_state_2.active = false
    }
    //出售道具界面
    showSaleState(saleItem:Item){
        this.reset()
        this.nd_state_1.active = true
        this.data = saleItem
        var price = 0
        if(saleItem.total_use_count > 0){
            price = saleItem.recycle_pink/saleItem.total_use_count*saleItem.remain_count
        }
        var lbNode = this.nd_state_1.getChildByPath("btn_directSell_1/nd_iconBg/lb_value")
        if(lbNode) {
            var lbComp = lbNode.getComponent(Label)
            lbComp.string = price.toString()
        }
        var spNode = this.nd_state_1.getChildByPath("nd_dialogBg/sp_icon")
        if(spNode){
            var spComp = spNode.getComponent(Sprite)
            loadItem(spComp, saleItem.item_id)
        }

        var saleDesNode = this.nd_state_1.getChildByPath("nd_dialogBg/lb_discription")
        console.log("saleNode==========",saleDesNode)
        if(saleDesNode){
            var saleDesComp = saleDesNode.getComponent(RichText)
            saleDesComp.string = "本店回收各类闲置物，\n价格公道，诚信第一。\n这件<b>"+ saleItem.name + "</b>\n你是想放易物集市还是直接卖我呢？"
        }

    }
    //扩容已满
    showExpandFull(){
        this.reset()
        this.nd_state_0.active = true

    }
    //扩容界面
    showExpanAdd(){        
        this.reset()
        this.expandType = 1
        this.nd_state_2.active = true
        var iconNode = this.nd_state_2.getChildByPath("nd_dialogBg/nd_shopDisplayBox/sp_backpackUpIcon")
        if(iconNode){
            var sp = iconNode.getComponent(Sprite)
            loadImg(sp, Common.texturePath + "storage/img1/spriteFrame")
        }
        var desNode = this.nd_state_2.getChildByPath("nd_dialogBg/nd_shopDisplayBox/lb_text")
        if(desNode){
            var lb = desNode.getComponent(Label)
            lb.string = "仓库收纳上限"
        }
        var numNode = this.nd_state_2.getChildByPath("nd_dialogBg/nd_shopDisplayBox/lb_value")
        if(numNode){
            var numlb = numNode.getComponent(Label)
            numlb.string = "+10"
        }
        var lbNode = this.nd_state_2.getChildByPath("nd_dialogBg/lb_discription")
        if(lbNode){
            var tipsLb = lbNode.getComponent(Label)
            tipsLb.string = "店里正好在打折处理一批收纳箱，请问顾客要买点吗？^v^"
        }
        var priceNode = this.nd_state_2.getChildByPath("btn_buy/nd_iconBg/lb_value")
        console.log("priceNode",priceNode)
        if(priceNode){
            var tipsLb = priceNode.getComponent(Label)
            var pinkNeed = DataManager.ins.getWarehouseExpandPink()
            tipsLb.string = pinkNeed.toString()
        }
    }
    //解锁背包
    showUnLockBag(){
        this.reset()
        console.log("showUnLockBag=============")
        this.expandType = 2
        this.nd_state_2.active = true
        var iconNode = this.nd_state_2.getChildByPath("nd_dialogBg/nd_shopDisplayBox/sp_backpackUpIcon")
        var desNode = this.nd_state_2.getChildByPath("nd_dialogBg/nd_shopDisplayBox/lb_text")
        var numNode = this.nd_state_2.getChildByPath("nd_dialogBg/nd_shopDisplayBox/lb_value")
        var iconNode = this.nd_state_2.getChildByPath("nd_dialogBg/nd_shopDisplayBox/sp_backpackUpIcon")
        if(iconNode){
            var sp = iconNode.getComponent(Sprite)
            loadImg(sp, Common.texturePath + "storage/img2/spriteFrame")
        }
        var desNode = this.nd_state_2.getChildByPath("nd_dialogBg/nd_shopDisplayBox/lb_text")
        if(desNode){
            var lb = desNode.getComponent(Label)
            lb.string = "背包携带上限"
        }
        var numNode = this.nd_state_2.getChildByPath("nd_dialogBg/nd_shopDisplayBox/lb_value")
        if(numNode){
            var numlb = numNode.getComponent(Label)
            numlb.string = "+1"
        }
        var lbNode = this.nd_state_2.getChildByPath("nd_dialogBg/lb_discription")
        if(lbNode){
            var tipsLb = lbNode.getComponent(Label)
            tipsLb.string = "隔壁包店老板跑路了，全场包包折扣价哦，机会难得千万别错过啦！"
        }
        var priceNode = this.nd_state_2.getChildByPath("btn_buy/nd_iconBg/lb_value")
        if(priceNode){
            var tipsLb = priceNode.getComponent(Label)
            var pinkNeed = DataManager.ins.getBackpackExpandPink()
            tipsLb.string = pinkNeed.toString()
        }
    }
    onClickDealMarket(){
        ToastManager.ins.showToast("敬请期待")
    }
    onClickClose(){
        UIManager.ins.hideView(this.node)
    }
}


