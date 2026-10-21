/**
 * 数据库管理器
 * 单例模式，自动根据平台选择引擎：
 *   - Android / iOS：NativeSqliteEngine（原生 SQLite）
 *   - Web / 编辑器：StorageEngine（localStorage 持久化）
 *
 * 使用方式：
 *   await DBManager.ins.init('chat.db');
 */
import { sys } from 'cc';
import { IDatabaseEngine } from './IEngine';
import { StorageEngine } from './StorageEngine';
import { NativeSqliteEngine } from './NativeSqliteEngine';

export class DBManager {
    private static _ins: DBManager | null = null;

    private _engine: IDatabaseEngine | null = null;
    private _dbName: string = '';

    static get ins(): DBManager {
        if (!DBManager._ins) {
            DBManager._ins = new DBManager();
        }
        return DBManager._ins;
    }

    private constructor() {}

    /**
     * 初始化数据库（自动选择引擎 + 打开）
     */
    async init(dbName: string = 'chat.db'): Promise<void> {
        if (this._engine && this._engine.isOpen()) {
            console.log(`[DBManager] 数据库已打开: ${this._dbName}`);
            return;
        }

        if (!this._engine) {
            this._engine = this._createEngine();
        }

        this._dbName = dbName;
        console.log(`[DBManager] ========== 初始化数据库 ==========`);
        console.log(`[DBManager] 平台: ${sys.platform}, 原生: ${sys.isNative}`);
        console.log(`[DBManager] 引擎: ${this._engine.constructor.name}`);
        console.log(`[DBManager] 数据库: ${dbName}`);
        await this._engine.open(dbName);
        console.log(`[DBManager] ✅ 数据库已就绪`);
    }

    /** 兼容旧接口 */
    async open(dbName: string = 'chat.db'): Promise<void> {
        return this.init(dbName);
    }

    async close(): Promise<void> {
        if (this._engine) {
            await this._engine.close();
        }
    }

    isOpen(): boolean {
        return this._engine ? this._engine.isOpen() : false;
    }

    getEngine(): IDatabaseEngine | null {
        return this._engine;
    }

    async execute(sql: string, params?: any[]): Promise<{ affectedRows: number }> {
        this._ensureOpen();
        return this._engine!.execute(sql, params);
    }

    async query<T>(sql: string, params?: any[]): Promise<T[]> {
        this._ensureOpen();
        return this._engine!.query<T>(sql, params);
    }

    async initTables(schemas: string[]): Promise<void> {
        for (const sql of schemas) {
            await this.execute(sql);
        }
        console.log(`[DBManager] ${schemas.length} 张表初始化完成`);
    }

    private _createEngine(): IDatabaseEngine {
        if (sys.isNative) {
            console.log('[DBManager] 选择 NativeSqliteEngine（原生 SQLite）');
            return new NativeSqliteEngine();
        }
        console.log('[DBManager] 选择 StorageEngine（localStorage 存储）');
        return new StorageEngine();
    }

    private _ensureOpen(): void {
        if (!this._engine || !this._engine.isOpen()) {
            throw new Error('[DBManager] 数据库未打开，请先调用 DBManager.ins.init()');
        }
    }
}