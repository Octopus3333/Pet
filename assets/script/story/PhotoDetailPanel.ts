import { _decorator, Component, Node, Sprite, Label, SpriteFrame } from 'cc';
import { UIManager } from '../common/utils/UIManager';
import { loadImg } from '../common/utils/UiTools';
import { Common } from '../common/utils/Define';
import { saveNodeImageToAlbum } from '../common/utils/UiTools';
import { SocketManager, SocketMSgId } from '../common/network/SocketManager';
import { ToastManager } from '../common/utils/ToastManager';

const { ccclass, property } = _decorator;

@ccclass('PhotoDetailPanel')
export class PhotoDetailPanel extends Component
{
    @property(Node)
    btn_back: Node = null;

    @property(Node)
    nd_photo: Node = null;

    @property(Sprite)
    sp_bg: Sprite = null;

    @property(Sprite)
    sp_pbg: Sprite = null;

    @property(Sprite)
    sp_fg: Sprite = null;

    @property(Sprite)
    sp_pose: Sprite = null;

    @property(Sprite)
    sp_emotion: Sprite = null;

    @property(Label)
    lb_name: Label = null;

    @property(Label)
    lb_date: Label = null;

    @property(Sprite)
    sp_quality: Sprite = null;

    @property(Label)
    lb_desc: Label = null;

    @property(Node)
    btn_save: Node = null;

    @property(Node)
    btn_share: Node = null;

    @property(Node)
    btn_prev: Node = null;

    @property(Node)
    btn_next: Node = null;

    @property([SpriteFrame])
    qualityFrames: SpriteFrame[] = [];

    private _currentUserPhotoId: number = 0;
    private _prevPhotoId: number = 0;
    private _nextPhotoId: number = 0;
    private _category: number = 0;
    private _initialIndex: number = 0;
    private _backCallback: (photoIndex: number) => void = null;
    private _isLoading: boolean = false;

    protected onLoad(): void
    {
        this.btn_back?.on(Node.EventType.TOUCH_END, this.onClickBack, this);
        this.btn_save?.on(Node.EventType.TOUCH_END, this.onClickSave, this);
        this.btn_prev?.on(Node.EventType.TOUCH_END, this.onClickPrev, this);
        this.btn_next?.on(Node.EventType.TOUCH_END, this.onClickNext, this);

        if (this.btn_share) this.btn_share.active = false;
    }

    public setData(
        userPhotoId: number,
        category: number,
        initialIndex: number
    ): void
    {
        this._currentUserPhotoId = userPhotoId;
        this._category = category;
        this._initialIndex = initialIndex;

        this.requestPhotoDetail(userPhotoId, category);
    }

    public setBackCallback(callback: (photoIndex: number) => void): void
    {
        this._backCallback = callback;
    }

    private requestPhotoDetail(userPhotoId: number, category: number): void
    {
        if (this._isLoading) return;
        this._isLoading = true;

        SocketManager.instance.sendDataWithCallback(
            SocketMSgId.PhotoDetail,
            { user_photo_id: userPhotoId, category },
            (resp, error) => {
                this._isLoading = false;
                if (error) {
                    console.error('[PhotoDetailPanel] PhotoDetail request error:', error);
                    return;
                }
                if (!resp) return;

                this._currentUserPhotoId = resp.user_photo_id;
                this._prevPhotoId = resp.prev_photo_id || 0;
                this._nextPhotoId = resp.next_photo_id || 0;
                this.loadDetail(resp);
            }
        );
    }

    private async loadDetail(data: any): Promise<void>
    {
        if (!data) return;

        this.clearAllLayers();
        await this.loadPhotoParts(data);
        this.renderDetail(data);
    }

    private clearAllLayers(): void
    {
        if (this.sp_pbg) this.sp_pbg.spriteFrame = null;
        if (this.sp_fg) this.sp_fg.spriteFrame = null;
        if (this.sp_pose) this.sp_pose.spriteFrame = null;
        if (this.sp_emotion) this.sp_emotion.spriteFrame = null;
    }

   private async loadPhotoParts(data: any): Promise<void>
    {
        const photoType = data.photo_type || 1;
        const SCALE_X = 558 / 1600;
        const SCALE_Y = 408 / 1200;

        if (photoType === 1) {
            if (this.sp_pbg && data.photo_filename) {
                const path = Common.texturePath + 'photo/' + data.photo_filename + '/spriteFrame';
                await loadImg(this.sp_pbg, path);
            }
            if (this.sp_fg) this.sp_fg.spriteFrame = null;
            if (this.sp_pose) this.sp_pose.spriteFrame = null;
            if (this.sp_emotion) this.sp_emotion.spriteFrame = null;
        } else {
            if (this.sp_pbg && data.bg_filename) {
                const path = Common.texturePath + 'photo/bg/' + data.bg_filename + '/spriteFrame';
                await loadImg(this.sp_pbg, path);
            }
            if (this.sp_fg && data.fg_filename) {
                const path = Common.texturePath + 'photo/fg/' + data.fg_filename + '/spriteFrame';
                await loadImg(this.sp_fg, path);
            }
            if (this.sp_pose && data.pose_filename) {
                const path = Common.texturePath + 'photo/pose/' + data.pose_filename + '/spriteFrame';
                await loadImg(this.sp_pose, path);
                if (data.pose_x != null) {
                    this.sp_pose.node.setPosition(data.pose_x * SCALE_X, -data.pose_y * SCALE_Y, 0);
                }
                this.sp_pose.node.setScale(SCALE_X, SCALE_Y, 1);
            }
            if (this.sp_emotion && data.emotion_filename) {
                const path = Common.texturePath + 'photo/emotion/' + data.emotion_filename + '/spriteFrame';
                await loadImg(this.sp_emotion, path);
                if (data.emotion_x != null) {
                    this.sp_emotion.node.setPosition(data.emotion_x * SCALE_X, -data.emotion_y * SCALE_Y, 0);
                }
                this.sp_emotion.node.setScale(SCALE_X, SCALE_Y, 1);
            }
        }
    }

    private renderDetail(data: any): void
    {
        if (!data) return;
        if (this.lb_name) this.lb_name.string = data.photo_name || '';
        if (this.lb_date) {
            if (data.obtain_time) {
                const date = new Date(data.obtain_time * 1000);
                const y = date.getFullYear();
                const m = date.getMonth() + 1;
                const d = date.getDate();
                this.lb_date.string = `${y}-${m < 10 ? '0' + m : m}-${d < 10 ? '0' + d : d}`;
            } else {
                this.lb_date.string = '';
            }
        }
        if (this.lb_desc) this.lb_desc.string = data.album_desc || '暂无简介';
        this.setQuality(data.rarity);
        this.updateArrows();
    }

    private setQuality(quality: number): void
    {
        if (!this.sp_quality) {
            return;
        }

        if (quality == null || quality < 1 || quality > 4) {
            this.sp_quality.node.active = false;
            return;
        }

        const frame = this.qualityFrames[quality - 1];
        if (frame) {
            this.sp_quality.node.active = true;
            this.sp_quality.spriteFrame = frame;
        } else {
            this.sp_quality.node.active = false;
        }
    }

    private updateArrows(): void
    {
        if (this.btn_prev) this.btn_prev.active = this._prevPhotoId > 0;
        if (this.btn_next) this.btn_next.active = this._nextPhotoId > 0;
    }

    private onClickPrev(): void
    {
        if (!this._prevPhotoId || this._isLoading) return;
        this.requestPhotoDetail(this._prevPhotoId, this._category);
    }

    private onClickNext(): void
    {
        if (!this._nextPhotoId || this._isLoading) return;
        this.requestPhotoDetail(this._nextPhotoId, this._category);
    }

    private async onClickSave(): Promise<void>
    {
        console.log('保存图片');
    
        try {
            const result = await saveNodeImageToAlbum(this.nd_photo);
            if (result.success) {
                console.log('保存成功');
                ToastManager.ins.showToast("已保存至系统相册")
                // 可以加个 Toast 提示
            } else {
                ToastManager.ins.showToast("保存失败")
                console.log('保存失败:', result.msg);
            }
        } catch (e) {
            console.error('保存异常:', e);
        }
    }

    private onClickBack(): void
    {
        UIManager.ins.hideView(this.node);
        if (this._backCallback) {
            this._backCallback(this._initialIndex);
        }
    }
}