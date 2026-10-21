/**
 * 网络系统公共常量配置
 * 所有网络相关配置统一在此维护，避免通过实例或数据结构传递
 */

/** Socket 服务器地址 */
export const SOCKET_HOST = '127.0.0.1';

/** Socket 服务器端口 */
export const SOCKET_PORT = 8080;

/** HTTP 基础地址 */
export const HTTP_BASE_URL = 'https://commafamily-api.24nyae.cn/commafamily';

/** 网络请求失败最大重试次数 */
export const NETWORK_RETRY_MAX_ATTEMPTS = 3;

/** 网络请求重试延迟（毫秒） */
export const NETWORK_RETRY_DELAY_MS = 1000;

/** 网络请求重试退避因子 */
export const NETWORK_RETRY_BACKOFF_FACTOR = 2;

/** HTTP 请求超时时间（毫秒） */
export const HTTP_REQUEST_TIMEOUT = 10000;

/** Socket 连接超时时间（毫秒） */
export const SOCKET_CONNECT_TIMEOUT = 5000;

/** Socket 心跳间隔（毫秒） */
export const SOCKET_PING_INTERVAL = 10000;
