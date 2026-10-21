/**
 * @file ResLoader.ts
 * @desc Cocos Creator 3.8.6 全局资源加载管理器（新增async/await异步接口）
 * @author xxx
 * @date 2026-06-17
 */
import { _decorator, assetManager, resources, Asset, Texture2D, SpriteFrame, Prefab, AudioClip, JsonAsset, ImageAsset, director } from 'cc';
const { ccclass } = _decorator;

type LoadProgressFunc = (finished: number, total: number) => void;
type LoadCompleteFunc<T = Asset> = (err: Error | null, asset: T) => void;
type LoadBatchCompleteFunc = (errArr: Error[], assetArr: Asset[]) => void;

// 资源缓存字典 key:资源路径 value:资源实例
const assetCache: Map<string, Asset> = new Map();

@ccclass('ResLoader')
export class ResLoader {
    private static _ins: ResLoader = null!;
    // 远程资源根地址，根据项目CDN修改
    public remoteBaseUrl: string = "";

    public static get ins(): ResLoader {
        if (!ResLoader._ins) {
            ResLoader._ins = new ResLoader();
        }
        return ResLoader._ins;
    }

    private constructor() { }

    //#region 基础加载 - resources本地包资源（原有回调版本）
    /**
     * 加载resources目录下单个资源（回调版）
     * @param path resources内相对路径 例:"ui/bg/battle_bg"
     * @param assetType 资源类型 Texture2D/Prefab/AudioClip...
     * @param progress 加载进度回调
     * @param complete 加载完成回调
     */
    public loadRes<T extends Asset>(
        path: string,
        assetType: new () => T,
        progress?: LoadProgressFunc,
        complete?: LoadCompleteFunc<T>
    ): void {
        // 先读取缓存，有缓存直接返回
        const cacheAsset = assetCache.get(path) as T;
        if (cacheAsset) {
            complete?.(null, cacheAsset);
            return;
        }

        resources.load(path, assetType, progress, (err, asset) => {
            if (err) {
                complete?.(err, null!);
                return;
            }
            // 加入缓存，增加引用计数
            asset.addRef();
            assetCache.set(path, asset);
            complete?.(null, asset);
        });
    }

    /**
     * 批量加载resources资源（回调版）
     * @param pathList 资源路径数组
     * @param assetType 统一资源类型
     * @param progress 总进度
     * @param complete 全部加载完成
     */
    public loadResBatch<T extends Asset>(
        pathList: string[],
        assetType: new () => T,
        progress?: LoadProgressFunc,
        complete?: LoadBatchCompleteFunc
    ): void {
        const unloadPaths: string[] = [];
        const cacheAssets: T[] = [];
        pathList.forEach(path => {
            const cacheAsset = assetCache.get(path) as T;
            if (cacheAsset) {
                cacheAssets.push(cacheAsset);
            } else {
                unloadPaths.push(path);
            }
        });

        // 全部命中缓存，直接返回
        if (unloadPaths.length === 0) {
            complete?.([], cacheAssets);
            return;
        }

        resources.load(unloadPaths, assetType, progress, (errArr, assetArr) => {
            if (errArr && errArr.length > 0) {
                complete?.(errArr, [...cacheAssets, ...assetArr]);
                return;
            }
            // 缓存新资源
            assetArr.forEach((asset, idx) => {
                asset.addRef();
                assetCache.set(unloadPaths[idx], asset);
            });
            complete?.([], [...cacheAssets, ...assetArr]);
        });
    }
    //#endregion

    //#region 【新增async/await 异步加载接口】
    /**
     * 异步加载单个resources资源（async await）
     * @param path resources路径
     * @param assetType 资源类型
     * @param progress 进度回调（可选）
     * @returns 资源实例，失败抛出Error
     */
    public async loadResAsync<T extends Asset>(
        path: string,
        assetType: new () => T,
        progress?: LoadProgressFunc
    ): Promise<T> {
        // 命中缓存直接返回
        const cacheAsset = assetCache.get(path) as T;
        if (cacheAsset) {
            return cacheAsset;
        }

        return new Promise<T>((resolve, reject) => {
            resources.load(path, assetType, progress, (err, asset) => {
                if (err) {
                    reject(err);
                    return;
                }
                asset.addRef();
                assetCache.set(path, asset);
                resolve(asset);
            });
        });
    }

    /**
     * 异步批量加载resources资源（async await）
     * @param pathList 路径数组
     * @param assetType 统一资源类型
     * @param progress 总进度回调
     * @returns 资源数组，如有失败会抛出包含错误的数组
     */
    public async loadResBatchAsync<T extends Asset>(
        pathList: string[],
        assetType: new () => T,
        progress?: LoadProgressFunc
    ): Promise<T[]> {
        const unloadPaths: string[] = [];
        const cacheAssets: T[] = [];
        pathList.forEach(path => {
            const cacheAsset = assetCache.get(path) as T;
            if (cacheAsset) cacheAssets.push(cacheAsset);
            else unloadPaths.push(path);
        });

        if (unloadPaths.length === 0) return cacheAssets;

        return new Promise<T[]>((resolve, reject) => {
            resources.load(unloadPaths, assetType, progress, (errArr, assetArr) => {
                if (errArr && errArr.length > 0) {
                    reject(errArr);
                    return;
                }
                assetArr.forEach((asset, idx) => {
                    asset.addRef();
                    assetCache.set(unloadPaths[idx], asset);
                });
                resolve([...cacheAssets, ...assetArr]);
            });
        });
    }

    /**
     * 异步加载远程图片 SpriteFrame
     */
    public async loadRemoteImageAsync(url: string): Promise<SpriteFrame> {
        let fullUrl = url;
        if (!url.startsWith("http")) {
            fullUrl = this.remoteBaseUrl + url;
        }

        return new Promise<SpriteFrame>((resolve, reject) => {
            assetManager.loadRemote<ImageAsset>(fullUrl, { ext: ".png" }, (err, imageAsset) => {
                if (err) return reject(err);
                const tex = new Texture2D();
                tex.image = imageAsset;
                const sf = new SpriteFrame();
                sf.texture = tex;
                resolve(sf);
            });
        });
    }

    /**
     * 异步加载远程Json配置
     */
    public async loadRemoteJsonAsync(url: string): Promise<JsonAsset> {
        let fullUrl = url;
        if (!url.startsWith("http")) {
            fullUrl = this.remoteBaseUrl + url;
        }
        return new Promise<JsonAsset>((resolve, reject) => {
            assetManager.loadRemote<JsonAsset>(fullUrl, (err, jsonAsset) => {
                if (err) return reject(err);
                resolve(jsonAsset);
            });
        });
    }
    //#endregion

    //#region 远程CDN资源加载（原有回调版本）
    /**
     * 加载远程图片（SpriteFrame/Texture2D）
     * @param url 完整远程地址 或 相对域名后缀
     * @param complete 回调
     */
    public loadRemoteImage(url: string, complete: LoadCompleteFunc<SpriteFrame>): void {
        let fullUrl = url;
        if (!url.startsWith("http")) {
            fullUrl = this.remoteBaseUrl + url;
        }
        assetManager.loadRemote<ImageAsset>(fullUrl, { ext: ".png" }, (err, imageAsset) => {
            if (err) {
                complete(err, null!);
                return;
            }
            const tex = new Texture2D();
            tex.image = imageAsset;
            const spriteFrame = new SpriteFrame();
            spriteFrame.texture = tex;
            complete(null, spriteFrame);
        });
    }

    /**
     * 加载远程Json配置
     */
    public loadRemoteJson(url: string, complete: LoadCompleteFunc<JsonAsset>): void {
        let fullUrl = url;
        if (!url.startsWith("http")) {
            fullUrl = this.remoteBaseUrl + url;
        }
        assetManager.loadRemote<JsonAsset>(fullUrl, (err, jsonAsset) => {
            complete(err, jsonAsset);
        });
    }
    //#endregion

    //#region 资源释放管理
    /**
     * 释放指定路径资源（减少引用计数，计数为0时销毁）
     * @param path resources资源路径
     */
    public releaseAsset(path: string): void {
        const asset = assetCache.get(path);
        if (!asset) return;
        asset.decRef();
        // 引用计数为0，移出缓存
        if (asset.refCount <= 0) {
            assetCache.delete(path);
            resources.release(path);
        }
    }

    /**
     * 清空全部缓存，释放所有资源（切换场景调用）
     */
    public clearAllCache(): void {
        assetCache.forEach((asset, path) => {
            asset.decRef();
            resources.release(path);
        });
        assetCache.clear();
        // 触发引擎GC
        director.gc();
    }

    /**
     * 获取缓存内已加载资源，无加载动作
     */
    public getCacheAsset<T extends Asset>(path: string): T | null {
        return assetCache.get(path) as T || null;
    }
    //#endregion
}