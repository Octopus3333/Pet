import { _decorator, Component, Node, Prefab } from 'cc';
import { RecycleScrollView } from '../common/components/RecycleScrollView';
import { UIManager } from '../common/utils/UIManager';
import { DataManager } from '../Data/DataManager';
import { ResLoader } from '../common/download/ResLoader';
import { Common, EventType } from '../common/utils/Define';
import { DispatchEvent } from '../common/utils/DispatchEvent';
const { ccclass, property } = _decorator;

@ccclass('ApplyFriendList')
export class ApplyFriendList extends Component {
    @property(RecycleScrollView)
    sv_list:RecycleScrollView = null
    protected async onLoad(): Promise<void> {
        var pb = await ResLoader.ins.loadResAsync(Common.prefabPath + "chat/ApplyFriendItem",Prefab)
        this.sv_list.setPrefab(pb)
        DispatchEvent.ins.on(EventType.RefreshApplyList, this.loadData, this)
        this.loadData()

    }
    onDestroy() {
        
    }
    loadData(){
        var addList = DataManager.ins.getAddList()

        var applyList = DataManager.ins.getApplyList()
        var totalData = applyList.concat(addList)
        console.log("totalData",totalData, addList, applyList)
        this.setData(totalData)
    }
    onClickClose(){
        console.log("clickClose==========")
        UIManager.ins.hideView(this.node)
    }
    async setData(data){
        var pb = await ResLoader.ins.loadResAsync(Common.prefabPath + "chat/ApplyFriendItem",Prefab)
        this.sv_list.setPrefab(pb)
        this.sv_list.setData(data)
    }

}


