# 养成类游戏基础框架文档

## 概述

本框架为 Cocos Creator 3.x 养成类游戏提供可扩展、可维护、稳定的基础架构，包含网络系统、下载系统和多语言翻译系统。所有模块均采用单例模式管理，配置统一通过 `common/consts/` 下的常量文件维护。

## 目录结构

```
assets/script/
├── common/                  # 框架核心模块
│   ├── config/              # 配置模块
│   │   ├── GameConfig.ts    # 全局配置入口
│   │   ├── NetworkConfig.ts # 网络配置
│   │   └── DownloadConfig.ts# 下载配置
│   ├── consts/              # 公共常量
│   │   └── DownloadConsts.ts# 下载系统常量配置
│   ├── network/             # 网络系统
│   │   ├── HttpClient.ts    # HTTP 客户端
│   │   └── SocketManager.ts # Socket 管理器
│   ├── download/            # 下载系统
│   │   ├── DownloadManager.ts    # 基础下载管理器
│   │   ├── HotUpdateManager.ts   # 热更新管理器
│   │   └── BundleDownloader.ts   # 分包下载器
│   ├── locales/             # 多语言翻译系统
│   │   ├── LocaleManager.ts # 翻译管理器
│   │   ├── types.ts         # 类型定义
│   │   ├── zh.ts            # 中文语言包
│   │   └── en.ts            # 英文语言包
│   └── utils/               # 工具类
│       └── RetryHelper.ts   # 通用重试工具
├── index.ts             # 统一导出入口
└── README.md            # 框架文档
```

## 快速开始

### 1. 初始化配置

```typescript
import { GameConfig } from './index';

GameConfig.instance.init({
    network: {
        socketHost: '127.0.0.1',
        socketPort: 8080,
        httpBaseUrl: 'http://127.0.0.1:3000',
        retry: { maxAttempts: 3, delayMs: 1000, backoffFactor: 2 },
        timeout: { httpRequest: 10000, socketConnect: 5000, socketPing: 30000 },
    },
    locale: {
        defaultLanguage: 'zh',
        fallbackLanguage: 'zh',
    },
});
```

### 2. 使用网络系统

```typescript
import { HttpClient, SocketManager } from './index';

// HTTP 请求
const response = await HttpClient.instance.get('/api/user/info');

// Socket 连接
SocketManager.instance.on('message', (event, data) => {
    console.log('收到消息:', data);
});
await SocketManager.instance.connect();
SocketManager.instance.send({ type: 'login', data: { uid: 10001 } });
```

## 网络系统

### HttpClient

HTTP 客户端封装了 `fetch`，提供统一的请求、超时、重试机制。

#### 支持的请求方法

- `get<T>(path, options?)`
- `post<T>(path, body?, options?)`
- `put<T>(path, body?, options?)`
- `delete<T>(path, options?)`
- `request<T>(options)`

#### 可配置项

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `httpBaseUrl` | HTTP 基础地址 | `http://127.0.0.1:3000` |
| `maxRetryAttempts` | 最大重试次数 | `3` |
| `retryDelayMs` | 重试延迟（毫秒） | `1000` |
| `retryBackoffFactor` | 退避因子 | `2` |
| `httpTimeout` | 请求超时时间（毫秒） | `10000` |

#### 使用示例

```typescript
const response = await HttpClient.instance.post('/api/login', {
    username: 'player',
    password: '123456',
}, {
    timeout: 5000,
    retry: { maxAttempts: 2 },
});
```

### SocketManager

基于 WebSocket 的 Socket 框架，支持断线重连、心跳检测和事件监听。

#### 生命周期方法

- `connect(): Promise<void>` - 连接服务器
- `disconnect(): void` - 断开连接
- `send(message: SocketMessage): void` - 发送消息

#### 事件类型

| 事件 | 触发时机 |
|------|----------|
| `connect` | 连接成功 |
| `disconnect` | 连接断开 |
| `error` | 发生错误 |
| `reconnect` | 重连尝试（携带尝试次数） |
| `message` | 收到消息 |

#### 使用示例

```typescript
SocketManager.instance.on('connect', () => {
    console.log('连接成功');
});

SocketManager.instance.on('reconnect', (event, attempt) => {
    console.log(`第 ${attempt} 次重连中...`);
});

SocketManager.instance.on('message', (event, message) => {
    if (message.type === 'pet_status') {
        updatePetUI(message.data);
    }
});

await SocketManager.instance.connect();
```

## 下载系统

### DownloadManager

基础下载管理器，支持并发控制、静默下载、进度回调和失败重试。

#### 主要方法

- `download(url, savePath, options?)` - 下载单个文件
- `getTask(taskId)` - 获取下载任务
- `cancelTask(taskId)` - 取消任务
- `clearCompletedTasks()` - 清理已完成任务

#### 使用示例

```typescript
const task = await DownloadManager.instance.download(
    'http://cdn.example.com/res.zip',
    'res/updates/v1.zip',
    {
        silent: true,
        onProgress: (progress, total, downloaded) => {
            console.log(`下载进度: ${progress.toFixed(2)}%`);
        },
    }
);
```

### HotUpdateManager

热更新管理器，实现版本检测、增量下载、更新应用。

#### 主要方法

- `checkForUpdate()` - 检查远程版本
- `downloadUpdate(silent?)` - 下载更新文件
- `applyUpdate()` - 应用更新并重启

#### 状态流转

```
idle -> checking -> downloading -> ready -> updating
```

#### 使用示例

```typescript
HotUpdateManager.instance.onStatusChange((status) => {
    console.log('热更新状态:', status);
});

HotUpdateManager.instance.onProgress((progress) => {
    console.log(`更新进度: ${progress.progress.toFixed(2)}%`);
});

const info = await HotUpdateManager.instance.checkForUpdate();
if (info.hasUpdate) {
    await HotUpdateManager.instance.downloadUpdate();
    await HotUpdateManager.instance.applyUpdate();
}
```

### BundleDownloader

分包下载器，用于管理游戏分包资源的下载、校验和预加载。

#### 主要方法

- `registerBundle(info)` - 注册分包信息
- `downloadBundle(name, silent?)` - 下载单个分包
- `downloadBundles(names, silent?)` - 批量下载分包
- `downloadAllBundles(silent?)` - 下载所有分包
- `preloadBundle(name)` - 预加载已下载分包

#### 使用示例

```typescript
BundleDownloader.instance.registerBundle({
    name: 'pet_cats',
    version: '1.0.0',
    url: 'http://cdn.example.com/bundles/cats.zip',
    size: 1024 * 1024,
    checksum: 'abc123',
});

await BundleDownloader.instance.downloadBundle('pet_cats', true);
await BundleDownloader.instance.preloadBundle('pet_cats');
```

## 多语言翻译系统

### LocaleManager

多语言管理器，支持嵌套 key、参数插值、语言回退和动态注册语言包。

#### 主要方法

- `init(config?)` - 初始化默认语言和回退语言
- `register(language, data)` - 注册语言包
- `setLanguage(language)` - 切换当前语言
- `t(key, params?)` - 翻译指定 key
- `has(key)` - 判断 key 是否存在

#### 使用示例

```typescript
import { LocaleManager } from './index';

LocaleManager.instance.setLanguage('en');

const text = LocaleManager.instance.t('pet.hungryTip', { name: 'Kitty' });
// 输出: Kitty is hungry, feed it now!
```

#### 添加新语言

```typescript
import { LocaleManager } from './index';

LocaleManager.instance.register('ja', {
    common: {
        confirm: '確認',
    },
});

LocaleManager.instance.setLanguage('ja');
```

## 配置项总览

### NetworkConfig

```typescript
interface NetworkConfigData {
    socketHost: string;
    socketPort: number;
    httpBaseUrl: string;
    retry: {
        maxAttempts: number;
        delayMs: number;
        backoffFactor: number;
    };
    timeout: {
        httpRequest: number;
        socketConnect: number;
        socketPing: number;
    };
}
```

### DownloadConsts

下载系统配置统一通过 `common/consts/DownloadConsts.ts` 中的常量维护，不再通过实例或数据结构动态配置。需要修改时直接编辑常量文件。

```typescript
export const DOWNLOAD_BASE_URL = 'http://127.0.0.1:3000/download';
export const DOWNLOAD_STORAGE_PATH = 'remote-assets';
export const HOT_UPDATE_MANIFEST_URL = 'http://127.0.0.1:3000/remote/manifest.json';
export const HOT_UPDATE_VERSION_URL = 'http://127.0.0.1:3000/remote/version.manifest';
export const BUNDLE_DIR = 'bundles';
export const BUNDLE_MAX_CONCURRENT_DOWNLOADS = 3;
export const DOWNLOAD_TIMEOUT = 30000;
export const DOWNLOAD_RETRY_MAX_ATTEMPTS = 3;
export const DOWNLOAD_RETRY_DELAY_MS = 2000;
```

### LocaleConfig

```typescript
interface LocaleConfig {
    defaultLanguage: string;
    fallbackLanguage: string;
}
```

## 最佳实践

1. **配置集中管理**：在游戏启动时统一通过 `GameConfig.instance.init()` 初始化所有配置。
2. **错误处理**：网络请求和下载操作应使用 `try/catch` 捕获异常。
3. **事件清理**：在组件销毁时，移除 SocketManager 和下载模块的事件监听。
4. **分包策略**：将养成场景、宠物模型、活动玩法等资源按功能拆分为分包，按需下载。
5. **语言切换**：切换语言后，刷新当前界面的文本显示。

## 注意事项

- 本框架默认使用 WebSocket 和 fetch，适用于 Web 平台。
- 原生平台（iOS/Android）的热更新建议使用 Cocos Creator 原生提供的 `jsb.AssetsManager` 替代当前基于 fetch 的实现。
- 下载系统当前基于 Node.js 文件系统 API 保存文件，Web 平台运行时可能需要适配浏览器存储方案。
