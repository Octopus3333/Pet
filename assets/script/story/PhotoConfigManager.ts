import { JsonAsset } from 'cc';
import { ResLoader } from '../common/download/ResLoader';

/** 照片基础配置（photoConfig.json 单项） */
export interface PhotoBaseConfig {
    id: number;             // photo_id
    name: string;           // 照片名称
    descripetion: string;   // 简介（JSON 里拼写就是 descripetion）
    quality: number;        // 稀有度
    pet_limit: number[];    // 宠物限制
}

/** 照片变种配置（photoVariantConfig.json 单项） */
export interface PhotoVariantConfig {
    id: number;             // photo_id
    grow_id: number;        // photo_variant_id（与后端对应）
    sub_id: string;         // 唯一标识
    type: number;           // 1=单照片 2=组合照片
    photo_path: string;     // 单照片文件名（type=1）
    bg_name: string;        // 背景文件名（type=2）
    forward_bg_name: string;// 前景文件名（type=2）
    action_path: string;    // 角色姿势文件名（type=2）
    pose_scale: number;     // 姿势缩放
    poseX: number;          // 姿势 X
    poseY: number;          // 姿势 Y
    emo_path: string;       // 表情文件名（type=2）
    emo_scale: number;      // 表情缩放
    emo_x: number;          // 表情 X
    emo_y: number;          // 表情 Y
}

/** 合并后的照片完整数据（给 Cell/DetailPanel 用） */
export interface PhotoFullData {
    photo_id: number;
    photo_variant_id: number;
    photo_name: string;
    album_desc: string;
    rarity: number;
    obtain_time: number;       
    photo_type: number;
    photo_filename: string;     // 单照片用
    bg_filename: string;        // 组合照片用
    fg_filename: string;        // 组合照片用
    pose_filename: string;      // 组合照片用
    pose_scale: number;
    pose_x: number;
    pose_y: number;
    emotion_filename: string;   // 组合照片用
    emotion_scale: number;
    emotion_x: number;
    emotion_y: number;
}

export class PhotoConfigManager {
    private static _ins: PhotoConfigManager = null!;

    private _photoBaseMap: Map<number, PhotoBaseConfig> = new Map();
    private _photoVariantMap: Map<number, PhotoVariantConfig> = new Map();
    private _loaded = false;

    public static get ins(): PhotoConfigManager {
        if (!PhotoConfigManager._ins) {
            PhotoConfigManager._ins = new PhotoConfigManager();
        }
        return PhotoConfigManager._ins;
    }

    private constructor() {}

    /** 配置是否已加载 */
    public get isLoaded(): boolean {
        return this._loaded;
    }

    /** 加载两个 JSON 配置 */
    public async load(): Promise<void> {
        if (this._loaded) return;

        console.log('[PhotoConfigManager] load 开始...');
        try {
            const baseJson = await ResLoader.ins.loadResAsync<JsonAsset>(
                'config/photoConfig/photoConfig',
                JsonAsset
            );
            const baseList: PhotoBaseConfig[] = baseJson.json as any[];
            baseList.forEach((item) => {
                this._photoBaseMap.set(item.id, item);
            });
            console.log(`[PhotoConfigManager] 加载照片基础配置: ${baseList.length} 条`);
        } catch (e) {
            console.error('[PhotoConfigManager] 加载 photoConfig 失败:', e);
        }

        try {
            const variantJson = await ResLoader.ins.loadResAsync<JsonAsset>(
                'config/photoConfig/photoVariantConfig',
                JsonAsset
            );
            const variantList: PhotoVariantConfig[] = variantJson.json as any[];
            variantList.forEach((item) => {
                this._photoVariantMap.set(item.grow_id, item);
            });
            console.log(`[PhotoConfigManager] 加载照片变种配置: ${variantList.length} 条`);
        } catch (e) {
            console.error('[PhotoConfigManager] 加载 photoVariantConfig 失败:', e);
        }

        this._loaded = true;
    }

    /** 根据 photo_id 和 photo_variant_id 获取合并后的完整数据 */
    public getPhotoData(photoId: number, variantId: number): PhotoFullData | null {
        const base = this._photoBaseMap.get(photoId);
        if (!base) {
            console.warn(`[PhotoConfigManager] 找不到照片配置: photo_id=${photoId}`);
            return null;
        }

        const variant = this._photoVariantMap.get(variantId);
        if (!variant) {
            console.warn(`[PhotoConfigManager] 找不到变种配置: variant_id=${variantId}`);
            return null;
        }

        return {
            photo_id: base.id,
            photo_variant_id: variant.grow_id,
            photo_name: base.name,
            album_desc: base.descripetion,
            rarity: base.quality,
            obtain_time: 0,
            photo_type: variant.type,
            photo_filename: variant.photo_path,
            bg_filename: variant.bg_name,
            fg_filename: variant.forward_bg_name,
            pose_filename: variant.action_path,
            pose_scale: variant.pose_scale,
            pose_x: variant.poseX,
            pose_y: variant.poseY,
            emotion_filename: variant.emo_path,
            emotion_scale: variant.emo_scale,
            emotion_x: variant.emo_x,
            emotion_y: variant.emo_y,
        };
    }

    /** 获取照片基础配置 */
    public getBaseConfig(photoId: number): PhotoBaseConfig | null {
        return this._photoBaseMap.get(photoId) || null;
    }

    /** 获取变种配置 */
    public getVariantConfig(variantId: number): PhotoVariantConfig | null {
        return this._photoVariantMap.get(variantId) || null;
    }
}