import { NetworkConfig } from './NetworkConfig';
import { DownloadConfig } from './DownloadConfig';
import { LocaleManager } from '../locales/LocaleManager';

export class GameConfig {
    private static _instance: GameConfig;

    private constructor() {}

    public static get instance(): GameConfig {
        if (!GameConfig._instance) {
            GameConfig._instance = new GameConfig();
        }
        return GameConfig._instance;
    }

    public get network(): NetworkConfig {
        return NetworkConfig.instance;
    }

    public get download(): DownloadConfig {
        return DownloadConfig.instance;
    }

    public get locale(): LocaleManager {
        return LocaleManager.instance;
    }
}
