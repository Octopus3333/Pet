import { LocalStorage, StorageKey } from '../storage/LocalStorage';
import { HttpClient } from '../network/HttpClient';
import { DeviceManager } from './DeviceManager';

/**
 * Token存储数据结构
 */
interface TokenStorage {
    accessToken: string;
    refreshToken: string;
    expireTimestamp: number; // 过期时间戳（毫秒）
}

/**
 * Token管理器
 * 负责Token的存储、获取、刷新和过期检测
 */
export class TokenManager {
    private static _instance: TokenManager;
    private _accessToken: string | null = null;
    // private _refreshToken: string | null = null;
    private _expireTimestamp: number = 0;

    private constructor() {
        this.loadFromStorage();
    }

    static get instance(): TokenManager {
        if (!TokenManager._instance) {
            TokenManager._instance = new TokenManager();
        }
        return TokenManager._instance;
    }

    /**
     * 从本地存储加载Token
     */
    private loadFromStorage(): void {
        const accessToken = LocalStorage.getString(StorageKey.ACCESS_TOKEN);
        const refreshToken = LocalStorage.getString(StorageKey.REFRESH_TOKEN);
        const expireTimestamp = LocalStorage.getNumber(StorageKey.TOKEN_EXPIRE);
        console.log("loadFromStorage", accessToken, refreshToken, expireTimestamp)
        if (accessToken) {
            this._accessToken = accessToken;
            // this._refreshToken = refreshToken;
        }
        if(expireTimestamp){
            this._expireTimestamp = expireTimestamp;
        }
    }

    /**
     * 保存Token
     * @param accessToken 访问令牌
     * @param refreshToken 刷新令牌
     * @param expireSeconds 过期时间（秒）
     */
    saveTokens(accessToken: string, refreshToken: string, expireSeconds: number): void {
        this._accessToken = accessToken;
        // this._refreshToken = refreshToken;
        this._expireTimestamp = Date.now() + expireSeconds * 1000;

        LocalStorage.setString(StorageKey.ACCESS_TOKEN, accessToken);
        // LocalStorage.setString(StorageKey.REFRESH_TOKEN, refreshToken);
        LocalStorage.setNumber(StorageKey.TOKEN_EXPIRE, this._expireTimestamp);
    }

    /**
     * 获取AccessToken
     */
    getAccessToken(): string | null {
        return this._accessToken;
    }

    // /**
    //  * 获取RefreshToken
    //  */
    // getRefreshToken(): string | null {
    //     return this._refreshToken;
    // }

    /**
     * Token是否过期
     */
    isTokenExpired(): boolean {
        if (!this._accessToken) {
            return true;
        }
        if(!this._expireTimestamp)return false
        return Date.now() >= this._expireTimestamp;
    }

    /**
     * 是否有有效Token（存在且未过期）
     */
    hasValidToken(): boolean {
        console.log("token====",this._accessToken , !!this._accessToken,!this.isTokenExpired())
        return !!this._accessToken && !this.isTokenExpired();
    }

    // /**
    //  * 刷新Token
    //  * @returns 是否刷新成功
    //  */
    // async refreshToken(): Promise<boolean> {
    //     if (!this._refreshToken) {
    //         return false;
    //     }

    //     try {
    //         const deviceId = DeviceManager.instance.getDeviceId();
    //         const response = await HttpClient.instance.post<{
    //             access_token: string;
    //             refresh_token: string;
    //             token_expire: number;
    //         }>('/user/refresh_token', {
    //             refresh_token: this._refreshToken,
    //             device_id: deviceId,
    //         });

    //         if (response.data && response.data.access_token) {
    //             this.saveTokens(
    //                 response.data.access_token,
    //                 response.data.refresh_token,
    //                 response.data.token_expire
    //             );
    //             return true;
    //         }
    //         return false;
    //     } catch (error) {
    //         console.error('[TokenManager] refreshToken failed:', error);
    //         return false;
    //     }
    // }

    /**
     * 清除所有Token
     */
    clearTokens(): void {
        this._accessToken = null;
        // this._refreshToken = null;
        this._expireTimestamp = 0;

        LocalStorage.remove(StorageKey.ACCESS_TOKEN);
        LocalStorage.remove(StorageKey.REFRESH_TOKEN);
        LocalStorage.remove(StorageKey.TOKEN_EXPIRE);
    }

    /**
     * 获取请求头（带Token和设备ID）
     */
    getAuthHeaders(): Record<string, string> {
        const headers: Record<string, string> = {};
        if (this._accessToken) {
            headers['token'] = this._accessToken;
        }
        return headers;
    }
}
