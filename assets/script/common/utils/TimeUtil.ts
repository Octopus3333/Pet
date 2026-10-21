/**
 * 将时间格式化为聊天/消息列表常用展示格式
 * - 当天：14:30
 * - 昨天：昨天
 * - 今年更早：7月2日
 * - 今年之前：2024年7月2日
 */
export function getTime(time: number | Date): string {
    const target = time instanceof Date ? time : new Date(time*1000);
    const now = new Date();

    const targetYear = target.getFullYear();
    const targetMonth = target.getMonth();
    const targetDate = target.getDate();

    const nowYear = now.getFullYear();
    const nowMonth = now.getMonth();
    const nowDate = now.getDate();

    // 当天仅展示时间
    if (targetYear === nowYear && targetMonth === nowMonth && targetDate === nowDate) {
        return formatHM(target);
    }

    // 昨天
    const yesterday = new Date(now);
    yesterday.setDate(nowDate - 1);
    if (targetYear === yesterday.getFullYear() &&
        targetMonth === yesterday.getMonth() &&
        targetDate === yesterday.getDate()) {
        return '昨天';
    }

    const dateStr = `${targetMonth + 1}月${targetDate}日`;

    // 今年之前显示年份
    if (targetYear !== nowYear) {
        return `${targetYear}年${dateStr}`;
    }

    // 今年更早只显示月日
    return dateStr;
}

/** 格式化为 HH:mm */
function formatHM(date: Date): string {
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function pad(n: number): string {
    return n < 10 ? '0' + n : n.toString();
}
