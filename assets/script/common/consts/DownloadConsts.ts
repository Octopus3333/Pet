/**
 * 下载系统公共常量配置
 * 所有下载相关配置统一在此维护，避免通过实例或数据结构传递
 *
 * 使用说明：
 * - 部署时修改 DOWNLOAD_BASE_URL 为实际 CDN 地址
 * - HOT_UPDATE_MANIFEST_URL 指向 project.manifest 文件
 * - HOT_UPDATE_VERSION_URL 指向 version.manifest 文件（文本格式，仅包含版本号）
 */

/** 下载资源基础地址（CDN 地址，部署时修改） */
export const DOWNLOAD_BASE_URL = 'http://127.0.0.1:3000/download';

/** 本地资源存储路径（相对于可写路径） */
export const DOWNLOAD_STORAGE_PATH = 'remote-assets';

export const BUNDLE_MAX_CONCURRENT_DOWNLOADS = 3
/**
 * 热更新 manifest 文件地址
 * manifest 格式（CC 3.8.6）:
 * {
 *   "packageUrl": "http://xxx/remote",
 *   "remoteManifestUrl": "http://xxx/remote/project.manifest",
 *   "remoteVersionUrl": "http://xxx/remote/version.manifest",
 *   "version": "1.0.0",
 *   "assets": { "main/index.js": { "size": 1234, "md5": "abc" } },
 *   "searchPaths": []
 * }
 */
export const HOT_UPDATE_MANIFEST_URL = 'http://127.0.0.1:3000/remote/project.manifest';

/** 热更新版本文件地址（纯文本，仅包含版本号如 "1.0.1"） */
export const HOT_UPDATE_VERSION_URL = 'http://127.0.0.1:3000/remote/version.manifest';

/** 分包资源目录 */
export const BUNDLE_DIR = 'bundles';

/** 下载最大并发数 */
export const DOWNLOAD_MAX_CONCURRENT_DOWNLOADS = 3;

/** 下载超时时间（毫秒） */
export const DOWNLOAD_TIMEOUT = 30000;

/** 下载失败最大重试次数 */
export const DOWNLOAD_RETRY_MAX_ATTEMPTS = 3;

/** 下载重试延迟（毫秒） */
export const DOWNLOAD_RETRY_DELAY_MS = 2000;