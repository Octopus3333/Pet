import { SocketManager, SocketMSgId } from '../common/network/SocketManager';
import { AlbumCategoryValue } from '../common/utils/Define';
import { AlbumListResp, PhotoItem } from '../common/utils/InterfaceDefine';

/**
 * 相册数据提供者接口
 */
export interface IAlbumDataProvider {
    loadPage(category: AlbumCategoryValue, page: number): Promise<AlbumListResp | null>;
    getCategoryCounts(): Record<number, number>;
    getTotalPages(category: AlbumCategoryValue): number;
    getCachedPage(category: AlbumCategoryValue, page: number): PhotoItem[] | null;
    clearCache(): void;
}

/**
 * 相册数据提供者实现
 */
export class AlbumDataProvider implements IAlbumDataProvider {
    private readonly PAGE_SIZE = 6;

    private _categoryTotals: Record<number, number> = {};
    private _pageCache: Map<string, PhotoItem[]> = new Map();

    async loadPage(category: AlbumCategoryValue, page: number): Promise<AlbumListResp | null> {
        console.log('[AlbumDataProvider] loadPage 被调用, category:', category, 'page:', page);

        // ★ 临时 Mock
        const USE_MOCK = false;
        if (USE_MOCK) {
            const mockResp = this.mockData(category, page);
            console.log('[AlbumDataProvider] Mock 返回:', JSON.stringify(mockResp));
            
            if (mockResp.counts) {
                mockResp.counts.forEach((c) => {
                    this._categoryTotals[c.category] = c.count;
                });
            }
            console.log('[AlbumDataProvider] _categoryTotals:', JSON.stringify(this._categoryTotals));

            const cacheKey = `${category}_${page}`;
            this._pageCache.set(cacheKey, mockResp.photos || []);
            console.log(`[AlbumDataProvider] 缓存页面: ${cacheKey}, 照片数: ${mockResp.photos?.length || 0}`);

            return mockResp;
        }

        //Socket 请求
        return new Promise((resolve) => {
            SocketManager.instance.sendDataWithCallback(
                SocketMSgId.AlbumList,
                { category, page },
                (res, error) => {
                    if (error) {
                        console.error('[AlbumDataProvider] Socket 错误:', error);
                        resolve(null);
                        return;
                    }

                    console.log('[AlbumDataProvider] 响应数据:', JSON.stringify(res));

                    if (!res || res.code !== 0) {
                        console.error('[AlbumDataProvider] 接口错误:', res?.code, res?.msg);
                        resolve(null);
                        return;
                    }
                    // 更新各分类总数
                    if (res.counts) {
                        res.counts.forEach((c: any) => {
                            this._categoryTotals[c.category] = c.count;
                        });
                        this._categoryTotals[category] = res.total
                        console.log('[AlbumDataProvider] 更新分类总数:', JSON.stringify(this._categoryTotals));
                    }

                    // 缓存页面数据
                    const cacheKey = `${category}_${page}`;
                    this._pageCache.set(cacheKey, res.photos || []);
                    console.log(`[AlbumDataProvider] 缓存页面: ${cacheKey}, 照片数: ${res.photos?.length || 0}`);

                    resolve(res);
                },
                SocketMSgId.AlbumList,  // 回包类型
                10000                   // 超时 10 秒
            );
        });
    }

    getCategoryCounts(): Record<number, number> {
        return { ...this._categoryTotals };
    }

    getTotalPages(category: AlbumCategoryValue): number {
        const total = this._categoryTotals[category] || 0;
        return total > 0 ? Math.ceil(total / this.PAGE_SIZE) : 0;
    }

    getCachedPage(category: AlbumCategoryValue, page: number): PhotoItem[] | null {
        const cacheKey = `${category}_${page}`;
        return this._pageCache.get(cacheKey) || null;
    }

    clearCache(): void {
        this._pageCache.clear();
        this._categoryTotals = {};
        console.log('[AlbumDataProvider] 缓存已清空');
    }

   private mockData(category: AlbumCategoryValue, page: number): AlbumListResp {
        const total = 3;
        const photos: any[] = [];

        // 第1张：单照片 cat
        photos.push({
            user_photo_id: 1,
            photo_id: 1,
            photo_variant_id: 0,
            photo_name: '',
            rarity: 0,
            album_desc: '',
            obtain_time: Math.floor(Date.now() / 1000) - 86400,
            photo_filename: '',
            photo_type: 1,
            bg_filename: '',
            fg_filename: '',
            pose_filename: '',
            pose_x: 0,
            pose_y: 0,
            pose_scale: 1,
            emotion_filename: '',
            emotion_x: 0,
            emotion_y: 0,
            emotion_scale: 1,
        });

        // 第2张：单照片 dog
        photos.push({
            user_photo_id: 2,
            photo_id: 2,
            photo_variant_id: 1,
            photo_name: '',
            rarity: 0,
            album_desc: '',
            obtain_time: Math.floor(Date.now() / 1000) - 2 * 86400,
            photo_filename: '',
            photo_type: 1,
            bg_filename: '',
            fg_filename: '',
            pose_filename: '',
            pose_x: 0,
            pose_y: 0,
            pose_scale: 1,
            emotion_filename: '',
            emotion_x: 0,
            emotion_y: 0,
            emotion_scale: 1,
        });

        // 第3张：组合照片
        photos.push({
            user_photo_id: 7,
            photo_id: 7,
            photo_variant_id: 4,
            photo_name: '',
            rarity: 0,
            album_desc: '',
            obtain_time: Math.floor(Date.now() / 1000) - 3 * 86400,
            photo_filename: '',
            photo_type: 2,
            bg_filename: 'BG_dacaoping_1',
            fg_filename: 'FG_dacaoping_1',
            pose_filename: 'Cat_Zn_C01',
            pose_x: 541,
            pose_y: 475,
            pose_scale: 0.75,
            emotion_filename: 'Cat_Zu_B06',
            emotion_x: 640,
            emotion_y: 687,
            emotion_scale: 0.75,
        });

        return {
            photos,
            total,
            counts: [
                { category: 1, count: total },
                { category: 2, count: 0 },
                { category: 3, count: 0 },
                { category: 4, count: 0 },
                { category: 5, count: 0 },
            ],
            has_more: false,
            code: 0,
            msg: 'mock',
        };
    }
}