import { JsonAsset } from 'cc';
import { ResLoader } from '../common/download/ResLoader';
import { Common } from '../common/utils/Define';
import { ItemConfig } from '../common/utils/InterfaceDefine';

/**
 * 道具配置管理器（单例）
 * 负责加载 resources/config/itemConfig.json 并提供按 item_id 查询配置的能力。
 *
 * 使用方式:
 *   await ItemConfigManager.ins.load();               // 初始化加载（项目启动时调用一次）
 *   const cfg = ItemConfigManager.ins.getConfig(1004); // 按 item_id 查询配置
 */
export class ItemConfigManager {
    private static _ins: ItemConfigManager = null!;

    static get ins(): ItemConfigManager {
        if (!ItemConfigManager._ins) {
            ItemConfigManager._ins = new ItemConfigManager();
        }
        return ItemConfigManager._ins;
    }

    /** 配置表：以 item_id 为键 */
    private _configMap: Map<number, ItemConfig> = new Map();
    /** 羁绊物 item_id 集合（来自 bondConfig.json） */
    private _bondItemIds: Set<number> = new Set();
    /** 是否已加载完成 */
    private _loaded: boolean = false;
    /** 加载中缓存 Promise，避免重复加载 */
    private _loadingPromise: Promise<void> | null = null;

    private constructor() {}

    /** 是否已加载完成 */
    get loaded(): boolean {
        return this._loaded;
    }

    /**
     * 加载道具配置表（幂等，多次调用只会真正加载一次）
     */
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
        const asset = await ResLoader.ins.loadResAsync(
            Common.configPath + 'itemConfig',
            JsonAsset
        );
        const bondAsset = await ResLoader.ins.loadResAsync(
            Common.configPath + 'bondConfig',
            JsonAsset
        );
        const json = asset.json as ItemConfig[];
        if (!Array.isArray(json)) {
            console.error('[ItemConfigManager] itemConfig.json 格式错误，应为数组');
            this._configMap.clear();
            this._loaded = true;
            return;
        }
        this._configMap.clear();
        this._bondItemIds.clear();
        for (const cfg of json) {
            if (cfg && cfg.item_id != null) {
                this._configMap.set(cfg.item_id, cfg);
            }
        }
        const bondJson = bondAsset.json as ItemConfig[];
        if (!Array.isArray(bondJson)) {
            console.error('[ItemConfigManager] bondConfig.json 格式错误，应为数组');
            this._loaded = true;
            return;
        }
        for (const cfg of bondJson) {
            if (cfg && cfg.item_id != null) {
                this._bondItemIds.add(cfg.item_id);
                this._configMap.set(cfg.item_id, cfg);
            }
        }
        this._loaded = true;

        console.log('[ItemConfigManager] 配置加载完成，共', this._configMap.size, '条',this._configMap);
    }

    /**
     * 根据 item_id 获取配置
     * @param itemId 配置id
     * @returns 配置对象，未找到返回 null
     */
    getConfig(itemId: number): ItemConfig | null {
        return this._configMap.get(itemId) || null;
    }

    /** 是否为羁绊物（配置在 bondConfig.json 中） */
    isBondItem(itemId: number): boolean {
        return this._bondItemIds.has(itemId);
    }
    getQuality(item_id){
        if(!item_id)return
        var cfg = this.getConfig(item_id)
        return cfg?.quality
    }
    /** 获取所有配置 */
    getAllConfigs(): ItemConfig[] {
        return Array.from(this._configMap.values());
    }
}
