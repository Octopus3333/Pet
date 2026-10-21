import { sys } from 'cc';

/**
 * 本地存储键名枚举
 */
export enum StorageKey {
    ACCESS_TOKEN = 'access_token',
    REFRESH_TOKEN = 'refresh_token',
    TOKEN_EXPIRE = 'token_expire_time',
    USER_INFO = 'user_info',
    DEVICE_ID = 'device_id',
    COUNTDOWN_END = 'code_countdown_end_time',
}

/**
 * 本地存储封装
 * 封装 cc.sys.localStorage，提供类型安全的存取接口
 */
export class LocalStorage {
    /**
     * 存储字符串
     */
    static setString(key: string, value: string): void {
        sys.localStorage.setItem(key, value);
    }

    /**
     * 获取字符串
     */
    static getString(key: string): string | null {
        const value = sys.localStorage.getItem(key);
        return value || null;
    }

    /**
     * 存储数字
     */
    static setNumber(key: string, value: number): void {
        sys.localStorage.setItem(key, value.toString());
    }

    /**
     * 获取数字
     */
    static getNumber(key: string): number | null {
        const value = sys.localStorage.getItem(key);
        if (value === null || value === undefined || value === '') {
            return null;
        }
        const num = Number(value);
        return isNaN(num) ? null : num;
    }

    /**
     * 存储对象（JSON序列化）
     */
    static setObject<T extends object>(key: string, value: T): void {
        try {
            const json = JSON.stringify(value);
            sys.localStorage.setItem(key, json);
        } catch (e) {
            console.error(`[LocalStorage] setObject error: key=${key}`, e);
        }
    }

    /**
     * 获取对象（JSON反序列化）
     */
    static getObject<T>(key: string): T | null {
        const json = sys.localStorage.getItem(key);
        if (!json) return null;
        try {
            return JSON.parse(json) as T;
        } catch (e) {
            console.error(`[LocalStorage] getObject error: key=${key}`, e);
            return null;
        }
    }

    /**
     * 删除键
     */
    static remove(key: string): void {
        sys.localStorage.removeItem(key);
    }

    /**
     * 清除所有存储
     */
    static clear(): void {
        sys.localStorage.clear();
    }
}
