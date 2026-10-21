import { Vec2 } from "cc";
import { EventType, ItemChangeType, WarehouseType } from "../common/utils/Define";
import { DispatchEvent } from "../common/utils/DispatchEvent";
import { Friend, UserInfo, Chat, FriendApply, Item, ItemChange, TeamData, WalkTeamChangeNotify, WalkFriend, WalkMapInfo, RouteConfig, MapCellData, DropItem, WalkRunNextNotify, RoadData } from "../common/utils/InterfaceDefine";
import { WalkMapCfgManager } from "../game/walk/WalkMapCfgManager";

export class GameData {
    /** 当前用户数据 */
    userInfo: UserInfo = null;
    friends:Friend[] = null
    addFriendList:FriendApply[] = []
    applyFriendList:FriendApply[] = []
    /** 散步可邀请好友列表（WalkFriendList 协议返回） */
    walkFriends: WalkFriend[] = []
    /** 其他玩家数据列表 */
    private _otherPlayers: UserInfo[] = [];

    /** 背包道具列表 */
    private _backpack: Item[] = [];
    /** 羁绊物列表 */
    private _bondItems: Item[] = [];
    /** 仓库道具列表 */
    private _warehouse: Item[] = [];

    /** 背包容量信息 */
    private _backpackStock: number = 0;       // 背包库存(分子)
    private _backpackCapacity: number = 0;    // 背包容量(分母)
    private _backpackExpandPink: number = 0;  // 扩容需要的粉爪币

    /** 仓库容量信息 */
    private _warehouseStock: number = 0;      // 仓库库存(分子，服务端)
    private _warehouseCapacity: number = 0;   // 仓库容量(分母)
    private _warehouseExpandPink: number = 0; // 扩容需要的粉爪币
    /** 道具页全部道具总数（与羁绊物共用容量） */
    private _warehousePropTotal: number = 0;
    /** 羁绊物总数（与道具共用容量） */
    private _warehouseBondTotal: number = 0;
    public _walkTotalMeters:number =  1000
    public walkSpeed:number = 10
    teamData:TeamData = {
        team_id: 0,
        walk_address_id: 0,
        walk_address_name: "",
        users: [],
        owner: undefined,
        ready_status: 0
    }
    walkData:WalkMapInfo = {
        team_id: 0,
        walk_address_id: 0,
        walk_address_name: "",
        map_cell_info: [],
        begin_at: 0,
        system_time: 0,
        users: [],
        round:0
    }
    getWalkSpeed(){
        return this.walkSpeed //米
    }
    getWalkData(){
        return this.walkData
    }
    findCellIndex(eventIndex){
        if(!this.walkData||!this.walkData.map_cell_info)return
        var index = 0
        for(var i = 0 ; i < this.walkData.map_cell_info.length; i ++){
            var obj = this.walkData.map_cell_info[i]
            for(var value of obj.events){
                if(index == eventIndex){
                    return i
                }
                index ++
            }
        }
    }
    loadRoads(data){
        if(!data.roads)return 
        this.walkData.map_cell_info = []
        var mapBgIndex = 0
        var mapIdArray = WalkMapCfgManager.ins.getMapBg(data.walk_address_id, data.scene_map)
        if(!mapIdArray){
            console.warn("未找到地图配置",mapIdArray)
            mapIdArray = WalkMapCfgManager.ins.getMapBg(data.walk_address_id, 1)
        }
        console.log("mapIdArray", mapIdArray)
        for(var obj of data.roads){
            var cell:any = {}as MapCellData
            cell.id = obj.road_id
            cell.mapBgs = []
            if(obj.road_id == -1 || obj.road_id == -2){
                cell.rewardPos = []
  
                if(!mapIdArray[mapBgIndex])continue
                cell.mapBgs.push(mapIdArray[mapBgIndex])
                mapBgIndex += 1
            }else{
                var cfg:RouteConfig = WalkMapCfgManager.ins.getRouteConfig(obj.road_id)
                if(!cfg) continue
                cell.rewardPos = cfg.DropPos
                for(var i = 0; i < cfg.count; i++)
                {
                    if(!mapIdArray[mapBgIndex])continue
                    console.log("loadArray==================", mapIdArray[mapBgIndex], mapBgIndex)
                    cell.mapBgs.push(mapIdArray[mapBgIndex])
                    mapBgIndex += 1
                }
                
            }
            cell.events = []
            for(var val of obj.rhythms){
                var distance = this.walkSpeed* val.second + (data.round - 1)*1000
                cell.events.push({id:val.rhythm_id, second:val.second,distance:distance})
            }
            if(cell.drops){
                for(var obj of obj.drops){
                    var dropItem = {} as DropItem
                    dropItem.itemId = obj.item_id
                    dropItem.pos = new Vec2(obj.x, obj.y)
                    cell.dropsInfo.push(dropItem)
                }
            }else{
                cell.dropsInfo = []
            }
                
            this.walkData.map_cell_info.push(cell)
        }
        console.log("this.walkData", this.walkData)
    }
    loadWalkingData(res){
        this.walkData.begin_at = res?.begin_at || 0
        this.walkData.system_time = res?.system_time || 0
        this.walkData.round = res?.round||0
        return this.walkData
    }
    updateWalkData(res){
        if(!res)return 
        if(!res.scene_map)return
        if(!res.walk_address_id)return
        this.walkData.walk_address_id = res.walk_address_id
        this.walkData.users = res.users
        this.walkData.team_id = res.team_id
        this.walkData.walk_address_name = res.walk_address_name
        this.loadRoads(res)
        return this.walkData
    }
    /** 追加下一轮散步数据 */
    appendWalkNextData(res: WalkRunNextNotify): void {
        if (!res) return
        this.walkData.team_id = res.team_id
        this.walkData.walk_address_id = res.walk_address_id
        this.walkData.walk_address_name = res.walk_address_name
        this.walkData.users = res.users

        if (!res.roads || res.roads.length === 0) return

        // 计算当前已使用的地图背景偏移量
        let mapBgIndex = 0
        for (const cell of this.walkData.map_cell_info) {
            mapBgIndex += cell.mapBgs.length
        }

        const mapIdArray = WalkMapCfgManager.ins.getMapBg(res.walk_address_id, res.scene_map)
        if (!mapIdArray) {
            console.warn("appendWalkNextData: 未找到地图配置", res.walk_address_id, res.scene_map)
            return
        }
        console.log("appendWalkNextData mapIdArray", mapIdArray, "offset", mapBgIndex)

        for (const obj of res.roads) {
            const cell: any = {} as MapCellData
            cell.id = obj.road_id
            cell.mapBgs = []
            if (obj.road_id == -1 || obj.road_id == -2) {
                cell.rewardPos = []
                if (!mapIdArray[mapBgIndex]) continue
                cell.mapBgs.push(mapIdArray[mapBgIndex])
                mapBgIndex += 1
            } else {
                const cfg: RouteConfig = WalkMapCfgManager.ins.getRouteConfig(obj.road_id)
                if (!cfg) continue
                cell.rewardPos = cfg.DropPos
                for (let i = 0; i < cfg.count; i++) {
                    if (!mapIdArray[mapBgIndex]) continue
                    cell.mapBgs.push(mapIdArray[mapBgIndex])
                    mapBgIndex += 1
                }
            }
            cell.events = []
            for (const val of obj.rhythms) {
                const distance = this.walkSpeed * val.second + (res.round - 1)*1000
                cell.events.push({ id: val.rhythm_id, second: val.second, distance: distance })
            }
            if (obj.drops && obj.drops.length > 0) {
                cell.dropsInfo = []
                for (const drop of obj.drops) {
                    const dropItem = {} as DropItem
                    dropItem.itemId = drop.item_id
                    dropItem.pos = new Vec2(drop.x, drop.y)
                    cell.dropsInfo.push(dropItem)
                }
            } else {
                cell.dropsInfo = []
            }

            this.walkData.map_cell_info.push(cell)
        }
        console.log("appendWalkNextData done", this.walkData)
    }
    getTeamData(){
        return this.teamData
    }
    updateTeamData(data:WalkTeamChangeNotify){
        console.log("updateTeamData",data)
        if(!data){
            return
        }
        this.teamData.team_id = data.team_id
        this.teamData.walk_address_id = data.walk_address_id
        this.teamData.walk_address_name = data.walk_address_name
        this.teamData.users = []
        this.teamData.owner = data.users[0]
        for(var i = 0; i < data.users.length; i ++){
            var obj = data.users[i]
            if(i == 0){
                this.teamData.owner = data.users[0]
            }else{
                if(obj.user_id == this.userInfo.userId){
                    this.teamData.ready_status = obj.ready_status
                }
                this.teamData.users.push(obj)
            }
        }
        return this.teamData
    }
    cleanTeamData(){
        this.teamData = {
        team_id: 0,
        walk_address_id: 0,
        walk_address_name: "",
        users: [],
        owner: undefined,
        ready_status: 0

    }
    }
    /** 清理散步游戏运行时数据，重置为默认值 */
    cleanWalkData(){
        this.walkData = {
            team_id: 0,
            walk_address_id: 0,
            walk_address_name: "",
            map_cell_info: [],
            begin_at: 0,
            system_time: 0,
            users: [],
            round: 0
        }
    }
    updateAddList(data:FriendApply[]){
        this.addFriendList = []
        if (!data)return
        for(var obj of data){
            var f = {
                ...obj,
                isMe:true
            }   
            this.addFriendList.push(f)
        }
    }
    updateApplyList(data:FriendApply[]){
        this.applyFriendList = []
        if (!data)return
      
        for(var obj of data){
            var f = {
                ...obj,
                isMe:false
            }   
            this.applyFriendList.push(f)
        }
    }

    updateFriends(data:Friend[]):Friend[]{
        this.friends = data
        return this.friends
    }
    /** 初始化当前用户数据 */
    init(data: UserInfo): void {
        this.userInfo = data;
        
    }
    updateUserData(data: any) {
        if (!this.userInfo) {
            this.userInfo = {} as UserInfo
        }
        this.userInfo.userId = data.user_id ?? (this.userInfo.userId || "")
        this.userInfo.nickname = data.nickname ?? (this.userInfo.nickname || "")
        this.userInfo.headImg = data.head_img ?? (this.userInfo.headImg || "")
        this.userInfo.sysTime = data.sys_time ?? (this.userInfo.sysTime || 0)
        this.userInfo.newUserLead = data.new_user_lead ?? (this.userInfo.newUserLead || 0)
        this.userInfo.petType = data.pet_type ?? (this.userInfo.petType || 0)
        this.userInfo.photoCount = data.photo_count ?? (this.userInfo.photoCount || 0)
        this.userInfo.petName = data.pet_name ?? (this.userInfo.petName || "")
        this.userInfo.clean = data.clean ?? (this.userInfo.clean || 0)
        this.userInfo.food = data.food ?? (this.userInfo.food || 0)

        this.userInfo.energy = data.energy ?? (this.userInfo.energy || 0)
        this.userInfo.energyMax = data.energy_max ?? (this.userInfo.energyMax || 0)
        this.userInfo.nature = data.nature ?? (this.userInfo.nature || 0)
        this.userInfo.color = data.color ?? (this.userInfo.color || '');
        this.userInfo.intimacy = data.intimacy ?? (this.userInfo.intimacy || 0)
        this.userInfo.unreadCount = data.unread_count ?? (this.userInfo.unreadCount || 0)
        this.userInfo.sparrowUnreadCount = data.sparrow_unread_count ?? (this.userInfo.sparrowUnreadCount || 0)
        this.userInfo.sparrowStatus = data.sparrow_status ?? (this.userInfo.sparrowStatus || 0)
        this.userInfo.sparrowHasUnclaimed = data.sparrow_has_unclaimed ?? (this.userInfo.sparrowHasUnclaimed || false)
        this.userInfo.reach_clean100 = data.reach_clean100 ?? (this.userInfo.reach_clean100|| false)
        this.userInfo.friendStatus = data.friend_status ?? (this.userInfo.friendStatus || 0)
        this.userInfo.pet_created_at = data.pet_created_at??(this.userInfo.pet_created_at|| 0)
        this.userInfo.friend_count = data.friend_count?? (this.userInfo.friend_count||0)
        this.userInfo.parent_call = data.parent_call ?? data.call_name ?? (this.userInfo.parent_call || '')
        this.userInfo.distance = data.distance ?? (this.userInfo.distance || 0)
        console.log("updateUserInfoData", data)
        if (data.pink != null || data.gold != null) {
            if (data.pink != null) {
                this.userInfo.pink = data.pink;
            }
            if (data.gold != null) {
                this.userInfo.gold = data.gold;
            }
            DispatchEvent.ins.emit(EventType.RefreshCoin)
        }
        DispatchEvent.ins.emit(EventType.RefreshPlayerInfo)
        return this.userInfo
    }
    /** 更新用户ID */
    updateUserId(userId: string): void {
        if (userId == null || !this.userInfo) return;
        this.userInfo.userId = userId;
        DispatchEvent.ins.emit(EventType.RefreshPlayerInfo)
    }

    /** 更新昵称 */
    updateNickname(nickname: string): void {
        if (nickname == null || !this.userInfo) return;
        this.userInfo.nickname = nickname;
        DispatchEvent.ins.emit(EventType.RefreshPlayerInfo)
    }

    /** 更新头像 */
    updateHeadImg(headImg: string): void {
        if (headImg == null || !this.userInfo) return;
        this.userInfo.headImg = headImg;
        DispatchEvent.ins.emit(EventType.RefreshPlayerInfo)
    }

    /** 更新宠物类型 */
    updatePetType(petType: number): void {
        if (petType == null || !this.userInfo) return;
        this.userInfo.petType = petType;
        DispatchEvent.ins.emit(EventType.RefreshPlayerInfo)
    }

    /** 批量更新用户信息 */
    updateUserInfo(data: Partial<UserInfo>): void {
        if (!this.userInfo || !data) return;
        Object.assign(this.userInfo, data);
        DispatchEvent.ins.emit(EventType.RefreshPlayerInfo)
    }

    /** 获取其他玩家列表 */
    getOtherPlayers(): UserInfo[] {
        return this._otherPlayers;
    }

    /** 根据userId获取其他玩家数据 */
    getOtherPlayer(userId: string): UserInfo | null {
        return this._otherPlayers.find(p => p.userId === userId) || null;
    }

    /** 添加或更新其他玩家数据（已存在则更新，否则新增） */
    setOtherPlayer(data: UserInfo): void {
        if (!data || !data.userId) return;
        const index = this._otherPlayers.findIndex(p => p.userId === data.userId);
        if (index >= 0) {
            Object.assign(this._otherPlayers[index], data);
        } else {
            this._otherPlayers.push(data);
        }
    }

    /** 批量设置其他玩家数据 */
    setOtherPlayers(players: UserInfo[]): void {
        if (!players) return;
        this._otherPlayers = players;
    }

    /** 移除其他玩家数据 */
    removeOtherPlayer(userId: string): void {
        this._otherPlayers = this._otherPlayers.filter(p => p.userId !== userId);
    }

    /** 清空其他玩家数据 */
    clearOtherPlayers(): void {
        this._otherPlayers = [];
    }

    // ========== 道具管理（背包/羁绊物/仓库） ==========

    /** 获取背包列表 */
    getBackpack(): Item[] {
        return this._backpack;
    }

    /** 获取羁绊物列表 */
    getBondItems(): Item[] {
        return this._bondItems;
    }
    
    _getWarehouse(){
        return this._warehouse
    }
    _getBoneItems(){
        return this._bondItems
    }
    _getBackPack(){
        return this._backpack
    }
    /** 获取仓库列表 */
    getWarehouse(type?): Item[] {
        console.log("type============",type)
        var result = []
        if(!type || type == WarehouseType.All){
            this._warehouse.forEach(element => {
                result.push(element)
            }); 
           ;
        }else {
            this._warehouse.forEach(element=>{
                if(element.type == type){
                    result.push(element)
                }
            })
        }
        console.log("wareHouse", this._warehouse,result, type)
        return result
    }
    /** 整体覆盖背包数据 */
    updateBackpack(items: Item[]): Item[] {
        this._backpack = items || [];
        DispatchEvent.ins.emit(EventType.RefreshBackpack);
        return this._backpack;
    }

    /** 整体覆盖羁绊物数据 */
    updateBondItems(items: Item[]): Item[] {
        items.forEach(element => {
            var item = this._bondItems.find(i => i.id === element.id)
            if(item){
                Object.assign(item, element)
            }else{
                this._bondItems.push(element);
            }
        });
        DispatchEvent.ins.emit(EventType.RefreshBondItems);
        return this._bondItems;
    }

    /** 整体覆盖仓库数据 */
    updateWarehouse(items: Item[]): Item[] {
        // 没有数据时不触发刷新事件
        if (!items || items.length === 0) {
            return this._warehouse;
        }
        items.forEach(element => {
            var item = this._warehouse.find(i => i.id === element.id)
            if(item){
                Object.assign(item, element)
            }else{
                this._warehouse.push(element);
            }
        });
        DispatchEvent.ins.emit(EventType.RefreshWarehouse);
        return this._warehouse;
    }

    /** 追加背包数据（分页加载更多） */
    appendBackpack(items: Item[]): Item[] {
        this._backpack = this._backpack.concat(items || []);
        DispatchEvent.ins.emit(EventType.RefreshBackpack);
        return this._backpack;
    }

    /** 追加羁绊物数据（分页加载更多） */
    appendBondItems(items: Item[]): Item[] {
        this._bondItems = this._bondItems.concat(items || []);
        DispatchEvent.ins.emit(EventType.RefreshBondItems);
        return this._bondItems;
    }

    /** 追加仓库数据（分页加载更多） */
    appendWarehouse(items: Item[]): Item[] {
        this._warehouse = this._warehouse.concat(items || []);
        DispatchEvent.ins.emit(EventType.RefreshWarehouse);
        return this._warehouse;
    }

    /** 根据唯一id查找道具所在列表 */
    findItemListById(id: number): Item[] | null {
        if (this._backpack.find(i => i.id === id)) return this._backpack;
        if (this._bondItems.find(i => i.id === id)) return this._bondItems;
        if (this._warehouse.find(i => i.id === id)) return this._warehouse;
        return null;
    }

    /** 根据唯一id查找道具 */
    findItemById(id: number): Item | null {
        return this._backpack.find(i => i.id === id)
            || this._bondItems.find(i => i.id === id)
            || this._warehouse.find(i => i.id === id)
            || null;
    }

    /** 新增道具到指定列表 */
    addItem(item: Item, list: Item[]): boolean {
        if (!list) return false;
        if (list.find(i => i.id === item.id)) return false;
        list.push(item);
        console.log("addItem============",item, list)

        this._emitItemRefresh(list);
        return true;
    }

    /** 更新指定道具（部分字段） */
    updateItem(id: number, data: Partial<Item>): boolean {
        const item = this.findItemById(id);
        if (!item) return false;
        Object.assign(item, data);
        this._emitItemRefresh(this.findItemListById(id));
        return true;
    }

    /** 根据唯一id移除道具 */
    removeItem(id: number): boolean {
        const list = this.findItemListById(id);
        if (!list) return false;
        const idx = list.findIndex(i => i.id === id);
        if (idx === -1) return false;
        list.splice(idx, 1);
        this._emitItemRefresh(list);
        return true;
    }

    /**
     * 将道具从当前列表迁移到目标列表（移动位置时同步本地数据）
     * @param id 道具唯一 id
     * @param targetList 目标列表
     */
    moveItemToList(id: number, targetList: Item[]): boolean {
        const item = this.findItemById(id);
        if (!item || !targetList) {
            return false;
        }

        const fromList = this.findItemListById(id);
        if (fromList === targetList) {
            return true;
        }

        if (fromList) {
            const idx = fromList.findIndex(i => i.id === id);
            if (idx >= 0) {
                fromList.splice(idx, 1);
                this._emitItemRefresh(fromList);
            }
        }

        if (!targetList.find(i => i.id === id)) {
            targetList.push(item);
        }
        this._emitItemRefresh(targetList);
        return true;
    }

    /** 应用服务器下发的单条道具变更 */
    applyItemChange(change: ItemChange): void {
        switch (change.change_type) {
            case ItemChangeType.Add: {
                // 新增：已有则更新，无则加入背包（默认）
                if (this.findItemById(change.id)) {
                    this.updateItem(change.id, { remain_count: change.remain_count });
                } else {
                    // 缺少完整配置信息，加入后触发刷新由UI重新拉取
                    this.addItem({
                        id: change.id,
                        item_id: change.item_id,
                        remain_count: change.remain_count,
                        num: change.remain_count,
                    } as Item, this._backpack);
                }
                break;
            }
            case ItemChangeType.Decrease: {
                this.updateItem(change.id, { remain_count: change.remain_count });
                break;
            }
            case ItemChangeType.Remove: {
                this.removeItem(change.id);
                break;
            }
        }
    }

    private _emitItemRefresh(list: Item[] | null): void {
        if (!list) return;
        if (list === this._backpack) {
            this._backpackStock = list.length;
            DispatchEvent.ins.emit(EventType.RefreshBackpack);
        } else if (list === this._bondItems) {
            this._warehouseBondTotal = list.length;
            DispatchEvent.ins.emit(EventType.RefreshBondItems);
            DispatchEvent.ins.emit(EventType.RefreshWarehouse);
        } else if (list === this._warehouse) {
            this._warehousePropTotal = list.length;
            this._warehouseStock = list.length;
            DispatchEvent.ins.emit(EventType.RefreshWarehouse);
        }
    }

    /** 清空仓库数据（全量请求前重置） */
    clearWarehouse(): void {
        this._warehouse = [];
        this._warehousePropTotal = 0;
    }

    /** 清空羁绊物数据（全量请求前重置） */
    clearBondItems(): void {
        this._bondItems = [];
        this._warehouseBondTotal = 0;
    }

    /** 清空所有道具数据 */
    clearAllItems(): void {
        this._backpack = [];
        this._bondItems = [];
        this._warehouse = [];
        this._backpackStock = 0;
        this._backpackCapacity = 0;
        this._backpackExpandPink = 0;
        this._warehouseStock = 0;
        this._warehouseCapacity = 0;
        this._warehouseExpandPink = 0;
        this._warehousePropTotal = 0;
        this._warehouseBondTotal = 0;
        DispatchEvent.ins.emit(EventType.RefreshBackpack);
        DispatchEvent.ins.emit(EventType.RefreshBondItems);
        DispatchEvent.ins.emit(EventType.RefreshWarehouse);
    }

    // ========== 背包容量信息 ==========

    getBackpackStock(): number { return this._backpack.length; }
    getBackpackCapacity(): number { return this._backpackCapacity; }
    getBackpackExpandPink(): number { return this._backpackExpandPink; }

    updateBackpackCapacity(stock: number, capacity: number, expandPink: number): void {
        // 使用 != null 判断，避免 stock/capacity 为 0 时被 || 误判为 falsy 而不更新
        this._backpackStock = stock != null ? stock : this._backpackStock;
        this._backpackCapacity = capacity != null ? capacity : this._backpackCapacity;
        this._backpackExpandPink = expandPink != null ? expandPink : this._backpackExpandPink;
        DispatchEvent.ins.emit(EventType.RefreshBackpack);
    }

    // ========== 仓库容量信息 ==========

    getWarehouseStock(type): number { 
        if(!type)return this._warehouseStock
        var result = this.getWarehouse(type)
        return result.length;
     }
    getWarehouseCapacity(): number { return this._warehouseCapacity; }
    getWarehouseExpandPink(): number { return this._warehouseExpandPink; }

    /** 道具 + 羁绊物合计占用数（与服务端 warehouse_stock 取较大值） */
    getWarehouseUsageStock(): number {
        const localTotal = this._warehousePropTotal + this._warehouseBondTotal
        if (localTotal <= 0) {
            return this._warehouseStock
        }
        return Math.max(this._warehouseStock, localTotal)
    }

    updateWarehousePropTotal(total: number): void {
        this._warehousePropTotal = Number(total) || 0
    }

    updateWarehouseBondTotal(total: number): void {
        this._warehouseBondTotal = Number(total) || 0
    }

    updateWarehouseCapacity(stock: number, capacity: number, expandPink: number): void {
        this._warehouseStock =  stock  != null ? stock : this._warehouseStock;;
        this._warehouseCapacity = capacity  != null ? capacity : this._warehouseCapacity;;
        this._warehouseExpandPink = expandPink  != null ?  expandPink : this._warehouseExpandPink;
        DispatchEvent.ins.emit(EventType.RefreshWarehouse);
    }
}
