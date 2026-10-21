import { HttpClient } from "../common/network/HttpClient";
import { ToastManager } from "../common/utils/ToastManager";


/**
 * 验证码管理器
 * 负责验证码发送、倒计时管理、手机号校验
 */
export class CodeManager {
    private static _instance: CodeManager;
    
    /** 倒计时开始时间戳（毫秒） */
    private _countdownStartTime: number = 0;
    /** 倒计时总秒数 */
    private _countdownTotalSeconds: number = 0;
    /** 倒计时定时器 */
    private _countdownTimer: number | null = null;
    /** 倒计时更新回调 */
    private _onCountdownUpdate: ((seconds: number) => void) | null = null;

    /** 中国大陆手机号正则（1开头，第二位3-9，共11位） */
    private static readonly PHONE_REGEX = /^1[3-9]\d{9}$/;
    
    /** 默认倒计时秒数 */
    private static readonly DEFAULT_COUNTDOWN = 90;

    private constructor() {}

    static get instance(): CodeManager {
        if (!CodeManager._instance) {
            CodeManager._instance = new CodeManager();
        }
        return CodeManager._instance;
    }

    /**
     * 手机号格式校验
     */
    static isValidPhone(phone: string): boolean {
        return CodeManager.PHONE_REGEX.test(phone);
    }

    /**
     * 发送验证码
     */
    async sendCode(phone: string, type?): Promise<boolean> {
        // 校验手机号格式
        if (!CodeManager.isValidPhone(phone)) {
            ToastManager.ins.showToast('请输入正确的手机号码');
            return false;
        }

        // 检查是否在倒计时中
        if (this.isCountdownActive()) {
            ToastManager.ins.showToast('获取频繁，请稍后重试');
            return false;
        }

        try {
            const response = await HttpClient.instance.post('/user/send_code', {
                phone: phone,
                code_type: type|| 1,
            });
            console.log("respones===========",response)
            // 检查响应
            if (response.data && (response.data as any).code === 0) {
                // 开始倒计时
                this.startCountdown(CodeManager.DEFAULT_COUNTDOWN);
                ToastManager.ins.showToast('验证码已发送');
                return true;
            } else {
                const errorMsg = (response.data as any)?.msg || '发送失败，请重试';
                ToastManager.ins.showToast(errorMsg);
                return false;
            }
        } catch (error: any) {
            console.error('[CodeManager] sendCode failed:', error);
            // 根据错误码提示
            const errorCode = error?.response?.data?.code;
            if (errorCode === 1002 || errorCode === 1003) {
                ToastManager.ins.showToast('获取频繁，请稍后重试');
            } else {
                ToastManager.ins.showToast('网络异常，请重试');
            }
            return false;
        }
    }

    /**
     * 开始倒计时
     */
    private startCountdown(seconds: number): void {
        // 清除之前的定时器
        this.stopCountdown();

        this._countdownStartTime = Date.now();
        this._countdownTotalSeconds = seconds;

        // 通知UI更新
        this._onCountdownUpdate?.(seconds);

        // 启动定时器，每次根据时间差计算剩余秒数
        this._countdownTimer = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this._countdownStartTime) / 1000);
            const remaining = this._countdownTotalSeconds - elapsed;
            
            if (remaining <= 0) {
                this.stopCountdown();
            } else {
                this._onCountdownUpdate?.(remaining);
            }
        }, 1000);
    }

    /**
     * 停止倒计时
     */
    private stopCountdown(): void {
        if (this._countdownTimer !== null) {
            clearInterval(this._countdownTimer);
            this._countdownTimer = null;
        }
        this._countdownStartTime = 0;
        this._countdownTotalSeconds = 0;
        this._onCountdownUpdate?.(0);
    }

    /**
     * 获取当前倒计时剩余秒数
     */
    getCountdownRemaining(): number {
        if (this._countdownStartTime <= 0) return 0;
        const elapsed = Math.floor((Date.now() - this._countdownStartTime) / 1000);
        return Math.max(0, this._countdownTotalSeconds - elapsed);
    }

    /**
     * 是否在倒计时中
     */
    isCountdownActive(): boolean {
        return this.getCountdownRemaining() > 0;
    }

    /**
     * 注册倒计时更新回调
     */
    onCountdownUpdate(callback: (seconds: number) => void): void {
        this._onCountdownUpdate = callback;
        // 立即触发一次，同步当前状态
        callback(this.getCountdownRemaining());
    }

    /**
     * 移除倒计时回调
     */
    offCountdownUpdate(): void {
        this._onCountdownUpdate = null;
    }
}