import { sys } from 'cc';
import { LocalStorage, StorageKey } from '../storage/LocalStorage';

/**
 * 设备ID管理器
 * 负责生成和获取设备唯一标识
 */
export class DeviceManager {
    private static _instance: DeviceManager;
    private _deviceId: string | null = null;

    private constructor() {}

    static get instance(): DeviceManager {
        if (!DeviceManager._instance) {
            DeviceManager._instance = new DeviceManager();
        }
        return DeviceManager._instance;
    }

    /**
     * 获取设备ID（首次调用时生成并持久化）
     */
    getDeviceId(): string {
        if (this._deviceId) {
            return this._deviceId;
        }

        // 从本地存储读取
        const stored = LocalStorage.getString(StorageKey.DEVICE_ID);
        if (stored) {
            this._deviceId = stored;
            return this._deviceId;
        }

        // 生成新的设备ID
        this._deviceId = this.generateDeviceId();
        LocalStorage.setString(StorageKey.DEVICE_ID, this._deviceId);
        return this._deviceId;
    }

    /**
     * 生成唯一设备ID
     * 使用平台 + 时间戳 + 随机数组合
     */
    private generateDeviceId(): string {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 10);
        const platform = sys.platform;
        return `device_${platform}_${timestamp}_${random}`;
    }

    /**
     * 清除设备ID（仅用于测试）
     */
    clearDeviceId(): void {
        this._deviceId = null;
        LocalStorage.remove(StorageKey.DEVICE_ID);
    }
}
