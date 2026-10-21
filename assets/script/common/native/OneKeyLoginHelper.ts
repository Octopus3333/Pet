import { native, sys } from 'cc';

/**
 * 一键登录结果码
 */
export enum OneKeyLoginResultCode {
    /** 成功获取Token */
    SUCCESS = 600000,
    /** 授权页唤起成功 */
    PAGE_SHOW = 600001,
    /** 授权页唤起失败 / 获取失败 */
    FAIL = 600002,
    /** 获取Token失败 */
    GET_TOKEN_FAIL = 600011,
    /** 获取Token超时 */
    GET_TOKEN_TIMEOUT = 600015,
    /** 运营商维护升级，功能不可用 */
    SERVICE_UNAVAILABLE = 600013,
    /** 达到最大调用次数 */
    RATE_LIMIT = 600014,
    /** 用户取消 */
    USER_CANCEL = 700000,
}

/**
 * 一键登录结果回调
 */
export interface OneKeyLoginResult {
    code: OneKeyLoginResultCode | number;
    msg: string;
}

/**
 * 阿里云一键登录 TS 封装
 * 依赖 Android 原生：com.comma.club.pet.world.story.OneKeyLoginHelper
 */
export class OneKeyLoginHelper {

    private static readonly CLASS_NAME = 'com/comma/club/pet/world/story/OneKeyLoginHelper';
    private static _initialized = false;
    private static _resultCallback: ((result: OneKeyLoginResult) => void) | null = null;

    /**
     * 检查是否为 Android 平台
     */
    private static get isAndroid(): boolean {
        return sys.isNative && sys.platform === sys.Platform.ANDROID;
    }

    /**
     * 监听结果回调（JsbBridge 回调到 TS）
     * 需要在使用前注册
     */
    static onRegisterResultCallback(callback: (result: OneKeyResult) => void) {
        this._resultCallback = callback;
        console.log("cocos onRegisterResultCallback",this.isAndroid)
        if (this.isAndroid) {
            // 注册事件监听
            native.bridge.onNative('oneKeyLoginResult', (jsonStr) => this.onResult(jsonStr));
        }
    }

    /**
     * 移除结果监听
     */
    static offRemoveResultCallback() {
        this._resultCallback = null;
        if (this.isAndroid) {
            native.bridge.onNative('oneKeyLoginResult', null);
        }
    }

    /**
     * 初始化 SDK，设置认证方案密钥
     * @param secretKey 从阿里云控制台获取的方案密钥
     */
    static setAuthSDKInfo(secretKey: string): void {
        if (!this.isAndroid) {
            console.warn('[OneKeyLoginHelper] 仅支持 Android 平台');
            return;
        }
        try {
            native.reflection.callStaticMethod(
                this.CLASS_NAME,
                'setAuthSDKInfo',
                '(Ljava/lang/String;)V',
                secretKey
            );
            this._initialized = true;
        } catch (e) {
            console.error('[OneKeyLoginHelper] setAuthSDKInfo 调用失败:', e);
        }
    }

    /**
     * 一键登录获取 Token
     * @param timeout 超时时间（毫秒），默认 5000
     */
    static getLoginToken(timeout: number = 5000): void {
        if (!this.isAndroid) {
            console.warn('[OneKeyLoginHelper] 仅支持 Android 平台');
            this.notifyResult({ code: -1, msg: '仅支持 Android 平台' });
            return;
        }
        if (!this._initialized) {
            console.warn('[OneKeyLoginHelper] SDK 未初始化，请先调用 setAuthSDKInfo');
            this.notifyResult({ code: -2, msg: 'SDK 未初始化' });
            return;
        }
        try {
            native.reflection.callStaticMethod(
                this.CLASS_NAME,
                'getLoginToken',
                '(I)V',
                timeout
            );
        } catch (e) {
            console.error('[OneKeyLoginHelper] getLoginToken 调用失败:', e);
            this.notifyResult({ code: -3, msg: `调用失败: ${e}` });
        }
    }

    /**
     * 退出授权页
     */
    static quitLoginPage(): void {
        if (!this.isAndroid) return;
        try {
            native.reflection.callStaticMethod(
                this.CLASS_NAME,
                'quitLoginPage',
                '()V'
            );
        } catch (e) {
            console.error('[OneKeyLoginHelper] quitLoginPage 调用失败:', e);
        }
    }

    /**
     * 检查环境是否支持一键登录
     */
    static checkEnvAvailable(): void {
        if (!this.isAndroid) {
            this.notifyResult({ code: -1, msg: '仅支持 Android 平台' });
            return;
        }
        try {
            native.reflection.callStaticMethod(
                this.CLASS_NAME,
                'checkEnvAvailable',
                '()V'
            );
        } catch (e) {
            console.error('[OneKeyLoginHelper] checkEnvAvailable 调用失败:', e);
            this.notifyResult({ code: -3, msg: `调用失败: ${e}` });
        }
    }

    /**
     * 预取号（加速拉起授权页）
     * @param timeout 超时时间（毫秒），默认 5000
     */
    static accelerateLoginPage(timeout: number = 5000): void {
        if (!this.isAndroid) return;
        try {
            native.reflection.callStaticMethod(
                this.CLASS_NAME,
                'accelerateLoginPage',
                '(I)V',
                timeout
            );
        } catch (e) {
            console.error('[OneKeyLoginHelper] accelerateLoginPage 调用失败:', e);
        }
    }

    /**
     * 获取当前运营商名称
     * @returns CMCC(移动) / CUCC(联通) / CTCC(电信) 或空字符串
     */
    static getCurrentCarrierName(): string {
        if (!this.isAndroid) return '';
        try {
            return native.reflection.callStaticMethod(
                this.CLASS_NAME,
                'getCurrentCarrierName',
                '()Ljava/lang/String;'
            ) || '';
        } catch (e) {
            console.error('[OneKeyLoginHelper] getCurrentCarrierName 调用失败:', e);
            return '';
        }
    }

    /**
     * 内部：处理原生层返回结果
     */
    private static onResult(jsonStr: string): void {
        try {
            const result = JSON.parse(jsonStr) as OneKeyLoginResult;
            this.notifyResult(result);
        } catch (e) {
            this.notifyResult({ code: -4, msg: `JSON 解析失败: ${e}` });
        }
    }

    /**
     * 通知结果到回调
     */
    private static notifyResult(result: OneKeyLoginResult): void {
        if (this._resultCallback) {
            this._resultCallback(result);
        }
    }
}

declare type OneKeyResult = OneKeyLoginResult;
