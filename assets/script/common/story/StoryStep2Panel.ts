import { _decorator, Animation, Component, Node } from 'cc';
import { EventType } from '../utils/Define';
import { DispatchEvent } from '../utils/DispatchEvent';
import { DataManager } from '../../Data/DataManager';

const { ccclass, property } = _decorator;

/** Clip 4/5/6 分别对应猫/兔/狗，与 pet_type（1猫 2狗 3兔）一致 */
const PET_CLIP_BY_TYPE: Record<number, number> = {
    1: 4,
    3: 5,
    2: 6,
};

const COMMON_CLIP_COUNT = 4;

@ccclass('StoryStep2Panel')
export class StoryStep2Panel extends Component {
    @property(Node)
    nd_sprite: Node = null;

    @property
    normalSpeed = 1;

    @property
    fastSpeed = 4;

    private _animation: Animation = null;
    private _clipNames: string[] = [];
    /** 待播放的 Clip 下标序列，如猫：[0,1,2,3,4] */
    private _playQueue: number[] = [];
    private _clipIndex = 0;
    private _isAdvancing = false;
    private _waitClickNext = false;

    protected onLoad(): void {
        const target = this.nd_sprite ?? this.node.getChildByName('Sprite');
        this._animation = target?.getComponent(Animation) ?? null;
        if (!this._animation) {
            console.error('[StoryStep2Panel] 未找到 Sprite 上的 Animation 组件');
            return;
        }
        this._animation.stop();
        this.node.on(Node.EventType.TOUCH_END, this.onClick, this);
    }

    protected start(): void {
        if (!this._animation) return;

        this._clipNames = this._animation.clips.map((clip) => clip.name);
        if (this._clipNames.length === 0) {
            console.error('[StoryStep2Panel] Animation Clips 为空');
            DispatchEvent.ins.emit(EventType.StoryLoadFinish);
            DispatchEvent.ins.emit(EventType.StoryNext);
            return;
        }

        this._playQueue = this.buildPlayQueue();
        if (this._playQueue.length === 0) {
            console.error('[StoryStep2Panel] 播放序列为空');
            DispatchEvent.ins.emit(EventType.StoryLoadFinish);
            DispatchEvent.ins.emit(EventType.StoryNext);
            return;
        }

        this._animation.on(Animation.EventType.FINISHED, this.onClipFinished, this);
        DispatchEvent.ins.emit(EventType.StoryLoadFinish);
        this.playCurrentClip();
    }

    protected onDestroy(): void {
        this._animation?.off(Animation.EventType.FINISHED, this.onClipFinished, this);
    }

    /** 公共段 0~3 + 问卷结果对应的宠物段（4猫/5兔/6狗） */
    private buildPlayQueue(): number[] {
        const petType = DataManager.ins.getUserInfo()?.petType ?? 1;
        const petClip = PET_CLIP_BY_TYPE[petType] ?? PET_CLIP_BY_TYPE[1];
        const queue: number[] = [];

        for (let i = 0; i < COMMON_CLIP_COUNT && i < this._clipNames.length; i++) {
            queue.push(i);
        }
        if (petClip < this._clipNames.length) {
            queue.push(petClip);
        } else {
            console.warn('[StoryStep2Panel] 宠物 Clip 不存在, petType:', petType, 'clipIndex:', petClip);
        }

        console.log('[StoryStep2Panel] 播放序列:', queue.map((i) => this._clipNames[i]));
        return queue;
    }

    /**
     * 播放当前索引对应的 Animation Clip
     */
    private playCurrentClip(): void {
        if (this._clipIndex >= this._playQueue.length) {
            this.onAllClipsFinished();
            return;
        }

        const clipName = this._clipNames[this._playQueue[this._clipIndex]];
        this._animation.play(clipName);
        const state = this._animation.getState(clipName);
        if (state) {
            state.speed = this.normalSpeed;
        }
    }

    /**
     * 单个 Clip 播放完成，自动播放下一段
     */
    private onClipFinished = (): void => {
        if (this._isAdvancing) return;
        this._isAdvancing = true;
        this._clipIndex++;
        this._isAdvancing = false;
        this.playCurrentClip();
    };

    /**
     * 全部 Clip 播完，等待点击屏幕后进入 story 下一步
     */
    private onAllClipsFinished(): void {
        this._animation.off(Animation.EventType.FINISHED, this.onClipFinished, this);
        this._waitClickNext = true;
    }

    /**
     * 点击屏幕：播放中加速当前片段；全部播完后点击进入下一步
     */
    private onClick(): void {
        if (this._waitClickNext) {
            this._waitClickNext = false;
            DispatchEvent.ins.emit(EventType.StoryNext);
            return;
        }

        if (!this._animation || this._clipIndex >= this._playQueue.length) return;

        const clipName = this._clipNames[this._playQueue[this._clipIndex]];
        const state = this._animation.getState(clipName);
        if (!state || !state.isPlaying) return;

        state.speed = this.fastSpeed;
    }
}