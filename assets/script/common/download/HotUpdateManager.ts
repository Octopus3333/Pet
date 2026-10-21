import { assetManager, director, sys } from 'cc';
import {
    DOWNLOAD_STORAGE_PATH,
    HOT_UPDATE_MANIFEST_URL,
    HOT_UPDATE_VERSION_URL,
} from '../consts/DownloadConsts';
import { DownloadManager } from './DownloadManager';

/** CC 3.8.6 热更新 manifest 中的资源条目 */
export interface ManifestAsset {
    size: number;
    md5?: string;
    path?: string;
    compressed?: boolean;
}

/** CC 3.8.6 热更新 manifest 结构 */
export interface UpdateManifest {
    packageUrl?: string;
    remoteManifestUrl?: string;
    remoteVersionUrl?: string;
    version: string;
    assets?: Record<string, ManifestAsset>;
    searchPaths?: string[];
}

export interface HotUpdateInfo {
    hasUpdate: boolean;
    remoteVersion: string;
    localVersion: string;
    updateSize: number;
    fileCount: number;
    manifest?: UpdateManifest;
}

export interface HotUpdateProgress {
    downloadedFiles: number;
    totalFiles: number;
    downloadedBytes: number;
    totalBytes: number;
    progress: number; // 0-100
}

export type HotUpdateStatus = 'idle' | 'checking' | 'downloading' | 'ready' | 'failed' | 'updating';

export class HotUpdateManager {
    private static _instance: HotUpdateManager;
    private _downloadManager = DownloadManager.instance;
    private _status: HotUpdateStatus = 'idle';
    private _updateInfo: HotUpdateInfo | null = null;
    private _onProgress?: (progress: HotUpdateProgress) => void;
    private _onStatusChange?: (status: HotUpdateStatus) => void;

    private constructor() {}

    public static get instance(): HotUpdateManager {
        if (!HotUpdateManager._instance) {
            HotUpdateManager._instance = new HotUpdateManager();
        }
        return HotUpdateManager._instance;
    }

    public get status(): HotUpdateStatus {
        return this._status;
    }

    public get updateInfo(): HotUpdateInfo | null {
        return this._updateInfo;
    }

    /** 注册进度回调 */
    public onProgress(callback: (progress: HotUpdateProgress) => void): void {
        this._onProgress = callback;
    }

    /** 注册状态变更回调 */
    public onStatusChange(callback: (status: HotUpdateStatus) => void): void {
        this._onStatusChange = callback;
    }

    /**
     * 检查是否有热更新
     * CC 3.8.6 流程：下载远程 manifest → 对比本地版本 → 返回更新信息
     */
    public async checkForUpdate(): Promise<HotUpdateInfo> {
        this.setStatus('checking');

        try {
            const localVersion = this.getLocalVersion();

            // 尝试下载版本 manifest
            let remoteManifest: UpdateManifest;
            try {
                remoteManifest = await this.downloadManifest(HOT_UPDATE_MANIFEST_URL);
            } catch {
                // 如果 manifest 不可用，尝试 version 文件
                const versionText = await this.downloadText(HOT_UPDATE_VERSION_URL);
                remoteManifest = { version: versionText.trim() };
            }

            const remoteVersion = remoteManifest.version;
            const hasUpdate = this.compareVersion(remoteVersion, localVersion) > 0;

            let updateSize = 0;
            let fileCount = 0;

            if (hasUpdate && remoteManifest.assets) {
                const assets = remoteManifest.assets;
                for (const key in assets) {
                    updateSize += assets[key].size || 0;
                    fileCount++;
                }
            }

            this._updateInfo = {
                hasUpdate,
                remoteVersion,
                localVersion,
                updateSize,
                fileCount,
                manifest: hasUpdate ? remoteManifest : undefined,
            };

            return this._updateInfo;
        } catch (error) {
            this.setStatus('failed');
            throw error;
        }
    }

    /**
     * 下载热更新资源
     * 原生平台：下载到可写路径 → 设置搜索路径
     * Web 平台：下载到浏览器缓存，刷新后生效
     */
    public async downloadUpdate(): Promise<void> {
        if (!this._updateInfo?.hasUpdate || !this._updateInfo.manifest) {
            throw new Error('No update available');
        }

        this.setStatus('downloading');

        try {
            const manifest = this._updateInfo.manifest;
            const assets = manifest.assets;

            if (!assets || Object.keys(assets).length === 0) {
                // 没有资源文件需要下载（仅版本号变更）
                this.setStatus('ready');
                return;
            }

            const totalBytes = this._updateInfo.updateSize;
            let downloadedBytes = 0;
            let downloadedFiles = 0;
            const totalFiles = Object.keys(assets).length;

            const baseUrl = manifest.packageUrl || this.getBaseUrl(HOT_UPDATE_MANIFEST_URL);

            for (const filePath in assets) {
                const asset = assets[filePath];
                const fileUrl = `${baseUrl}/${filePath}`;

                await this._downloadManager.download(fileUrl, filePath, {
                    onProgress: (_progress, _total, downloaded) => {
                        downloadedBytes += downloaded;
                        this._onProgress?.({
                            downloadedFiles,
                            totalFiles,
                            downloadedBytes,
                            totalBytes,
                            progress: totalBytes > 0 ? (downloadedBytes / totalBytes) * 100 : 0,
                        });
                    },
                });

                downloadedFiles++;
                this._onProgress?.({
                    downloadedFiles,
                    totalFiles,
                    downloadedBytes,
                    totalBytes,
                    progress: (downloadedFiles / totalFiles) * 100,
                });
            }

            this.setStatus('ready');
        } catch (error) {
            this.setStatus('failed');
            throw error;
        }
    }

    /**
     * 应用热更新
     * 原生平台：保存版本号 → 设置搜索路径 → 重启游戏
     * Web 平台：保存版本号 → 刷新页面
     */
    public async applyUpdate(): Promise<void> {
        if (this._status !== 'ready') {
            throw new Error('Update not ready');
        }

        this.setStatus('updating');

        try {
            // 保存新版本号
            if (this._updateInfo?.remoteVersion) {
                this.saveVersion(this._updateInfo.remoteVersion);
            }

            if (this.isNative()) {
                // 原生平台：设置搜索路径，让引擎从可写路径加载更新后的资源
                const writablePath = jsb.fileUtils.getWritablePath();
                const searchPaths = jsb.fileUtils.getSearchPaths() || [];
                const remotePath = `${writablePath}${DOWNLOAD_STORAGE_PATH}/`;

                // 将可写路径置顶，优先加载更新资源
                if (searchPaths.indexOf(remotePath) === -1) {
                    searchPaths.unshift(remotePath);
                    jsb.fileUtils.setSearchPaths(searchPaths);
                }

                console.log('[HotUpdate] Search paths updated, restarting...');
            }

            // 重启游戏
            this.restartGame();
        } catch (error) {
            this.setStatus('failed');
            throw error;
        }
    }

    /**
     * 清除已下载的热更新资源
     */
    public clearUpdate(): void {
        if (this.isNative()) {
            const writablePath = jsb.fileUtils.getWritablePath();
            const updatePath = `${writablePath}${DOWNLOAD_STORAGE_PATH}`;
            if (jsb.fileUtils.isDirectoryExist(updatePath)) {
                jsb.fileUtils.removeDirectory(updatePath);
            }
        }
        this.saveVersion('0.0.0');
        this._updateInfo = null;
        this._status = 'idle';
    }

    // ========== 私有方法 ==========

    private setStatus(status: HotUpdateStatus): void {
        this._status = status;
        this._onStatusChange?.(status);
    }

    /**
     * CC 3.8.6 下载文本内容
     * assetManager.downloader.download(id, url, type, options, onProgress, onComplete)
     */
    private downloadText(url: string): Promise<string> {
        return new Promise((resolve, reject) => {
            assetManager.downloader.download(
                'version_check',
                url,
                '.txt',
                {},
                null,
                (err: Error | null, data: unknown) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    if (typeof data === 'string') {
                        resolve(data);
                    } else if (data instanceof ArrayBuffer) {
                        resolve(new TextDecoder().decode(data));
                    } else {
                        resolve(String(data));
                    }
                }
            );
        });
    }

    /**
     * CC 3.8.6 下载 manifest JSON
     */
    private downloadManifest(url: string): Promise<UpdateManifest> {
        return new Promise((resolve, reject) => {
            assetManager.downloader.download(
                'manifest',
                url,
                '.json',
                {},
                null,
                (err: Error | null, data: unknown) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    try {
                        const json = typeof data === 'string'
                            ? JSON.parse(data)
                            : data;
                        resolve(json as UpdateManifest);
                    } catch (e) {
                        reject(new Error(`Failed to parse manifest: ${e}`));
                    }
                }
            );
        });
    }

    /**
     * 获取本地版本号
     */
    private getLocalVersion(): string {
        try {
            if (this.isNative()) {
                const versionPath = `${jsb.fileUtils.getWritablePath()}${DOWNLOAD_STORAGE_PATH}/version.txt`;
                if (jsb.fileUtils.isFileExist(versionPath)) {
                    return jsb.fileUtils.getStringFromFile(versionPath).trim();
                }
            } else {
                return sys.localStorage.getItem('hot_update_version') || '0.0.0';
            }
        } catch (error) {
            console.error('[HotUpdate] Failed to get local version:', error);
        }
        return '0.0.0';
    }

    /**
     * 保存版本号
     */
    private saveVersion(version: string): void {
        try {
            if (this.isNative()) {
                const dirPath = `${jsb.fileUtils.getWritablePath()}${DOWNLOAD_STORAGE_PATH}`;
                if (!jsb.fileUtils.isDirectoryExist(dirPath)) {
                    jsb.fileUtils.createDirectory(dirPath);
                }
                const versionPath = `${dirPath}/version.txt`;
                jsb.fileUtils.writeStringToFile(version, versionPath);
            } else {
                sys.localStorage.setItem('hot_update_version', version);
            }
        } catch (error) {
            console.error('[HotUpdate] Failed to save version:', error);
        }
    }

    /**
     * 版本号比较（支持 x.y.z 格式）
     * @returns >0 表示 v1 > v2, <0 表示 v1 < v2, 0 表示相等
     */
    private compareVersion(v1: string, v2: string): number {
        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);
        const len = Math.max(parts1.length, parts2.length);

        for (let i = 0; i < len; i++) {
            const a = parts1[i] || 0;
            const b = parts2[i] || 0;
            if (a > b) return 1;
            if (a < b) return -1;
        }
        return 0;
    }

    /**
     * 从 URL 提取基础路径
     */
    private getBaseUrl(url: string): string {
        const idx = url.lastIndexOf('/');
        return idx > 0 ? url.substring(0, idx) : url;
    }

    /**
     * 重启游戏
     */
    private restartGame(): void {
        if (this.isNative()) {
            // 原生平台：重启游戏
            director.loadScene(director.getScene()!.name, () => {
                console.log('[HotUpdate] Game restarted');
            });
        } else {
            // Web 平台：刷新页面
            if (typeof window !== 'undefined') {
                window.location.reload();
            }
        }
    }

    private isNative(): boolean {
        return typeof jsb !== 'undefined' && !!jsb.fileUtils;
    }
}