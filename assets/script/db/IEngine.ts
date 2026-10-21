/**
 * 数据库引擎抽象接口
 * 实现此接口可替换底层存储方案（sql.js / 原生SQLite / 内存模拟）
 */
export interface IDatabaseEngine {
    open(dbName: string): Promise<void>;
    close(): Promise<void>;
    execute(sql: string, params?: any[]): Promise<{ affectedRows: number }>;
    query<T>(sql: string, params?: any[]): Promise<T[]>;
    isOpen(): boolean;
}