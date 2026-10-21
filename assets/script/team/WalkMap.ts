import { _decorator, Component, Layout, Node, UITransform, EventTouch, Vec2, Vec3, Sprite, SpriteFrame, Label, JsonAsset } from 'cc';
import { ResLoader } from '../common/download/ResLoader';
import { Common, ViewPath } from '../common/utils/Define';
import { DataManager } from '../Data/DataManager';
import { WalkMapCfgManager } from '../game/walk/WalkMapCfgManager';
import { UIManager } from '../common/utils/UIManager';
const { ccclass, property } = _decorator;

export enum LocationStatus {
    CURRENT = 'current',
    DEFAULT = 'default',
    GREY = 'grey'
}

@ccclass('WalkMap')
export class WalkMap extends Component {
    @property(Layout)
    nd_content: Layout = null;

    @property(Node)
    nd_map_1: Node = null;

    @property(Node)
    nd_map_2: Node = null;

    @property(Node)
    nd_map_3: Node = null;
    @property(Sprite)
    sp_icon:Sprite = null
    @property(Label)
    lb_name:Label = null
    @property(Label)
    lb_des:Label = null

    private _contentNode: Node = null;
    private _contentUITransform: UITransform = null;
    private _viewUITransform: UITransform = null;

    private _startTouchPos: Vec2 = new Vec2();
    private _startContentPos: Vec3 = new Vec3();
    private _isDragging: boolean = false;

    private _minX: number = 0;
    private _maxX: number = 0;

    private _locationSpriteFrames: Map<string, SpriteFrame> = new Map();
    private _selectedLocationId: number = 0;

    onLoad() {
        this._contentNode = this.nd_content.node;
        this._contentUITransform = this._contentNode.getComponent(UITransform);
        this._viewUITransform = this.node.getComponent(UITransform);

        this.initTouchEvents();
        this.calculateBoundary();
        this.loadSpriteFrames();
    }
    show(location_id){
        this._selectedLocationId = location_id
        this.setLocationSelected(location_id, true)
        this.scrollToLocation(location_id)
        this.loadMapInfo(location_id)
    }

    /**
     * 加载地图信息：图标、名称、描述
     * 读取 map_bg_cfg 配置，加载 common/map 目录下的图标，赋值 mapname 和 mapdes
     */
    private async loadMapInfo(locationId: number): Promise<void> {
        // 加载地图图标：textures/common/map/map_icon_{locationId}
        console.log("loadMapInfo=================")
        if (this.sp_icon) {
            const iconPath = Common.texturePath + 'common/map/map_icon_' + locationId + '/spriteFrame'
            ResLoader.ins.loadResAsync(iconPath, SpriteFrame).then((spf) => {
                if (this.sp_icon && this.sp_icon.isValid) {
                    this.sp_icon.spriteFrame = spf
                }
            }).catch((err) => {
                console.warn('[WalkMap] 加载地图图标失败:', iconPath, err)
            })
        }

        // 设置地图名称：从 map_bg_cfg 配置中按 location_id 查找
        if (this.lb_name) {
            this.lb_name.string = await this._getMapName(locationId)
        }

        // 设置地图描述：从 map_bg_cfg 配置中读取 des 字段
        if (this.lb_des) {
            this.lb_des.string = await this._getMapDescription(locationId)
        }
    }
    onClickClose(){
        UIManager.ins.hideView(this.node)
    }
    /** 根据 locationId 从 map_bg_cfg 配置中获取地图名称 */
    private async _getMapName(locationId: number): Promise<string> {
        if (!locationId) return ''

        const cfgs = await ResLoader.ins.loadResAsync("config/map_config",JsonAsset)
        console.log("cfgs", cfgs)
        for (const cfg of cfgs.json) {
            if (cfg.id === locationId && cfg.des) {
                return cfg.name
            }
        }
        // 回退：使用 walk_address_name
        const walkData = DataManager.ins.getWalkData()
        return walkData ? String(walkData.walk_address_name || '') : ''
    }

    /** 根据 locationId 从 map_bg_cfg 配置中获取地图描述 */
    private async _getMapDescription(locationId: number): Promise<string> {
        if (!locationId ) return ''

        const cfgs = await ResLoader.ins.loadResAsync("config/map_config",JsonAsset)
        console.log("cfgs", cfgs)
        for (const cfg of cfgs.json) {
            if (cfg.id === locationId && cfg.des) {
                return cfg.des
            }
        }
        return ''
    }
    initTouchEvents() {
        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }

    calculateBoundary() {
        const contentWidth = this._contentUITransform.contentSize.width;
        const viewWidth = this._viewUITransform.contentSize.width;
        const halfContentWidth = contentWidth / 2;
        const halfViewWidth = viewWidth / 2;

        this._minX = halfViewWidth - halfContentWidth;
        this._maxX = halfContentWidth - halfViewWidth;
    }

    async loadSpriteFrames() {
        const paths = [
            { key: 'current', path: 'textures/common/map/bigMap/location_current/spriteFrame' },
            { key: 'default', path: 'textures/common/map/bigMap/location_default/spriteFrame' },
            { key: 'grey', path: 'textures/common/map/bigMap/location_grey/spriteFrame' }
        ];

        for (const item of paths) {
            try {
                const spf = await ResLoader.ins.loadResAsync(item.path, SpriteFrame);
                if (spf) {
                    this._locationSpriteFrames.set(item.key, spf);
                }
            } catch (error) {
                console.error('load spriteFrame error:', item.path, error);
            }
        }
    }
    onClickLoacation(sender, data){
        if(!data)return
        var locationId = Number(data)
        if(!locationId)return
        this.setLocationSelected(locationId, true)
    }
    onTouchStart(event: EventTouch) {
        this._isDragging = true;
        this._startTouchPos = event.getLocation();
        this._startContentPos = this._contentNode.position.clone();
    }

    onTouchMove(event: EventTouch) {
        if (!this._isDragging) return;

        const currentPos = event.getLocation();
        const deltaX = currentPos.x - this._startTouchPos.x;

        let targetX = this._startContentPos.x + deltaX;
        targetX = Math.max(this._minX, Math.min(this._maxX, targetX));

        this._contentNode.setPosition(targetX, this._contentNode.position.y, 0);
    }

    onTouchEnd(event: EventTouch) {
        this._isDragging = false;
    }

    scrollToLocation(locationId: number) {

        var targetMapNode = this.getMapNodeByLocationId(locationId)

        let targetContentX = -targetMapNode.position.x;
        targetContentX = Math.max(this._minX, Math.min(this._maxX, targetContentX));

        this._contentNode.setPosition(targetContentX, this._contentNode.position.y, 0);
    }

    setLocationStatus(locationId: number, status: LocationStatus) {
        const locationNode = this.findLocationNode(locationId);
        if (!locationNode) return;

        const sprite = locationNode.getChildByName("sp_icon")?.getComponent(Sprite);
        if (!sprite) return;

        const spf = this._locationSpriteFrames.get(status);
        if (spf) {
            sprite.spriteFrame = spf;
        }
    }

    setLocationSelected(locationId: number, selected: boolean) {
        const locationNode = this.findLocationNode(locationId);
        if (!locationNode) return;

        const spSelect = locationNode.getComponent(Sprite);
        if (spSelect) {
            spSelect.enabled = selected;
        }

        const scale = selected ? 1.3 : 1;
        locationNode.setScale(scale, scale, 1);
    }

    private findLocationNode(locationId: number): Node | null {
        const mapNode = this.getMapNodeByLocationId(locationId);
        if (!mapNode) return null;

        return mapNode.getChildByName(`nd_location_${locationId}`);
    }

    private getMapNodeByLocationId(locationId: number): Node | null {
        for(var i = 1; i <= 3; i ++){
            if(this["nd_map_" + i]&& this["nd_map_" + i]?.getChildByName("nd_location_" + locationId)){
                return this["nd_map_" + i]
            }
        }
        return null
    }
}