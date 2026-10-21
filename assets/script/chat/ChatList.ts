import { _decorator, Component, Node, ScrollView, Prefab, EditBox, Button, SpriteFrame, Sprite, UITransform, Label } from 'cc';
import { Chat } from '../common/utils/InterfaceDefine';
import { RecycleScrollView } from '../common/components/RecycleScrollView';
import { UIManager } from '../common/utils/UIManager';
import { StoryManager } from '../common/story/StoryManager';
import { DataManager } from '../Data/DataManager';
import { Common, ViewPath } from '../common/utils/Define';
import { ResLoader } from '../common/download/ResLoader';
import { UserInfoDetail } from '../game/UserInfoDetail';
import { ChatManager } from './ChatManager';
import { ToastManager } from '../common/utils/ToastManager';
import { ChatDataManager } from './ChatDataManager';

const { ccclass, property } = _decorator;

/** Item 固定高度，需与 ChatObjCell 预制体高度一致 */
const CELL_HEIGHT = 150;

/**
 * 聊天列表组件
 * 挂在 ChatList 预制体上，管理好友列表的显示与复用
 *
 * 预制体结构：
 * ChatList (Node)
 *   ├─ nd_scroll (ScrollView)    ← 挂 RecycleScrollView 组件
 *   │    └─ view
 *   │         └─ content
 *   ├─ btn_close (Button)
 *   └─ edit_search (EditBox)
 *
 * 复用逻辑由 RecycleScrollView 组件提供，ChatList 只负责数据管理、搜索、事件。
 */
@ccclass('ChatList')
export class ChatList extends Component {
    @property(ScrollView)
    nd_scroll: ScrollView = null!;

    @property(Prefab)
    cell_Prefab: Prefab = null!;
    @property(Prefab)
    friend_prefab:Prefab = null
    @property(Button)
    btn_close: Button = null!;

    @property(EditBox)
    edit_search: EditBox = null!;

    @property(Button)
    btn_news: Button = null!;
    @property(Button)
    btn_friend_list: Button = null!;
    @property(Button)
    btn_search: Button = null!;
    @property(Button)
    btn_my: Button = null!;
    @property(Node)
    nd_new_friend: Node = null!;
    @property(Node)
    lb_friend_des:Node = null
    @property(Node)
    nd_content:Node = null
    @property(Node)
    nd_team:Node = null
    @property(Node)
    nd_discover:Node = null

    @property(Node)
    nd_my_info: Node = null!
    @property(Label)
    lb_name:Label = null
    /** 复用 ScrollView 组件引用 */
    private _recycleScroll: RecycleScrollView | null = null;
    /** 关闭回调 */
    private _onClose?: () => void;
    /** Item 点击回调 */

    private pageIndex:number = 1

    /** 聊天列表每页请求数量 */
    private _chatPageSize: number = 8;

    
    protected onEnable(): void {
        this.pageIndex = 1
        this.refreshPageBtn()
        this.refreshContent()
    }

    // ========== 生命周期 ==========
    onChangePage(sender, data){
        var pageIndex = Number(data)
        if(!this.pageIndex)return
        this.pageIndex = pageIndex
        this.refreshPageBtn()
        this._recycleScroll?.setPullRefreshEnabled(this.pageIndex === 1)
        this.refreshContent()
    }
    async refreshPageBtn(){
        var spNews = this.btn_news.node.getChildByName("sp_bg").getComponent(Sprite)
        if(spNews){
            var iconName = this.pageIndex == 1?  "btnNewsSelect":"btnNews"
            var spf = await ResLoader.ins.loadResAsync(Common.texturePath+ "chat/" + iconName + "/spriteFrame", SpriteFrame)
            spNews.spriteFrame = spf 
        }
        var spFriends = this.btn_friend_list.node.getChildByName("sp_bg").getComponent(Sprite)
        if(spFriends){
            var iconName = this.pageIndex == 2?  "btnfriendSelect":"btnFriend"
            var spf = await ResLoader.ins.loadResAsync(Common.texturePath+ "chat/" + iconName + "/spriteFrame", SpriteFrame)
            spFriends.spriteFrame = spf 
        }
        var spSearch = this.btn_search.node.getChildByName("sp_bg").getComponent(Sprite)
        if(spSearch){
            var iconName = this.pageIndex == 3?  "btnSearchSelect":"btnSearch"
            var spf = await ResLoader.ins.loadResAsync(Common.texturePath+ "chat/" + iconName + "/spriteFrame", SpriteFrame)
            spSearch.spriteFrame = spf 
        }
        var spMy = this.btn_my.node.getChildByName("sp_bg").getComponent(Sprite)
        if(spMy){
            var iconName = this.pageIndex == 4?  "btnPetSelect":"btnPet"
            var spf = await ResLoader.ins.loadResAsync(Common.texturePath+ "chat/" + iconName + "/spriteFrame", SpriteFrame)
            spMy.spriteFrame = spf 
        }

    }
    updateApplyList(): void {
        ChatManager.ins.updateApplyList();
    }
    showFriendList(){                
        if (this._recycleScroll)
        {
            this._recycleScroll.setData([]);
        }
        this.updateApplyList()
        this.updateFriendList()
        this.nd_content.active = true
        this.nd_new_friend.active = true 
        if(this.lb_name){
            this.lb_name.string = "通讯录"
            this.lb_name.node.active = true
        }
        this.nd_team.active = false
        this.nd_discover && (this.nd_discover.active = false)
        this.lb_friend_des && (this.lb_friend_des.active = true)
        this.changeSvContent("hasNewFriend")
    }
    onClickMarket(){
        ToastManager.ins.showToast("敬请期待")
    }
    showChatList(){
        this.nd_content.active = true
        this.nd_new_friend.active = false 
        this.nd_team.active = false
        if(this.lb_name){
            this.lb_name.string = "逗信"
            this.lb_name.node.active = true
        }

        this.nd_discover && (this.nd_discover.active = false)
        this.setCellPrefab(this.cell_Prefab)
        console.log("loadChatData===")
        this.loadChatData()
        this.lb_friend_des && (this.lb_friend_des.active = false)
        this.changeSvContent()
    }

    /**
     * 下拉刷新加载更多
     * 通过 ChatDataManager 请求数据
     */
    onPullRefresh(){
        console.log("下拉刷新============")
        this.addChatData()
    }
    showTeam(){
        if(this.lb_name){
            this.lb_name.node.active = false
        }
        this.nd_my_info.active = false
        this.nd_content.active = false
        this.nd_team.active = true
        this.nd_discover && (this.nd_discover.active = true)
    }
    
    async refreshContent(){
        if (this.pageIndex !== 4) {
            this.nd_my_info.active = false
        }
        switch (this.pageIndex) {
            case 1:
                this.showChatList()
                break;
            case 2:
                this.showFriendList()
                break;
            case 3:
                this.showTeam()
                break;
            case 4:
                this.nd_team.active = false
                this.nd_discover && (this.nd_discover.active = false)
                this.nd_my_info.active = true
                break;
            default:
                ToastManager.ins.showToast("页面不可达")
                break;
        }
    }
    protected onLoad(): void {
        this.initRecycleScroll();
        this.refreshPageBtn()
        // this.refreshContent()
        this.registerEvents();
    }
    updateFriendList(): void {
        ChatManager.ins.updateFriendList();
    }
    protected onDestroy(): void {
    }
    async onShowApplyList(){
        UIManager.ins.show(ViewPath.ApplyFriendList)
    }
    changeSvContent(state?:string){
        var trans = this._recycleScroll.getComponent(UITransform)
        if(!trans)return
        trans.height = state == "hasNewFriend"? 950:1100
    }

    private initRecycleScroll(): void {
        if (!this.nd_scroll) return;

        this._recycleScroll = this.nd_scroll.node.getComponent(RecycleScrollView);
        if (!this._recycleScroll) {
            console.error('[ChatList] RecycleScrollView component not found on ScrollView node');
            return;
        }

        this._recycleScroll.cellPrefab = this.cell_Prefab;
        this._recycleScroll.cellHeight = CELL_HEIGHT;
        this._recycleScroll.setOnPullRefresh(() => this.onPullRefresh());
        this._recycleScroll.setPullRefreshEnabled(this.pageIndex === 1);
    }

    private registerEvents(): void {
        if (this.btn_close) {
            this.btn_close.node.on(Button.EventType.CLICK, this.onCloseClick, this);
        }
        if (this.edit_search) {
            this.edit_search.node.on(EditBox.EventType.TEXT_CHANGED, this.onSearchChanged, this);
        }
    }

    // ========== 公共 API ==========

    public setOnClose(callback: () => void): void {
        this._onClose = callback;
    }

    public setData(data: Chat[]): void {
        if(!this._recycleScroll)return
        this._recycleScroll.setData(data);
        // this._recycleScroll.node?.getComponent(ScrollView)?.scrollToBottom()
    }

    /**
     * 追加聊天列表数据（下拉刷新加载更多）
     * @param data 新加载的数据
     */
    public addChatData(): void {
        ChatManager.ins.addChatData(this._chatPageSize);
    }

    /**
     * 
     * @param data 
     * 初始化聊天列表数据
     */
    public loadChatData(){
        ChatManager.ins.loadChatData(this._chatPageSize);
    }
    public addData(data: Chat[]): void {
        if(!this._recycleScroll)return
        this._recycleScroll?.addData(data);
        // this._recycleScroll.node?.getComponent(ScrollView)?.scrollToBottom()
    }


    public updateItem(item: Chat): void {
        // const idx = this._allFriends.findIndex((v) => v.chat_id === item.chat_id);
        // if (idx >= 0) {
        //     this._allFriends[idx] = item;
        // } else {
        //     this._allFriends.push(item);
        // }
        // this.applySearch();
    }

    /**
     * 设置 Cell 预制体（由 ChatManager 初始化时调用）
     */
    public setCellPrefab(prefab: Prefab): void {
        if (this._recycleScroll) {
            this._recycleScroll.setPrefab(prefab);
        }
    }

    public close(): void {
        this._onClose?.();
        this.node.active = false;
    }
    onClickSearchFriend(){
        UIManager.ins.show(ViewPath.SearchFriend)
    }
    // ========== 搜索 ==========

    private onSearchChanged(str): void {
        var data 
        if(this.pageIndex == 1){
            data = ChatDataManager.instance.getAllChats()
        }else if(this.pageIndex == 2){
            data = DataManager.ins.getFriendsData()
        }else{
            return
        }
        this.applySearch(str, data);
    }

    private applySearch(keyword: string = '',data, scrollToTop: boolean = true): void {
        if(!data)return
        var showData = data.filter((item) => item.nickname.includes(keyword))
        this._recycleScroll?.setData(showData, scrollToTop);
    }

    private sortByTime(list: Chat[]): Chat[] {
        return list
        // return [...list].sort((a, b) => b.created_at - a.created_at);
    }

    // ========== 事件 ==========

    private onCloseClick(): void {
        this.close();
        UIManager.ins.hideView(this.node)
        StoryManager.ins.stopStory()
    }
}