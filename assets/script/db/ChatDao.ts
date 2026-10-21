/**
 * Chat 表数据访问对象
 * 对应 InterfaceDefine.ts 中的 Chat 接口
 * 提供增删改查接口，底层存储由 DBManager 管理
 *
 * 建表 SQL（由 ChatDao.initTable 自动执行）：
 *   CREATE TABLE IF NOT EXISTS chat (
 *       chat_id INTEGER PRIMARY KEY AUTOINCREMENT,
 *       user_id TEXT NOT NULL,
 *       nickname TEXT NOT NULL DEFAULT '',
 *       head_img TEXT NOT NULL DEFAULT '',
 *       pet_img TEXT NOT NULL DEFAULT '',
 *       last_msg TEXT NOT NULL DEFAULT '',
 *       last_msg_id INTEGER NOT NULL DEFAULT 0,
 *       created_at INTEGER NOT NULL DEFAULT 0,
 *       unread_count INTEGER NOT NULL DEFAULT 0
 *   );
 */

import { DBManager } from './DBManager';
import { Chat } from '../common/utils/InterfaceDefine';

/** Chat 表名 */
const TABLE_NAME = 'chat';

/** Chat 表结构 DDL */
const CREATE_TABLE_SQL = `
    CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
        chat_id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        nickname TEXT NOT NULL DEFAULT '',
        head_img TEXT NOT NULL DEFAULT '',
        pet_img TEXT NOT NULL DEFAULT '',
        last_msg TEXT NOT NULL DEFAULT '',
        last_msg_id INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT 0,
        unread_count INTEGER NOT NULL DEFAULT 0
    )
`;

export class ChatDao {
    /**
     * 初始化 chat 表
     * 在应用启动时调用一次即可
     */
    static async initTable(): Promise<void> {
        await DBManager.ins.execute(CREATE_TABLE_SQL);
        console.log('[ChatDao] Table initialized');
    }

    /**
     * 插入一条聊天会话记录
     * @returns 自增的 chat_id
     */
    static async insert(data: Omit<Chat, 'chat_id'> & { chat_id?: number }): Promise<number> {
        const sql = `INSERT INTO ${TABLE_NAME} (user_id, nickname, head_img, pet_img, last_msg, last_msg_id, created_at, unread_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        const result = await DBManager.ins.execute(sql, [
            data.user_id,
            data.nickname,
            data.head_img,
            data.pet_img,
            data.last_msg,
            data.last_msg_id,
            data.created_at,
            data.unread_count,
        ]);
        console.log(`[ChatDao] insert result: affectedRows=${result.affectedRows}`);
        // 查询刚插入的 chat_id (内存引擎自增实现)
        const rows = await DBManager.ins.query<{ chat_id: number }>(
            `SELECT chat_id FROM ${TABLE_NAME} WHERE user_id = ? ORDER BY chat_id DESC LIMIT 1`,
            [data.user_id]
        );
        const chatId = rows.length > 0 ? rows[0].chat_id : 0;
        console.log(`[ChatDao] insert → chat_id=${chatId}, user_id=${data.user_id}, nickname=${data.nickname}`);
        return chatId;
    }

    /**
     * 根据 chat_id 查询单条会话
     */
    static async getById(chatId: number): Promise<Chat | null> {
        const rows = await DBManager.ins.query<Chat>(
            `SELECT * FROM ${TABLE_NAME} WHERE chat_id = ?`,
            [chatId]
        );
        console.log(`[ChatDao] getById(${chatId}) → found=${rows.length}, row=`, JSON.stringify(rows[0] || null));
        return rows.length > 0 ? rows[0] : null;
    }

    /**
     * 根据 user_id 查询单条会话
     */
    static async getByUserId(userId: string): Promise<Chat | null> {
        const rows = await DBManager.ins.query<Chat>(
            `SELECT * FROM ${TABLE_NAME} WHERE user_id = ? LIMIT 1`,
            [userId]
        );
        console.log(`[ChatDao] getByUserId(${userId}) → found=${rows.length}, row=`, JSON.stringify(rows[0] || null));
        return rows.length > 0 ? rows[0] : null;
    }

    /**
     * 查询所有会话列表，按 created_at 降序排列
     * @param limit  每页数量（翻页用）
     * @param offset 偏移量（翻页用）
     */
    static async getList(limit: number = 20, offset: number = 0): Promise<Chat[]> {
        return DBManager.ins.query<Chat>(
            `SELECT * FROM ${TABLE_NAME} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [limit, offset]
        );
    }

    /**
     * 根据最后一条消息 id 查询更旧的会话（翻页用）
     * @param lastMsgId 当前列表最后一条消息 id
     * @param pageSize  每页数量
     */
    static async getListByCursor(lastMsgId: number, pageSize: number = 20): Promise<Chat[]> {
        return DBManager.ins.query<Chat>(
            `SELECT * FROM ${TABLE_NAME} WHERE last_msg_id < ? ORDER BY last_msg_id DESC LIMIT ?`,
            [lastMsgId, pageSize]
        );
    }

    /**
     * 更新会话的部分字段
     * @param chatId 会话 id
     * @param data   要更新的字段
     */
    static async update(chatId: number, data: Partial<Chat>): Promise<number> {
        const setClauses: string[] = [];
        const params: any[] = [];

        if (data.user_id !== undefined) { setClauses.push('user_id = ?'); params.push(data.user_id); }
        if (data.nickname !== undefined) { setClauses.push('nickname = ?'); params.push(data.nickname); }
        if (data.head_img !== undefined) { setClauses.push('head_img = ?'); params.push(data.head_img); }
        if (data.pet_img !== undefined) { setClauses.push('pet_img = ?'); params.push(data.pet_img); }
        if (data.last_msg !== undefined) { setClauses.push('last_msg = ?'); params.push(data.last_msg); }
        if (data.last_msg_id !== undefined) { setClauses.push('last_msg_id = ?'); params.push(data.last_msg_id); }
        if (data.created_at !== undefined) { setClauses.push('created_at = ?'); params.push(data.created_at); }
        if (data.unread_count !== undefined) { setClauses.push('unread_count = ?'); params.push(data.unread_count); }

        if (setClauses.length === 0) return 0;

        params.push(chatId);
        const sql = `UPDATE ${TABLE_NAME} SET ${setClauses.join(', ')} WHERE chat_id = ?`;
        const result = await DBManager.ins.execute(sql, params);
        return result.affectedRows;
    }

    /**
     * 更新未读数量
     */
    static async updateUnreadCount(chatId: number, unreadCount: number): Promise<number> {
        return ChatDao.update(chatId, { unread_count: unreadCount });
    }

    /**
     * 更新最后一条消息内容
     */
    static async updateLastMsg(chatId: number, lastMsg: string, lastMsgId: number, createAt: number): Promise<number> {
        return ChatDao.update(chatId, { last_msg: lastMsg, last_msg_id: lastMsgId, created_at: createAt });
    }

    /**
     * 根据 chat_id 删除一条会话
     */
    static async deleteById(chatId: number): Promise<boolean> {
        const result = await DBManager.ins.execute(
            `DELETE FROM ${TABLE_NAME} WHERE chat_id = ?`,
            [chatId]
        );
        return result.affectedRows > 0;
    }

    /**
     * 根据 user_id 删除一条会话
     */
    static async deleteByUserId(userId: string): Promise<boolean> {
        const result = await DBManager.ins.execute(
            `DELETE FROM ${TABLE_NAME} WHERE user_id = ?`,
            [userId]
        );
        return result.affectedRows > 0;
    }

    /**
     * 获取总会话数
     */
    static async count(): Promise<number> {
        const rows = await DBManager.ins.query<Chat>(`SELECT * FROM ${TABLE_NAME}`);
        return rows.length;
    }

    /**
     * 获取所有未读消息总数
     */
    static async totalUnreadCount(): Promise<number> {
        const rows = await DBManager.ins.query<Chat>(`SELECT * FROM ${TABLE_NAME}`);
        return rows.reduce((sum, r) => sum + (r.unread_count || 0), 0);
    }
}