import { _decorator, BlockInputEvents, Component, EditBox, Label, Node, Sprite, Toggle } from 'cc';
import { UIManager } from '../common/utils/UIManager';
import { ToastManager } from '../common/utils/ToastManager';
import { EventType, ViewPath, AgreementUrl, AgreementType } from '../common/utils/Define';
import { SocketManager, SocketMSgId } from '../common/network/SocketManager';
import { MainController } from '../game/MainController';
import { DispatchEvent } from '../common/utils/DispatchEvent';
import { showPrivacyPanel } from '../common/utils/UiTools';

const { ccclass, property } = _decorator;

@ccclass('AccountPanel')
export class AccountPanel extends Component
{
    @property(Node)
    btn_back: Node = null;

    @property(Label)
    lb_title: Label = null;

    @property(Node)
    nd_account: Node = null;

    @property(Label)
    lb_phone_value: Label = null;

    @property(Node)
    btn_delete_account: Node = null;

    @property(Node)
    nd_delete: Node = null;

    @property(Node)
    tg_agreement: Node = null;

    @property(Node)
    btn_agreement_link: Node = null;

    @property(Node)
    btn_delete_next: Node = null;

    @property(Node)
    nd_verify: Node = null;

    @property(Label)
    lb_phone: Label = null;

    @property(EditBox)
    edt_code: EditBox = null;

    @property(Node)
    btn_get_code: Node = null;

    @property(Label)
    lb_countdown: Label = null;

    @property(Node)
    btn_verify_next: Node = null;

    @property(Node)
    nd_confirm: Node = null;

    @property(EditBox)
    edt_reason: EditBox = null;

    @property(Label)
    lb_count: Label = null;

    @property(Node)
    btn_confirm: Node = null;

    @property(Sprite)
    sp_btn_bg: Sprite = null;

    private _currentPage: string = 'account';
    private _countdown: number = 0;
    private _phone:number = 0
    protected onLoad(): void
    {
        let block = this.node.getComponent(BlockInputEvents);
        if (!block)
        {
            this.node.addComponent(BlockInputEvents);
        }

        this.btn_back?.on(Node.EventType.TOUCH_END, this.onClickBack, this);

        this.btn_delete_account?.on(Node.EventType.TOUCH_END, this.onClickDeleteAccount, this);
        this.btn_agreement_link?.on(Node.EventType.TOUCH_END, this.onClickAgreementLink, this);
        this.btn_delete_next?.on(Node.EventType.TOUCH_END, this.onClickDeleteNext, this);

        this.btn_get_code?.on(Node.EventType.TOUCH_END, this.onClickGetCode, this);
        this.btn_verify_next?.on(Node.EventType.TOUCH_END, this.onClickVerifyNext, this);

        this.btn_confirm?.on(Node.EventType.TOUCH_END, this.onClickConfirm, this);

        if (this.edt_reason)
        {
            this.edt_reason.node.on('text-changed', this.onTextChanged, this);
            this.edt_reason.node.on('editing-did-began', this.onEditingBegin, this);
            this.edt_reason.node.on('editing-did-ended', this.onEditingEnd, this);
        }

        SocketManager.instance.on('connect', this.onSocketConnected);
    }

    private onSocketConnected(): void
    {
        if (this.node && this.node.active && this._currentPage === 'account')
        {
            this.loadPhoneNumber();
        }
    }

    protected onEnable(): void
    {
        this.showPage('account');
        if (SocketManager.instance.isConnected)
        {
            this.loadPhoneNumber();
        }
    }

    hide(): void
    {
        this.unschedule(this.onCountdownTick);
        this.node.active = false;
    }

    private showPage(page: string): void
    {
        this._currentPage = page;

        this.nd_account.active = page === 'account';
        this.nd_delete.active = page === 'delete';
        this.nd_verify.active = page === 'verify';
        this.nd_confirm.active = page === 'confirm';

        switch (page)
        {
            case 'account':
                this.lb_title.string = '账号设置';
                break;
            case 'delete':
                this.lb_title.string = '注销账号';
                break;
            case 'verify':
                this.lb_title.string = '请先验证身份';
                break;
            case 'confirm':
                this.lb_title.string = '注销原因';
                break;
        }
    }

    private onClickBack(): void
    {    
        const toggle = this.tg_agreement.getComponent(Toggle)
        if(toggle){
        toggle.isChecked = false
        }
        switch (this._currentPage)
        {
            case 'delete':
                this.showPage('account');
                break;
            case 'verify':
                this.showPage('delete');
                break;
            case 'confirm':
                this.showPage('verify');
                break;
            default:
                this.hide();
                break;
        }
    }

    private loadPhoneNumber(): void
    {
        SocketManager.instance.sendDataWithCallback(SocketMSgId.UserLoginAccount, {}, (res) =>
        {
            if (res.code != 0)
            {
                ToastManager.ins.showToast(res.msg || '获取手机号失败');
                return;
            }
            const phone = res.login_account || '';
            var phoneView = phone.substring(0, 3) + '****' + phone.substring(phone.length - 4);
            console.log("phoneView", phoneView)
            this._phone = res.login_account
            if (this.lb_phone_value)
            {
                this.lb_phone_value.string = phoneView;
            }
            if (this.lb_phone)
            {
                if (phone.length >= 7)
                {
                    this.lb_phone.string = phoneView;
                }
                else
                {
                    this.lb_phone.string = phone;
                }
            }
        });
    }

    private onClickDeleteAccount(): void
    {
        this.showPage('delete');
    }

    private onClickAgreementLink(): void
    {
        showPrivacyPanel(AgreementUrl.DeleteAccount, AgreementType.DeleteAccount);
    }

    private onClickDeleteNext(): void
    {
        if (this.tg_agreement)
        {
            const toggle = this.tg_agreement.getComponent(Toggle) as any;
            if (toggle && !toggle.isChecked)
            {
                ToastManager.ins.showToast('请先阅读并勾选《逗号家族账号注销须知》');
                return;
            }
        }
        this.showPage('verify');
    }

    private setBtnGray(gray: boolean): void
    {
        if (!this.btn_get_code) return;
        const sp = this.btn_get_code.getComponent(Sprite);
        if (sp) sp.grayscale = gray;
    }

    private onClickGetCode(): void
    {
        if (this._countdown > 0) return;
        if(!this._phone ){
            ToastManager.ins.showToast("手机号码错误")
            return
        }
        DispatchEvent.ins.emit(EventType.ClickGetPhoneCode, { phone: this._phone, type:2 });
        
        this.startCountdown();
    }

    private startCountdown(): void
    {
        this._countdown = 59;
        this.setBtnGray(true);
        this.updateCountdownUI();
        this.schedule(this.onCountdownTick, 1);
    }

    private onCountdownTick(): void
    {
        this._countdown--;
        if (this._countdown <= 0)
        {
            this._countdown = 0;
            this.setBtnGray(false);
            this.unschedule(this.onCountdownTick);
        }
        this.updateCountdownUI();
    }

    private updateCountdownUI(): void
    {
        if (!this.lb_countdown) return;
        if (this._countdown > 0)
        {
            this.lb_countdown.string = '重新获取\n(' + this._countdown + 's)';
        }
        else
        {
            this.lb_countdown.string = '获取验证码';
        }
    }

    private onClickVerifyNext(): void
    {
        const code = this.edt_code?.string || '';
        if (code.length < 4)
        {
            ToastManager.ins.showToast('请输入4位验证码');
            return;
        }
        SocketManager.instance.sendDataWithCallback(SocketMSgId.CheckCode,{code_type:2,verify_code:this.edt_code?.string},(res)=>{
            if(res.code != 0){
                ToastManager.ins.showToast(res.msg ||"注销失败")
                return
            }
            this.showPage('confirm');
        })
    }

    private onEditingBegin(): void
    {
        if (this.lb_count) this.lb_count.node.active = true;
        this.updateCountLabel();
    }

    private onEditingEnd(): void
    {
        const text = this.edt_reason?.string || '';
        if (text.length === 0 && this.lb_count)
        {
            this.lb_count.node.active = false;
        }
    }

    private onTextChanged(): void
    {
        this.updateCountLabel();
        this.updateBtnState();
    }

    private updateCountLabel(): void
    {
        if (!this.lb_count) return;
        const text = this.edt_reason?.string || '';
        this.lb_count.string = text.length + '/200';
    }

    private updateBtnState(): void
    {
        const text = this.edt_reason?.string || '';
        const canConfirm = text.length >= 15;
        if (this.sp_btn_bg)
        {
            this.sp_btn_bg.grayscale = !canConfirm;
        }
    }

    private onClickConfirm(): void
    {
        const text = this.edt_reason?.string || '';
        if (text.length < 15) return;
        const code = this.edt_code?.string || '';

        SocketManager.instance.sendDataWithCallback(SocketMSgId.UserDel,{ reason:text,verify_code:code},(res)=>{
            if(res.code != 0){
                ToastManager.ins.showToast(res.msg ||"注销失败")
                return
            }
            ToastManager.ins.showToast('已进入15天注销反悔期，期间登录游戏即可取消。');
            this.scheduleOnce(() =>
            {
                MainController.ins.logout();
            }, 2);
        })

    }

    protected onDestroy(): void
    {
        SocketManager.instance.off('connect', this.onSocketConnected);
        this.unschedule(this.onCountdownTick);
    }
}