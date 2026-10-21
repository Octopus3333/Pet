import { Friend, Chat, UserInfo, Item, ItemChange, WalkFriend } from "../common/utils/InterfaceDefine";
import { GameData } from "./GameData";
import { LocalStorage, StorageKey } from "../common/storage/LocalStorage";
import { DispatchEvent } from "../common/utils/DispatchEvent";
import { EventType } from "../common/utils/Define";
import { game, Node } from "cc"
export class DataManager {
    static _ins: DataManager = null
    static get ins(): DataManager {
        if (!this._ins) {
            this._ins = new DataManager()
        }
        return this._ins
    }
    gameData: GameData
    getWalkData(){
        var gameData = this.getGameData()
        return gameData.getWalkData()
    }
    getWalkDistanceByTime(time){
        var gameData = this.getGameData()
        return gameData.walkSpeed*time
    }
    findWalkCellIndex(eventIndex){
        var gameData = this.getGameData()
        return gameData.findCellIndex(eventIndex)
    }
    loadWalkingData(data){
        var gameData = this.getGameData()
        return gameData.loadWalkingData(data)
    }
    updateWalkData(data){
        var gameData = this.getGameData()
        return gameData.updateWalkData(data)
    }
    appendWalkNextData(data){
        var gameData = this.getGameData()
        gameData.appendWalkNextData(data)
    }
    updateTeamData(data){
        var gameData = this.getGameData()
        return gameData.updateTeamData(data)
    }
    getTeamData(){
        var gameData = this.getGameData()
        return gameData.getTeamData()
    }
    cleanTeamData(){
        var gameData = this.getGameData()
        gameData.cleanTeamData()
    }
    cleanWalkData(){
        var gameData = this.getGameData()
        gameData.cleanWalkData()
    }
    getGameData(): GameData {
        if (!this.gameData) {
            this.gameData = new GameData()
        }
        return this.gameData
    }
    isNewUser(){
        var userInfo = this.getUserInfo()
        if(userInfo.newUserLead < 8){
            return true
        }
        return false
    }
    getFriendsNameByUserId(user_id){
        if(user_id == "XN69BL"){
            return "小麻雀一坨"
        }
        var userInfo = this.getFriendsData()
        if(!userInfo)return
        for (const element of userInfo) {
            element.userId = user_id
            return element?.nickname
        }
    }
    getUserInfo(): UserInfo {
        return this.getGameData().userInfo
    }
    getUserLead(){
        var user = this.getUserInfo()
        return user.newUserLead
    }
    updateUserData(data:any){
        const gameData = this.getGameData()
        return gameData.updateUserData(data)
    }
    getFriendsData(){
       return this.getGameData().friends ||[]
    }
    getApplyList(){
        return this.getGameData().applyFriendList
    }
    updateApplyList(data){
        const gameData = this.getGameData()
        return gameData.updateApplyList(data) 
    }
    getAddList(){
        return this.getGameData().addFriendList
    }
    updateAddList(data){
        const gameData = this.getGameData()
        return gameData.updateAddList(data) 
    }
    updateFriendsData(data:Friend[]){
        const gameData = this.getGameData()
        return gameData.updateFriends(data)
    }
    getWalkFriends(): WalkFriend[] {
        return this.getGameData().walkFriends || []
    }
    updateWalkFriends(data: WalkFriend[]): void {
        this.getGameData().walkFriends = data || []
    }
    // ========== 道具管理 ==========
    getBackpack(): Item[] {
        return this.getGameData().getBackpack()
    }
    getBondItems(): Item[] {
        return this.getGameData().getBondItems()
    }
    _getBackPack(){
        return this.gameData._getBackPack()
    }
    _getBoneItems(){
        return this.gameData._getBoneItems()
    }
    _getWareHouse(){
        return this.gameData._getWarehouse()
    }
    getWarehouse(type?): Item[] {
        return this.getGameData().getWarehouse(type)
    }
    /** 获取仓库原始列表（数据写入用） */
    getWarehouseList(): Item[] {
        return this.getGameData().getWarehouse()
    }
    updateBackpack(items: Item[]): Item[] {
        return this.getGameData().updateBackpack(items)
    }
    updateBondItems(items: Item[]): Item[] {
        return this.getGameData().updateBondItems(items)
    }
    updateWarehouse(items: Item[]): Item[] {
        return this.getGameData().updateWarehouse(items)
    }
    appendBackpack(items: Item[]): Item[] {
        return this.getGameData().appendBackpack(items)
    }
    appendBondItems(items: Item[]): Item[] {
        return this.getGameData().appendBondItems(items)
    }
    appendWarehouse(items: Item[]): Item[] {
        return this.getGameData().appendWarehouse(items)
    }
    findItemById(id: number): Item | null {
        return this.getGameData().findItemById(id)
    }
    updateItem(id: number, data: Partial<Item>): boolean {
        return this.getGameData().updateItem(id, data)
    }
    removeItem(id: number): boolean {
        return this.getGameData().removeItem(id)
    }
    moveItemToList(id: number, targetList: Item[]): boolean {
        return this.getGameData().moveItemToList(id, targetList)
    }
    addItem(item: Item, list: Item[]): boolean {
        return this.getGameData().addItem(item, list)
    }
    applyItemChange(change: ItemChange): void {
        this.getGameData().applyItemChange(change)
    }
    clearWarehouse(): void {
        this.getGameData().clearWarehouse()
    }
    clearBondItems(): void {
        this.getGameData().clearBondItems()
    }
    clearAllItems(): void {
        this.getGameData().clearAllItems()
    }
    // ========== 容量信息 ==========
    getBackpackStock(): number {
        return this.getGameData().getBackpackStock()
    }
    getBackpackCapacity(): number {
        return this.getGameData().getBackpackCapacity()
    }

    getBackpackExpandPink(): number {
        return this.getGameData().getBackpackExpandPink()
    }
    updateBackpackCapacity(stock: number, capacity: number, expandPink: number): void {
        this.getGameData().updateBackpackCapacity(stock, capacity, expandPink)
    }
    getWarehouseStock(type?): number {
        return this.getGameData().getWarehouseStock(type)
    }
    /** 道具 + 羁绊物合计占用数 */
    getWarehouseUsageStock(): number {
        return this.getGameData().getWarehouseUsageStock()
    }
    getWarehouseCapacity(): number {
        return this.getGameData().getWarehouseCapacity()
    }
    getWarehouseExpandPink(): number {
        return this.getGameData().getWarehouseExpandPink()
    }
    updateWarehousePropTotal(total: number): void {
        this.getGameData().updateWarehousePropTotal(total)
    }
    updateWarehouseBondTotal(total: number): void {
        this.getGameData().updateWarehouseBondTotal(total)
    }
    updateWarehouseCapacity(stock: number, capacity: number, expandPink: number): void {
        this.getGameData().updateWarehouseCapacity(stock, capacity, expandPink)
    }
    /**
     * 登录成功后，用后端返回数据初始化用户信息
     */
    updateLoginData(data: any): void {
        var userInfo = this.updateUserData(data)
        // 持久化到本地
        LocalStorage.setObject(StorageKey.USER_INFO, userInfo)
    }

    /**
     * 清除用户数据（登出时调用）
     */
    clearUserData(): void {
        this.gameData = null
        LocalStorage.remove(StorageKey.USER_INFO)
    }

    /**
     * 从本地缓存恢复用户信息（App重启时）
     */
    restoreUserInfo(): UserInfo | null {
        const cached = LocalStorage.getObject<UserInfo>(StorageKey.USER_INFO)
        if (cached) {
            this.getGameData().init(cached)
        }
        return cached
    }
}


