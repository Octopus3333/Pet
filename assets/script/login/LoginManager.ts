import { HttpClient } from '../common/network/HttpClient';
import { TokenManager } from '../common/auth/TokenManager';
import { DeviceManager } from '../common/auth/DeviceManager';
import { DispatchEvent } from '../common/utils/DispatchEvent';
import { EventType } from '../common/utils/Define';
import { ToastManager } from '../common/utils/ToastManager';
import { DataManager } from '../Data/DataManager';
import { LoginResult, UserInfo } from '../common/utils/InterfaceDefine';
import { Socket } from 'cc';
import { SocketManager } from '../common/network/SocketManager';
import { WaitingManager } from '../common/utils/WaitingManager';

/**
 * 登录管理器
 * 负责登录/登出流程、用户状态管理
 * 数据存储统一委托给 DataManager
 */
export class LoginManager {
    private static _instance: LoginManager;

    private constructor() {}

    static get instance(): LoginManager {
        if (!LoginManager._instance) {
            LoginManager._instance = new LoginManager();
        }
        return LoginManager._instance;
    }

    /**
     * 手机号+验证码登录
     */
    async login(phone?: string, code?: string): Promise<LoginResult> {
        try {
            WaitingManager.ins.show()
            const deviceId = DeviceManager.instance.getDeviceId();
            console.log("login============")
            const response = await HttpClient.instance.post('/user/login', {
                login_account: phone||null,
                verify_code: code||null,
                device_id: deviceId,
            });

            const resData = response.data as any;
            if (resData.code !== 0) {
                WaitingManager.ins.hide()
                return {
                    success: false,
                    errorCode: resData.code,
                    errorMsg: resData.msg || '登录失败',
                };
            }

            const data = resData;
            console.log("login res data", data)
            if (!data || !data.access_token) {
                WaitingManager.ins.hide()
                return {
                    success: false,
                    errorMsg: '登录响应数据异常',
                };
            }

            // 保存Token
            TokenManager.instance.saveTokens(
                data.access_token,
                data.refresh_token,
                data.token_expire
            );

            // 通过 DataManager 存储用户信息
            DataManager.ins.updateLoginData(data);
            console.log("111111111111111111111111111111")
            // 派发登录成功事件
            DispatchEvent.ins.emit(EventType.LoginSuccess);

            return { success: true };
        } catch (error: any) {
            console.error('[LoginManager] login failed:', error);
            WaitingManager.ins.hide()
            const errorData = error?.response?.data;
            if (errorData) {
                return {
                    success: false,
                    errorCode: errorData.code,
                    errorMsg: errorData.msg || '登录失败',
                };
            }

            return {
                success: false,
                errorMsg: '网络异常，请重试',
            };
        }
    }

    /**
     * 一键登录（使用阿里云号码认证Token）
     */
    async oneKeyLogin(token: string): Promise<LoginResult> {
        try {
            const deviceId = DeviceManager.instance.getDeviceId();

            const response = await HttpClient.instance.post('/user/login', {
                one_key_token: token,
                device_id: deviceId,
            });

            const resData = response.data as any;
            if (resData.code !== 0) {
                return {
                    success: false,
                    errorCode: resData.code,
                    errorMsg: resData.msg || '一键登录失败',
                };
            }

            const data = resData;
            console.log("oneKeyLogin res data", data);
            if (!data || !data.access_token) {
                return {
                    success: false,
                    errorMsg: '登录响应数据异常',
                };
            }

            // 保存Token
            TokenManager.instance.saveTokens(
                data.access_token,
                data.refresh_token,
                data.token_expire
            );

            // 通过 DataManager 存储用户信息
            DataManager.ins.updateLoginData(data);

            // 派发登录成功事件
            DispatchEvent.ins.emit(EventType.LoginSuccess);

            return { success: true };
        } catch (error: any) {
            console.error('[LoginManager] oneKeyLogin failed:', error);

            const errorData = error?.response?.data;
            if (errorData) {
                return {
                    success: false,
                    errorCode: errorData.code,
                    errorMsg: errorData.msg || '一键登录失败',
                };
            }

            return {
                success: false,
                errorMsg: '网络异常，请重试',
            };
        }
    }

    /**
     * 自动登录（使用本地Token）
     */
    async autoLogin(): Promise<boolean> {
        // 检查是否有有效Token
        console.log("TokenManager.instance.hasValidToken", TokenManager.instance.hasValidToken())
        if (!TokenManager.instance.hasValidToken()) {
            TokenManager.instance.clearTokens();
            return false
        }

        try {
            const response = await HttpClient.instance.post('/user/info',{});
            const resData = response.data as any;
            if (resData.code === 0 && resData) {
                // 通过 DataManager 存储用户信息
                DataManager.ins.updateLoginData(resData);

                DispatchEvent.ins.emit(EventType.LoginSuccess, {
                    userInfo: resData.data,
                    isNewUser: false,
                });

                return true;
            }

            // Token无效
            this.clearLoginState();
            return false;
        } catch (error: any) {
            console.error('[LoginManager] autoLogin failed:', error);

            const errorData = error?.response?.data;
            if (errorData?.code === 4003) {
                this.clearLoginState();
                ToastManager.ins.showToast('您的账号已在其他设备登录');
            }

            return false;
        }
    }

    /**
     * 登出
     */
    async logout(): Promise<void> {
        this.clearLoginState();
    }

    /**
     * 清除登录状态
     */
    private clearLoginState(): void {
        TokenManager.instance.clearTokens();
        DataManager.ins.clearUserData();
        SocketManager.instance.disconnect()
    }

}
