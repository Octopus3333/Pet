import { _decorator, Button, Color, Component, instantiate, Label, Node, Prefab, ScrollView, Sprite } from 'cc';
import { RecycleScrollView } from '../common/components/RecycleScrollView';
import { DataManager } from '../Data/DataManager';
import { loadImg } from '../common/utils/UiTools';
import { Common, ViewPath } from '../common/utils/Define';
import { SocketManager, SocketMSgId } from '../common/network/SocketManager';
import { WalkSeekItem, WalkSeekListReq, WalkSeekListResp } from '../common/utils/InterfaceDefine';
const { ccclass, property } = _decorator;
const Location = ["大草坪"]
@ccclass('TeamView')
export class TeamView extends Component {
    @property(RecycleScrollView)
    sv_scroll:RecycleScrollView = null
    @property(Node)
    nd_all_detail:Node = null
    @property(Node)
    nd_location:Node = null
    @property(Node)
    ly_location:Node = null
    @property(Prefab)
    cell_Prefab:Prefab = null
    @property(Label)
    lb_all:Label = null
    /** 招募列表数据（临时存储，供 recycleScrollView 渲染） */
    data:WalkSeekItem[] = []
    locationIndex = 0

    /** 每页请求数量 */
    private _pageSize:number = 10
    /** 轮询间隔（秒） */
    private _pollInterval:number = 10
    /** 是否正在加载（防止重复请求） */
    private _isLoading:boolean = false

    protected onLoad(): void {
        this.init()
        this.initScroll()
    }

    protected onEnable(): void {
        // 清空当前数据
        this.data = []
        this.sv_scroll?.setData([], false)
        // 请求最新招募数据（缓存为空时 last_seek_id=0, is_new=true）
        this.requestWalkSeekList(true)
        // 启动轮询：每 _pollInterval 秒请求最新招募数据
        this.schedule(this.pollLatestData, this._pollInterval)
    }

    protected onDisable(): void {
        // 停止轮询
        this.unschedule(this.pollLatestData)
    }

    protected onDestroy(): void {
        this.unscheduleAllCallbacks()
    }

    /**
     * 初始化滚动列表组件
     * 设置 Cell 预制体与上拉加载更多回调
     */
    initScroll(){
        if(!this.sv_scroll) return
        if(this.cell_Prefab){
            this.sv_scroll.setPrefab(this.cell_Prefab)
        }
        // 上拉加载更多（请求更老的历史数据）
        this.sv_scroll.setOnPullRefresh(() => this.onPullUpRefresh())
        this.sv_scroll.setPullRefreshEnabled(true)
    }

    /**
     * 获取缓存数据中最大的 seek_id（用于请求最新数据时的游标）
     * 缓存为空时返回 0
     */
    private getMaxSeekId():number {
        if(this.data.length === 0) return 0
        let max = 0
        for(const item of this.data){
            if(item.seek_id > max) max = item.seek_id
        }
        return max
    }

    /**
     * 获取缓存数据中最小的 seek_id（用于请求更老数据时的游标）
     * 缓存为空时返回 0
     */
    private getMinSeekId():number {
        if(this.data.length === 0) return 0
        let min = this.data[0].seek_id
        for(const item of this.data){
            if(item.seek_id < min) min = item.seek_id
        }
        return min
    }

    /**
     * 请求招募列表
     * @param isNew true: 请求最新数据（seek_id > max_seek_id 的增量）；false: 请求更老数据（seek_id < min_seek_id 的历史）
     */
    requestWalkSeekList(isNew:boolean){
        if(this._isLoading) return
        this._isLoading = true
        const lastSeekId = isNew ? this.getMaxSeekId() : this.getMinSeekId()
        const req:WalkSeekListReq = {
            last_seek_id: lastSeekId,
            page_size: this._pageSize,
            is_new: isNew
        }
        SocketManager.instance.sendDataWithCallback(SocketMSgId.WalkSeekList, req, (res, err)=>{
            this._isLoading = false
            if(err){
                console.warn('[TeamView] WalkSeekList error', err)
                return
            }
            if(!res || res.code != 0){
                console.warn('[TeamView] WalkSeekList failed', res?.msg)
                return
            }
            this.onWalkSeekListResp(res, isNew)
        })
    }

    /**
     * 处理招募列表响应
     * @param isNew true: 返回的是最新增量数据，放到缓存最前面；false: 返回的是更老历史数据，追加到缓存末尾
     */
    onWalkSeekListResp(resp:WalkSeekListResp, isNew:boolean){
        console.log("onWalkSeekListResp",resp)
        const list = resp.list || []
        if(list.length === 0) return

        if(isNew){
            // 最新增量数据：去重后放到最前面
            const existingIds = new Set(this.data.map(item => item.seek_id))
            const newItems = list.filter(item => !existingIds.has(item.seek_id))
            if(newItems.length === 0) return
            this.data = [...newItems, ...this.data]
            var addItems = []
            for(var item of newItems){
                if(this.locationIndex == 0 || this.locationIndex == item.walk_address_id){
                    addItems.push(item)
                }
            }
            this.sv_scroll?.unshiftData(addItems)

            // 刷新界面并滑动到最下面
            this.scheduleOnce(()=>{
                // this.sv_scroll?.scrollView?.scrollToBottom(0.2)
            }, 0)
        }else{
            // 更老历史数据：去重后追加到末尾
            const existingIds = new Set(this.data.map(item => item.seek_id))
            const newItems = list.filter(item => !existingIds.has(item.seek_id))
            if(newItems.length === 0) return
            this.data = this.data.concat(newItems)
            var addItems = []
            for(var item of newItems){
                if(this.locationIndex == 0 || this.locationIndex == item.walk_address_id){
                    addItems.push(item)
                }
            }
            this.sv_scroll?.addData(addItems)
        }
    }

    /**
     * 上拉加载更多：请求更老的历史数据
     * last_seek_id = 缓存中最小的 seek_id，is_new=false
     */
    onPullUpRefresh(){
        if(this.data.length === 0) return
        this.requestWalkSeekList(false)
    }

    /**
     * 轮询：每 _pollInterval 秒请求最新招募数据
     * last_seek_id = 缓存中最大的 seek_id，is_new=true
     */
    pollLatestData(){
        this.requestWalkSeekList(true)
    }

    // ========== 以下为原有的地点选择逻辑 ==========
    init(){
        if(this.nd_all_detail){
            this.nd_all_detail.active = false
        }
        if(this.nd_location){
            this.nd_location.active = true
        }
        this.loadLocations()
        this.refreshView()
    }
    onClickLocationBtn(sender){
        if(sender?.target?.index == null)return
        this.locationIndex = sender?.target?.index || 0
        this.onClickFlod()
        this.refreshView()
    }

    onClickExpand(){
        if(this.nd_location){
            this.nd_location.active = false
        }
        if(this.nd_all_detail){
           this.nd_all_detail.active = true         
        }    
        this.loadLocations()
    }
    onClickFlod(){
        if(this.nd_location){
            this.nd_location.active = true
        }
        if(this.nd_all_detail){
           this.nd_all_detail.active = false         
        }
        this.cleanLocation()

    }
    refreshLocationBtns(){
        for(var obj of this.ly_location.children){
            var sp = obj.getComponent(Sprite)
            var lb = obj?.getChildByName("Label").getComponent(Label)
            console.log("obj===", obj.index, this.locationIndex)
            if(obj.index == this.locationIndex){
                console.log(111111111)
                lb.color = new Color(195, 125 ,115)
                loadImg(sp, Common.texturePath + "chat/loc_name_1/spriteFrame" )
            }else{
                console.log(222222222)
                lb.color = new Color(107, 164 ,142)
                loadImg(sp, Common.texturePath + "chat/loc_name_2/spriteFrame" )
            }
        }
    }
    refreshView(){
        console.log("refreshView")
        this.refreshLocationBtns()
        var data = []
        if(this.locationIndex == 0){
            data = this.data
            this.lb_all.string = "全部"
        }else{
            console.log("Location[this.locationIndex - 1]", Location[this.locationIndex - 1])
            this.lb_all.string = Location[this.locationIndex - 1] || "全部"
            this.data.forEach((element)=>{
                if(element.walk_address_id == this.locationIndex){
                    data.push(element)
                }
            })
        }
        this.sv_scroll.setData(data)
    }
    cleanLocation(){
        if(!this.ly_location)return
        for(var i = 0; i < this.ly_location.children.length; i++){
            if(i > 0 && this.ly_location.children[i]){
                this.ly_location.children[i].destroy()
            }
        }
    }
    loadLocations(){
        if(!this.ly_location)return
        var data = ["大草坪"]
        if(data.length <= 0) return
        this.cleanLocation()
        var btn_check = this.ly_location.getChildByName("btn_check")
        if(!btn_check)return
        // if(data.length > 1){
        for(var i = 0 ; i < data.length; i++){
            var btn = instantiate(btn_check)
            btn.parent = this.ly_location      
            var lbBtn = btn.getChildByName("Label")?.getComponent(Label)
            lbBtn.string = data[i]
            btn.index = i + 1
        }
        // }
        var lb = btn_check.getChildByName("Label")?.getComponent(Label)
        btn_check.index = 0
        lb.string = "全部"
        this.refreshLocationBtns()
    }
}
