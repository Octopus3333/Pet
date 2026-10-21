import { _decorator, Node, Prefab, instantiate, director } from 'cc';
import { ResLoader } from '../download/ResLoader';
import { ViewPath } from './Define';

const { ccclass } = _decorator;

@ccclass('WaitingManager')
export class WaitingManager {
    private static _ins: WaitingManager = null!;

    private _node: Node = null;
    private _loading = false;

    static get ins(): WaitingManager {
        if (!WaitingManager._ins) {
            WaitingManager._ins = new WaitingManager();
        }
        return WaitingManager._ins;
    }

    private constructor() { }

    /**
     * 显示 waiting 界面，已存在则直接置顶显示
     * @param hideMask 是否隐藏遮罩层（sp_mask），默认 false 显示遮罩
     */
    public async show(hideMask: boolean = false): Promise<void> {
        if (this._loading) return;
        if (this._node && this._node.isValid) {
            this._node.active = true;
            this._node.setSiblingIndex(99999);
            this._updateMaskVisibility(hideMask);
            return;
        }

        this._loading = true;
        try {
            const prefab = await ResLoader.ins.loadResAsync(ViewPath.Waiting, Prefab);
            if (!prefab) {
                console.warn('[WaitingManager] prefab load failed:', ViewPath.Waiting);
                return;
            }
            this._node = instantiate(prefab);
            const canvas = director.getScene()?.getChildByName('Canvas');
            if (canvas) {
                this._node.parent = canvas;
                this._node.setSiblingIndex(99999);
            } else {
                console.warn('[WaitingManager] Canvas not found in current scene');
            }
            this._updateMaskVisibility(hideMask);
        } catch (error) {
            console.error('[WaitingManager] show error:', error);
        } finally {
            this._loading = false;
        }
    }

    /**
     * 更新遮罩层的可见性
     */
    private _updateMaskVisibility(hide: boolean): void {
        if (!this._node || !this._node.isValid) return;
        const maskNode = this._node.getChildByName('sp_mask');
        if (maskNode && maskNode.isValid) {
            console.log("updateMaskVisibility", hide)
            maskNode.active = !hide;
        }
    }

    /**
     * 隐藏 waiting 界面（不销毁，下次 show 复用）
     */
    public hide(): void {
        if (this._node && this._node.isValid) {
            this._node.active = false;
        }
    }

    /**
     * 销毁 waiting 界面
     */
    public destroy(): void {
        if (this._node && this._node.isValid) {
            this._node.destroy();
        }
        this._node = null;
    }

    /**
     * 当前是否处于显示状态
     */
    public get isShowing(): boolean {
        return this._node !== null && this._node.isValid && this._node.active;
    }
}
