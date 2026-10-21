import { _decorator, Component, sys } from 'cc';

export interface TableSchema {
    name: string;
    columns: {
        name: string;
        type: 'INTEGER' | 'REAL' | 'TEXT' | 'BOOLEAN' | 'DATE';
        primaryKey?: boolean;
        autoIncrement?: boolean;
        notNull?: boolean;
        defaultValue?: any;
    }[];
    indexes?: {
        name: string;
        columns: string[];
        unique?: boolean;
    }[];
}

export interface QueryOptions {
    where?: Record<string, any> | ((row: Record<string, any>) => boolean);
    orderBy?: string;
    order?: 'ASC' | 'DESC';
    limit?: number;
    offset?: number;
}

export interface QueryResult {
    rows: Record<string, any>[];
    count: number;
}

export class LocalDB {
    private static _instance: LocalDB = null;
    private _dbName: string = 'localdb';
    private _tables: Record<string, TableSchema> = {};
    private _data: Record<string, Record<string, any>[]> = {};
    private _indexes: Record<string, Record<string, Set<any>>> = {};
    private _nextId: Record<string, number> = {};
    private _isTransaction: boolean = false;
    private _saveTimeoutId: number = null;

    private constructor() { }

    static getInstance(): LocalDB {
        if (!LocalDB._instance) {
            LocalDB._instance = new LocalDB();
        }
        return LocalDB._instance;
    }

    init(dbName: string = 'localdb'): void {
        this._dbName = dbName;
        this._loadFromStorage();
    }

    private _storageKey(key: string): string {
        return `${this._dbName}_${key}`;
    }

    private _loadFromStorage(): void {
        const tablesStr = sys.localStorage.getItem(this._storageKey('tables'));
        if (tablesStr) {
            this._tables = JSON.parse(tablesStr);
        }

        const nextIdStr = sys.localStorage.getItem(this._storageKey('nextId'));
        if (nextIdStr) {
            this._nextId = JSON.parse(nextIdStr);
        }

        for (const tableName of Object.keys(this._tables)) {
            const dataStr = sys.localStorage.getItem(this._storageKey(`data_${tableName}`));
            if (dataStr) {
                this._data[tableName] = JSON.parse(dataStr);
            } else {
                this._data[tableName] = [];
            }

            const indexesStr = sys.localStorage.getItem(this._storageKey(`indexes_${tableName}`));
            if (indexesStr) {
                const rawIndexes = JSON.parse(indexesStr);
                this._indexes[tableName] = {};
                for (const idxName of Object.keys(rawIndexes)) {
                    this._indexes[tableName][idxName] = new Set(rawIndexes[idxName]);
                }
            }
        }
    }

    private _saveToStorage(): void {
        if (this._isTransaction) return;

        if (this._saveTimeoutId) {
            clearTimeout(this._saveTimeoutId);
        }

        this._saveTimeoutId = setTimeout(() => {
            sys.localStorage.setItem(this._storageKey('tables'), JSON.stringify(this._tables));
            sys.localStorage.setItem(this._storageKey('nextId'), JSON.stringify(this._nextId));

            for (const tableName of Object.keys(this._tables)) {
                if (this._data[tableName]) {
                    sys.localStorage.setItem(this._storageKey(`data_${tableName}`), JSON.stringify(this._data[tableName]));
                }

                if (this._indexes[tableName]) {
                    const rawIndexes: Record<string, any[]> = {};
                    for (const idxName of Object.keys(this._indexes[tableName])) {
                        rawIndexes[idxName] = Array.from(this._indexes[tableName][idxName]);
                    }
                    sys.localStorage.setItem(this._storageKey(`indexes_${tableName}`), JSON.stringify(rawIndexes));
                }
            }

            this._saveTimeoutId = null;
        }, 50) as unknown as number;
    }

    private _forceSave(): void {
        if (this._saveTimeoutId) {
            clearTimeout(this._saveTimeoutId);
            this._saveTimeoutId = null;
        }

        sys.localStorage.setItem(this._storageKey('tables'), JSON.stringify(this._tables));
        sys.localStorage.setItem(this._storageKey('nextId'), JSON.stringify(this._nextId));

        for (const tableName of Object.keys(this._tables)) {
            if (this._data[tableName]) {
                sys.localStorage.setItem(this._storageKey(`data_${tableName}`), JSON.stringify(this._data[tableName]));
            }

            if (this._indexes[tableName]) {
                const rawIndexes: Record<string, any[]> = {};
                for (const idxName of Object.keys(this._indexes[tableName])) {
                    rawIndexes[idxName] = Array.from(this._indexes[tableName][idxName]);
                }
                sys.localStorage.setItem(this._storageKey(`indexes_${tableName}`), JSON.stringify(rawIndexes));
            }
        }
    }

    beginTransaction(): void {
        this._isTransaction = true;
    }

    commitTransaction(): void {
        this._isTransaction = false;
        this._forceSave();
    }

    rollbackTransaction(): void {
        this._isTransaction = false;
        this._loadFromStorage();
    }

    createTable(schema: TableSchema): void {
        if (this._tables[schema.name]) {
            console.warn(`[LocalDB] 表 ${schema.name} 已存在`);
            return;
        }

        const primaryKey = schema.columns.find(c => c.primaryKey);
        if (!primaryKey) {
            schema.columns.push({
                name: 'id',
                type: 'INTEGER',
                primaryKey: true,
                autoIncrement: true
            });
        }

        this._tables[schema.name] = schema;
        this._data[schema.name] = [];
        this._nextId[schema.name] = 1;
        this._indexes[schema.name] = {};

        if (schema.indexes) {
            for (const index of schema.indexes) {
                this._createIndex(schema.name, index.name, index.columns, index.unique);
            }
        }

        this._saveToStorage();
        console.log(`[LocalDB] 表 ${schema.name} 创建成功`);
    }

    private _createIndex(tableName: string, indexName: string, columns: string[], unique?: boolean): void {
        if (!this._indexes[tableName]) {
            this._indexes[tableName] = {};
        }
        this._indexes[tableName][indexName] = new Set();

        for (const row of this._data[tableName]) {
            const key = columns.map(col => row[col]).join('|');
            this._indexes[tableName][indexName].add(key);
        }

        console.log(`[LocalDB] 索引 ${indexName} 创建成功`);
    }

    addIndex(tableName: string, indexName: string, columns: string[], unique?: boolean): void {
        if (!this._tables[tableName]) {
            throw new Error(`[LocalDB] 表 ${tableName} 不存在`);
        }

        if (this._indexes[tableName] && this._indexes[tableName][indexName]) {
            console.warn(`[LocalDB] 索引 ${indexName} 已存在`);
            return;
        }

        this._createIndex(tableName, indexName, columns, unique);
        this._saveToStorage();
    }

    dropTable(tableName: string): void {
        if (!this._tables[tableName]) {
            throw new Error(`[LocalDB] 表 ${tableName} 不存在`);
        }

        delete this._tables[tableName];
        delete this._data[tableName];
        delete this._nextId[tableName];
        delete this._indexes[tableName];

        sys.localStorage.removeItem(this._storageKey(`data_${tableName}`));
        sys.localStorage.removeItem(this._storageKey(`indexes_${tableName}`));

        this._saveToStorage();
        console.log(`[LocalDB] 表 ${tableName} 删除成功`);
    }

    existsTable(tableName: string): boolean {
        return !!this._tables[tableName];
    }

    /**
     * 向已有表添加新列（迁移用）
     */
    addColumn(tableName: string, column: { name: string; type: 'INTEGER' | 'REAL' | 'TEXT' | 'BOOLEAN' | 'DATE'; defaultValue?: any }): void {
        if (!this._tables[tableName]) {
            throw new Error(`[LocalDB] 表 ${tableName} 不存在`);
        }

        const schema = this._tables[tableName];
        if (schema.columns.find(c => c.name === column.name)) {
            return; // 列已存在，跳过
        }

        schema.columns.push({ ...column, notNull: false });
        const defaultValue = column.defaultValue !== undefined ? column.defaultValue : null;

        // 为已有行填充默认值
        for (const row of this._data[tableName]) {
            if (!(column.name in row)) {
                row[column.name] = defaultValue;
            }
        }

        this._saveToStorage();
        console.log(`[LocalDB] 表 ${tableName} 添加列 ${column.name} 成功`);
    }

    getTableSchema(tableName: string): TableSchema | null {
        return this._tables[tableName] || null;
    }

    insert(tableName: string, data: Record<string, any>): number {
        if (!this._tables[tableName]) {
            throw new Error(`[LocalDB] 表 ${tableName} 不存在`);
        }

        const schema = this._tables[tableName];
        const row: Record<string, any> = {};

        for (const column of schema.columns) {
            if (data.hasOwnProperty(column.name)) {
                row[column.name] = this._castValue(data[column.name], column.type);
            } else if (column.defaultValue !== undefined) {
                row[column.name] = column.defaultValue;
            } else if (column.autoIncrement && column.primaryKey) {
                row[column.name] = this._nextId[tableName]++;
            } else if (column.notNull) {
                throw new Error(`[LocalDB] 字段 ${column.name} 不能为空`);
            } else {
                row[column.name] = null;
            }
        }

        this._data[tableName].push(row);
        this._updateIndexes(tableName, row);
        this._saveToStorage();

        return row[schema.columns.find(c => c.primaryKey)?.name || 'id'];
    }

    batchInsert(tableName: string, dataList: Record<string, any>[]): number[] {
        if (!this._tables[tableName]) {
            throw new Error(`[LocalDB] 表 ${tableName} 不存在`);
        }

        const schema = this._tables[tableName];
        const ids: number[] = [];

        this.beginTransaction();

        for (const data of dataList) {
            const row: Record<string, any> = {};

            for (const column of schema.columns) {
                if (data.hasOwnProperty(column.name)) {
                    row[column.name] = this._castValue(data[column.name], column.type);
                } else if (column.defaultValue !== undefined) {
                    row[column.name] = column.defaultValue;
                } else if (column.autoIncrement && column.primaryKey) {
                    row[column.name] = this._nextId[tableName]++;
                } else if (column.notNull) {
                    this.rollbackTransaction();
                    throw new Error(`[LocalDB] 字段 ${column.name} 不能为空`);
                } else {
                    row[column.name] = null;
                }
            }

            this._data[tableName].push(row);
            this._updateIndexes(tableName, row);
            ids.push(row[schema.columns.find(c => c.primaryKey)?.name || 'id']);
        }

        this.commitTransaction();
        return ids;
    }

    private _castValue(value: any, type: string): any {
        switch (type) {
            case 'INTEGER':
                if (typeof value === 'boolean') return value ? 1 : 0;
                return parseInt(value, 10) || 0;
            case 'REAL':
                return parseFloat(value) || 0;
            case 'BOOLEAN':
                return !!value ? 1 : 0;
            case 'DATE':
                return typeof value === 'string' ? value : new Date().toISOString();
            default:
                return value;
        }
    }

    private _updateIndexes(tableName: string, row: Record<string, any>): void {
        if (!this._indexes[tableName]) return;

        for (const [idxName, idxColumns] of Object.entries(this._getIndexColumns(tableName))) {
            const key = idxColumns.map(col => row[col]).join('|');
            this._indexes[tableName][idxName].add(key);
        }
    }

    private _getIndexColumns(tableName: string): Record<string, string[]> {
        const result: Record<string, string[]> = {};
        const schema = this._tables[tableName];
        if (schema.indexes) {
            for (const idx of schema.indexes) {
                result[idx.name] = idx.columns;
            }
        }
        return result;
    }

    update(tableName: string, data: Record<string, any>, options: QueryOptions): number {
        if (!this._tables[tableName]) {
            throw new Error(`[LocalDB] 表 ${tableName} 不存在`);
        }

        const schema = this._tables[tableName];
        let updatedCount = 0;

        for (let i = 0; i < this._data[tableName].length; i++) {
            const row = this._data[tableName][i];
            if (this._matchWhere(row, options.where)) {
                for (const key of Object.keys(data)) {
                    const column = schema.columns.find(c => c.name === key);
                    if (column && !column.primaryKey) {
                        row[key] = this._castValue(data[key], column.type);
                    }
                }

                this._updateIndexes(tableName, row);
                updatedCount++;
            }
        }

        if (updatedCount > 0) {
            this._saveToStorage();
        }

        return updatedCount;
    }

    delete(tableName: string, options: QueryOptions): number {
        if (!this._tables[tableName]) {
            throw new Error(`[LocalDB] 表 ${tableName} 不存在`);
        }

        const originalLength = this._data[tableName].length;
        this._data[tableName] = this._data[tableName].filter(row => !this._matchWhere(row, options.where));

        const deletedCount = originalLength - this._data[tableName].length;

        if (deletedCount > 0) {
            this._rebuildIndexes(tableName);
            this._saveToStorage();
        }

        return deletedCount;
    }

    private _rebuildIndexes(tableName: string): void {
        if (!this._indexes[tableName]) return;

        const schema = this._tables[tableName];
        if (!schema.indexes) return;

        this._indexes[tableName] = {};
        for (const index of schema.indexes) {
            this._createIndex(tableName, index.name, index.columns, index.unique);
        }
    }

    query(tableName: string, options: QueryOptions = {}): QueryResult {
        if (!this._tables[tableName]) {
            throw new Error(`[LocalDB] 表 ${tableName} 不存在`);
        }

        let rows = [...this._data[tableName]];

        if (options.where) {
            rows = rows.filter(row => this._matchWhere(row, options.where));
        }

        if (options.orderBy) {
            rows.sort((a, b) => {
                const valA = a[options.orderBy!];
                const valB = b[options.orderBy!];
                if (valA < valB) return options.order === 'DESC' ? 1 : -1;
                if (valA > valB) return options.order === 'DESC' ? -1 : 1;
                return 0;
            });
        }

        const offset = options.offset || 0;
        const limit = options.limit || rows.length;
        const paginatedRows = rows.slice(offset, offset + limit);

        return {
            rows: paginatedRows,
            count: rows.length
        };
    }

    findOne(tableName: string, options: QueryOptions = {}): Record<string, any> | null {
        const result = this.query(tableName, { ...options, limit: 1 });
        return result.rows.length > 0 ? result.rows[0] : null;
    }

    findById(tableName: string, id: number): Record<string, any> | null {
        const schema = this._tables[tableName];
        if (!schema) {
            throw new Error(`[LocalDB] 表 ${tableName} 不存在`);
        }

        const primaryKey = schema.columns.find(c => c.primaryKey)?.name || 'id';
        return this.findOne(tableName, { where: { [primaryKey]: id } });
    }

    count(tableName: string, options: QueryOptions = {}): number {
        if (!this._tables[tableName]) {
            throw new Error(`[LocalDB] 表 ${tableName} 不存在`);
        }

        let rows = this._data[tableName];
        if (options.where) {
            rows = rows.filter(row => this._matchWhere(row, options.where));
        }
        return rows.length;
    }

    private _matchWhere(row: Record<string, any>, where?: Record<string, any> | ((row: Record<string, any>) => boolean)): boolean {
        if (!where) return true;

        if (typeof where === 'function') {
            return where(row);
        }

        for (const [key, value] of Object.entries(where)) {
            if (row[key] !== value) {
                return false;
            }
        }
        return true;
    }

    getAll(tableName: string): Record<string, any>[] {
        if (!this._tables[tableName]) {
            throw new Error(`[LocalDB] 表 ${tableName} 不存在`);
        }
        return [...this._data[tableName]];
    }

    truncate(tableName: string): void {
        if (!this._tables[tableName]) {
            throw new Error(`[LocalDB] 表 ${tableName} 不存在`);
        }

        this._data[tableName] = [];
        this._nextId[tableName] = 1;
        this._rebuildIndexes(tableName);
        this._saveToStorage();
        console.log(`[LocalDB] 表 ${tableName} 已清空`);
    }

    dropDatabase(): void {
        sys.localStorage.clear();
        this._tables = {};
        this._data = {};
        this._nextId = {};
        this._indexes = {};
        console.log('[LocalDB] 数据库已删除');
    }

    getTableNames(): string[] {
        return Object.keys(this._tables);
    }

    getTableCount(tableName: string): number {
        if (!this._tables[tableName]) {
            throw new Error(`[LocalDB] 表 ${tableName} 不存在`);
        }
        return this._data[tableName].length;
    }

    static destroy(): void {
        LocalDB._instance = null;
    }
}