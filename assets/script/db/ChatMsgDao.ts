/**
 * ChatMsg 表数据访问对象
 * 对应 InterfaceDefine.ts 中的 ChatMsg 接口
 * 提供增删改查接口，底层存储由 DBManager 管理
 *
 * 建表 SQL（由 ChatMsgDao.initTable 自动执行）：
 *   CREATE TABLE IF NOT EXISTS chat_msg (
 *       msg_id INTEGER NOT NULL,
 *       chat_id INTEGER NOT NULL,
 *       user_id TEXT NOT NULL,
 *       nickname TEXT NOT NULL DEFAULT '',
 *       head_img TEXT NOT NULL DEFAULT '',
 *       msg TEXT NOT NULL DEFAULT '',
 *       msg_type INTEGER NOT NULL DEFAULT 0,
 *       created_at INTEGER NOT NULL DEFAULT 0
 *   );
 *
 * 索引（自动创建）：
 *   idx_chat_msg_chat_id  — 按 chat_id 查询加速
 *   idx_chat_msg_created   — 按时间排序加速
 */

import { DBManager } from './DBManager';
import { ChatMsg } from '../common/utils/InterfaceDefine';

/** ChatMsg 表名 */
const TABLE_NAME = 'chat_msg';

/** ChatMsg 表结构 DDL */
const CREATE_TABLE_SQL = `
    CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
        msg_id INTEGER NOT NULL,
        chat_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        nickname TEXT NOT NULL DEFAULT '',
        head_img TEXT NOT NULL DEFAULT '',
        msg TEXT NOT NULL DEFAULT '',
        msg_type INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT 0
    )
`;

/** 索引 DDL */
const INDEX_CHAT_ID_SQL = `CREATE INDEX IF NOT EXISTS idx_chat_msg_chat_id ON ${TABLE_NAME}(chat_id)`;
const INDEX_CREATE_AT_SQL = `CREATE INDEX IF NOT EXISTS idx_chat_msg_create_at ON ${TABLE_NAME}(created_at)`;

export class ChatMsgDao {
    /**
     * 初始化 chat_msg 表
     * 在应用启动时调用一次即可
     */
    static async initTable(): Promise<void> {
        await DBManager.ins.execute(CREATE_TABLE_SQL);
        await DBManager.ins.execute(INDEX_CHAT_ID_SQL);
        await DBManager.ins.execute(INDEX_CREATE_AT_SQL);
        console.log('[ChatMsgDao] Table initialized');
    }

    /**
     * 插入一条聊天消息
     * @param data 消息数据（msg_id 由外部传入）
     * @returns 传入的 msg_id
     */
    static async insert(data: ChatMsg): Promise<number> {
        const sql = `INSERT INTO ${TABLE_NAME} (msg_id, chat_id, user_id, nickname, head_img, msg, msg_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        await DBManager.ins.execute(sql, [
            data.msg_id,
            data.chat_id,
            data.user_id,
            data.nickname,
            data.head_img,
            data.msg,
            data.msg_type,
            data.created_at,
        ]);
        return data.msg_id;
    }

    /**
     * 根据 msg_id 查询单条消息
     */
    static async getById(msgId: number): Promise<ChatMsg | null> {
        const rows = await DBManager.ins.query<ChatMsg>(
            `SELECT * FROM ${TABLE_NAME} WHERE msg_id = ?`,
            [msgId]
        );
        return rows.length > 0 ? rows[0] : null;
    }

    /**
     * 查询某个会话的消息列表（按时间正序）
     * @param chatId   会话 id
     * @param limit    每页数量
     * @param offset   偏移量
     */
    static async getListByChatId(chatId: number, limit: number = 50, offset: number = 0): Promise<ChatMsg[]> {
        return DBManager.ins.query<ChatMsg>(
            `SELECT * FROM ${TABLE_NAME} WHERE chat_id = ? ORDER BY created_at ASC LIMIT ? OFFSET ?`,
            [chatId, limit, offset]
        );
    }

    /**
     * 按游标翻页加载更多历史消息（时间倒序，向前翻页）
     * @param chatId     会话 id
     * @param cursorMsgId 当前页面最早的 msg_id（用于加载更早的消息）
     * @param pageSize   每页数量
     */
    static async getListByCursor(chatId: number, cursorMsgId: number, pageSize: number = 20): Promise<ChatMsg[]> {
        const rows = await DBManager.ins.query<ChatMsg>(
            `SELECT * FROM ${TABLE_NAME} WHERE chat_id = ? AND msg_id < ? ORDER BY msg_id DESC LIMIT ?`,
            [chatId, cursorMsgId, pageSize]
        );
        // 按时间正序返回
        return rows.reverse();
    }

    /**
     * 根据 msg_id 范围分页查询消息（向后翻页）
     * @param chatId      会话 id
     * @param lastMsgId   当前页面最后一条 msg_id
     * @param pageSize    每页数量
     */
    static async getListByLastId(chatId: number, lastMsgId: number, pageSize: number = 20): Promise<ChatMsg[]> {
        return DBManager.ins.query<ChatMsg>(
            `SELECT * FROM ${TABLE_NAME} WHERE chat_id = ? AND msg_id > ? ORDER BY msg_id ASC LIMIT ?`,
            [chatId, lastMsgId, pageSize]
        );
    }

    /**
     * 查询某个会话的最新 N 条消息
     */
    static async getLatest(chatId: number, limit: number = 20): Promise<ChatMsg[]> {
        const rows = await DBManager.ins.query<ChatMsg>(
            `SELECT * FROM ${TABLE_NAME} WHERE chat_id = ? ORDER BY msg_id DESC LIMIT ?`,
            [chatId, limit]
        );
        return rows.reverse();
    }

    /**
     * 更新消息内容
     */
    static async update(msgId: number, data: Partial<ChatMsg>): Promise<number> {
        const setClauses: string[] = [];
        const params: any[] = [];

        if (data.msg !== undefined) { setClauses.push('msg = ?'); params.push(data.msg); }
        if (data.msg_type !== undefined) { setClauses.push('msg_type = ?'); params.push(data.msg_type); }
        if (data.nickname !== undefined) { setClauses.push('nickname = ?'); params.push(data.nickname); }
        if (data.head_img !== undefined) { setClauses.push('head_img = ?'); params.push(data.head_img); }

        if (setClauses.length === 0) return 0;

        params.push(msgId);
        const sql = `UPDATE ${TABLE_NAME} SET ${setClauses.join(', ')} WHERE msg_id = ?`;
        const result = await DBManager.ins.execute(sql, params);
        return result.affectedRows;
    }

    /**
     * 根据 msg_id 删除单条消息
     */
    static async deleteById(msgId: number): Promise<boolean> {
        const result = await DBManager.ins.execute(
            `DELETE FROM ${TABLE_NAME} WHERE msg_id = ?`,
            [msgId]
        );
        return result.affectedRows > 0;
    }

    /**
     * 清空某个会话的所有消息
     */
    static async deleteByChatId(chatId: number): Promise<number> {
        const result = await DBManager.ins.execute(
            `DELETE FROM ${TABLE_NAME} WHERE chat_id = ?`,
            [chatId]
        );
        return result.affectedRows;
    }

    /**
     * 获取某个会话的消息总数
     */
    static async countByChatId(chatId: number): Promise<number> {
        const rows = await DBManager.ins.query<ChatMsg>(
            `SELECT * FROM ${TABLE_NAME} WHERE chat_id = ?`,
            [chatId]
        );
        return rows.length;
    }

    /**
     * 批量插入消息
     * @param messages 消息数组
     */
    static async batchInsert(messages: ChatMsg[]): Promise<number> {
        let inserted = 0;
        for (const msg of messages) {
            await ChatMsgDao.insert(msg);
            inserted++;
        }
        return inserted;
    }
}