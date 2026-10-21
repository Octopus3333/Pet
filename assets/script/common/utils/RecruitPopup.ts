import { _decorator, Component, EditBox, Label, Node } from 'cc';
import { UIManager } from './UIManager';
import { ViewPath } from './Define';

const { ccclass, property } = _decorator;

@ccclass('RecruitPopup')
export class RecruitPopup extends Component
{
    @property(Label)
    lb_title: Label = null;

    @property(EditBox)
    edt_input: EditBox = null;

    @property(Label)
    lb_tips: Label = null;

    @property(Node)
    btn_close: Node = null;

    @property(Node)
    btn_confirm: Node = null;

    private _placeholderLabel: Label = null;

    protected onLoad(): void
    {
        this.btn_close?.on(Node.EventType.TOUCH_END, this.onClickClose, this);
        this.btn_confirm?.on(Node.EventType.TOUCH_END, this.onClickConfirm, this);

        this.edt_input?.node.on('text-changed', this.onTextChanged, this);
        this.edt_input?.node.on('editing-did-began', this.onEditingBegin, this);
        this.edt_input?.node.on('editing-did-ended', this.onEditingEnd, this);

        this._placeholderLabel = this.edt_input?.node?.getChildByName('lb_placeholder')?.getComponent(Label);
    }

    show(title?: string, tips?: string): void
    {
        if (this.lb_title)
        {
            this.lb_title.string = title || '发布招募';
        }
        if (this.lb_tips)
        {
            this.lb_tips.string = tips || '组队的招募信息将会发布至「逗号手机」的「发现」页面，所有用户都可以加入散步队伍。';
        }
        this.edt_input.string = '';
        this._showPlaceholder();
        this.node.active = true;
    }

    hide(): void
    {
        this.node.active = false;
    }

    private _showPlaceholder(): void
    {
        if (this._placeholderLabel)
        {
            this._placeholderLabel.node.active = true;
        }
    }

    private _hidePlaceholder(): void
    {
        if (this._placeholderLabel)
        {
            this._placeholderLabel.node.active = false;
        }
    }

    private onEditingBegin(): void
    {
        this._hidePlaceholder();
    }

    private onEditingEnd(): void
    {
        if (!this.edt_input || this.edt_input.string.length === 0)
        {
            this._showPlaceholder();
        }
    }

    private onTextChanged(): void
    {
        if (this.edt_input && this.edt_input.string.length > 0)
        {
            this._hidePlaceholder();
        }
        else
        {
            this._showPlaceholder();
        }
    }

    private onClickClose(): void
    {
        this.hide();
    }

    private onClickConfirm(): void
    {
        this.hide();
    }

    protected onDestroy(): void
    {
        this.btn_close?.off(Node.EventType.TOUCH_END, this.onClickClose, this);
        this.btn_confirm?.off(Node.EventType.TOUCH_END, this.onClickConfirm, this);
        this.edt_input?.node?.off('text-changed', this.onTextChanged, this);
        this.edt_input?.node?.off('editing-did-began', this.onEditingBegin, this);
        this.edt_input?.node?.off('editing-did-ended', this.onEditingEnd, this);
    }
}