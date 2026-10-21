/**
 * 本地存储数据库引擎（非原生环境兜底）
 *
 * 基于 MemoryEngine 的 Map 实现 + localStorage 持久化。
 * 每次写入操作后自动保存到 localStorage，打开时自动恢复。
 *
 * 适用平台：Web 预览、编辑器
 */
import { IDatabaseEngine } from './IEngine';
import { MemoryEngine } from './MemoryEngine';

const STORAGE_KEY = 'comma_storage_db_';

export class StorageEngine implements IDatabaseEngine {
    private _engine: MemoryEngine | null = null;
    private _dbName: string = '';

    async open(dbName: string): Promise<void> {
        this._dbName = dbName;
        this._engine = new MemoryEngine();
        await this._engine.open(dbName);

        // 从 localStorage 恢复表数据
        const saved = this._loadFromStorage();
        if (saved) {
            this._engine['_tables'] = saved;
            console.log(`[StorageEngine] ✅ 从 localStorage 恢复数据: ${dbName}, 表数=${saved.size}`);
        } else {
            console.log(`[StorageEngine] 🆕 新建数据库: ${dbName}`);
        }
    }

    async close(): Promise<void> {
        if (this._engine) {
            await this._engine.close();
            this._engine = null;
        }
        console.log(`[StorageEngine] 已关闭: ${this._dbName}`);
    }

    isOpen(): boolean {
        return this._engine?.isOpen() ?? false;
    }

    async execute(sql: string, params?: any[]): Promise<{ affectedRows: number }> {
        const result = await this._engine!.execute(sql, params);
        this._persist();
        console.log(`[StorageEngine] execute | rows=${result.affectedRows} | ${sql.substring(0, 80)}`);
        return result;
    }

    async query<T>(sql: string, params?: any[]): Promise<T[]> {
        const result = await this._engine!.query<T>(sql, params);
        console.log(`[StorageEngine] query   | rows=${result.length} | ${sql.substring(0, 80)}`);
        return result;
    }

    // ========== 持久化 ==========

    private _persist(): void {
        if (!this._engine) return;
        try {
            const tables = this._engine['_tables'];
            // 序列化 Map 为 JSON
            const obj: any = {};
            for (const [name, table] of tables) {
                obj[name] = table;
            }
            localStorage.setItem(STORAGE_KEY + this._dbName, JSON.stringify(obj));
        } catch (e) {
            console.error('[StorageEngine] 持久化失败:', e);
        }
    }

    private _loadFromStorage(): Map<string, any> | null {
        try {
            const json = localStorage.getItem(STORAGE_KEY + this._dbName);
            if (!json) return null;
            const obj = JSON.parse(json);
            const map = new Map<string, any>();
            for (const key of Object.keys(obj)) {
                map.set(key, obj[key]);
            }
            return map;
        } catch (e) {
            console.error('[StorageEngine] 加载失败:', e);
            return null;
        }
    }
}