import { _decorator, Component, Label, Button, Node, Prefab } from 'cc';
import { RecycleScrollView } from '../components/RecycleScrollView';
import { InvitViewData, WalkFriend } from './InterfaceDefine';
import { ResLoader } from '../download/ResLoader';
import { Common, ViewPath } from './Define';
import { UIManager } from './UIManager';
import { DataManager } from '../../Data/DataManager';
import { InvitTips } from '../../team/InvitTips';

const { ccclass, property } = _decorator;

/**
 * 邀请好友视图
 * 展示全部好友列表（全量加载），区分可邀请/不可邀请
 *
 * 数据流程：MainController.showWalkInvite() 请求 WalkFriendList → 存入 DataManager → 显示本视图 → 从 DataManager 读取并展示
 *
 * 预制体结构（需在编辑器中绑定）：
 * InvitView (Node)
 *   ├─ btn_back            → btn_back (Button)
 *   ├─ lb_title            → lb_title (Label)
 *   ├─ sv_friend_list      → sv_friend_list (RecycleScrollView，已由用户添加组件)
 *   ├─ pf_friend_item      → pf_friend_item (Prefab，InviteCell 预制体，可选不绑则自动加载)
 *   └─ lb_bottom_tip       → lb_bottom_tip (Label，底部"到底啦～"提示)
 */
@ccclass('InvitView')
export class InvitView extends Component {

    @property(Button)
    btn_back: Button = null!;

    @property(Label)
    lb_title: Label = null!;

    @property(RecycleScrollView)
    sv_friend_list: RecycleScrollView = null!;

    @property(Prefab)
    pf_friend_item: Prefab = null!;

    @property(Label)
    lb_bottom_tip: Label = null!;

    /** 视图配置（标题、返回回调） */
    private _viewData: InvitViewData | null = null;
    /** Cell 预制体是否已就绪（避免 onEnable 在 onLoad 完成前重复渲染） */
    private _prefabReady: boolean = false;

    protected async onLoad(): Promise<void> {
        if (this.btn_back) {
            this.btn_back.node.on(Button.EventType.CLICK, this.onBack, this);
        }

        // 确保 RecycleScrollView 已设置 Cell 预制体
        await this.ensureCellPrefab();
        this._prefabReady = true;

        // 首次渲染
        this.renderFriends();
    }

    protected onEnable(): void {
        // 重新显示时刷新数据（跳过首次，由 onLoad 处理）
        if (this._prefabReady) {
            this.renderFriends();
        }
    }

    protected onDestroy(): void {
        // if (this.btn_back) {
        //     this.btn_back.node.off(Button.EventType.CLICK, this.onBack, this);
        // }
    }

    /**
     * 显示视图（可选传入配置数据）
     * 注意：通过 UIManager.ins.show(ViewPath.InvitView) 显示时不会调用此方法，
     *      仅在需要自定义标题/返回回调时手动调用
     */
    public show(data?: InvitViewData): void {
        this._viewData = data || null;
        if (this.lb_title && data?.title) {
            this.lb_title.string = data.title;
        }
        this.node.active = true;
    }

    /** 确保 RecycleScrollView 已设置 Cell 预制体 */
    private async ensureCellPrefab(): Promise<void> {
        if (!this.sv_friend_list) return;
        if (this.sv_friend_list.cellPrefab) return;

        let pb = this.pf_friend_item;
        if (!pb) {
            pb = await ResLoader.ins.loadResAsync(
                Common.prefabPath + 'common/InviteCell',
                Prefab
            );
            this.pf_friend_item = pb;
        }
        if (pb) {
            this.sv_friend_list.setPrefab(pb);
        }
    }

    /** 从 DataManager 读取全量好友数据并渲染 */
    private renderFriends(): void {
        const friends: WalkFriend[] = DataManager.ins.getWalkFriends();
        this.sv_friend_list.setData(friends);
        this.updateBottomTip(friends.length);
    }

    /** 更新底部提示：有数据时显示"到底啦～" */
    private updateBottomTip(count: number): void {
        if (!this.lb_bottom_tip) return;
        if (count > 0) {
            this.lb_bottom_tip.node.active = true;
            this.lb_bottom_tip.string = '到底啦～';
        } else {
            this.lb_bottom_tip.node.active = false;
        }
    }
    async onClickPublish(){
        var tips:Node = await UIManager.ins.show(ViewPath.InvitTips)
        var tipsComp:InvitTips = tips.getComponent(InvitTips)
        tipsComp.show(1)   
    }
    private onBack(): void {
        if (this._viewData?.onBack) {
            this._viewData.onBack();
        }
        UIManager.ins.hideView(this.node);
    }
}
