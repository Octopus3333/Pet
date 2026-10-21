import { ResLoader } from "../download/ResLoader";
import { Button, Camera, Color, director, Director, instantiate, Label, Overflow, Prefab, Node, Rect, RenderTexture, Sprite, SpriteFrame, Texture2D, UITransform, sys, sp, view, Vec3 } from "cc";
import { Common, ViewPath } from "./Define";
import { UiToast } from "./UiToast";
import { Item } from "../components/Item";
import { UIManager } from "./UIManager";
import { GetRewardsLayer } from "../components/GetRewardsLayer";
import { DataManager } from "../../Data/DataManager";
import { ItemConfigManager } from "../../item/ItemConfigManager";
import { UserInfo } from "./InterfaceDefine";
import { HeadComp } from "../components/HeadComp";
import { PrivacyPanel } from "../components/PrivacyPanel";
import { AlbumSaver, SaveImageResult } from "../native/AlbumSaver";

export async function createPrefab(prefabPath){
    try {
        var res = await ResLoader.ins.loadResAsync(prefabPath,Prefab)
        var pb = instantiate(res)
        return pb
    } catch (error) {
        console.error("createPrefab erro", error)
    }
}
export async function addPrefab(prefabPath, node?){
    var pb = await createPrefab(prefabPath)
    if(!node){
        pb.parent = director.getScene()?.getChildByName("Canvas")
        
    }else{
        pb.parent = node
    }
    return pb
}
export function setBtnEnable(btn:Button, bool:boolean){
    if(!btn)return
    btn.interactable = bool
    var sp = btn?.getComponent(Sprite)
    if(!sp)return
    sp.grayscale = !bool
}
export async function loadItem(sp, item_id){
    if(!sp)return
    var path = Common.texturePath + "items/item_" + item_id + "/spriteFrame"
    await loadImg(sp, path)
}
export async function  getItemSpf(item_id):Promise<SpriteFrame> {
    var path = Common.texturePath + "items/item_" + item_id + "/spriteFrame"
    var spf = await ResLoader.ins.loadResAsync(path,SpriteFrame)
    return spf
}
export async function loadItemQuality(sp, item_id) {
    if(!sp)return
    var quality = ItemConfigManager.ins.getQuality(item_id)||1
    var path = Common.texturePath + "quality/quality_" + quality + "/spriteFrame"
    console.log("path", path)
    try {
        await loadImg(sp, path)
    } catch (error) {
        console.log("erro======",error)
        await loadImg(sp,  Common.texturePath + "quality/quality_1/spriteFrame")

    }
}
export function fitSpWithWithLabelStr(str:string, lb:Label, sp:Node , paddingWidth, paddingHeight){
        lb.string = str
        lb.updateRenderData(true)
        if(!lb) return
        var trans = lb.node.getComponent(UITransform)||lb.node.addComponent(UITransform)
        if(trans.width > 700){
            trans.width = 700
            lb.overflow = Overflow.RESIZE_HEIGHT
        }else{
            lb.overflow = Overflow.NONE
        }
        if(!this.nd_bg)return
        lb.updateRenderData(true)
        var bgTrans = sp.getComponent(UITransform)||sp.addComponent(UITransform)
        bgTrans.width = trans.width + paddingWidth 
        bgTrans.height = trans.height + paddingHeight
}
export async function loadImg(sp, path){
    if(!sp || !path || !sp.isValid){
        return 
    }
    try {
        var spf = await ResLoader.ins.loadResAsync(path,SpriteFrame)
        if (!sp.isValid) return
        sp.node.active = true
        sp.spriteFrame = spf
    } catch (error) {
        console.log("errrooo",error)
        if (sp.isValid) sp.node.active = false
    }
}
export async function popupRewardsLayer(rewards) {
    var popUp = await UIManager.ins.show(ViewPath.GetRewardsLayer)
    var rewardsLayer = popUp.getComponent(GetRewardsLayer)
    rewardsLayer.loadDatas(rewards)
}

/**
 * 显示协议面板（公用接口）
 * @param url 协议页面URL
 * @param type 协议类型：1-用户协议，2-隐私协议，3-注销须知
 */
export async function showPrivacyPanel(url: string, type: number) {
    const nameMap = { 1: '用户协议', 2: '隐私政策', 3: '注销须知' };
    const name = nameMap[type] || '协议';
    const popUp = await UIManager.ins.show(ViewPath.UserAgreementPanel);
    const privacyPanel = popUp.getComponent(PrivacyPanel);
    if (privacyPanel) {
        privacyPanel.show(url, null, name);
    }
}
export async function createItem(item_id, num) {
    var item = await createPrefab(Common.prefabPath+"common/Item")
    var comp = item.getComponent(Item)
    comp.setData(item_id, num)
    return item
}
export async function addHeadPb(node, userData, scale = 1){
    console.log("addHeadPb", node, userData )
    if(!userData)return
    try {
        var pb = await createPrefab(Common.prefabPath + "common/HeadPrefab")
        if(!pb)return
        var headComp = pb.getComponent(HeadComp)            
        headComp.setData(userData)
        pb.parent = node   
        pb.scale = new Vec3(scale, scale, scale)
    } catch (error) {
        console.log("create HeadErro", error)
    }

}
export function isObjEqual(a: any, b: any): boolean {
    // 基础类型/null/undefined 直接对比
    if(!a ||!b) return false
    if (a === b) return true;
    // 其中一个不是对象，直接不等
    if (typeof a !== 'object' || typeof b !== 'object') return false;

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    // 属性数量不一致
    if (keysA.length !== keysB.length) return false;

    // 逐个属性对比
    for (const key of keysA) {
        if (a[key] !== b[key]) return false;
    }
    return true;
}
export async function loadAvatar(sp:Sprite, path?: string) {
    if(sys.isBrowser)return
    if (!sp) return;
    if (!path) {
        return;
    }

    await ResLoader.ins.loadRemoteImageAsync(path)
        .then((sf) => {
            // 版本检查：防止复用后旧请求覆盖新数据
            if (sp && sp.isValid) {
                sp.spriteFrame = sf;
            }
        })
        .catch((err) => {
            console.warn('[ChatObjCell] Load avatar failed:', path, err);
            if (sp && sp.isValid) {
                sp.spriteFrame = null;
            }
        });
}
export  function getMoneyStr():{pink:string, gold:string}{
    var userInfo = DataManager.ins.getUserInfo()
    var result = {} as {pink:string, gold:string}
    result.pink = userInfo.pink > 999999? 999999+"+":String(userInfo.pink)
    result.gold = userInfo.gold > 999999? 999999+"+":String(userInfo.gold)
    return result
}

export async function changeBone(spine:sp.Skeleton, boneName:string, path){
	if(!spine ){
		console.warn("changeBone 参数无效")
		return
	}
	// try {
	// 	var spf = await ResLoader.ins.loadResAsync(path,SpriteFrame)
	// 	var nd = new Node()
	// 	var spr = nd.addComponent(Sprite)
	// 	spr.spriteFrame = spf
	// 	var socket = new sp.SpineSocket("root/bone/brush", this.attachNode); // 第一个参数传入的是挂点的目标骨骼。第二个参数传入的是挂点的节点
	// 	this.skeleton!.sockets.push(socket);
	// 	this.skeleton!.sockets = this.skeleton!.sockets;
	// } catch (error) {
	// 	console.log("error", error)
	// }

}

// ============================================================================
// 节点截图 / 保存到相册
// ============================================================================

/** captureNodeToImage 选项 */
export interface CaptureNodeOptions {
    /** 长边像素上限，默认 2048（Cocos 引擎 RenderTexture 单边上限） */
    maxSize?: number;
    /** 像素倍率，默认取设备像素比（保证清晰度） */
    pixelRatio?: number;
    /** 渲染等待帧数，默认 2（保证目标纹理已写入完成） */
    waitFrames?: number;
}

/** captureNodeToImage 返回结果 */
export interface CaptureNodeResult {
    /** 渲染贴图；不再使用时请调用 texture.destroy() 释放 */
    texture: RenderTexture;
    /** 可直接赋给 Sprite.spriteFrame 用于预览 */
    spriteFrame: SpriteFrame;
    /** 像素宽度 */
    width: number;
    /** 像素高度 */
    height: number;
    /** RGBA8888 像素数据（已翻转为顶到底行序，便于保存到相册） */
    pixels: Uint8Array;
}

/** 离屏渲染用的独立 layer（用户自定义层 bit 19，与 UI_2D 等内置层隔离） */
const CAPTURE_LAYER = 1 << 19;

/**
 * 把节点（含所有子节点，例如 n 个 sprite 拼成的一张图）渲染为一张图片。
 *
 * 原理：临时把目标子树切换到独立 layer，用一个正交离屏相机渲染到 RenderTexture，
 * 再 readPixels 读出像素。这样不会把屏幕上其它重叠 UI 一并截进去。
 *
 * @param node 目标节点（其子树构成最终图片）
 * @param options 捕获选项
 */
export async function captureNodeToImage(
    node: Node,
    options?: CaptureNodeOptions
): Promise<CaptureNodeResult> {
    if (!node || !node.isValid) {
        throw new Error('[UiTools] captureNodeToImage: 节点无效');
    }

    const maxSize = Math.min(2048, Math.max(1, options?.maxSize ?? 2048));
    const pixelRatio = options?.pixelRatio ?? (view.getDevicePixelRatio?.() || 1);
    const waitFrameCount = Math.max(1, options?.waitFrames ?? 2);

    // 1. 计算节点子树的世界包围盒（取所有 UITransform 的并集）
    const box = computeWorldBoundingBox(node);
    if (box.width <= 0 || box.height <= 0) {
        throw new Error('[UiTools] captureNodeToImage: 节点包围盒尺寸为 0');
    }

    // 2. 像素尺寸：按像素倍率放大，再按长边限制等比缩放
    let pw = Math.round(box.width * pixelRatio);
    let ph = Math.round(box.height * pixelRatio);
    const longEdge = Math.max(pw, ph);
    if (longEdge > maxSize) {
        const s = maxSize / longEdge;
        pw = Math.max(1, Math.round(pw * s));
        ph = Math.max(1, Math.round(ph * s));
    }
    pw = Math.min(2048, pw);
    ph = Math.min(2048, ph);

    // 3. 创建 RenderTexture
    const rt = new RenderTexture('captureNodeToImage');
    rt.reset({ width: pw, height: ph });

    // 4. 创建离屏正交相机，框住包围盒
    const camNode = new Node('CaptureCamera');
    director.getScene()?.addChild(camNode);
    const cam = camNode.addComponent(Camera);
    cam.projection = Camera.ProjectionType.ORTHO;
    cam.orthoHeight = box.height / 2;           // 可见高度 = 包围盒高度
    cam.clearFlags = Camera.ClearFlag.SOLID_COLOR;
    cam.clearColor = new Color(0, 0, 0, 0);      // 透明背景
    cam.visibility = CAPTURE_LAYER;              // 仅渲染目标子树
    cam.targetTexture = rt;
    cam.near = 1;
    cam.far = 2000;
    cam.priority = 100;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    camNode.setWorldPosition(cx, cy, 1000);

    // 5. 临时把目标子树切到 CAPTURE_LAYER（保证只被离屏相机渲染，避免重叠 UI 被截入）
    const restoreFns: Array<() => void> = [];
    node.walk((n: Node) => {
        const oldLayer = n.layer;
        restoreFns.push(() => { if (n.isValid) n.layer = oldLayer; });
        n.layer = CAPTURE_LAYER;
    });

    try {
        // 6. 等待渲染完成
        await waitFrames(waitFrameCount);

        // 7. 读取像素（GPU 原点在左下角，需要纵向翻转为顶到底行序）
        const raw = rt.readPixels();
        if (!raw) {
            throw new Error('[UiTools] captureNodeToImage: readPixels 返回空');
        }
        const pixels = flipPixelsVertical(raw, pw, ph);

        // 8. 构造可预览的 SpriteFrame（Cocos 会处理 UV，直接显示不会上下颠倒）
        const spriteFrame = new SpriteFrame();
        spriteFrame.texture = rt;

        return { texture: rt, spriteFrame, width: pw, height: ph, pixels };
    } finally {
        // 恢复 layer（无论成功失败）
        for (const fn of restoreFns) {
            try { fn(); } catch (e) { /* ignore */ }
        }
        // 销毁离屏相机（保留 rt 给调用方使用/预览）
        if (camNode.isValid) camNode.destroy();
    }
}

/**
 * 一键把节点内容保存到手机相册（Android / iOS）。
 * 内部会先 captureNodeToImage，再通过 AlbumSaver 检查/申请权限并保存。
 *
 * @param node 目标节点
 * @param options 捕获选项
 */
export async function saveNodeImageToAlbum(
    node: Node,
    options?: CaptureNodeOptions
): Promise<SaveImageResult> {
    const cap = await captureNodeToImage(node, options);
    console.log("cap=====================")
    try {
        return await AlbumSaver.savePixelsToAlbum({
            pixels: cap.pixels,
            width: cap.width,
            height: cap.height,
        });
    } finally {
        // 释放渲染贴图资源
        try { cap.spriteFrame.destroy(); } catch (e) { /* ignore */ }
        try { cap.texture.destroy(); } catch (e) { /* ignore */ }
    }
}

// ---------- 节点截图内部工具 ----------

/** 计算节点子树（含自身）所有 UITransform 世界包围盒的并集 */
function computeWorldBoundingBox(node: Node): Rect {
    let rect: Rect | null = null;
    node.walk((n: Node) => {
        const t = n.getComponent(UITransform);
        if (!t) return;
        const b = t.getBoundingBoxToWorld();
        if (!b || b.width <= 0 || b.height <= 0) return;
        rect = rect ? unionRect(rect, b) : b;
    });
    return rect ?? new Rect(0, 0, 0, 0);
}

/** 两个 Rect 的并集 */
function unionRect(a: Rect, b: Rect): Rect {
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    const right = Math.max(a.x + a.width, b.x + b.width);
    const top = Math.max(a.y + a.height, b.y + b.height);
    return new Rect(x, y, right - x, top - y);
}

/** 等待 N 个 AFTER_RENDER 帧 */
function waitFrames(frameCount: number): Promise<void> {
    return new Promise<void>((resolve) => {
        let remaining = frameCount;
        const handler = () => {
            remaining--;
            if (remaining <= 0) {
                director.off(Director.EVENT_AFTER_RENDER, handler);
                resolve();
            }
        };
        director.on(Director.EVENT_AFTER_RENDER, handler);
    });
}

/** 把 RGBA8888 像素数据纵向翻转（GPU 左下角原点 -> 顶到底行序） */
function flipPixelsVertical(src: Uint8Array, width: number, height: number): Uint8Array {
    const rowBytes = width * 4;
    const dst = new Uint8Array(src.length);
    for (let y = 0; y < height; y++) {
        const srcOffset = (height - 1 - y) * rowBytes;
        dst.set(src.subarray(srcOffset, srcOffset + rowBytes), y * rowBytes);
    }
    return dst;
}