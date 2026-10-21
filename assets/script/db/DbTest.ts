/**
 * 数据库框架测试脚本
 * 将此脚本挂载到场景中的任意节点（如 Canvas），运行后查看控制台日志
 *
 * 测试内容：
 *   1. 自动选择引擎 + 打开数据库 + 初始化两张表
 *   2. ChatDao 增删改查
 *   3. ChatMsgDao 增删改查
 *   4. 分页查询 & 游标翻页
 *
 * 平台行为：
 *   - Android / iOS：NativeSqliteEngine（原生 SQLite），数据持久化到文件
 *   - Web / 编辑器：StorageEngine（localStorage 持久化）
 *
 * 验证日志标签：
 *   [DBManager]  - 数据库管理器
 *   [StorageEngine] - 非原生存储引擎
 *   [NativeSqliteEngine] - 原生 SQLite 引擎
 *   [ChatDao] / [ChatMsgDao] - DAO 操作
 */

import { _decorator, Component } from 'cc';
import { DBManager } from './DBManager';
import { ChatDao } from './ChatDao';
import { ChatMsgDao } from './ChatMsgDao';

const { ccclass } = _decorator;

@ccclass('DbTest')
export class DbTest extends Component {

    async start() {
        console.log('========== DB Test Start ==========');

        try {
            // 1. 初始化数据库（自动选择引擎 + 打开）
            console.log('[DBTest] 步骤1: 初始化数据库...');
            await DBManager.ins.init('test_chat.db');
            const engineName = DBManager.ins.getEngine()?.constructor.name;
            console.log(`[DBTest] ✅ 引擎: ${engineName}`);

            // 2. 初始化表
            console.log('[DBTest] 步骤2: 初始化表结构...');
            await ChatDao.initTable();
            await ChatMsgDao.initTable();
            console.log('[DBTest] ✅ 表结构初始化完成');
            console.log('[DBTest] ✅ 数据库已就绪，开始功能测试...');

            // ========== ChatDao 测试 ==========
            await this.testChatDao();

            // ========== ChatMsgDao 测试 ==========
            await this.testChatMsgDao();

            console.log('\n========== DB Test All Passed ✅ ==========');
        } catch (e) {
            console.error('[FAIL]', e);
        }
    }

    // ==================== ChatDao 测试 ====================

    private async testChatDao() {
        console.log('\n--- ChatDao Test ---');

        // 清理旧数据
        await DBManager.ins.execute('DELETE FROM chat');
        await DBManager.ins.execute('DELETE FROM chat_msg');
        console.log('[ChatDao] 已清理旧数据');

        // 插入 3 条会话
        const id1 = await ChatDao.insert({
            user_id: 'u001',
            nickname: 'Alice',
            head_img: 'avatar_01.png',
            pet_img: 'pet_01.png',
            last_msg: '你好！',
            last_msg_id: 10,
            created_at: 1000,
            unread_count: 2,
        });
        console.log(`[ChatDao] insert - chat_id=${id1}`);

        const id2 = await ChatDao.insert({
            user_id: 'u002',
            nickname: 'Bob',
            head_img: 'avatar_02.png',
            pet_img: 'pet_02.png',
            last_msg: '在吗？',
            last_msg_id: 8,
            created_at: 900,
            unread_count: 0,
        });
        console.log(`[ChatDao] insert - chat_id=${id2}`);

        const id3 = await ChatDao.insert({
            user_id: 'u003',
            nickname: 'Charlie',
            head_img: 'avatar_03.png',
            pet_img: 'pet_03.png',
            last_msg: '明天见',
            last_msg_id: 15,
            created_at: 800,
            unread_count: 5,
        });
        console.log(`[ChatDao] insert - chat_id=${id3}`);

        // 按 id 查询
        const chat = await ChatDao.getById(id1);
        console.assert(chat?.nickname === 'Alice', 'getById failed');
        console.log(`[ChatDao] getById - ${chat?.nickname}`);

        // 按 user_id 查询
        const chatByUid = await ChatDao.getByUserId('u002');
        console.assert(chatByUid?.nickname === 'Bob', 'getByUserId failed');
        console.log(`[ChatDao] getByUserId - ${chatByUid?.nickname}`);

        // 分页列表
        const list = await ChatDao.getList(10, 0);
        console.assert(list.length === 3, `getList expected 3, got ${list.length}`);
        console.log(`[ChatDao] getList - count=${list.length}`);

        // 更新最后一条消息
        const affected = await ChatDao.updateLastMsg(id1, '吃了么？', 11, 1100);
        console.assert(affected === 1, 'update failed');
        const updated = await ChatDao.getById(id1);
        console.assert(updated?.last_msg === '吃了么？', 'update last_msg failed');
        console.log(`[ChatDao] update - last_msg="${updated?.last_msg}"`);

        // 更新未读数
        await ChatDao.updateUnreadCount(id3, 0);
        const cleared = await ChatDao.getById(id3);
        console.assert(cleared?.unread_count === 0, 'updateUnreadCount failed');
        console.log(`[ChatDao] updateUnreadCount - unread_count=${cleared?.unread_count}`);

        // 删除一条
        const deleted = await ChatDao.deleteById(id2);
        console.assert(deleted === true, 'deleteById failed');
        const remaining = await ChatDao.count();
        console.assert(remaining === 2, `count expected 2, got ${remaining}`);
        console.log(`[ChatDao] deleteById + count - remaining=${remaining}`);

        // 总未读数
        const totalUnread = await ChatDao.totalUnreadCount();
        console.log(`[ChatDao] totalUnreadCount - ${totalUnread}`);
    }

    // ==================== ChatMsgDao 测试 ====================

    private async testChatMsgDao() {
        console.log('\n--- ChatMsgDao Test ---');

        // 插入 6 条消息（chat_id=1 的会话）
        const msgIds: number[] = [];
        for (let i = 1; i <= 6; i++) {
            const msgId = await ChatMsgDao.insert({
                msg_id: i,
                chat_id: 1,
                user_id: 'u001',
                nickname: 'Alice',
                head_img: 'avatar_01.png',
                msg: `这是第 ${i} 条消息`,
                msg_type: 0,
                created_at: 1000 + i * 10,
            });
            msgIds.push(msgId);
            console.log(`[ChatMsgDao] insert - msg_id=${msgId}`);
        }
        console.assert(msgIds.length === 6, 'insert 6 messages failed');

        // 按 msg_id 查询
        const msg = await ChatMsgDao.getById(msgIds[0]);
        console.assert(msg?.msg === '这是第 1 条消息', 'getById failed');
        console.log(`[ChatMsgDao] getById - "${msg?.msg}"`);

        // 按 chat_id 查消息列表
        const list = await ChatMsgDao.getListByChatId(1, 10, 0);
        console.assert(list.length === 6, `getListByChatId expected 6, got ${list.length}`);
        console.log(`[ChatMsgDao] getListByChatId - count=${list.length}`);

        // 游标向前翻页
        const cursorResult = await ChatMsgDao.getListByCursor(1, 5, 2);
        console.assert(cursorResult.length === 2, `cursor expected 2, got ${cursorResult.length}`);
        console.log(`[ChatMsgDao] getListByCursor - msg_ids=${cursorResult.map(m => m.msg_id).join(',')}`);

        // 向后翻页
        const lastResult = await ChatMsgDao.getListByLastId(1, 3, 2);
        console.assert(lastResult.length === 2, `lastId expected 2, got ${lastResult.length}`);
        console.log(`[ChatMsgDao] getListByLastId - msg_ids=${lastResult.map(m => m.msg_id).join(',')}`);

        // 最新 3 条
        const latest = await ChatMsgDao.getLatest(1, 3);
        console.assert(latest.length === 3, `latest expected 3, got ${latest.length}`);
        console.log(`[ChatMsgDao] getLatest - msg_ids=${latest.map(m => m.msg_id).join(',')}`);

        // 更新消息内容
        const updated = await ChatMsgDao.update(msgIds[0], { msg: '修改后的消息' });
        console.assert(updated === 1, 'update failed');
        const updatedMsg = await ChatMsgDao.getById(msgIds[0]);
        console.assert(updatedMsg?.msg === '修改后的消息', 'update msg failed');
        console.log(`[ChatMsgDao] update - "${updatedMsg?.msg}"`);

        // 删除单条消息
        const deleted = await ChatMsgDao.deleteById(msgIds[5]);
        console.assert(deleted === true, 'deleteById failed');
        const afterDelete = await ChatMsgDao.countByChatId(1);
        console.assert(afterDelete === 5, `countByChatId expected 5, got ${afterDelete}`);
        console.log(`[ChatMsgDao] deleteById + countByChatId - ${afterDelete}`);

        // 批量插入
        const batchCount = await ChatMsgDao.batchInsert([
            { msg_id: 101, chat_id: 1, user_id: 'u002', nickname: 'Bob', head_img: '', msg: '批量消息1', msg_type: 0, created_at: 2000 },
            { msg_id: 102, chat_id: 1, user_id: 'u002', nickname: 'Bob', head_img: '', msg: '批量消息2', msg_type: 0, created_at: 2001 },
        ]);
        console.assert(batchCount === 2, `batchInsert expected 2, got ${batchCount}`);
        console.log(`[ChatMsgDao] batchInsert - ${batchCount} messages`);

        // 清空会话的所有消息
        const cleared = await ChatMsgDao.deleteByChatId(1);
        console.assert(cleared > 0, 'deleteByChatId failed');
        console.log(`[ChatMsgDao] deleteByChatId - cleared ${cleared} messages`);
    }
}