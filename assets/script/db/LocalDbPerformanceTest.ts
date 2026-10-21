import { _decorator, Component, sys } from 'cc';
import { LocalDB } from './LocalDB';
import { Chat, ChatMsg } from '../common/utils/InterfaceDefine';

const { ccclass } = _decorator;

@ccclass('LocalDbPerformanceTest')
export class LocalDbPerformanceTest extends Component {

    async start() {
        console.log('========== LocalDB 性能测试（真实 localStorage 读写）==========');
        await this.runPerformanceTest();
        console.log('========== 测试结束 ==========');
    }

    private async runPerformanceTest(): Promise<void> {
        this.clearTestData();
        this.logStorageInfo('初始状态');

        const chatCount = 10000;
        const chatMsgCount = 100;

        console.log(`\n--- 准备数据: ${chatCount} 条 Chat, ${chatMsgCount} 条 ChatMsg ---`);

        const chatDataList: Partial<Chat>[] = [];
        for (let i = 1; i <= chatCount; i++) {
            chatDataList.push({
                user_id: `user_${i}`,
                nickname: `User_${i}`,
                head_img: `avatar_${i % 100}.png`,
                pet_img: `pet_${i % 50}.png`,
                last_msg: `Hello from User ${i}`,
                last_msg_id: i,
                created_at: Date.now() - i * 1000,
                unread_count: i % 10,
            });
        }

        const chatMsgDataList: Partial<ChatMsg>[] = [];
        for (let i = 1; i <= chatMsgCount; i++) {
            chatMsgDataList.push({
                msg_id: i,
                chat_id: 1,
                user_id: `user_${i % 100 + 1}`,
                nickname: `User_${i % 100 + 1}`,
                head_img: `avatar_${i % 100}.png`,
                msg: `Message content ${i}`,
                msg_type: i % 3,
                created_at: Date.now() - i * 100,
            });
        }

        console.log('\n--- 第一步: 创建表结构并写入 localStorage ---');

        const db = LocalDB.getInstance();
        db.init('performance_test');

        if (!db.existsTable('chat')) {
            db.createTable({
                name: 'chat',
                columns: [
                    { name: 'chat_id', type: 'INTEGER', primaryKey: true, autoIncrement: true },
                    { name: 'user_id', type: 'TEXT', notNull: true },
                    { name: 'nickname', type: 'TEXT', notNull: true, defaultValue: '' },
                    { name: 'head_img', type: 'TEXT', notNull: true, defaultValue: '' },
                    { name: 'pet_img', type: 'TEXT', notNull: true, defaultValue: '' },
                    { name: 'last_msg', type: 'TEXT', notNull: true, defaultValue: '' },
                    { name: 'last_msg_id', type: 'INTEGER', notNull: true, defaultValue: 0 },
                    { name: 'created_at', type: 'INTEGER', notNull: true, defaultValue: 0 },
                    { name: 'unread_count', type: 'INTEGER', notNull: true, defaultValue: 0 },
                ],
            });
        }

        if (!db.existsTable('chat_msg')) {
            db.createTable({
                name: 'chat_msg',
                columns: [
                    { name: 'msg_id', type: 'INTEGER', notNull: true },
                    { name: 'chat_id', type: 'INTEGER', notNull: true },
                    { name: 'user_id', type: 'TEXT', notNull: true },
                    { name: 'nickname', type: 'TEXT', notNull: true, defaultValue: '' },
                    { name: 'head_img', type: 'TEXT', notNull: true, defaultValue: '' },
                    { name: 'msg', type: 'TEXT', notNull: true, defaultValue: '' },
                    { name: 'msg_type', type: 'INTEGER', notNull: true, defaultValue: 0 },
                    { name: 'created_at', type: 'INTEGER', notNull: true, defaultValue: 0 },
                ],
            });
        }

        db.truncate('chat');
        db.truncate('chat_msg');

        console.log('\n[写入] Chat x ' + chatCount);
        const chatWriteStart = Date.now();
        db.beginTransaction();
        for (const data of chatDataList) {
            db.insert('chat', data as Record<string, any>);
        }
        db.commitTransaction();
        const chatWriteEnd = Date.now();
        const chatWriteTime = chatWriteEnd - chatWriteStart;
        console.log(`[写入] Chat 完成! 耗时: ${chatWriteTime}ms, 速率: ${(chatCount / chatWriteTime * 1000).toFixed(2)}/s`);

        console.log('\n[写入] ChatMsg x ' + chatMsgCount);
        const msgWriteStart = Date.now();
        db.beginTransaction();
        for (const data of chatMsgDataList) {
            db.insert('chat_msg', data as Record<string, any>);
        }
        db.commitTransaction();
        const msgWriteEnd = Date.now();
        const msgWriteTime = msgWriteEnd - msgWriteStart;
        console.log(`[写入] ChatMsg 完成! 耗时: ${msgWriteTime}ms, 速率: ${(chatCount / msgWriteTime * 1000).toFixed(2)}/s`);

        this.logStorageInfo('写入完成后');

        this.verifyLocalStorageData('chat', chatCount);
        this.verifyLocalStorageData('chat_msg', chatMsgCount);

        console.log('\n--- 第二步: 销毁内存数据，模拟页面刷新 ---');
        console.log('[操作] 销毁 LocalDB 单例，清空内存缓存...');
        LocalDB.destroy();

        console.log('\n--- 第三步: 从 localStorage 重新加载数据（真实读取速度测试）---');
        console.log('[读取] 重新创建 LocalDB 并从 localStorage 加载...');
        
        const reloadStart = Date.now();
        const dbReloaded = LocalDB.getInstance();
        dbReloaded.init('performance_test');
        const reloadEnd = Date.now();
        const reloadTime = reloadEnd - reloadStart;

        console.log(`[读取] 重新加载完成! 耗时: ${reloadTime}ms`);

        const reloadedChatCount = dbReloaded.getTableCount('chat');
        const reloadedMsgCount = dbReloaded.getTableCount('chat_msg');

        console.log(`\n[验证] 从 localStorage 读取到的 Chat 数量: ${reloadedChatCount}`);
        console.log(`[验证] 从 localStorage 读取到的 ChatMsg 数量: ${reloadedMsgCount}`);

        if (reloadedChatCount !== chatCount) {
            console.error(`❌ Chat 读取失败！期望 ${chatCount} 条，实际 ${reloadedChatCount} 条`);
        } else {
            console.log(`✅ Chat 读取成功！`);
        }

        if (reloadedMsgCount !== chatMsgCount) {
            console.error(`❌ ChatMsg 读取失败！期望 ${chatMsgCount} 条，实际 ${reloadedMsgCount} 条`);
        } else {
            console.log(`✅ ChatMsg 读取成功！`);
        }

        console.log('\n--- 第四步: 打印读取的数据 ---');

        const allChats = dbReloaded.getAll('chat');
        const allChatMsgs = dbReloaded.getAll('chat_msg');

        console.log('\n[打印] Chat 前3条:');
        for (let i = 0; i < Math.min(3, allChats.length); i++) {
            console.log(`  ${JSON.stringify(allChats[i])}`);
        }

        console.log('\n[打印] Chat 后3条:');
        for (let i = Math.max(0, allChats.length - 3); i < allChats.length; i++) {
            console.log(`  ${JSON.stringify(allChats[i])}`);
        }

        console.log('\n[打印] ChatMsg 前3条:');
        for (let i = 0; i < Math.min(3, allChatMsgs.length); i++) {
            console.log(`  ${JSON.stringify(allChatMsgs[i])}`);
        }

        console.log('\n[打印] ChatMsg 后3条:');
        for (let i = Math.max(0, allChatMsgs.length - 3); i < allChatMsgs.length; i++) {
            console.log(`  ${JSON.stringify(allChatMsgs[i])}`);
        }

        console.log('\n--- 性能汇总 ---');
        console.log(`┌─────────────────────────────────────────────────────────────┐`);
        console.log(`│              localStorage 真实读写性能测试                  │`);
        console.log(`├─────────────────────────────────────────────────────────────┤`);
        console.log(`│ 操作              │ 数量       │ 耗时(ms) │ 速率(/s)       │`);
        console.log(`├─────────────────────────────────────────────────────────────┤`);
        console.log(`│ 写入 Chat         │ ${chatCount.toString().padStart(8)} │ ${chatWriteTime.toString().padStart(9)} │ ${(chatCount / chatWriteTime * 1000).toFixed(2).padStart(12)} │`);
        console.log(`│ 写入 ChatMsg      │ ${chatMsgCount.toString().padStart(8)} │ ${msgWriteTime.toString().padStart(9)} │ ${(chatMsgCount / msgWriteTime * 1000).toFixed(2).padStart(12)} │`);
        console.log(`│ 读取(从localStorage)│ ${(chatCount + chatMsgCount).toString().padStart(8)} │ ${reloadTime.toString().padStart(9)} │ ${((chatCount + chatMsgCount) / reloadTime * 1000).toFixed(2).padStart(12)} │`);
        console.log(`└─────────────────────────────────────────────────────────────┘`);

        const storageUsage = this.getStorageUsage();
        console.log(`\n--- localStorage 容量信息 ---`);
        console.log(`总容量: 约 5MB`);
        console.log(`已使用: ${(storageUsage.used / 1024).toFixed(2)} KB (${((storageUsage.used / storageUsage.limit) * 100).toFixed(2)}%)`);
        console.log(`剩余容量: ${((storageUsage.limit - storageUsage.used) / 1024).toFixed(2)} KB`);
    }

    private clearTestData(): void {
        const keysToRemove: string[] = [];
        for (let i = 0; i < sys.localStorage.length; i++) {
            const key = sys.localStorage.key(i);
            if (key && key.startsWith('performance_test_')) {
                keysToRemove.push(key);
            }
        }
        for (const key of keysToRemove) {
            sys.localStorage.removeItem(key);
        }
        console.log(`[清理] 已清除 ${keysToRemove.length} 个测试相关的 localStorage 键`);
    }

    private verifyLocalStorageData(tableName: string, expectedCount: number): void {
        const dataKey = `performance_test_data_${tableName}`;
        const dataStr = sys.localStorage.getItem(dataKey);
        
        if (!dataStr) {
            console.error(`❌ localStorage 中未找到 ${tableName} 数据`);
            return;
        }

        try {
            const data = JSON.parse(dataStr);
            const actualCount = data.length;
            console.log(`[验证] localStorage 中 ${tableName} 数据: ${actualCount} 条`);
            
            if (actualCount !== expectedCount) {
                console.error(`❌ ${tableName} 数据不完整！期望 ${expectedCount} 条，实际 ${actualCount} 条`);
            } else {
                console.log(`✅ ${tableName} 数据完整`);
            }

            if (actualCount > 0) {
                console.log(`[验证] ${tableName} 第一条数据: ${JSON.stringify(data[0])}`);
            }
        } catch (e) {
            console.error(`❌ ${tableName} 数据解析失败:`, e);
        }
    }

    private logStorageInfo(label: string): void {
        const usage = this.getStorageUsage();
        console.log(`[存储] ${label} - 使用量: ${(usage.used / 1024).toFixed(2)} KB / ${(usage.limit / 1024).toFixed(2)} KB (${((usage.used / usage.limit) * 100).toFixed(1)}%)`);
    }

    private getStorageUsage(): { used: number; limit: number } {
        let used = 0;
        for (let i = 0; i < sys.localStorage.length; i++) {
            const key = sys.localStorage.key(i);
            if (key) {
                const value = sys.localStorage.getItem(key);
                if (value) {
                    used += key.length + value.length;
                }
            }
        }
        const limit = 5 * 1024 * 1024;
        return { used, limit };
    }
}