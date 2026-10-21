import { JsonAsset } from 'cc';
import { ResLoader } from '../common/download/ResLoader';
import { Common } from '../common/utils/Define';

interface QuizConfigData {
    natureNames: Record<string, string>;
    petNames: Record<string, string>;
}

/** 问卷配置管理 */
export class QuizConfigManager {
    private static _ins: QuizConfigManager = null!;
    private _natureNames: Record<string, string> = {};
    private _petNames: Record<string, string> = {};
    private _readyPromise: Promise<void> | null = null;

    static get ins(): QuizConfigManager {
        if (!QuizConfigManager._ins) {
            QuizConfigManager._ins = new QuizConfigManager();
        }
        return QuizConfigManager._ins;
    }

    private constructor() {}

    /** 确保问卷配置已加载 */
    ready(): Promise<void> {
        if (this._readyPromise) return this._readyPromise;
        this._readyPromise = this._loadConfig();
        return this._readyPromise;
    }

    /**
     * 根据性格 ID 获取形容词名称
     * @param nature 性格 ID（1-12）
     * @returns 如「敏感」「懒散」
     */
    getNatureName(nature: number): string {
        return this._natureNames[String(nature)] ?? '';
    }

    /**
     * 根据物种 ID 获取物种名称
     * @param petType 物种 ID（1:猫 2:狗 3:兔）
     * @returns 如「猫」「狗」「兔」
     */
    getPetTypeName(petType: number): string {
        return this._petNames[String(petType)] ?? '';
    }

    private async _loadConfig(): Promise<void> {
        try {
            const asset = await ResLoader.ins.loadResAsync(
                Common.configPath + 'quizConfig', JsonAsset
            );
            const raw = asset.json as QuizConfigData;
            this._natureNames = raw.natureNames;
            this._petNames = raw.petNames;
        } catch (error) {
            console.error('QuizConfigManager 加载失败:', error);
        }
    }
}
