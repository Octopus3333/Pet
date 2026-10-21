/**
 * 内存数据库引擎（纯 Map 实现，兜底方案）
 *
 * 支持标准 SQL 语法的子集（CREATE TABLE / INSERT / SELECT / UPDATE / DELETE / DROP TABLE）
 * 数据仅在内存中，页面刷新后丢失，仅供测试/开发调试使用
 */
import { IDatabaseEngine } from './IEngine';

export class MemoryEngine implements IDatabaseEngine {
    private _tables: Map<string, { columns: { name: string; type: string; pk: boolean }[]; rows: any[] }> = new Map();
    private _opened = false;

    async open(_dbName: string): Promise<void> {
        this._opened = true;
        console.log(`[MemoryEngine] Opened: ${_dbName}`);
    }

    async close(): Promise<void> {
        this._tables.clear();
        this._opened = false;
        console.log('[MemoryEngine] Closed');
    }

    isOpen(): boolean {
        return this._opened;
    }

    async execute(sql: string, params?: any[]): Promise<{ affectedRows: number }> {
        const trimmed = sql.trim().toUpperCase();
        if (trimmed.startsWith('CREATE TABLE')) { this._parseCreateTable(sql); return { affectedRows: 0 }; }
        if (trimmed.startsWith('INSERT INTO')) { return this._executeInsert(sql, params); }
        if (trimmed.startsWith('UPDATE')) { return this._executeUpdate(sql, params); }
        if (trimmed.startsWith('DELETE')) { return this._executeDelete(sql, params); }
        if (trimmed.startsWith('DROP TABLE')) { return this._executeDrop(sql); }
        if (trimmed.startsWith('CREATE INDEX')) { return { affectedRows: 0 }; } // 索引在内存引擎中忽略
        console.warn(`[MemoryEngine] Unsupported SQL: ${sql}`);
        return { affectedRows: 0 };
    }

    async query<T>(sql: string, params?: any[]): Promise<T[]> {
        const trimmed = sql.trim().toUpperCase();
        if (trimmed.startsWith('SELECT')) { return this._executeSelect<T>(sql, params); }
        console.warn(`[MemoryEngine] Unsupported query: ${sql}`);
        return [];
    }

    // ========== 内部实现 ==========

    private _parseCreateTable(sql: string): void {
        const tableNameMatch = sql.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/i);
        if (!tableNameMatch) throw new Error(`Invalid CREATE TABLE: ${sql}`);
        const tableName = tableNameMatch[1];
        const columnsMatch = sql.match(/\(([^)]+)\)/);
        if (!columnsMatch) throw new Error(`Invalid CREATE TABLE columns: ${sql}`);
        const columns = columnsMatch[1].split(',').map(col => {
            const parts = col.trim().split(/\s+/);
            return { name: parts[0], type: parts[1]?.toUpperCase() || 'TEXT', pk: col.toUpperCase().includes('PRIMARY KEY') };
        });
        if (this._tables.has(tableName)) { console.log(`[MemoryEngine] Table ${tableName} already exists, skipping`); return; }
        this._tables.set(tableName, { columns, rows: [] });
        console.log(`[MemoryEngine] Table ${tableName} created`);
    }

    private _executeInsert(sql: string, params?: any[]): { affectedRows: number } {
        const match = sql.match(/INSERT\s+INTO\s+(\w+)\s*(?:\(([^)]+)\))?\s*VALUES\s*\(([^)]+)\)/i);
        if (!match) throw new Error(`Invalid INSERT: ${sql}`);
        const tableName = match[1];
        const table = this._tables.get(tableName);
        if (!table) throw new Error(`Table ${tableName} not found`);
        let colNames: string[];
        if (match[2]) { colNames = match[2].split(',').map(c => c.trim()); }
        else { colNames = table.columns.map(c => c.name); }
        const row: any = {};
        const valueExprs = match[3].split(',').map(v => v.trim());
        let paramIdx = 0;
        colNames.forEach((colName, i) => {
            const val = valueExprs[i];
            row[colName] = (val === '?') ? (params ? params[paramIdx++] : null) : this._parseLiteral(val);
        });
        const pkCol = table.columns.find(c => c.pk);
        if (pkCol && row[pkCol.name] == null) {
            const maxId = table.rows.reduce((max, r) => Math.max(max, r[pkCol.name] || 0), 0);
            row[pkCol.name] = maxId + 1;
        }
        table.rows.push(row);
        return { affectedRows: 1 };
    }

    private _executeUpdate(sql: string, params?: any[]): { affectedRows: number } {
        const match = sql.match(/UPDATE\s+(\w+)\s+SET\s+(.+?)(?:\s+WHERE\s+(.+))?$/i);
        if (!match) throw new Error(`Invalid UPDATE: ${sql}`);
        const tableName = match[1];
        const table = this._tables.get(tableName);
        if (!table) throw new Error(`Table ${tableName} not found`);
        const setClauses = match[2].split(',').map(s => { const [col, val] = s.trim().split('=').map(v => v.trim()); return { col, val }; });
        const whereClause = match[3];
        const allParams = params || [];
        // 计算 SET 子句中的 ? 数量，剩余参数给 WHERE 子句
        const setParamCount = setClauses.filter(sc => sc.val === '?').length;
        const whereParams = allParams.slice(setParamCount);
        const filtered = whereClause ? this._filterRows(table.rows, whereClause, whereParams) : table.rows;
        let affectedRows = 0;
        let paramIdx = 0;
        filtered.forEach(row => {
            setClauses.forEach(sc => { row[sc.col] = (sc.val === '?') ? (allParams[paramIdx++] ?? null) : this._parseLiteral(sc.val); });
            affectedRows++;
        });
        return { affectedRows };
    }

    private _executeDelete(sql: string, params?: any[]): { affectedRows: number } {
        const match = sql.match(/DELETE\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+))?$/i);
        if (!match) throw new Error(`Invalid DELETE: ${sql}`);
        const tableName = match[1];
        const table = this._tables.get(tableName);
        if (!table) throw new Error(`Table ${tableName} not found`);
        const whereClause = match[2];
        if (!whereClause) { const count = table.rows.length; table.rows = []; return { affectedRows: count }; }
        const before = table.rows.length;
        table.rows = this._filterRows(table.rows, whereClause, params || [], true);
        return { affectedRows: before - table.rows.length };
    }

    private _executeSelect<T>(sql: string, params?: any[]): T[] {
        // 手动解析 SQL 各子句，避免正则贪婪匹配导致 WHERE 吃掉 ORDER BY/LIMIT
        const sqlUpper = sql.toUpperCase();
        const tableMatch = sql.match(/FROM\s+(\w+)/i);
        if (!tableMatch) return [];
        const tableName = tableMatch[1];
        const table = this._tables.get(tableName);
        if (!table) { console.warn(`[MemoryEngine] Table "${tableName}" not found for SELECT`); return []; }

        const selectCols = sql.match(/SELECT\s+(.+?)\s+FROM/i)?.[1]?.trim() || '*';

        // 提取 SELECT ... FROM 之后的部分
        const afterFromIdx = sqlUpper.indexOf('FROM') + 4;
        let remaining = sql.substring(afterFromIdx).replace(/^\s*\w+\s*/, '').trim(); // 去掉表名（含前导空格）

        // 找到 WHERE 子句（在 ORDER BY / LIMIT / OFFSET 之前）
        let whereClause = '';
        const orderByIdx = this._findKeywordIndex(remaining, 'ORDER BY');
        const limitIdx = this._findKeywordIndex(remaining, 'LIMIT');
        const offsetIdx = this._findKeywordIndex(remaining, 'OFFSET');
        const whereEndIdx = this._minPositive(orderByIdx, limitIdx, offsetIdx);

        if (remaining.toUpperCase().startsWith('WHERE')) {
            if (whereEndIdx > 0) {
                whereClause = remaining.substring(6, whereEndIdx).trim();
                remaining = remaining.substring(whereEndIdx).trim();
            } else {
                whereClause = remaining.substring(6).trim();
                remaining = '';
            }
        }

        let rows = table.rows;
        let paramIdx = 0;
        if (whereClause) {
            // 统计 WHERE 中 ? 数量，用于后续 LIMIT/OFFSET 参数索引
            const whereParamCount = (whereClause.match(/\?/g) || []).length;
            rows = this._filterRows(rows, whereClause, (params || []).slice(0, whereParamCount));
            paramIdx = whereParamCount;
        }

        // 解析 ORDER BY
        if (remaining.toUpperCase().startsWith('ORDER BY')) {
            const nextKeywordIdx = this._minPositive(
                this._findKeywordIndex(remaining.substring(8), 'LIMIT'),
                this._findKeywordIndex(remaining.substring(8), 'OFFSET'),
            );
            let orderClause: string;
            if (nextKeywordIdx > 0) {
                orderClause = remaining.substring(9, 8 + nextKeywordIdx).trim();
                remaining = remaining.substring(8 + nextKeywordIdx).trim();
            } else {
                orderClause = remaining.substring(9).trim();
                remaining = '';
            }
            const [col, dir] = orderClause.split(/\s+/);
            const desc = dir?.toUpperCase() === 'DESC';
            rows = [...rows].sort((a, b) => {
                const va = a[col] ?? 0; const vb = b[col] ?? 0;
                return desc ? (vb > va ? 1 : -1) : (va > vb ? 1 : -1);
            });
        }

        // 解析 LIMIT（支持 ? 占位符）
        let limit = rows.length;
        if (remaining.toUpperCase().startsWith('LIMIT')) {
            const limitMatch = remaining.match(/LIMIT\s+(\S+)/i);
            if (limitMatch) {
                const val = limitMatch[1];
                limit = val === '?' ? Number((params || [])[paramIdx++]) : parseInt(val);
                remaining = remaining.substring(limitMatch[0].length).trim();
            }
        }

        // 解析 OFFSET（支持 ? 占位符）
        let offset = 0;
        if (remaining.toUpperCase().startsWith('OFFSET')) {
            const offsetMatch = remaining.match(/OFFSET\s+(\S+)/i);
            if (offsetMatch) {
                const val = offsetMatch[1];
                offset = val === '?' ? Number((params || [])[paramIdx++]) : parseInt(val);
                remaining = remaining.substring(offsetMatch[0].length).trim();
            }
        }

        rows = rows.slice(offset, offset + limit);

        console.log(`[MemoryEngine] SELECT | table=${tableName} | where="${whereClause}" | orderBy=${remaining} | limit=${limit} offset=${offset} | result=${rows.length} rows`);

        if (selectCols === '*') { return rows as T[]; }
        const colNames = selectCols.split(',').map(c => c.trim());
        return rows.map(row => {
            const result: any = {};
            colNames.forEach(cn => { result[cn] = row[cn] ?? null; });
            return result as T;
        });
    }

    private _findKeywordIndex(str: string, keyword: string, fromIndex: number = 0): number {
        const idx = str.toUpperCase().indexOf(keyword, fromIndex);
        // 确保关键字前面是空格或开头
        if (idx === -1) return -1;
        if (idx > 0 && str[idx - 1] !== ' ') return -1;
        return idx;
    }

    private _minPositive(...nums: number[]): number {
        const positive = nums.filter(n => n > 0);
        return positive.length > 0 ? Math.min(...positive) : -1;
    }

    private _executeDrop(sql: string): { affectedRows: number } {
        const match = sql.match(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(\w+)/i);
        if (!match) throw new Error(`Invalid DROP TABLE: ${sql}`);
        this._tables.delete(match[1]);
        return { affectedRows: 0 };
    }

    private _filterRows(rows: any[], whereClause: string, params: any[], invert = false): any[] {
        let paramIdx = 0;
        // 先解析 WHERE 中所有 ? 占位符，避免在 filter 循环内递增导致多行参数错位
        const resolvedWhere = whereClause.replace(/\?/g, () => {
            const val = params[paramIdx++];
            return val === null ? 'NULL' : (typeof val === 'string' ? `'${val}'` : String(val));
        });
        // 按 AND 分割为多个条件（支持大小写不敏感）
        const conditions = resolvedWhere.split(/\s+AND\s+/i);
        return rows.filter(row => {
            const allMatch = conditions.every(cond => {
                const match = cond.match(/(\w+)\s*(=|!=|>|<|>=|<=|IN)\s*(.+)/i);
                if (!match) { console.warn(`[MemoryEngine] _filterRows regex not matched: "${cond}"`); return !invert; }
                const col = match[1]; const op = match[2].toUpperCase(); const valExpr = match[3].trim();
                const val = this._parseLiteral(valExpr);
                const rowVal = row[col];
                let matched: boolean;
                switch (op) { case '=': matched = rowVal == val; break; case '!=': matched = rowVal != val; break; case '>': matched = rowVal > val; break; case '<': matched = rowVal < val; break; case '>=': matched = rowVal >= val; break; case '<=': matched = rowVal <= val; break; case 'IN': matched = Array.isArray(val) && val.includes(rowVal); break; default: matched = false; }
                if (!matched) { console.log(`[MemoryEngine] _filterRows: row.${col}=${rowVal} (${typeof rowVal}) ${op} ${val} (${typeof val}) → ${matched}`); }
                return matched;
            });
            return invert ? !allMatch : allMatch;
        });
    }

    private _parseLiteral(val: string): any {
        if (val.startsWith("'") && val.endsWith("'")) return val.slice(1, -1);
        if (val === 'NULL') return null;
        if (val === 'TRUE' || val === 'true') return true;
        if (val === 'FALSE' || val === 'false') return false;
        const num = Number(val);
        return isNaN(num) ? val : num;
    }
}