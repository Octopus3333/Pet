import { native, sys } from 'cc';

/**
 * 相册保存结果
 */
export interface SaveImageResult {
    /** 是否保存成功 */
    success: boolean;
    /** 结果描述 */
    msg: string;
    /** 保存后的本地路径（部分平台/系统可能为空，仅作参考） */
    path?: string;
}

/**
 * 权限状态
 * - granted：已授权
 * - denied：被拒绝（或被系统限制）
 * - not_determined：尚未询问（iOS 专属，Android 无此态）
 * - unsupported：当前平台不支持
 */
export type PermissionState = 'granted' | 'denied' | 'not_determined' | 'unsupported';

/**
 * 像素格式（目前固定 RGBA8888）
 */
export interface PixelData {
    /** RGBA 像素数据，顶到底行序 */
    pixels: Uint8Array;
    width: number;
    height: number;
}

/**
 * 相册保存工具（Android / iOS）
 *
 * Android：通过 native.reflection 调用 com.comma.club.pet.world.story.AlbumSaver
 *          异步结果通过 JsbBridge.sendToScript 回传
 * iOS：    通过 native.bridge（JsbBridge 单回调）与原生 AlbumSaver 通信
 *
 * 注意：内部使用单槽位保存 in-flight 的 resolve，建议串行调用，不要并发保存。
 */
export class AlbumSaver {

    /** Android Java 类路径 */
    private static readonly JAVA_CLASS = 'com/comma/club/pet/world/story/AlbumSaver';

    // iOS 事件名
    private static readonly IOS_EVT_PERM = 'albumPermission';
    private static readonly IOS_EVT_SAVE = 'albumSave';
    private static readonly IOS_EVT_PERM_RESULT = 'albumPermissionResult';
    private static readonly IOS_EVT_SAVE_RESULT = 'albumSaveResult';

    // 结果事件名（Android / iOS 共用）
    private static readonly EVT_PERM_RESULT = 'albumPermissionResult';
    private static readonly EVT_SAVE_RESULT = 'albumSaveResult';

    private static _bridgesRegistered = false;
    private static _permResolve: ((s: PermissionState) => void) | null = null;
    private static _saveResolve: ((r: SaveImageResult) => void) | null = null;

    private static get isAndroid(): boolean {
        return sys.isNative && sys.platform === sys.Platform.ANDROID;
    }

    private static get isIOS(): boolean {
        return sys.isNative && sys.platform === sys.Platform.IOS;
    }

    private static get isWeb(): boolean {
        return sys.isBrowser;
    }

    /**
     * 检查相册写入权限（不弹窗）
     */
    static async checkPermission(): Promise<PermissionState> {
        if (this.isWeb) return 'granted'; // H5 无需权限
        this._registerBridges();
        if (this.isAndroid) {
            const granted = this.androidCall('hasWritePermission', '()Z');
            return granted ? 'granted' : 'denied';
        }
        if (this.isIOS) {
            return this._iosRequestPermission('check');
        }
        return 'unsupported';
    }

    /**
     * 申请相册写入权限（会弹系统授权框）
     * - Android < 10：申请 WRITE_EXTERNAL_STORAGE
     * - Android >= 10 / iOS：写相册无需/由系统在写入时弹窗
     */
    static async requestPermission(): Promise<PermissionState> {
        if (this.isWeb) return 'granted'; // H5 无需权限
        this._registerBridges();
        if (this.isAndroid) {
            if (this.androidCall('hasWritePermission', '()Z')) return 'granted';
            return this._androidRequestPermission();
        }
        if (this.isIOS) {
            return this._iosRequestPermission('request');
        }
        return 'unsupported';
    }

    /**
     * 把 RGBA 像素数据保存到相册（内部：先落临时文件，再调用原生保存）
     * @param data 像素数据（pixels 须为顶到底行序的 RGBA8888）
     */
    static async savePixelsToAlbum(data: PixelData): Promise<SaveImageResult> {
        console.log("savePixelsToAlbum")
        if (this.isWeb) {
            return this._webSave(data);
        }
        if (!this.isAndroid && !this.isIOS) {
            return { success: false, msg: '仅支持原生平台（Android/iOS）或 Web 平台' };
        }
        const filePath = this.writeTempRgbaFile(data.pixels);
        if (!filePath) {
            return { success: false, msg: '写入临时文件失败' };
        }
        try {
            return await this.saveImageFileToAlbum(filePath, data.width, data.height);
        } finally {
            this.removeTempFile(filePath);
        }
    }

    /**
     * 把已落盘的 RGBA 临时文件保存到相册
     * 会先检查权限，未授权时自动申请；申请被拒绝则直接返回失败。
     */
    static async saveImageFileToAlbum(
        filePath: string,
        width: number,
        height: number
    ): Promise<SaveImageResult> {
        if (this.isWeb) {
            return { success: false, msg: 'Web 平台不支持从文件保存，请使用 savePixelsToAlbum' };
        }
        this._registerBridges();

        // 1. 检查 / 申请权限
        const state = await this.checkPermission();
        if (state === 'unsupported') {
            return { success: false, msg: '不支持的平台' };
        }
        if (state !== 'granted') {
            const after = await this.requestPermission();
            if (after !== 'granted') {
                return { success: false, msg: '相册权限被拒绝' };
            }
        }

        // 2. 调用原生保存
        if (this.isAndroid) {
            return this._androidSave(filePath, width, height);
        }
        return this._iosSave(filePath, width, height);
    }

    // ===================== Web =====================

    /**
     * H5 平台保存逻辑：通过 Base64 触发浏览器下载
     */
    private static async _webSave(data: PixelData): Promise<SaveImageResult> {
        console.log("_webSave=====",data)
        try {
            const base64 = this.pixelsToBase64Png(data.pixels, data.width, data.height);
            const fileName = `cocos_album_${Date.now()}.png`;
            
            // 创建一个临时的 a 标签来触发下载
            const a = document.createElement('a');
            a.href = base64;
            a.download = fileName;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            return { success: true, msg: '触发下载成功' };
        } catch (e) {
            console.error('[AlbumSaver] _webSave 失败:', e);
            return { success: false, msg: 'H5 下载失败' };
        }
    }

    /**
     * 将 RGBA 像素数据转换为 PNG 格式的 Base64 字符串
     * 注意：此方法在 Web 环境下有效，需要浏览器支持 Canvas
     */
    private static pixelsToBase64Png(pixels: Uint8Array, width: number, height: number): string {
        // 创建一个临时 Canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return '';

        // 创建 ImageData 对象
        const imageData = ctx.createImageData(width, height);
        // 注意：Cocos 的像素数据是顶到底的顺序，而 Canvas 的 ImageData 也是顶到底的顺序，所以可以直接赋值
        imageData.data.set(pixels);

        // 将 ImageData 绘制到 Canvas 上
        ctx.putImageData(imageData, 0, 0);

        // 转换为 Base64 (PNG 格式)
        return canvas.toDataURL('image/png');
    }

    // ===================== Android =====================

    private static androidCall(method: string, sig: string, ...args: any[]): any {
        try {
            return native.reflection.callStaticMethod(this.JAVA_CLASS, method, sig, ...args);
        } catch (e) {
            console.error('[AlbumSaver] androidCall ' + method + ' 失败:', e);
            return null;
        }
    }

    private static _androidRequestPermission(): Promise<PermissionState> {
        return new Promise<PermissionState>((resolve) => {
            this._permResolve = resolve;
            this.androidCall('requestWritePermission', '()V');
            // 超时保护
            setTimeout(() => {
                if (this._permResolve) {
                    this._permResolve = null;
                    resolve('denied');
                }
            }, 30000);
        });
    }

    private static _androidSave(filePath: string, width: number, height: number): Promise<SaveImageResult> {
        return new Promise<SaveImageResult>((resolve) => {
            this._saveResolve = resolve;
            this.androidCall(
                'saveImage',
                '(Ljava/lang/String;II)V',
                filePath, width, height
            );
            setTimeout(() => {
                if (this._saveResolve) {
                    this._saveResolve = null;
                    resolve({ success: false, msg: '保存超时' });
                }
            }, 60000);
        });
    }

    // ===================== iOS =====================

    private static _iosRequestPermission(action: 'check' | 'request'): Promise<PermissionState> {
        return new Promise<PermissionState>((resolve) => {
            this._permResolve = resolve;
            native.bridge.sendToNative(this.IOS_EVT_PERM, JSON.stringify({ action }));
            setTimeout(() => {
                if (this._permResolve) {
                    this._permResolve = null;
                    resolve('denied');
                }
            }, 30000);
        });
    }

    private static _iosSave(filePath: string, width: number, height: number): Promise<SaveImageResult> {
        return new Promise<SaveImageResult>((resolve) => {
            this._saveResolve = resolve;
            native.bridge.sendToNative(
                this.IOS_EVT_SAVE,
                JSON.stringify({ filePath, width, height })
            );
            setTimeout(() => {
                if (this._saveResolve) {
                    this._saveResolve = null;
                    resolve({ success: false, msg: '保存超时' });
                }
            }, 60000);
        });
    }

    // ===================== 结果回调（Android / iOS 共用） =====================

    private static _registerBridges(): void {
        if (this._bridgesRegistered) return;
        this._bridgesRegistered = true;
        native.bridge.onNative(this.EVT_PERM_RESULT, (json) => this._onPermResult(json));
        native.bridge.onNative(this.EVT_SAVE_RESULT, (json) => this._onSaveResult(json));
    }

    private static _onPermResult(json: string): void {
        if (!this._permResolve) return;
        let state: PermissionState = 'denied';
        try {
            const r = JSON.parse(json);
            if (r && typeof r.state === 'string') {
                state = r.state as PermissionState;
            } else if (r && r.granted) {
                state = 'granted';
            }
        } catch (e) {
            console.error('[AlbumSaver] _onPermResult 解析失败:', e);
        }
        const cb = this._permResolve;
        this._permResolve = null;
        cb(state);
    }

    private static _onSaveResult(json: string): void {
        if (!this._saveResolve) return;
        let result: SaveImageResult = { success: false, msg: '结果解析失败' };
        try {
            const r = JSON.parse(json);
            result = {
                success: !!r.success,
                msg: r.msg || '',
                path: r.path,
            };
        } catch (e) {
            console.error('[AlbumSaver] _onSaveResult 解析失败:', e);
        }
        const cb = this._saveResolve;
        this._saveResolve = null;
        cb(result);
    }

    // ===================== 临时文件 =====================

    private static getFileUtils(): any {
        try {
            // 通过 globalThis 取 jsb（避免直接引用 jsb 命名空间导致 TS 类型解析问题）
            const g: any = (typeof globalThis !== 'undefined') ? globalThis : (typeof window !== 'undefined' ? (window as any) : undefined);
            const jsbRef = g ? g.jsb : undefined;
            return jsbRef ? jsbRef.fileUtils : null;
        } catch (e) {
            return null;
        }
    }

    private static writeTempRgbaFile(pixels: Uint8Array): string | null {
        const fu = this.getFileUtils();
        if (!fu || !fu.getWritablePath || !fu.writeDataToFile) return null;
        try {
            const path = fu.getWritablePath() + 'cocos_album_temp.rgba';
            // writeDataToFile 需要 ArrayBuffer；取一个干净的 ArrayBuffer 视图
            const buffer = pixels.buffer.slice(
                pixels.byteOffset,
                pixels.byteOffset + pixels.byteLength
            );
            const ok = fu.writeDataToFile(buffer, path);
            return ok ? path : null;
        } catch (e) {
            console.error('[AlbumSaver] writeTempRgbaFile 失败:', e);
            return null;
        }
    }

    private static removeTempFile(path: string): void {
        const fu = this.getFileUtils();
        if (!fu || !fu.isFileExist || !fu.removeFile) return;
        try {
            if (fu.isFileExist(path)) fu.removeFile(path);
        } catch (e) {
            // ignore
        }
    }
}
