import { _decorator, Color, Component, EditBox, Label, Node, Toggle, Button, Sprite, View } from 'cc';
import { DispatchEvent } from '../common/utils/DispatchEvent';
import { EventType, ViewPath, AgreementUrl, AgreementType } from '../common/utils/Define';
import { CodeManager } from './CodeManager';
import { UIManager } from '../common/utils/UIManager';
import { SimCardHelper } from '../common/native/SimCardHelper';
import { OneKeyLoginHelper, OneKeyLoginResult, OneKeyLoginResultCode } from '../common/native/OneKeyLoginHelper';
import { LoginManager } from './LoginManager';
import { ToastManager } from '../common/utils/ToastManager';
import { PrivacyPanel } from '../common/components/PrivacyPanel';
import { showPrivacyPanel } from '../common/utils/UiTools';

const { ccclass, property } = _decorator;

@ccclass('LoginPanel')
export class LoginPanel extends Component {
    @property(EditBox)
    ed_phone_number: EditBox = null;
    @property(EditBox)
    ed_code: EditBox = null;
    @property(Label)
    lab_countdown: Label = null;
    @property(Button)
    btn_get_code: Button = null;
    @property(Button)
    btn_login: Button = null;
    @property(Label)
    lab_login: Label = null;
    @property(Toggle)
    tg_agreement: Toggle = null;

    /** 一键登录节点 */
    @property(Node)
    nd_auto_login: Node = null;

    /** 普通登录节点 */
    @property(Node)
    nd_normal_login: Node = null;

    private _phone: string = '';
    private _code: string = '';
    private _isAutoLoginMode: boolean = false;

    onLoad() {
        this.initEvents();
        this.registerCountdown();
        this.initUI();
    }

    onDestroy() {
        CodeManager.instance.offCountdownUpdate();
        console.log("offRemoveResultCallBack")
        OneKeyLoginHelper.offRemoveResultCallback();
    }

    private initEvents() {
        this.ed_phone_number?.node.on('text-changed', this.onPhoneChanged, this);
        this.ed_code?.node.on('text-changed', this.onCodeChanged, this);
        DispatchEvent.ins.on(EventType.AgreeProto, this.AgreeProto, this)
    }

    private initUI() {
        const hasSimCard = SimCardHelper.hasSimCard();
        const availablePhoneNum = SimCardHelper.getAvailablePhoneNumber();
        const simCount = SimCardHelper.getSimCount();
        console.log("hasSimCard", hasSimCard, "availablePhoneNum", availablePhoneNum, "simCount", simCount);

        if (false) {
            // 有SIM卡，显示一键登录，初始化SDK
            console.log("shou auto login")
            this.showAutoLogin();
            OneKeyLoginHelper.onRegisterResultCallback(this.onOneKeyLoginResult.bind(this));
            // 延迟到下一帧初始化 SDK，确保 native.bridge.onNative 注册完成
            this.scheduleOnce(() => {
                OneKeyLoginHelper.setAuthSDKInfo("HoE10vpm6NQ+KEqKGMt7TziJcYG8he4WyRCy5kvtY4o+WGAv62FvirFWJspoJ4CAnc2rWHQ49AeDKtIJjk0uXVX8uXVsolyYoaQas7C+nHfb7JOduXkwGWtKlIkCXIxX3M4K5vSdrUz4vJEd0Pr6+kRkRKzTMZaoC+iD2J6TnEXKShv/7VhFGdh9Q7FcW/hIsRCFCXPf1b3GMXX8/hh2amW6BYMiA54pd2g5hNmlHWO6FtdtJc5nIPRWmKAESgMJMNdxRl/QQeWj2A2ws/v5rH8vJ03G3MocYYYFX2KM4o50Oo4XN/ag8UG1znPHT8bM");
            }, 0);
    } else {
            console.log("shou normal login")
            this.showNormalLogin();
        }

        this.updateButtonState();
    }

    private AgreeProto(){
        this.tg_agreement.isChecked = true
        const phone = this._phone;
        const code = this._code;
        DispatchEvent.ins.emit(EventType.ClickLogin, { phone, code })
    }
    private registerCountdown() {
        CodeManager.instance.onCountdownUpdate((seconds) => {
            this.updateCountdownUI(seconds);
        });
    }

    private onPhoneChanged() {
        this._phone = this.ed_phone_number?.string || '';
        this.updateButtonState();
    }

    private onCodeChanged() {
        this._code = this.ed_code?.string || '';
        this.updateLoginButtonState();
    }

    private updateLoginButtonState(){
        const phoneValid = CodeManager.isValidPhone(this._phone);
        console.log("phoneValid", phoneValid)
        const codeValid = this._code.length >= 4;
        const canLogin = phoneValid && codeValid;
        if (this.btn_login) {
            this.btn_login.interactable = canLogin;
            if (this.lab_login) {
                this.lab_login.color = canLogin ? new Color('#6F4018') : new Color('#444444');
            }
        }
    }
    private updateButtonState() {
        this.updateLoginButtonState()
        if(this.btn_get_code){
            const phoneValid = CodeManager.isValidPhone(this._phone);
            this.btn_get_code.interactable = phoneValid;
            this.setCodeBtnGray(!phoneValid)
        }
    }
    private setCodeBtnGray(bool:boolean){
        console.log("CodeBtnGray==========",bool)
        if(!this.btn_get_code)return
        var sp = this.btn_get_code.getComponent(Sprite)
        sp.grayscale = bool
    }
    private updateCountdownUI(seconds: number) {
        if (!this.lab_countdown || !this.btn_get_code) return;

        if (seconds > 0) {
            this.lab_countdown.string = `重新获取\n(${seconds}s)`;
            this.btn_get_code.interactable = false;
            this.setCodeBtnGray(true)
        } else {
            this.lab_countdown.string = '获取验证码';
            this.btn_get_code.interactable = true;
            this.setCodeBtnGray(false)
        }
    }

    async onClickGetCode() {
        if (!this._phone) {
            console.log('请输入手机号');
            return;
        }
        DispatchEvent.ins.emit(EventType.ClickGetPhoneCode, { phone: this._phone });
    }

    async onClickLogin() {
        const phone = this._phone;
        const code = this._code;

        if (!phone || !code) {
            console.warn('请输入手机号和验证码');
            return;
        }
        if(!this.tg_agreement.isChecked){
            UIManager.ins.show(ViewPath.ProtoPanel)
            return
        }
        DispatchEvent.ins.emit(EventType.ClickLogin, { phone, code });
    }

    onClickUser(){
        showPrivacyPanel(AgreementUrl.User, AgreementType.User);
    }
    async onClickPrivilage(){
        showPrivacyPanel(AgreementUrl.Privacy, AgreementType.Privacy);
    }
    // ========== 一键登录 ==========

    /** 显示一键登录界面 */
    private showAutoLogin() {
        this._isAutoLoginMode = true;
        if (this.nd_auto_login) {
            this.nd_auto_login.active = true;
        }
        if (this.nd_normal_login) {
            this.nd_normal_login.active = false;
        }
    }

    /** 显示普通登录界面 */
    private showNormalLogin() {
        this._isAutoLoginMode = false;
        if (this.nd_auto_login) {
            this.nd_auto_login.active = false;
        }
        if (this.nd_normal_login) {
            this.nd_normal_login.active = true;
        }
    }

    /** 点击一键登录按钮 */
    onClickAutoLogin() {
        if (!this.tg_agreement.isChecked) {
            UIManager.ins.show(ViewPath.ProtoPanel);
            return;
        }
        console.log('[LoginPanel] 触发一键登录');
        OneKeyLoginHelper.getLoginToken(5000);
    }

    /** 一键登录结果回调 */
    private onOneKeyLoginResult(result: OneKeyLoginResult) {
        console.log('[LoginPanel] 一键登录结果:', result.code, result.msg);

        if (result.code === OneKeyLoginResultCode.SUCCESS) {
            // 获取Token成功，发送到后端验证
            OneKeyLoginHelper.quitLoginPage();
            this.handleOneKeyLoginToken(result.msg);
        } else if (result.code === OneKeyLoginResultCode.USER_CANCEL) {
            // 用户取消，切换到普通登录
            OneKeyLoginHelper.quitLoginPage();
            this.showNormalLogin();
            ToastManager.ins.showToast('已取消一键登录');
        } else {
            // 其他失败，切换到普通登录
            OneKeyLoginHelper.quitLoginPage();
            this.showNormalLogin();
            ToastManager.ins.showToast('一键登录失败，请使用验证码登录');
        }
    }

    /** 用一键登录Token调用后端登录 */
    private async handleOneKeyLoginToken(token: string) {
        const result = await LoginManager.instance.oneKeyLogin(token);
        if (result.success) {
            console.log('[LoginPanel] 一键登录成功');
        } else {
            console.warn('[LoginPanel] 一键登录后端验证失败:', result.errorMsg);
            this.showNormalLogin();
            ToastManager.ins.showToast(result.errorMsg || '登录失败，请使用验证码登录');
        }
    }
}
