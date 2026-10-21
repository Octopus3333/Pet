import { _decorator, Component, Node, Socket } from 'cc';
import { SocketManager, SocketMSgId } from '../common/network/SocketManager';
import { RoomLayer } from './RoomLayer';
import { DataManager } from '../Data/DataManager';
import { TeamData, WalkTeamChangeNotify, WalkUser } from '../common/utils/InterfaceDefine';
import { DispatchEvent } from '../common/utils/DispatchEvent';
import { EventType, ViewPath } from '../common/utils/Define';
import { ToastManager } from '../common/utils/ToastManager';
import { UIManager } from '../common/utils/UIManager';
import { WaitingManager } from '../common/utils/WaitingManager';
import { WalkManager } from './walk/WalkManager';

export class WalkTeamManager  {
    static _ins:WalkTeamManager = null
    static get ins(): WalkTeamManager {
        if (!this._ins) {
            this._ins = new WalkTeamManager()
        }
        return this._ins
    }
    roomLayer:Node = null
    // private mockPushTimer:any = null
    // private mockPushCount = 0
    init(){
        console.log("WalkTeamManager.init")
        DispatchEvent.ins.on(EventType.WalkTeamGo,this.onGo, this)
        DispatchEvent.ins.on(EventType.WalkTeamReady,this.onReady, this)
        DispatchEvent.ins.on(EventType.WalkTeamLeave,this.onLeave, this)
        DispatchEvent.ins.on(EventType.WalkTeamMake, this.walkTeamMake, this)
        DispatchEvent.ins.on(EventType.ShowWalkInvite, this.showWalkInvite,this)
        DispatchEvent.ins.on(EventType.JoinTeam, this.JoinTeam,this)
        DispatchEvent.ins.on(EventType.WalkTeamLeave, this.onExitTeam, this)
        DispatchEvent.ins.on(EventType.BackTeam, this.backTeamFromWalk, this)
        SocketManager.instance.on(SocketMSgId.WalkTeamChangeNotify,this.onTeamChange.bind(this))

    }
    clean(){
        DispatchEvent.ins.off(EventType.WalkTeamGo,this.onGo, this)
        DispatchEvent.ins.off(EventType.WalkTeamReady,this.onReady, this)
        DispatchEvent.ins.off(EventType.WalkTeamLeave,this.onLeave, this)
        DispatchEvent.ins.off(EventType.WalkTeamMake, this.walkTeamMake, this)
        DispatchEvent.ins.off(EventType.ShowWalkInvite, this.showWalkInvite,this)
        DispatchEvent.ins.off(EventType.JoinTeam, this.JoinTeam,this)
        DispatchEvent.ins.off(EventType.WalkTeamLeave, this.onExitTeam, this)        
        SocketManager.instance.off(SocketMSgId.WalkTeamChangeNotify,this.onTeamChange.bind(this))

    }
    backTeamFromWalk(){
        SocketManager.instance.sendDataWithCallback(SocketMSgId.WalkBackCamp,{},async (res)=>{
            if(res.code != 0){
                ToastManager.ins.showToast(res.msg ||"返回队伍失败")
                UIManager.ins.show(ViewPath.HomePanel)
                return
            }
            UIManager.ins.hide(ViewPath.WalkMain)
            var node = await UIManager.ins.show(ViewPath.RoomLayer)
            // 测试假数据：初始化监听 + 注册房间节点 + 加载初始数据 + 启动定时推送
            this.setRoomLayer(node)
            this.JoinRoom(res)
        })
    }
    walkTeamMake(){
        // if(this.checkWareHouseView()){
        //     return
        // }
        SocketManager.instance.sendDataWithCallback(SocketMSgId.WalkTeamMake,{},async (res)=>{
            if(res.code != 0){
                if(res.code == 1014014){
                    UIManager.ins.show(ViewPath.WarehouseFullPopup)
                    return
                }                
                ToastManager.ins.showToast(res.msg || "创建房间失败")
                return
            }
            if(res.walk_status == 2){ // 正在游戏中
                this.JoinTeam()//调用加入队伍方法获取游戏数据
                return
            }
            var node = await UIManager.ins.show(ViewPath.RoomLayer)
            // 测试假数据：初始化监听 + 注册房间节点 + 加载初始数据 + 启动定时推送
            this.setRoomLayer(node)
            this.JoinRoom(res)
            // WalkTeamManager.ins.loadMockTeamData()
            // WalkTeamManager.ins.startMockPush()
        })
    }
    onExitTeam(){
        this.onLeave()
    }

    checkWareHouseView(){
        var stoke = DataManager.ins.getWarehouseStock()
        var capcity = DataManager.ins.getWarehouseCapacity()
        console.log("stoke====================", stoke, capcity)
        if(stoke >= capcity){
            UIManager.ins.show(ViewPath.WarehouseFullPopup)
            return true
        }
        return false
    }
    showWalkInvite(){
        console.log("showWalkInvite================")
        WaitingManager.ins.show(true)
        SocketManager.instance.sendDataWithCallback(SocketMSgId.WalkFriendList,{},(res)=>{
            WaitingManager.ins.hide()
            if(!res || res.code != 0){
                ToastManager.ins.showToast(res.msg || "获取好友列表失败")
                return
            }
            console.log("walkFrienList Res", res)
            DataManager.ins.updateWalkFriends(res.list || [])
            UIManager.ins.show(ViewPath.InvitView)
        })
    }

    JoinTeam(){
        // if(this.checkWareHouseView()){
        //     return
        // }
        SocketManager.instance.sendDataWithCallback(SocketMSgId.WalkInfo,{},async (res)=>{
            WaitingManager.ins.hide()
            console.log("WalkInfo",res)
            if(res.code != 0){
                if(res.code == 1014014){
                    UIManager.ins.show(ViewPath.WarehouseFullPopup)
                    return
                }
                ToastManager.ins.showToast(res.msg || "创建房间失败")
                return
            }
            if(res.walk_status == 2){
                WalkManager.ins.relogin(res)
                return
            }
            var node = await UIManager.ins.show(ViewPath.RoomLayer)
            this.setRoomLayer(node)
            this.JoinRoom(res)
        })
    }
    onGo(){
        SocketManager.instance.sendDataWithCallback(SocketMSgId.WalkRun,{},(res)=>{
            if(res.code != 0){
                ToastManager.ins.showToast(res.msg || "开始散步错误")
                return
            }
            UIManager.ins.hideView(this.roomLayer)
        })
    }
    onReady(data:{ready_status:number, successCallback?:()=>void, failCallback?:()=>void}){
        SocketManager.instance.sendDataWithCallback(SocketMSgId.WalkReady,{ready_status: data.ready_status},(res)=>{
            if(res.code != 0){
                ToastManager.ins.showToast(res.msg || "操作失败")
                if(data.failCallback)data.failCallback()
                return
            }
            if(data.successCallback)data.successCallback()
        })
    }
    onLeave(){
        // this.stopMockPush()
        UIManager.ins.hideView(this.roomLayer)
        DataManager.ins.cleanTeamData()
    }
    setRoomLayer(node){
        if(!this.roomLayer){
            this.roomLayer = node
        }else if(this.roomLayer == node){
            this.roomLayer.active = true
        }else{
            this.roomLayer.destroy()
            this.roomLayer = node
        }
    }
    JoinRoom(data){
        var teamData = DataManager.ins.updateTeamData(data)
         if(!this.roomLayer)return
        var roomLayer = this.roomLayer.getComponent(RoomLayer)
        console.log("roomLayer", roomLayer)
        if(roomLayer){
            roomLayer.loadRoomData(teamData)
        }
    }
    onTeamChange(msgId:string,data:WalkTeamChangeNotify){
        console.log("onTeamChange",data)
        var teamData = DataManager.ins.updateTeamData(data)
        // roomLayer 可能为空（如重连直接进入 walkMain 时），此时跳过房间 UI 刷新但不影响数据更新
        if(this.roomLayer){
            var roomLayer = this.roomLayer.getComponent(RoomLayer)
            console.log("roomLayer", roomLayer)
            if(roomLayer){
                roomLayer.loadRoomData(teamData)
            }
        }
        // 通知 WalkUser 组件更新数据
        DispatchEvent.ins.emit(EventType.TeamUserUpdate, data.users)
    }

}


