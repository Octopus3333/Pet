import { JsonAsset } from 'cc';
import { ResLoader } from '../common/download/ResLoader';
import { Common } from '../common/utils/Define';

export class PatternManager {
    private static _ins: PatternManager = null!;
    private _config: Record<string, string[]> | null = null;   // key 为宠物类型字符串
    private _readyPromise: Promise<void> | null = null;

    static get ins(): PatternManager {
        if (!PatternManager._ins) {
            PatternManager._ins = new PatternManager();
        }
        return PatternManager._ins;
    }

    private constructor() {}

    /** 确保配置已加载（懒加载，和 UIManager 等类似，谁用谁调） */
    ready(): Promise<void> {
        if (this._config) return Promise.resolve();
        if (!this._readyPromise) {
            this._readyPromise = this._loadConfig();
        }
        return this._readyPromise;
    }

    /** 根据宠物类型获取花色列表 */
    getPatterns(petType: number): string[] {
        if (!this._config) {
            console.warn('PatternManager: 配置尚未加载，请先 await ready()');
            return [];
        }
        return this._config[String(petType)] || [];
    }

    /** 根据宠物类型随机一个花色 */
    getRandomPattern(petType: number): string {
        const patterns = this.getPatterns(petType);
        if (patterns.length === 0) return '默认花色';
        return patterns[Math.floor(Math.random() * patterns.length)];
    }

    private async _loadConfig(): Promise<void> {
        try {
            const asset = await ResLoader.ins.loadResAsync(
                Common.configPath + 'petPatternConfig', JsonAsset
            );
            const raw = asset.json as any;
            this._config = raw.patternGroups || {};
            console.log('PatternManager: 配置加载完成');
        } catch (error) {
            console.error('PatternManager 加载失败:', error);
            this._config = {};
        }
    }
}