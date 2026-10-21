import { _decorator, Button, Component, instantiate, Label, Layout, Node, ScrollView, Sprite } from 'cc';
import { Item, TeamData, UserInfo, WalkUser } from '../common/utils/InterfaceDefine';
import { ToastManager } from '../common/utils/ToastManager';
import { DispatchEvent } from '../common/utils/DispatchEvent';
import { Common, EventType, ViewPath } from '../common/utils/Define';
import { DataManager } from '../Data/DataManager';
import { loadAvatar, loadImg, loadItem, loadItemQuality } from '../common/utils/UiTools';
import { ItemManager } from '../item/ItemManager';
import { UIManager } from '../common/utils/UIManager';
import { PetCommonComp } from '../common/components/PetCommonComp';
import { RoomPlayer } from './RoomPlayer';
import { ItemDescripView } from '../common/storage/ItemDescripView';
import { WalkMap } from '../team/WalkMap';
const { ccclass, property } = _decorator;

@ccclass('RoomLayer')
export class RoomLayer extends Component {
    @property(Node)
    nd_room_owner:Node = null
    @property(Node)
    nd_play_1:Node = null
    @property(Node)
    nd_play_2:Node = null
    @property(Node)
    nd_play_3:Node = null
    @property(Node)
    nd_pet_1:Node = null
    @property(Node)
    nd_pet_2:Node = null
    @property(Node)
    nd_pet_3:Node = null
    @property(Node)
    btn_go:Node = null
    @property(Node)
    btn_ready:Node = null
    @property(Node)
    btn_cancel:Node = null
    @property(ScrollView)
    sv_items:ScrollView = null
    @property(Node)
    nd_item_instance:Node = null
    @property(Label)
    lb_backPack:Label = null
    @property(Label)
    lb_aim:Label = null
    @property(Sprite)
    sp_aim:Sprite = null
    @property(Node)
    nd_info:Node = null
    currentOwner:WalkUser
    location_id:number = 0
    protected async onLoad(): Promise<void> {
        await this.requestData()
        DispatchEvent.ins.on(EventType.RefreshBackpack, this.loadItems, this)
        this.loadItems()
    }

    loadRoomData(data:TeamData){
        console.log(data,"data=============")
        this.loadOwner(data.owner)
        this.location_id = data.walk_address_id
        for(var i = 0; i < 3; i++){
            var obj = data.users[i]
            this.loadPlayer(i + 1, obj)
        }
        this.lb_aim.string = data.walk_address_name
        var userInfo = DataManager.ins.getUserInfo()
        if(data.owner.user_id == userInfo.userId){
            var allReady = this.checkAllReady(data)
            var sp = this.btn_go.getComponent(Sprite)
            if(sp){
                sp.grayscale = !allReady
            }
            this.setGoUi()
        }else{       
            if(data.ready_status == 1){
                this.setReadyUi()
            }else{
                this.setCancelUi()
            }

        }
        loadImg(this.sp_aim,  Common.texturePath + "common/map/map_icon_" + data.walk_address_id + "/spriteFrame")
        if(this.currentOwner && data.owner && this.currentOwner.user_id != data.owner.user_id){
            if(userInfo.userId == data.owner.user_id){
                ToastManager.ins.showToast("您已成为新房主")
            }else{
                ToastManager.ins.showToast(data.owner.nickname + "已成为新房主")
            }
        }
        this.currentOwner = data.owner

    }
    loadMyInfo(data, pos){
        console.log("loadMyinfo======================",pos)
        if(pos == null)return
        if(!this.nd_info) return
        var posNode = this.node.getChildByName("nd_info_pos_" + pos)
        console.log("nowPostion====================", posNode.getPosition().clone())
        this.nd_info.position = posNode.getPosition().clone()
        var lb_clean = this.nd_info.getChildByPath("sp_clean/lb_num")?.getComponent(Label)
        var lb_food = this.nd_info.getChildByPath("sp_food/lb_num")?.getComponent(Label)
        if(lb_clean){
            lb_clean.string = data.clean.toString()
        }
        if(lb_food){
            lb_food.string = data.energy.toString()
        }
    }
    checkAllReady(data:TeamData):boolean{
        for(var i = 0; i < data.users.length; i++){
            var user = data.users[i]
            if(user && user.ready_status != 2)return false
        }
        return true
    }

    async loadPlayer(index, data:WalkUser){
        var nd_pet = this["nd_pet_" + index]
        var panel:Node = this["nd_play_" + index]

        var clickContent = this.node.getChildByName("play_add_" + index)?.getComponent(Button)
        if(!data){
            panel.active = false
            nd_pet.active = false
            if(clickContent){
                clickContent.interactable = true
            }
            return
        }
        var userInfo = DataManager.ins.getUserInfo()
        if(userInfo.userId == data.user_id){
            this.loadMyInfo(data, index)
            if(panel){
                panel.active = false
            }
        }else{
            if(panel){
                var player = panel.getComponent(RoomPlayer)
                player.setData(data)
                panel.active = true
            }
        }
        if(nd_pet){
            console.log("initPet========================", data.ready_status == 2)
            var pet = nd_pet.getComponent(PetCommonComp)||nd_pet.addComponent(PetCommonComp)
            await pet.setData(data)
            pet.playReadyAnimation(data.ready_status == 2)
        }
        if(clickContent){
            clickContent.interactable = false
        }
        nd_pet.active = true
    }

    async loadOwner(data:WalkUser){
        if(!data)return
        var nd_pet = this.nd_room_owner.getChildByName("nd_pet")
        if(nd_pet){
            var pet = nd_pet.getComponent(PetCommonComp)||nd_pet.addComponent(PetCommonComp)
            await pet.setData(data)
            pet.playReadyAnimation(true)
        }
        var nd_info_tips = this.nd_room_owner.getChildByName("nd_info")
        var userInfo = DataManager.ins.getUserInfo()
        if(data.user_id == userInfo.userId){
            if(nd_info_tips){
                nd_info_tips.active = false
            }
            this.loadMyInfo(data, 0)
        }else{
            if(nd_info_tips){
                var player = nd_info_tips.getComponent(RoomPlayer)
                player.setData(data)
                nd_info_tips.active = true 
            }

        }

        var lb_name = this.nd_room_owner.getChildByPath("sp_name/Label")?.getComponent(Label)
        lb_name.string = data.nickname

    }

    onClickInvite(){
        console.log("onClickInvite")
        DispatchEvent.ins.emit(EventType.ShowWalkInvite)
    }
    async onClickChoose(){
        var walkMap = await UIManager.ins.show(ViewPath.WalkMap)
        var comp = walkMap.getComponent(WalkMap)
        comp.show(this.location_id)
    }
    onClickCurrent(){
        ToastManager.ins.showToast("暂未开放")
    }
    setReadyUi(){
        this.btn_go.active = false
        this.btn_cancel.active = false
        this.btn_ready.active = true
    }
    setCancelUi(){
        this.btn_go.active = false
        this.btn_cancel.active = true
        this.btn_ready.active = false
    }
    setGoUi(){
        this.btn_go.active = true
        this.btn_cancel.active = false
        this.btn_ready.active = false
    }
    async requestData(){
        var data = DataManager.ins.getBackpack()
        if(!data ||data.length == 0){
            await ItemManager.ins.requestBackpack()
        }
    }
    loadItems(){
        if(!this.sv_items || !this.sv_items.content)return
        var items = DataManager.ins.getBackpack()
        console.log("items", items)
        var content = this.sv_items.content
        var curCellNum = content.children.length
        if(curCellNum < items.length){
            for(var i = curCellNum ; i < items.length; i++){
                this.addItemNode()
            }
        }else if(curCellNum > items.length){
            for(var i = items.length; i < curCellNum; i++){
                if(!content.children[i]) continue
                content.children[i].active = false
            }
        }
        console.log("contetnLength", content.children.length)
        for(var i = 0; i < content.children.length; i ++){
            if(!content.children[i])continue
            this.loadItem(content.children[i], items[i])
        }
        this.updatBackPackLabel()
    }
    updatBackPackLabel(){
        if(!this.lb_backPack)return
        var backpackNum = DataManager.ins.getBackpackStock()
        var backPackTotal = DataManager.ins.getBackpackCapacity()
        this.lb_backPack.string = backpackNum + "/" + backPackTotal
    }
    addItemNode(){
        var node = instantiate(this.nd_item_instance)
        node.parent = this.sv_items.content
        var layout = this.sv_items.content.getComponent(Layout)
        // layout.updateLayout()
    }
    async onTouchItem(sender,data){
        if(!sender || !sender.target?.itemData)return
        var itemInfoView = await UIManager.ins.show(ViewPath.ItemDescripView)
        var comp =itemInfoView.getComponent(ItemDescripView)
        comp.show(sender.target.itemData)
    }
    loadItem(node:Node, data:Item){
        console.log("data=============",data)
        if(!data||!node)return
        try {
            var sp_quality = node.getChildByName("sp_quality")
            var sp_icon = node.getChildByName("sp_icon")
            loadItemQuality(sp_quality?.getComponent(Sprite), data.item_id)
            loadItem(sp_icon?.getComponent(Sprite), data.item_id)
            node.active = true      
            node['itemData'] = data
            console.log("node", node.position, node.parent)
        } catch (error) {
            console.log("error",error)
 
        }

    }
    onClickGo(){
        var teamData = DataManager.ins.getTeamData()
        if(!teamData)return
        var allReady = true
        var notReadyUsers:string[] = []

        for(var i = 0; i < teamData.users.length; i++){
            var user = teamData.users[i]
            if(user && user.ready_status != 2){
                allReady = false
                notReadyUsers.push(user.nickname)
            }
        }
        if(!allReady){
            ToastManager.ins.showToast("还有队员未准备好哦")
            return
        }
        DispatchEvent.ins.emit(EventType.WalkTeamGo)
    }
    onClickReady(){
        DispatchEvent.ins.emit(EventType.WalkTeamReady, {
            ready_status: 2,
            successCallback: () => {
                this.btn_ready.active = false
                this.btn_cancel.active = true
            },
            failCallback: () => {
                this.btn_ready.active = true
                this.btn_cancel.active = false
            }
        })
    }
    onClickCancel(){
        DispatchEvent.ins.emit(EventType.WalkTeamReady, {
            ready_status: 1,
            successCallback: () => {
                this.btn_ready.active = true
                this.btn_cancel.active = false
            },
            failCallback: () => {
                this.btn_ready.active = false
                this.btn_cancel.active = true
            }
        })
    }
    onClickBack(){
        UIManager.ins.show(ViewPath.ConfirmLeaveTeamPanel)
        // UIManager.ins.hideView(this.node)
    }
}


