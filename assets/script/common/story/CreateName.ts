import { _decorator, Component, EditBox, Button, error, tween } from 'cc';
import { HttpClient } from '../network/HttpClient';
import { DispatchEvent } from '../utils/DispatchEvent';
import { EventType } from '../utils/Define';
import { ToastManager } from '../utils/ToastManager';
import { DataManager } from '../../Data/DataManager';
import { SocketManager, SocketMSgId } from '../network/SocketManager';
import { UIManager } from '../utils/UIManager';
import { ChatManager } from '../../chat/ChatManager';
import { ChatMessage } from '../../chat/ChatData';
import { ChatMsg } from '../utils/InterfaceDefine';
import { StoryManager } from './StoryManager';

const { ccclass, property } = _decorator;

@ccclass('CreateName')
export class CreateName extends Component {
    @property(EditBox)
    edName: EditBox = null;

    @property(EditBox)
    edPet: EditBox = null;

    @property(EditBox)
    edCall: EditBox = null;

    @property(Button)
    btnConfirm: Button = null;

    async onClickConfirm() {
        const userName = this.edName?.string?.trim() || '';
        const petName = this.edPet?.string?.trim() || '';
        const callName = this.edCall?.string?.trim() || '';
        if(userName.length > 6){
            ToastManager.ins.showToast("名字最长不超过6个汉字")
            return
        }
        if(petName.length > 6){
            ToastManager.ins.showToast("宠物名字最长不超过6个汉字")
            return
        }
        if (!userName) {
            ToastManager.ins.showToast('请输入你的名字');
            return;
        }
        if (!petName) {
            ToastManager.ins.showToast('请输入宠物名字');
            return;
        }
        if (!callName) {
            ToastManager.ins.showToast('请输入宠物对你的称呼');
            return;
        }
        SocketManager.instance.sendDataWithCallback(SocketMSgId.UserInfoUpdate,{
            pet_name:petName,
            nickname:userName,
            parent_call:callName
        },(res)=>{
            if(!res){
                ToastManager.ins.showToast("请求错误")
                return
            }
            if(res?.code != 0){
                ToastManager.ins.showToast(res.error)
                return
            }
            DataManager.ins.updateUserData({petName:petName, nickname:userName, parent_call:callName})
            UIManager.ins.hideView(this.node)
            var str = petName + "...这是我的名字吗？我有名字了！" + "谢谢" + callName
            var message:ChatMsg[] = [{
                nickname:petName,
                is_me:false,
                msg:str,
                msg_type:1,
                chat_type:2
            }]
            ChatManager.ins.appendMessage(message)
            SocketManager.instance.sendDataWithCallback(SocketMSgId.UserInfoUpdate,{new_user_lead:8},(res)=>{
                if(res.code == 0){
                    var userInfo = DataManager.ins.getUserInfo()
                    userInfo.newUserLead = 8
                    StoryManager.ins.stopStory()
                    console.log("new_user_lead set", res)
                }else{
                    ToastManager.ins.showToast(res.msg || "引导错误")
                }
               
            })
        })

    }
}
