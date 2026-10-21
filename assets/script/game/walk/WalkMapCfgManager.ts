import { JsonAsset } from 'cc';
import { ResLoader } from '../../common/download/ResLoader';
import { Common } from '../../common/utils/Define';
import { MapBgCfg, RouteConfig } from '../../common/utils/InterfaceDefine';

export class WalkMapCfgManager {
    private static _ins: WalkMapCfgManager = null!;

    static get ins(): WalkMapCfgManager {
        if (!WalkMapCfgManager._ins) {
            WalkMapCfgManager._ins = new WalkMapCfgManager();
        }
        return WalkMapCfgManager._ins;
    }

    private _mapBgConfigMap: Map<string, MapBgCfg> = new Map();
    private _routeConfigMap: Map<number, RouteConfig> = new Map();
    private _loaded: boolean = false;
    private _loadingPromise: Promise<void> | null = null;

    private constructor() {}

    get loaded(): boolean {
        return this._loaded;
    }

    async load(): Promise<void> {
        if (this._loaded) return;
        if (this._loadingPromise) return this._loadingPromise;

        this._loadingPromise = this._doLoad();
        try {
            await this._loadingPromise;
        } finally {
            this._loadingPromise = null;
        }
    }

    private async _doLoad(): Promise<void> {
        const [mapBgAsset, routeAsset] = await Promise.all([
            ResLoader.ins.loadResAsync(Common.configPath + 'map_bg_cfg', JsonAsset),
            ResLoader.ins.loadResAsync(Common.configPath + 'route_config', JsonAsset),
        ]);

        const mapBgJson = mapBgAsset.json as MapBgCfg[];
        if (!Array.isArray(mapBgJson)) {
            console.error('[WalkMapCfgManager] map_bg_cfg.json 格式错误，应为数组');
        } else {
            this._mapBgConfigMap.clear();
            for (const cfg of mapBgJson) {
                if (cfg && cfg.map_id != null && cfg.location != null) {
                    const key = `${cfg.location}_${cfg.map_id}`;
                    this._mapBgConfigMap.set(key, cfg);
                }
            }
        }

        const routeJson = routeAsset.json as RouteConfig[];
        if (!Array.isArray(routeJson)) {
            console.error('[WalkMapCfgManager] route_config.json 格式错误，应为数组');
        } else {
            this._routeConfigMap.clear();
            for (const cfg of routeJson) {
                if (cfg && cfg.route_id != null) {
                    this._routeConfigMap.set(cfg.route_id, cfg);
                }
            }
        }

        this._loaded = true;
        console.log('[WalkMapCfgManager] 配置加载完成，地图背景配置:', this._mapBgConfigMap.size, '条，路线配置:', this._routeConfigMap.size, '条');
    }

    getMapBg(walkAddressId: number, mapId: number): number[] | null {
        const key = `${walkAddressId}_${mapId}`;
        const cfg = this._mapBgConfigMap.get(key);
        return cfg ? cfg.order : null;
    }

    getMapBgImageId(walkAddressId: number, mapId: number, index: number): number | null {
        const order = this.getMapBg(walkAddressId, mapId);
        if (!order || index < 0 || index >= order.length) {
            return null;
        }
        return order[index];
    }

    getRouteConfig(routeId: number): RouteConfig | null {
        return this._routeConfigMap.get(routeId) || null;
    }

    getAllRouteConfigs(): RouteConfig[] {
        return Array.from(this._routeConfigMap.values());
    }

    getAllMapBgConfigs(): MapBgCfg[] {
        return Array.from(this._mapBgConfigMap.values());
    }

    /** 清理已加载的配置缓存，下次进入游戏时重新加载 */
    cleanup(): void {
        this._mapBgConfigMap.clear()
        this._routeConfigMap.clear()
        this._loaded = false
        this._loadingPromise = null
    }
}