import { assetManager, AssetManager } from 'cc';
import { DOWNLOAD_STORAGE_PATH, BUNDLE_DIR } from '../consts/DownloadConsts';
import { DownloadManager } from './DownloadManager';

export interface BundleInfo {
    name: string;
    version: string;
    url: string;
    size: number;
    checksum?: string;
}

export interface BundleDownloadProgress {
    bundleName: string;
    downloadedBytes: number;
    totalBytes: number;
    progress: number;
}

export type BundleStatus = 'not_downloaded' | 'downloading' | 'downloaded' | 'failed';

export class BundleDownloader {
    private static _instance: BundleDownloader;
    private _downloadManager = DownloadManager.instance;
    private _bundles: Map<string, BundleInfo> = new Map();
    private _bundleStatus: Map<string, BundleStatus> = new Map();
    private _loadedBundles: Map<string, AssetManager.Bundle> = new Map();
    private _onProgress?: (progress: BundleDownloadProgress) => void;

    private constructor() {}

    public static get instance(): BundleDownloader {
        if (!BundleDownloader._instance) {
            BundleDownloader._instance = new BundleDownloader();
        }
        return BundleDownloader._instance;
    }

    public registerBundle(info: BundleInfo): void {
        this._bundles.set(info.name, info);
        this._bundleStatus.set(info.name, 'not_downloaded');
    }

    public registerBundles(bundles: BundleInfo[]): void {
        bundles.forEach((bundle) => this.registerBundle(bundle));
    }

    public getBundleInfo(name: string): BundleInfo | undefined {
        return this._bundles.get(name);
    }

    public getBundleStatus(name: string): BundleStatus {
        return this._bundleStatus.get(name) ?? 'not_downloaded';
    }

    public getAllBundles(): BundleInfo[] {
        return Array.from(this._bundles.values());
    }

    public getDownloadedBundles(): BundleInfo[] {
        return Array.from(this._bundles.values()).filter(
            (bundle) => this._bundleStatus.get(bundle.name) === 'downloaded'
        );
    }

    public getLoadedBundle(name: string): AssetManager.Bundle | undefined {
        return this._loadedBundles.get(name);
    }

    public onProgress(callback: (progress: BundleDownloadProgress) => void): void {
        this._onProgress = callback;
    }

    /**
     * 下载单个分包
     */
    public async downloadBundle(name: string, silent: boolean = false): Promise<void> {
        const bundle = this._bundles.get(name);
        if (!bundle) {
            throw new Error(`Bundle not found: ${name}`);
        }

        if (this._bundleStatus.get(name) === 'downloaded') {
            return;
        }

        this._bundleStatus.set(name, 'downloading');

        try {
            const savePath = `${BUNDLE_DIR}/${name}/${bundle.version}`;

            await this._downloadManager.download(bundle.url, savePath, {
                silent,
                onProgress: (progress, totalBytes, downloadedBytes) => {
                    this._onProgress?.({
                        bundleName: name,
                        downloadedBytes,
                        totalBytes,
                        progress,
                    });
                },
            });

            this._bundleStatus.set(name, 'downloaded');
        } catch (error) {
            this._bundleStatus.set(name, 'failed');
            throw error;
        }
    }

    /**
     * 批量下载分包
     */
    public async downloadBundles(names: string[], silent: boolean = false): Promise<void> {
        for (const name of names) {
            await this.downloadBundle(name, silent);
        }
    }

    /**
     * 下载所有已注册分包
     */
    public async downloadAllBundles(silent: boolean = false): Promise<void> {
        const bundleNames = Array.from(this._bundles.keys());
        await this.downloadBundles(bundleNames, silent);
    }

    /**
     * CC 3.8.6 预加载分包到内存
     * 下载完成后调用，将分包加载到 assetManager 中
     */
    public async preloadBundle(name: string): Promise<AssetManager.Bundle> {
        const status = this._bundleStatus.get(name);
        if (status !== 'downloaded') {
            throw new Error(`Bundle not downloaded: ${name}`);
        }

        const bundle = this._bundles.get(name);
        if (!bundle) {
            throw new Error(`Bundle not found: ${name}`);
        }

        // 检查是否已加载
        const existing = this._loadedBundles.get(name);
        if (existing) {
            return existing;
        }

        const path = `${DOWNLOAD_STORAGE_PATH}/${BUNDLE_DIR}/${name}/${bundle.version}`;

        return new Promise<AssetManager.Bundle>((resolve, reject) => {
            assetManager.loadBundle(path, (err, loadedBundle) => {
                if (err) {
                    reject(err);
                    return;
                }
                this._loadedBundles.set(name, loadedBundle);
                resolve(loadedBundle);
            });
        });
    }

    /**
     * 从远程直接加载分包（CC 3.8.6 支持远程 URL 加载）
     */
    public async loadRemoteBundle(name: string, url: string): Promise<AssetManager.Bundle> {
        return new Promise<AssetManager.Bundle>((resolve, reject) => {
            assetManager.loadBundle(url, (err, loadedBundle) => {
                if (err) {
                    reject(err);
                    return;
                }
                this._loadedBundles.set(name, loadedBundle);
                resolve(loadedBundle);
            });
        });
    }

    /**
     * 卸载分包
     */
    public removeBundle(name: string): void {
        const bundle = this._loadedBundles.get(name);
        if (bundle) {
            assetManager.removeBundle(bundle);
            this._loadedBundles.delete(name);
        }
    }
}