import { _decorator, Node, Prefab, instantiate, director } from 'cc';
import { ResLoader } from '../download/ResLoader';
import { ViewPath } from './Define';

const { ccclass } = _decorator;

@ccclass('UIManager')
export class UIManager {
    private static _ins: UIManager = null!;

    private _uiMap: Map<string, Node> = new Map();
    private _defaultParent: Node = null;

    static get ins(): UIManager {
        if (!UIManager._ins) {
            UIManager._ins = new UIManager();
        }
        return UIManager._ins;
    }

    private constructor() { }

    /**
     * 设置默认父节点，未指定 parent 时挂载到此节点下
     */
    public setDefaultParent(parent: Node): void {
        this._defaultParent = parent;
    }

    /**
     * 展示预制体界面，若已存在则直接显示，否则加载并创建
     * @param prefabPath prefab 路径（如 "prefabs/home/homePanel"）
     * @param parent 父节点，不传则使用默认父节点
     * @returns 界面节点
     */
    public async show(prefabName: string, parent?: Node): Promise<Node> {
        let node = this._uiMap.get(prefabName);
        if (node && node.isValid) {
            node.active = true;
            node.setSiblingIndex(9999)
            return node;
        }

        node = await this.createNode(prefabName, parent);
        if (node) {
            this._uiMap.set(prefabName, node);
        }
        return node;
    }

    /**
     * 隐藏指定预制体界面
     * @param prefabPath prefab 路径
     */
    public hide(prefabPath: string): void {
        const node = this._uiMap.get(prefabPath);
        if (node && node.isValid) {
            node.active = false;
        }
    }
    public hideView(view:Node){
        this._uiMap.forEach((v)=>{
            if(v == view && v.isValid){
                v.active = false
                return
            }
        })
    }
    /**
     * 移除并销毁指定预制体界面
     * @param prefabPath prefab 路径
     */
    public remove(prefabPath: string): void {
        const node = this._uiMap.get(prefabPath);
        if (node && node.isValid) {
            node.destroy();
        }
        this._uiMap.delete(prefabPath);
    }

    /**
     * 添加一个新的预制体界面实例（每次都会创建新节点）
     * @param prefabPath prefab 路径
     * @param parent 父节点，不传则使用默认父节点
     * @returns 界面节点
     */
    public async add(prefabPath: string, parent?: Node): Promise<Node> {
        return this.createNode(prefabPath, parent);
    }

    /**
     * 获取已展示的界面节点
     */
    public get(prefabPath: string): Node | null {
        return this._uiMap.get(prefabPath) || null;
    }

    /**
     * 移除所有界面
     */
    public removeAll(): void {
        this._uiMap.forEach((node) => {
            if (node && node.isValid) {
                node.destroy();
            }
        });
        this._uiMap.clear();
    }

    private async createNode(prefabName: string, parent?: Node): Promise<Node> {
        try {
            var prefabPath = ViewPath[prefabName]? ViewPath[prefabName]:prefabName
            console.log("prefabPath", prefabPath)
            const prefab = await ResLoader.ins.loadResAsync(prefabPath, Prefab);
            if (!prefab) return null;
            const node = instantiate(prefab);
            const targetParent = parent || this._defaultParent;
            if (targetParent) {
                node.parent = targetParent;
            }else{
                node.parent = director.getScene().getChildByName("Canvas")
            }
            return node;
        } catch (error) {
            console.error('UIManager createNode error:', error);
            return null;
        }
    }
}