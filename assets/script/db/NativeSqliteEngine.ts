/**
 * 原生 SQLite 数据库引擎（Android / iOS）
 *
 * Android：通过 JSB 反射调用 Java 类 SqliteHelper
 * iOS：通过 JsbBridge 调用原生 SqliteHelper
 *
 * Java 端：native/engine/android/app/src/.../SqliteHelper.java
 * iOS 端：native/engine/ios/SqliteHelper.h / SqliteHelper.mm
 */
import { native, sys } from 'cc';
import { IDatabaseEngine } from './IEngine';

/** Android Java 类 */
const JAVA_CLASS = 'com/comma/club/pet/world/story/SqliteHelper';

/** iOS Bridge 事件名 */
const IOS_EVENT = 'sqlite';

export class NativeSqliteEngine implements IDatabaseEngine {
    private _opened = false;
    private _pendingResolve: ((value: any) => void) | null = null;
    private _pendingReject: ((reason: any) => void) | null = null;

    async open(dbName: string): Promise<void> {
        if (sys.platform === sys.Platform.ANDROID) {
            native.reflection.callStaticMethod(JAVA_CLASS, 'open', '(Ljava/lang/String;)V', dbName);
            this._opened = true;
            console.log(`[NativeSqliteEngine] ✅ Android SQLite 已打开: ${dbName}`);
        } else if (sys.platform === sys.Platform.IOS) {
            // iOS 使用 JsbBridge
            this._registerIosBridge();
            await this._iosCall('open', { dbName });
            this._opened = true;
            console.log(`[NativeSqliteEngine] ✅ iOS SQLite 已打开: ${dbName}`);
        } else {
            throw new Error(`[NativeSqliteEngine] 不支持的平台: ${sys.platform}`);
        }
    }

    async close(): Promise<void> {
        if (!this._opened) return;
        if (sys.platform === sys.Platform.ANDROID) {
            native.reflection.callStaticMethod(JAVA_CLASS, 'close', '()V');
        } else if (sys.platform === sys.Platform.IOS) {
            await this._iosCall('close', {});
        }
        this._opened = false;
        console.log('[NativeSqliteEngine] SQLite 已关闭');
    }

    isOpen(): boolean {
        return this._opened;
    }

    async execute(sql: string, params?: any[]): Promise<{ affectedRows: number }> {
        const paramsJson = JSON.stringify(params || []);
        let affectedRows = 0;

        if (sys.platform === sys.Platform.ANDROID) {
            affectedRows = native.reflection.callStaticMethod(
                JAVA_CLASS, 'execute',
                '(Ljava/lang/String;Ljava/lang/String;)I',
                sql, paramsJson
            ) as number;
        } else if (sys.platform === sys.Platform.IOS) {
            const result = await this._iosCall('execute', { sql, paramsJson });
            affectedRows = result?.affectedRows ?? 0;
        }

        console.log(`[NativeSqliteEngine] execute | rows=${affectedRows} | ${sql.substring(0, 80)}`);
        return { affectedRows };
    }

    async query<T>(sql: string, params?: any[]): Promise<T[]> {
        const paramsJson = JSON.stringify(params || []);
        let rows: T[] = [];

        if (sys.platform === sys.Platform.ANDROID) {
            const jsonStr = native.reflection.callStaticMethod(
                JAVA_CLASS, 'query',
                '(Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;',
                sql, paramsJson
            );
            rows = (jsonStr && typeof jsonStr === 'string') ? JSON.parse(jsonStr) : [];
        } else if (sys.platform === sys.Platform.IOS) {
            const result = await this._iosCall('query', { sql, paramsJson });
            rows = result?.rows ?? [];
        }

        console.log(`[NativeSqliteEngine] query   | rows=${rows.length} | ${sql.substring(0, 80)}`);
        return rows;
    }

    // ========== iOS Bridge ==========

    private _iosCall(action: string, data: any): Promise<any> {
        return new Promise((resolve, reject) => {
            this._pendingResolve = resolve;
            this._pendingReject = reject;

            const msg = JSON.stringify({ action, ...data });
            native.bridge.sendToNative(IOS_EVENT, msg);

            // 超时保护（10秒）
            setTimeout(() => {
                if (this._pendingReject) {
                    this._pendingReject(new Error(`[NativeSqliteEngine] iOS 调用超时: ${action}`));
                    this._pendingResolve = null;
                    this._pendingReject = null;
                }
            }, 10000);
        });
    }

    private _registerIosBridge(): void {
        native.bridge.onNative(IOS_EVENT, (jsonStr: string) => {
            try {
                const result = JSON.parse(jsonStr);
                if (result.error && this._pendingReject) {
                    this._pendingReject(new Error(result.error));
                } else if (this._pendingResolve) {
                    this._pendingResolve(result);
                }
            } catch (e) {
                if (this._pendingReject) {
                    this._pendingReject(e);
                }
            }
            this._pendingResolve = null;
            this._pendingReject = null;
        });
    }
}