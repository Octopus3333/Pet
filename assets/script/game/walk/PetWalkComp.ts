import { _decorator, Component, sp } from 'cc';
import { WalkUser } from '../../common/utils/InterfaceDefine';
import { ResLoader } from '../../common/download/ResLoader';
import { ColorSkin, Common } from '../../common/utils/Define';

const { ccclass, property } = _decorator;

@ccclass('PetWalkComp')
export class PetWalkComp extends Component {
    private _data: WalkUser = null;
    private _isClean100: boolean = false;
    private _loaded: boolean = false;

    skeleton: sp.Skeleton = null;

    /**
     * 加载散步宠物数据
     * @param data WalkUser数据结构，需包含pet_type、color、clean字段，可选isclean100字段
     */
    async load(data: WalkUser): Promise<void> {
        this._data = data;
        // 通过clean值判断是否达到clean100，优先使用显式的isclean100字段
        this._isClean100 = (data as any).reach_clean100 ?? (data.clean >= 100);

        await this._loadSkeleton();
        this._loaded = true;
        // 默认播放sit特效
        this.playSit();
    }

    /**
     * 播放sit特效（待机）
     */
    playSit(): void {
        if (!this.skeleton) return;
        this.skeleton.setAnimation(0, 'sit', true);
    }

    /**
     * 播放sanbu特效（散步）
     */
    playSanbu(): void {
        if (!this.skeleton) return;
        this.skeleton.setAnimation(0, 'sanbu', true);
    }

    /**
     * 切换为sit特效（walkMain暂停或未开始时调用）
     */
    switchToSit(): void {
        this.playSit();
    }

    /**
     * 切换为sanbu特效（walkMain run时调用）
     */
    switchToSanbu(): void {
        this.playSanbu();
    }

    private async _loadSkeleton(): Promise<void> {
        if (!this._data) return;

        this.skeleton = this.node.getComponent(sp.Skeleton);
        if (!this.skeleton) return;

        const petType = this._data.pet_type;
        // 路径规则: cemian_{pet_type} 或 cemian_{pet_type}_grey
        const skelName = 'cemian_' + petType + (this._isClean100 ? '' : '_grey');
        const path = Common.AnimaPath + 'petAnima/cemian/' + skelName;

        try {
            const res = await ResLoader.ins.loadResAsync(path, sp.SkeletonData);
            if (!res) {
                console.error('[PetWalkComp] 加载骨骼失败:', path);
                return;
            }
            this.skeleton.skeletonData = res;
            this.skeleton.loop = true;

            // 设置花色皮肤
            var color = this._data.color - 1;
            color = color > 0 ? color:1

            const colorSkin = ColorSkin[petType] && ColorSkin[petType][color];
            console.log("colorSkin", colorSkin, petType, color)
            if (colorSkin) {
                this.skeleton.setSkin(colorSkin);
            }
        } catch (err) {
            console.error('[PetWalkComp] 加载骨骼异常:', err);
        }
    }
}
