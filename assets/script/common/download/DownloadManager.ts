import { assetManager } from 'cc';
import {
    DOWNLOAD_STORAGE_PATH,
    DOWNLOAD_MAX_CONCURRENT_DOWNLOADS,
    DOWNLOAD_RETRY_MAX_ATTEMPTS,
    DOWNLOAD_RETRY_DELAY_MS,
    DOWNLOAD_TIMEOUT,
} from '../consts/DownloadConsts';
import { RetryHelper, RetryOptions } from '../utils/RetryHelper';

export interface DownloadTask {
    id: string;
    url: string;
    path: string;
    silent: boolean;
    progress: number;
    status: 'pending' | 'downloading' | 'completed' | 'failed';
    error?: Error;
}

export interface DownloadOptions {
    silent?: boolean;
    retry?: Partial<RetryOptions>;
    onProgress?: (progress: number, totalBytes: number, downloadedBytes: number) => void;
}

export class DownloadManager {
    private static _instance: DownloadManager;
    private _tasks: Map<string, DownloadTask> = new Map();
    private _activeDownloads = 0;

    private constructor() {}

    public static get instance(): DownloadManager {
        if (!DownloadManager._instance) {
            DownloadManager._instance = new DownloadManager();
        }
        return DownloadManager._instance;
    }

    public async download(
        url: string,
        savePath: string,
        options?: DownloadOptions
    ): Promise<DownloadTask> {
        const taskId = `${url}-${Date.now()}`;
        const task: DownloadTask = {
            id: taskId,
            url,
            path: savePath,
            silent: options?.silent ?? false,
            progress: 0,
            status: 'pending',
        };

        this._tasks.set(taskId, task);
        await this.executeDownload(task, options);

        return task;
    }

    public getTask(taskId: string): DownloadTask | undefined {
        return this._tasks.get(taskId);
    }

    public cancelTask(taskId: string): void {
        this._tasks.delete(taskId);
    }

    public getAllTasks(): DownloadTask[] {
        return Array.from(this._tasks.values());
    }

    public clearCompletedTasks(): void {
        this._tasks.forEach((task) => {
            if (task.status === 'completed' || task.status === 'failed') {
                this._tasks.delete(task.id);
            }
        });
    }

    private async executeDownload(task: DownloadTask, options?: DownloadOptions): Promise<void> {
        while (this._activeDownloads >= DOWNLOAD_MAX_CONCURRENT_DOWNLOADS) {
            await this.delay(100);
        }

        this._activeDownloads++;
        task.status = 'downloading';

        const retryOptions: RetryOptions = {
            maxAttempts: options?.retry?.maxAttempts ?? DOWNLOAD_RETRY_MAX_ATTEMPTS,
            delayMs: options?.retry?.delayMs ?? DOWNLOAD_RETRY_DELAY_MS,
            backoffFactor: options?.retry?.backoffFactor ?? 1,
        };

        try {
            await RetryHelper.execute(async () => {
                await this.performDownload(task, options);
            }, retryOptions);
            task.status = 'completed';
            task.progress = 100;
        } catch (error) {
            task.status = 'failed';
            task.error = error as Error;
        } finally {
            this._activeDownloads--;
        }
    }

    /**
     * CC 3.8.6 下载实现
     * assetManager.downloader.download 签名:
     *   download(id, url, type, options, onProgress, onComplete)
     */
    private performDownload(task: DownloadTask, options?: DownloadOptions): Promise<void> {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error(`Download timeout: ${task.url}`));
            }, DOWNLOAD_TIMEOUT);

            // 从 URL 提取文件扩展名作为 type
            const ext = this.getFileExt(task.url) || '.bin';

            assetManager.downloader.download(
                task.id,
                task.url,
                ext,
                {
                    // 原生平台：指定保存路径
                    ...(this.isNative() ? { fileName: task.path } : {}),
                },
                // onProgress (CC 3.8.6: finished, total, item)
                (_finished: number, total: number, _item: unknown) => {
                    if (total > 0) {
                        const progress = (_finished / total) * 100;
                        task.progress = progress;
                        options?.onProgress?.(progress, total, _finished);
                    }
                },
                // onComplete
                (err: Error | null, data: unknown) => {
                    clearTimeout(timeoutId);
                    if (err) {
                        reject(err);
                        return;
                    }
                    this.saveDownloadedData(data, task.path)
                        .then(() => resolve())
                        .catch(reject);
                }
            );
        });
    }

    /**
     * 保存下载数据到本地
     */
    private async saveDownloadedData(data: unknown, path: string): Promise<void> {
        if (this.isNative()) {
            const writablePath = jsb.fileUtils.getWritablePath();
            const fullPath = `${writablePath}${DOWNLOAD_STORAGE_PATH}/${path}`;
            const dirPath = fullPath.substring(0, fullPath.lastIndexOf('/'));

            // 确保目录存在
            if (!jsb.fileUtils.isDirectoryExist(dirPath)) {
                jsb.fileUtils.createDirectory(dirPath);
            }

            let buffer: Uint8Array;
            if (data instanceof ArrayBuffer) {
                buffer = new Uint8Array(data);
            } else if (ArrayBuffer.isView(data)) {
                const view = data as ArrayBufferView;
                buffer = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
            } else if (typeof data === 'string') {
                buffer = new TextEncoder().encode(data);
            } else {
                console.warn(`[DownloadManager] Unsupported data type for: ${path}`);
                return;
            }

            jsb.fileUtils.writeDataToFile(buffer, fullPath);
        } else {
            // Web 平台：下载器已处理，数据持久化由业务层通过 IndexedDB 实现
            const length = (data as ArrayBuffer)?.byteLength ?? (data as string)?.length ?? 0;
            console.log(`[DownloadManager] Web download completed, size: ${length} bytes`);
        }
    }

    private getFileExt(url: string): string {
        const match = url.match(/\.([\w]+)(\?.*)?$/);
        return match ? `.${match[1]}` : '.bin';
    }

    private isNative(): boolean {
        return typeof jsb !== 'undefined' && !!jsb.fileUtils;
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}