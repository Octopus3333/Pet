import { _decorator, Component, Label, Node } from 'cc';
import { UIManager } from '../common/utils/UIManager';
import { ViewPath, EventType, AgreementUrl, AgreementType } from '../common/utils/Define';
import { DataManager } from '../Data/DataManager';
import { DispatchEvent } from '../common/utils/DispatchEvent';
import { loadImg, showPrivacyPanel } from '../common/utils/UiTools';
import { addHeadPb } from '../common/utils/UiTools';

const { ccclass, property } = _decorator;

@ccclass('SettingPanel')
export class SettingPanel extends Component
{
    @property(Node)
    btn_back: Node = null;

    @property(Node)
    nd_main: Node = null;

    @property(Node)
    nd_avatar_area: Node = null;

    @property(Label)
    lb_nickname: Label = null;

    @property(Node)
    btn_account_setting: Node = null;

    @property(Node)
    btn_help: Node = null;

    @property(Node)
    btn_about: Node = null;

    @property(Node)
    btn_logout: Node = null;

    @property(Label)
    lb_user_agreement: Label = null;

    @property(Label)
    lb_privacy_agreement: Label = null;

    @property(Node)
    nd_about: Node = null;

    protected onLoad(): void
    {
        this.btn_back?.on(Node.EventType.TOUCH_END, this.onClickBack, this);
        this.btn_account_setting?.on(Node.EventType.TOUCH_END, this.onClickAccountSetting, this);
        this.btn_help?.on(Node.EventType.TOUCH_END, this.onClickHelp, this);
        this.btn_about?.on(Node.EventType.TOUCH_END, this.onClickAbout, this);
        this.btn_logout?.on(Node.EventType.TOUCH_END, this.onClickLogout, this);
        this.lb_user_agreement?.node?.on(Node.EventType.TOUCH_END, this.onClickUserAgreement, this);
        this.lb_privacy_agreement?.node?.on(Node.EventType.TOUCH_END, this.onClickPrivacyAgreement, this);
    }

    show(): void
    {
        this.node.active = true;
    }

    hide(): void
    {
        this.node.active = false;
    }

    protected onEnable(): void
    {
        this.showMain();
        this.refreshUserInfo();
    }

    private refreshUserInfo(): void
    {
        const userInfo = DataManager.ins.getUserInfo();
        if (!userInfo)
        {
            return;
        }

        if (this.lb_nickname)
        {
            this.lb_nickname.string = userInfo.nickname || '';
        }

        this.refreshAvatar(userInfo);
    }

    private refreshAvatar(userInfo: NonNullable<ReturnType<typeof DataManager.ins.getUserInfo>>): void
    {
        const avatarArea = this.nd_avatar_area ?? this.nd_main?.getChildByName('nd_avatar_area');
        if (!avatarArea)
        {
            return;
        }

        avatarArea.removeAllChildren();
        addHeadPb(avatarArea, {
            head_img: userInfo.headImg,
            pet_type: userInfo.petType,
            color: userInfo.color,
        },2.5);
    }

    private showMain(): void
    {
        if (this.nd_main) this.nd_main.active = true;
        if (this.nd_about) this.nd_about.active = false;
    }

    private onClickBack(): void
    {
        if (this.nd_about && this.nd_about.active)
        {
            this.showMain();
            return;
        }
        this.hide();
    }

    private onClickAccountSetting(): void
    {
        UIManager.ins.show(ViewPath.AccountPanel);
    }

    private onClickHelp(): void
    {
        UIManager.ins.show(ViewPath.FeedbackPanel);
    }

    private onClickAbout(): void
    {
        if (this.nd_main) this.nd_main.active = false;
        if (this.nd_about) this.nd_about.active = true;
    }

    private onClickLogout(): void
    {
        DispatchEvent.ins.emit(EventType.LoginOut);
    }

    private onClickUserAgreement(): void
    {
        showPrivacyPanel(AgreementUrl.User, AgreementType.User);
        UIManager.ins.show(ViewPath.UserAgreementPanel);
    }

    private onClickPrivacyAgreement(): void
    {
        showPrivacyPanel(AgreementUrl.Privacy, AgreementType.Privacy);
    }
}