import { _decorator, BlockInputEvents, Component, EventTouch, Node, Sprite, UITransform, Vec2, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('MaskPanel')
export class MaskPanel extends Component {
    private _hollowCenter: Vec2;
    private _hollowRadius: number;
    onLoad() {
        console.log("MaskPanel==========================")
        this.node.on(Node.EventType.TOUCH_START, this.onTouchMask, this);
        this.node.on(Node.EventType.TOUCH_END, this.onTouchMask, this);
    }
    private checkTouchHollow(point: Vec2, listener?: any): boolean {
        console.log("checkTouchHollow============")
        const dx = point.x - this._hollowCenter.x;
        const dy = point.y - this._hollowCenter.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        console.log("dx, dy", dx, dy, "dist", dist, this._hollowRadius)
        if (dist <= this._hollowRadius) {
            return true; // 镂空区域，触摸穿透
        }
        return false; // 非镂空区域，拦截触摸
    }
    onTouchMask(touch:EventTouch){
        console.log("ontouchMask========",touch)
        // 将触摸点转换到 nd_mask 本地坐标，与 _hollowCenter 坐标系一致
        const uiLoc = touch.getUILocation();
        const maskTransform = this.node.getComponent(UITransform);
        const localPos = maskTransform 
            ? maskTransform.convertToNodeSpaceAR(new Vec3(uiLoc.x, uiLoc.y, 0)) 
            : new Vec3(uiLoc.x, uiLoc.y, 0);
        var check = this.checkTouchHollow(new Vec2(localPos.x, localPos.y))
        // 2. 如果触摸点不在镂空区域（即需要拦截触摸），则添加 BlockInputEvents 组件
        console.log("check============",check)
        touch.preventSwallow = check
    }
        /**
     * 显示引导蒙版，在目标节点位置产生圆形镂空
     * @param targetNode 需要镂空的目标节点
     * @param padding 镂空区域额外留白（像素）
     */
    showGuideMask(targetNode: Node, padding: number = 10): void {
        if (!this.node) return;
        console.log("showMask")
        const maskTransform = this.node.getComponent(UITransform);
        if (!maskTransform) return;

        const maskSize = maskTransform.contentSize;
        const targetWorldPos = targetNode.getWorldPosition();
        const localPos = maskTransform.convertToNodeSpaceAR(targetWorldPos);
        const targetTransform = targetNode.getComponent(UITransform);
        const tw = targetTransform ? targetTransform.contentSize.width : 100;
        const th = targetTransform ? targetTransform.contentSize.height : 100;
        console.log("SIZE==========", maskSize, localPos)
        this._hollowCenter = localPos.toVec2()
        
        // 计算目标节点在 mask 坐标系下的 UV 百分比 (0,0 = 左下, 1,1 = 右上)
        const uvX = (localPos.x + maskSize.width / 2) / maskSize.width;
        const uvY = (localPos.y + maskSize.height / 2) / maskSize.height;

        // 取 targetNode 长宽最大值 + padding 作为半径，计算与 maskSize 的比例
        const maxDim = Math.max(tw, th) + padding * 2;
        this._hollowRadius = maxDim / 2; // 半径
        const radius = (maxDim / 2) / maskSize.width; // 归一化到 0~1 范围

        // 获取 mask 节点的 Sprite 材质并设置参数
        const sprite = this.node.getComponent(Sprite);
        console.log("sprite", sprite)
        if (sprite && sprite._customMaterial) {
            console.log("use Mask mat")
            const mat = sprite._customMaterial;
            console.log("uvX", uvX , "uvY", 1- uvY, "radius",radius)
            mat.setProperty("x", parseFloat(uvX.toFixed(3)));         // 圆心 X
            mat.setProperty("y", 1 - parseFloat(uvY.toFixed(3)));    
            mat.setProperty('radius', parseFloat(radius.toFixed(3)));
            var aspectRatio = parseFloat((this.node.getComponent(UITransform).contentSize.width/this.node.getComponent(UITransform).contentSize.height).toFixed(3));
            mat.setProperty('aspectRatio', aspectRatio);
            console.log("uvX", uvX, "uvY", uvY,"radius",radius, "aspectRatio", aspectRatio)
            
        }
    }

    update(deltaTime: number) {
        
    }
}


