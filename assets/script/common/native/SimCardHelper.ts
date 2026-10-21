import { native, sys } from 'cc';

/**
 * SIM卡信息接口
 */
export interface SimInfo {
    /** 是否有SIM卡 */
    hasSim: boolean;
    /** SIM卡数量 */
    simCount: number;
    /** 手机号码（优先卡1有信号的号码） */
    phoneNumber: string;
}

/**
 * Android SIM卡信息获取工具
 * 通过 native.reflection 调用 Android 原生 SimCardHelper 类
 */
export class SimCardHelper {

    private static readonly CLASS_NAME = 'com/comma/club/pet/world/story/SimCardHelper';

    /**
     * 检查是否为 Android 平台
     */
    private static get isAndroid(): boolean {
        return sys.isNative && sys.platform === sys.Platform.ANDROID;
    }

    /**
     * 检查设备是否有 SIM 卡
     */
    static hasSimCard(): boolean {
        if (!this.isAndroid) {
            console.warn('[SimCardHelper] hasSimCard 仅支持 Android 平台');
            return false;
        }
        try {
            return native.reflection.callStaticMethod(this.CLASS_NAME, 'hasSimCard', '()Z');
        } catch (e) {
            console.error('[SimCardHelper] hasSimCard 调用失败:', e);
            return false;
        }
    }

    /**
     * 获取可用的手机号码
     * 双卡时优先卡1，返回有信号的SIM卡号码
     * @returns 手机号码，无SIM卡或无号码时返回空字符串
     */
    static getAvailablePhoneNumber(): string {
        if (!this.isAndroid) {
            console.warn('[SimCardHelper] getAvailablePhoneNumber 仅支持 Android 平台');
            return '';
        }
        try {
            return native.reflection.callStaticMethod(
                this.CLASS_NAME,
                'getAvailablePhoneNumber',
                '()Ljava/lang/String;'
            );
        } catch (e) {
            console.error('[SimCardHelper] getAvailablePhoneNumber 调用失败:', e);
            return '';
        }
    }

    /**
     * 获取SIM卡数量
     */
    static getSimCount(): number {
        if (!this.isAndroid) {
            console.warn('[SimCardHelper] getSimCount 仅支持 Android 平台');
            return 0;
        }
        try {
            return native.reflection.callStaticMethod(this.CLASS_NAME, 'getSimCount', '()I');
        } catch (e) {
            console.error('[SimCardHelper] getSimCount 调用失败:', e);
            return 0;
        }
    }

    /**
     * 获取SIM卡综合信息
     * @returns SIM卡信息对象
     */
    static getSimInfo(): SimInfo {
        if (!this.isAndroid) {
            console.warn('[SimCardHelper] getSimInfo 仅支持 Android 平台');
            return { hasSim: false, simCount: 0, phoneNumber: '' };
        }
        try {
            const jsonStr = native.reflection.callStaticMethod(
                this.CLASS_NAME,
                'getSimInfo',
                '()Ljava/lang/String;'
            );
            if (jsonStr && typeof jsonStr === 'string') {
                return JSON.parse(jsonStr);
            }
        } catch (e) {
            console.error('[SimCardHelper] getSimInfo 调用失败:', e);
        }
        return { hasSim: false, simCount: 0, phoneNumber: '' };
    }
}