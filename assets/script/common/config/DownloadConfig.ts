import {
    DOWNLOAD_BASE_URL,
    DOWNLOAD_STORAGE_PATH,
    HOT_UPDATE_MANIFEST_URL,
    HOT_UPDATE_VERSION_URL,
    BUNDLE_DIR,
    BUNDLE_MAX_CONCURRENT_DOWNLOADS,
    DOWNLOAD_TIMEOUT,
    DOWNLOAD_RETRY_MAX_ATTEMPTS,
    DOWNLOAD_RETRY_DELAY_MS,
} from '../consts/DownloadConsts';

export class DownloadConfig {
    private static _instance: DownloadConfig;

    private constructor() {}

    public static get instance(): DownloadConfig {
        if (!DownloadConfig._instance) {
            DownloadConfig._instance = new DownloadConfig();
        }
        return DownloadConfig._instance;
    }

    public get downloadUrl(): string {
        return DOWNLOAD_BASE_URL;
    }

    public get storagePath(): string {
        return DOWNLOAD_STORAGE_PATH;
    }

    public get manifestUrl(): string {
        return HOT_UPDATE_MANIFEST_URL;
    }

    public get versionUrl(): string {
        return HOT_UPDATE_VERSION_URL;
    }

    public get bundleDir(): string {
        return BUNDLE_DIR;
    }

    public get maxConcurrentDownloads(): number {
        return BUNDLE_MAX_CONCURRENT_DOWNLOADS;
    }

    public get timeout(): number {
        return DOWNLOAD_TIMEOUT;
    }

    public get maxRetryAttempts(): number {
        return DOWNLOAD_RETRY_MAX_ATTEMPTS;
    }

    public get retryDelayMs(): number {
        return DOWNLOAD_RETRY_DELAY_MS;
    }
}
