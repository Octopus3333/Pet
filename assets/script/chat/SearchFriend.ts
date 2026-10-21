import { _decorator, Button, Label, Component, EditBox, Prefab } from 'cc';
import { SocketManager, SocketMSgId } from '../common/network/SocketManager';
import { RecycleScrollView } from '../common/components/RecycleScrollView';
import { ResLoader } from '../common/download/ResLoader';
import { Common } from '../common/utils/Define';
import { UIManager } from '../common/utils/UIManager';
import { ToastManager } from '../common/utils/ToastManager';
import { DataManager } from '../Data/DataManager';
const { ccclass, property } = _decorator;

@ccclass('SearchFriend')
export class SearchFriend extends Component {
    @property(RecycleScrollView)
    sv_list:RecycleScrollView = null
    @property(Button)
    btn_search:Button = null
    @property(EditBox)
    ed_input:EditBox = null
    @property(Label)
    lb_id:Label = null
    @property(Button)
    btn_copy_id:Button = null

    protected onLoad(): void {
        this.refreshMyIdText()
    }

    protected onEnable(): void {
        this.resetSearchState()
    }

    onClickClose(){
        this.resetSearchState()
        UIManager.ins.hideView(this.node)
    }

    /** 清空搜索输入与结果，恢复「我的 ID」展示 */
    private resetSearchState(): void {
        if (this.ed_input) {
            this.ed_input.string = ''
        }
        this.sv_list?.setData([])
        this.setMyIdVisible(true)
        this.refreshMyIdText()
    }

    onSearch(){
        var key = this.ed_input.string
        if(!key|| key.length == 0)return
        console.log("key=========",key)
        SocketManager.instance.sendDataWithCallback(SocketMSgId.UserSearch,{ keyword : key }, async (res)=>{
            console.log("search callback",res)
            if(res.code != 0){
                ToastManager.ins.showToast(res.msg)
                return
            }
            var pb = await ResLoader.ins.loadResAsync(Common.prefabPath + "chat/SearchFriendItem", Prefab)
            this.sv_list.setPrefab(pb)

            const users = res.users || []
            this.sv_list.setData(users)

            this.setMyIdVisible(users.length === 0)
        })
    }

    onSearchChange(){
        const key = this.ed_input.string
        if(!key || key.length === 0){
            this.setMyIdVisible(true)
            this.sv_list.setData([])
        }
    }

    onCopyId(){
        //复制玩家ID逻辑
    }

    /** 控制我的ID区域与复制按钮显隐 */
    private setMyIdVisible(visible: boolean): void {
        if (this.lb_id?.node) {
            this.lb_id.node.active = visible
        }
        if (this.btn_copy_id?.node) {
            this.btn_copy_id.node.active = visible
        }
    }

    /** 刷新「我的 ID」数值（lb_value） */
    private refreshMyIdText(): void {
        const userId = DataManager.ins.getUserInfo()?.userId
        if (!userId || !this.lb_id?.node) return
        const valueLabel = this.lb_id.node.getChildByName('lb_value')?.getComponent(Label)
        if (valueLabel) {
            valueLabel.string = String(userId)
        }
    }
}
