import { _decorator, Button, Component, Label, Node, Sprite } from 'cc';
import { ToastManager } from '../common/utils/ToastManager';
import { OtherUserDetail } from '../common/utils/InterfaceDefine';
import { loadAvatar } from '../common/utils/UiTools';
import { SocketManager, SocketMSgId } from '../common/network/SocketManager';
import { UIManager } from '../common/utils/UIManager';
import { ChatManager } from '../chat/ChatManager';
import { PetCommonComp } from '../common/components/PetCommonComp';
const { ccclass, property } = _decorator;

@ccclass('UserInfoDetail')
export class UserInfoDetail extends Component {
    @property(Node)
    nd_pet:Node = null
    @property(Label)
    lb_name:Label = null
    @property(Label)
    lb_id:Label = null
    @property(Sprite)
    sp_icon:Sprite = null
    @property(Sprite)
    sp_message:Sprite = null
    /** 添加好友弹窗 */
    @property(Node)
    nd_add_friend:Node = null
    /** 添加好友按钮 */
    @property(Node)
    btn_add:Node = null
    @property(Label)
    lb_pet_name:Label = null
    @property(Button)
    btn_pet_close:Button = null
    /** 宠物状态 */
    @property(Label)
    lb_pet_albums:Label = null
    @property(Label)
    lb_pet_love:Label = null
    @property(Label)
    lb_pet_hungry:Label = null
    @property(Label)
    lb_pet_clean:Label = null

    data: OtherUserDetail = null
    private _fromTeam = false
    private btn_visit: Button = null
    private btn_team: Button = null
    private btn_send: Button = null
    private btn_chat: Node = null
    private nd_love: Node = null

    protected onLoad(): void {
        this.node.on(Node.EventType.TOUCH_END, this.close,this)
        const content = this.node.getChildByName('nd_content')
        if(content){
            this.btn_visit = content.getChildByName('btn_visit')?.getComponent(Button)
            this.btn_team = content.getChildByName('btn_team')?.getComponent(Button)
            this.btn_send = content.getChildByName('btn_send')?.getComponent(Button)
            this.btn_chat = content.getChildByName('btn_chat')
            this.nd_love = content.getChildByPath('pet_state/nd_love')
        }
    }
    close(){
        UIManager.ins.hideView(this.node)
    }

    setData(data: OtherUserDetail, fromTeam = false){
        this._fromTeam = fromTeam
        this.data = data
        this.lb_name.string = data.nickname
        this.lb_id.string = "id: " + data.user_id
        this.lb_pet_name.string = "名字: " + data.pet_name
        loadAvatar(this.sp_icon, data.head_img)

        // this.lb_pet_albums.string = String(data.pet_albums)
        this.lb_pet_love.string = String(data.intimacy)
        this.lb_pet_hungry.string = String(data.energy)
        this.lb_pet_clean.string = String(data.clean) + "%"

        // 服务器 friend_apply_status 映射到本地 friendStatus
        const status = data.friend_apply_status ?? data.friendStatus ?? 0
        this.data.friend_apply_status = status
        this.data.friendStatus = status
        if(this.nd_pet){
            var petComp = this.nd_pet.getComponent(PetCommonComp)
            petComp.setData(data)
        }
        this.refreshAddFriendBtn(status)
        this.refreshTeamView()

        if(this.nd_add_friend){
            this.nd_add_friend.active = false
        }
    }

    private isFriend(){
        return (this.data?.friend_apply_status ?? this.data?.friendStatus ?? 0) === 2
    }

    private refreshTeamView(){
        if(!this._fromTeam){
            if(this.btn_chat) this.btn_chat.active = true
            this.setBtnGray(this.btn_visit, false)
            this.setBtnGray(this.btn_team, false)
            this.setBtnGray(this.btn_send, !this.isFriend())
            this.setNodeGray(this.nd_love, false)
            return
        }
        if(this.btn_chat) this.btn_chat.active = false
        console.log("isFriend", this.isFriend())
        this.setBtnGray(this.btn_visit, true)
        this.setBtnGray(this.btn_team, true)
        this.setBtnGray(this.btn_send, !this.isFriend())
        this.setNodeGray(this.nd_love, !this.isFriend())
    }

    private setBtnGray(btn: Button, gray: boolean){
        if(!btn) return
        btn.interactable = true
        console.log("gray===========",btn, gray)
        const sp = btn.getComponent(Sprite)
        if(sp) sp.grayscale = gray
    }

    private setNodeGray(node: Node, gray: boolean){
        if(!node) return
        node.getComponentsInChildren(Sprite).forEach(sp => sp.grayscale = gray)
    }

    /**
     * 根据好友状态刷新 btn_add 子节点显示
     * @param status 0:未添加 1:已申请 2:已添加
     */
    refreshAddFriendBtn(status: number){
        if(!this.btn_add) return
        const sp_add = this.btn_add.getChildByName('sp_add')
        const lb_text = this.btn_add.getChildByName('lb_text')
        const lb_text2 = this.btn_add.getChildByName('lb_text2')
        if(sp_add) sp_add.active = status === 0
        if(lb_text) lb_text.active = status === 1
        if(lb_text2){
            lb_text2.active = status === 2
            if(status === 2){
                const lb = lb_text2.getComponent(Label)
                if(lb) lb.string = `友好度：\n${this.data?.intimacy ?? 0}`
            }
        }
        this.sp_message.node.active = status == 0
        const btn = this.btn_add.getComponent(Button)
        if(btn){
            btn.interactable = status === 0
        }
    }

    /** 更新好友状态（同步服务器字段与本地字段） */
    private updateFriendStatus(status: number){
        if(!this.data) return
        this.data.friend_apply_status = status
        this.data.friendStatus = status
        this.refreshAddFriendBtn(status)
        this.refreshTeamView()
    }

    onClickAddFriend(){
        if(!this.data || this.data.friendStatus !== 0) return
        if(!this.nd_add_friend) return
        this.nd_add_friend.active = true
    }
    onClickVisit(){
        if(this._fromTeam){
            ToastManager.ins.showToast("组队中，暂不可拜访")
            return
        }
        ToastManager.ins.showToast("暂未开放")
    }
    onClickTeam(){
        if(this._fromTeam){
            ToastManager.ins.showToast("已在队伍中")
            return
        }
        ToastManager.ins.showToast("暂未开放")
    }
    onClickSend(){
        if(this._fromTeam){
            if(this.isFriend()){
                ToastManager.ins.showToast("敬请期待～")
            }else{
                ToastManager.ins.showToast("先成为好友吧～")
            }
            return
        }
        ToastManager.ins.showToast("暂未开放")
    }
    onClickChat(){
        if(this._fromTeam) return
        ChatManager.ins.openChat({
            user_id :this.data.user_id,
            nickname:this.data.nickname,
            head_img:this.data.head_img
        })
    }
    onClickCancelApply(){
        if(!this.nd_add_friend) return
        this.nd_add_friend.active = false
    }
    onClickApply(){
        SocketManager.instance.sendDataWithCallback(SocketMSgId.FriendAdd,{user_id:this.data.user_id}, (res)=>{
            console.log("apply friend=======",res)
            if(res.code != 0){
                ToastManager.ins.showToast(res.msg)
                // 已申请过等错误时，若服务端返回状态则同步 UI
                if(res.friend_apply_status != null){
                    this.updateFriendStatus(res.friend_apply_status)
                    this.onClickCancelApply()
                }else if(res.msg && res.msg.indexOf('已申请') >= 0){
                    this.updateFriendStatus(1)
                    this.onClickCancelApply()
                }
                return
            }
            const status = res.friend_apply_status ?? 1
            this.updateFriendStatus(status)
            this.onClickCancelApply()
            ChatManager.ins.updateApplyList()
        })
    }
    onClickClose(){
        UIManager.ins.hideView(this.node)
    }
}