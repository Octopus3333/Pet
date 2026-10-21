import { _decorator, BlockInputEvents, Component, EditBox, Label, Node, instantiate, ScrollView, UITransform, Button } from 'cc';
import { UIManager } from '../common/utils/UIManager';
import { ViewPath } from '../common/utils/Define';
import { ConfirmPopup } from '../common/utils/ConfirmPopup';
import { ToastManager } from '../common/utils/ToastManager';
import { SocketManager, SocketMSgId } from '../common/network/SocketManager';

const { ccclass, property } = _decorator;

@ccclass('FeedbackPanel')
export class FeedbackPanel extends Component
{
    @property(Node)
    btn_back: Node = null;

    @property(EditBox)
    edt_content: EditBox = null;

    @property(Label)
    lb_count: Label = null;

    @property(Node)
    nd_image_area: Node = null;

    @property(Node)
    img_template: Node = null;

    @property(Node)
    btn_add: Node = null;

    @property(EditBox)
    edt_email: EditBox = null;

    @property(Node)
    btn_submit: Node = null;

    @property(ScrollView)
    sv_content: ScrollView = null;

    private _images: Node[] = [];
    private _isEditing: boolean = false;
    private _viewHeight: number = 400;

    protected onLoad(): void
    {
        let block = this.node.getComponent(BlockInputEvents);
        if (!block)
        {
            this.node.addComponent(BlockInputEvents);
        }

        if (this.img_template)
        {
            this.img_template.active = false;
        }

        if (this.sv_content)
        {
            const viewTrans = this.sv_content.node.getComponent(UITransform);
            this._viewHeight = viewTrans ? viewTrans.height : 400;
        }

        this.btn_back?.on(Node.EventType.TOUCH_END, this.onClickBack, this);
        this.btn_add?.on(Node.EventType.TOUCH_END, this.onClickAddImage, this);
        this.btn_submit?.on(Node.EventType.TOUCH_END, this.onClickSubmit, this);
        this.edt_content?.node?.on('text-changed', this.onContentChanged, this);

        this.edt_content?.node?.on('editing-did-began', () => {
            this._isEditing = true;
            const edtTrans = this.edt_content.node.getComponent(UITransform);
            if (edtTrans) edtTrans.height = this._viewHeight;
            if (this.sv_content)
            {
                this.sv_content.vertical = false;
                if (this.sv_content.content)
                {
                    const contentTrans = this.sv_content.content.getComponent(UITransform);
                    if (contentTrans) contentTrans.height = this._viewHeight;
                }
                this.sv_content.scrollToTop();
            }
        });

        this.edt_content?.node?.on('editing-did-ended', () => {
            this._isEditing = false;
            this.expandContentHeight();
            if (this.sv_content)
            {
                this.sv_content.vertical = true;
                this.sv_content.scrollToTop();
            }
        });
    }

    private onContentChanged(): void
    {
        this.updateCountLabel();
    }

    private expandContentHeight(): void
    {
        if (!this.edt_content) return;

        const textLabel = this.edt_content.node.getChildByName('TEXT_LABEL');
        if (!textLabel) return;

        const label = textLabel.getComponent(Label);
        if (!label) return;

        const text = label.string || '';

        let newHeight: number;
        if (text.length === 0)
        {
            newHeight = this._viewHeight;
        }
        else
        {
            const lineHeight = label.lineHeight || 34;
            const edtWidth = this.edt_content.node.getComponent(UITransform)?.width || 500;
            const usableWidth = edtWidth - 30;

            let totalLines = 0;
            const lines = text.split('\n');
            for (const line of lines)
            {
                if (line.length === 0)
                {
                    totalLines += 1;
                }
                else
                {
                    let lineWidth = 0;
                    for (const char of line)
                    {
                        lineWidth += (char.charCodeAt(0) > 127) ? 24 : 13;
                    }
                    totalLines += Math.max(1, Math.ceil(lineWidth / usableWidth));
                }
            }
            newHeight = Math.max(totalLines * lineHeight, this._viewHeight);
        }

        const edtTrans = this.edt_content.node.getComponent(UITransform);
        if (edtTrans) edtTrans.height = newHeight;

        if (this.sv_content && this.sv_content.content)
        {
            const contentTrans = this.sv_content.content.getComponent(UITransform);
            if (contentTrans) contentTrans.height = newHeight;
        }
    }

    show(): void
    {
        this.edt_content.string = '';
        this.edt_email.string = '';
        this.clearImages();
        this.updateCountLabel();
        this._isEditing = false;

        const edtTrans = this.edt_content.node.getComponent(UITransform);
        if (edtTrans) edtTrans.height = this._viewHeight;
        if (this.sv_content && this.sv_content.content)
        {
            const contentTrans = this.sv_content.content.getComponent(UITransform);
            if (contentTrans) contentTrans.height = this._viewHeight;
        }

        this.node.active = true;
    }

    hide(): void
    {
        if (this.edt_content) this.edt_content.string = '';
        if (this.edt_email) this.edt_email.string = '';
        this.clearImages();
        this.updateCountLabel();
        this._isEditing = false;
        this.node.active = false;
    }

    private updateCountLabel(): void
    {
        if (!this.lb_count) return;
        const text = this.edt_content?.string || '';
        this.lb_count.string = text.length + '/500';
    }

    private clearImages(): void
    {
        for (const img of this._images)
        {
            if (img && img.isValid)
            {
                img.removeFromParent();
                img.destroy();
            }
        }
        this._images = [];
        if (this.btn_add) this.btn_add.active = true;
    }

    private onDeleteImage(imgNode: Node): void
    {
        if (!imgNode || !imgNode.isValid) return;

        const index = this._images.indexOf(imgNode);
        if (index >= 0) this._images.splice(index, 1);

        imgNode.removeFromParent();
        imgNode.destroy();

        if (this.btn_add) this.btn_add.active = this._images.length < 4;
    }

    private onClickBack(): void
    {
        const hasText = (this.edt_content?.string || '').length > 0;
        const hasEmail = (this.edt_email?.string || '').length > 0;
        if (hasText || hasEmail || this._images.length > 0)
        {
            this.showLeaveConfirm();
        }
        else
        {
            this.hide();
        }
    }

    private async showLeaveConfirm(): Promise<void>
    {
        const node = await UIManager.ins.show(ViewPath.ConfirmPopup);
        const popup = node?.getComponent(ConfirmPopup);
        if (popup)
        {
            popup.show({
                title: '确定要离开吗？',
                message: '离开后，您填写的内容将不会保存。',
                confirmText: '离开',
                cancelText: '取消',
                onConfirm: () => { this.hide(); },
            });
        }
    }

    private onClickAddImage(): void
    {
        if (this._images.length >= 4 || !this.img_template || !this.nd_image_area) return;

        const newImg = instantiate(this.img_template);
        newImg.active = true;
        newImg.parent = this.nd_image_area;

        const addIndex = this.nd_image_area.children.indexOf(this.btn_add);
        if (addIndex >= 0) newImg.setSiblingIndex(addIndex);

        // 绑定删除按钮
        const btnDelete = newImg.getChildByName('btn_delete');
        if (btnDelete)
        {
            const btn = btnDelete.getComponent(Button) || btnDelete.addComponent(Button);
            btn.node.on(Button.EventType.CLICK, () => {
                this.onDeleteImage(newImg);
            }, this);
        }

        this._images.push(newImg);
        if (this._images.length >= 4 && this.btn_add) this.btn_add.active = false;
    }

    private onClickSubmit(): void
    {
        const content = this.edt_content?.string || '';
        if (content.length === 0)
        {
            ToastManager.ins.showToast('请输入反馈内容');
            return;
        }
        SocketManager.instance.sendDataWithCallback(SocketMSgId.FeedbackSend,{
            // feedback_type:
            // sub_type
            content:content
            // mobile
            // email
            // pic_list
        },(res)=>{
            if(res.code != 0){
                ToastManager.ins.showToast(res.msg || "网络异常，反馈失败")
                return
            }
            ToastManager.ins.showToast('感谢反馈');
            this.hide();
        })

    }
}