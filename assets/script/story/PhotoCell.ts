import { _decorator, Component, Sprite, Label, SpriteFrame, Node, Button } from 'cc';
import { Common } from '../common/utils/Define';
import { loadImg } from '../common/utils/UiTools';
import { PhotoConfigManager } from './PhotoConfigManager';
const { ccclass, property } = _decorator;

export enum PhotoQuality
{
    NORMAL = 0,
    RARE = 1,
    EPIC = 2,
    LEGENDARY = 3
}

@ccclass('PhotoCell')
export class PhotoCell extends Component
{
    @property(Sprite)
    sp_bg: Sprite = null!;

    @property(Sprite)
    sp_pbg: Sprite = null!;

    @property(Sprite)
    sp_fg: Sprite = null!;

    @property(Sprite)
    sp_pose: Sprite = null!;

    @property(Sprite)
    sp_emotion: Sprite = null!;

    @property(Label)
    lb_name: Label = null!;

    @property(Label)
    lb_date: Label = null!;

    @property(Sprite)
    sp_pz: Sprite = null!;

    @property(Button)
    btn_click: Button = null!;

    @property([SpriteFrame])
    qualityFrames: SpriteFrame[] = [];

    @property(SpriteFrame)
    defaultBg: SpriteFrame = null;

    private _currentData: any = null;
    private _clickCallback: (data: any, index: number) => void = null;
    private _cellIndex: number = 0;

    protected onLoad(): void
    {
        if (this.sp_bg) this.sp_bg.spriteFrame = null;
        if (this.sp_pbg) this.sp_pbg.spriteFrame = null;
        if (this.sp_fg) this.sp_fg.spriteFrame = null;
        if (this.sp_pose) this.sp_pose.spriteFrame = null;
        if (this.sp_emotion) this.sp_emotion.spriteFrame = null;
        if (this.lb_name) this.lb_name.string = '';
        if (this.lb_date) this.lb_date.string = '';
        if (this.sp_pz) this.sp_pz.spriteFrame = null;

        if (this.btn_click)
        {
            this.btn_click.node.on(Button.EventType.CLICK, this.onCellClick, this);
        }
    }

    public setClickCallback(callback: (data: any, index: number) => void, index: number): void
    {
        this._clickCallback = callback;
        this._cellIndex = index;
    }

    private onCellClick(): void
    {
        if (this._clickCallback)
        {
            this._clickCallback(this._currentData, this._cellIndex);
        }
        else
        {
            console.log('_clickCallback 为空');
        }
    }

    public clearDisplay(): void
    {
        if (this.sp_bg) {
            this.sp_bg.spriteFrame = this.defaultBg;
            this.sp_bg.node.active = true;
        }
        if (this.sp_pbg) this.sp_pbg.spriteFrame = null;
        if (this.sp_fg) this.sp_fg.spriteFrame = null;
        if (this.sp_pose) this.sp_pose.spriteFrame = null;
        if (this.sp_emotion) this.sp_emotion.spriteFrame = null;
        if (this.lb_name) this.lb_name.string = '';
        if (this.lb_date) this.lb_date.string = '';
        if (this.sp_pz) this.sp_pz.spriteFrame = null;
    }

    public async loadData(data: any): Promise<void>
    {
        if (!data) return;
        this._currentData = data;

        // 背景框
        if (this.sp_bg) {
            this.sp_bg.spriteFrame = this.defaultBg;
            this.sp_bg.node.active = true;
        }

        // 加载照片
        const fullData = PhotoConfigManager.ins.getPhotoData(data.photo_id, data.photo_variant_id);
        console.log('[PhotoCell] photo_id:', data.photo_id, 'photo_variant_id:', data.photo_variant_id);
        console.log('[PhotoCell] fullData:', JSON.stringify(fullData));
        if (fullData) {
            console.log('[PhotoCell] fullData.photo_type:', fullData.photo_type);
            console.log('[PhotoCell] fullData.photo_filename:', fullData.photo_filename);
            console.log('[PhotoCell] fullData.bg_filename:', fullData.bg_filename);

            // ★ 名称（从 JSON1）
            if (this.lb_name) this.lb_name.string = fullData.photo_name || '';

            // ★ 日期（从后端 Mock 数据）
            if (this.lb_date) {
                this.lb_date.string = this.formatTime(data.obtain_time);
            }

            // ★ 品质（从 JSON1）
            this.setQuality(fullData.rarity);

            await this.loadPhotoParts(fullData);
        } else {
            console.warn('[PhotoCell] getPhotoData 返回 null! photo_id=' + data.photo_id + ', variant_id=' + data.photo_variant_id);
            console.warn('[PhotoCell] PhotoConfigManager 已加载:', PhotoConfigManager.ins.isLoaded);
        }
    }

  private async loadPhotoParts(data: any): Promise<void>
    {
        const photoType = data.photo_type || 1;
        const SCALE_X = 280 / 1600;
        const SCALE_Y = 216 / 1200;

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


    private setQuality(quality: number): void
    {
        if (!this.sp_pz) return;
        if (quality == null || quality < 1 || quality > 4)
        {
            this.sp_pz.spriteFrame = null;
            return;
        }
        this.sp_pz.spriteFrame = this.qualityFrames[quality - 1] || null;
    }

    private formatTime(timestamp: number): string
    {
        if (!timestamp) return '';
        const date = new Date(timestamp * 1000);
        const y = date.getFullYear();
        const m = date.getMonth() + 1;
        const d = date.getDate();
        return `${y}-${m < 10 ? '0' + m : m}-${d < 10 ? '0' + d : d}`;
    }
}