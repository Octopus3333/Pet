package com.comma.club.pet.world.story;

import android.content.Context;
import android.os.Build;
import android.telephony.SubscriptionInfo;
import android.telephony.SubscriptionManager;
import android.telephony.TelephonyManager;

import java.util.List;

/**
 * SIM卡信息获取工具类
 * 通过 native.reflection.callStaticMethod 从 TS 层调用
 */
public class SimCardHelper {

    private static Context appContext;

    /**
     * 初始化，需要在 AppActivity.onCreate 中调用
     */
    public static void init(Context context) {
        appContext = context.getApplicationContext();
    }

    /**
     * 检查设备是否有 SIM 卡
     * TS 调用: native.reflection.callStaticMethod("com/comma/club/pet/world/story/SimCardHelper", "hasSimCard", "()Z")
     * @return true 有SIM卡, false 无SIM卡
     */
    public static boolean hasSimCard() {
        if (appContext == null) return false;
        try {
            TelephonyManager tm = (TelephonyManager) appContext.getSystemService(Context.TELEPHONY_SERVICE);
            if (tm == null) return false;
            int simState = tm.getSimState();
            return simState == TelephonyManager.SIM_STATE_READY;
        } catch (SecurityException e) {
            android.util.Log.e("SimCardHelper", "hasSimCard: 权限不足 " + e.getMessage());
            return false;
        }
    }

    /**
     * 获取可用的手机号码
     * 双卡时优先卡1，返回有信号的SIM卡号码
     * TS 调用: native.reflection.callStaticMethod("com/comma/club/pet/world/story/SimCardHelper", "getAvailablePhoneNumber", "()Ljava/lang/String;")
     * @return 手机号码字符串，无SIM卡或无号码时返回空字符串
     */
    public static String getAvailablePhoneNumber() {
        if (appContext == null) return "";
        try {
            TelephonyManager baseTm = (TelephonyManager) appContext.getSystemService(Context.TELEPHONY_SERVICE);
            if (baseTm == null) return "";

            // 获取活跃的SIM卡订阅列表
            SubscriptionManager sm = (SubscriptionManager) appContext.getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE);
            if (sm == null) {
                // 无SubscriptionManager，尝试单卡
                return getSingleSimNumber(baseTm);
            }

            List<SubscriptionInfo> activeSubs = sm.getActiveSubscriptionInfoList();
            if (activeSubs == null || activeSubs.isEmpty()) {
                // 无活跃订阅，尝试单卡
                return getSingleSimNumber(baseTm);
            }

            // 按SIM卡槽位排序（卡1优先）
            if (activeSubs.size() > 1) {
                activeSubs.sort((a, b) -> Integer.compare(a.getSimSlotIndex(), b.getSimSlotIndex()));
            }

            // 遍历订阅，优先返回有信号（SIM_STATE_READY）的卡号
            for (SubscriptionInfo sub : activeSubs) {
                int subId = sub.getSubscriptionId();
                TelephonyManager subTm = baseTm.createForSubscriptionId(subId);
                if (subTm != null) {
                    int simState = subTm.getSimState();
                    if (simState == TelephonyManager.SIM_STATE_READY) {
                        String number = subTm.getLine1Number();
                        if (number != null && !number.isEmpty()) {
                            return number;
                        }
                        number = sub.getNumber();
                        if (number != null && !number.isEmpty()) {
                            return number;
                        }
                    }
                }
            }

            return "";
        } catch (SecurityException e) {
            android.util.Log.e("SimCardHelper", "getAvailablePhoneNumber: 权限不足 " + e.getMessage());
            return "";
        }
    }

    /**
     * 获取SIM卡数量
     * TS 调用: native.reflection.callStaticMethod("com/comma/club/pet/world/story/SimCardHelper", "getSimCount", "()I")
     * @return SIM卡数量
     */
    public static int getSimCount() {
        if (appContext == null) return 0;
        try {
            SubscriptionManager sm = (SubscriptionManager) appContext.getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE);
            if (sm == null) return 0;
            List<SubscriptionInfo> activeSubs = sm.getActiveSubscriptionInfoList();
            return activeSubs != null ? activeSubs.size() : 0;
        } catch (SecurityException e) {
            android.util.Log.e("SimCardHelper", "getSimCount: 权限不足 " + e.getMessage());
            return 0;
        }
    }

    /**
     * 获取SIM卡综合信息（JSON格式）
     * TS 调用: native.reflection.callStaticMethod("com/comma/club/pet/world/story/SimCardHelper", "getSimInfo", "()Ljava/lang/String;")
     * @return JSON字符串 {"hasSim":true, "simCount":1, "phoneNumber":"138xxxx"}
     */
    public static String getSimInfo() {
        StringBuilder json = new StringBuilder();
        json.append("{");

        boolean hasSim = hasSimCard();
        json.append("\"hasSim\":").append(hasSim);

        int simCount = getSimCount();
        json.append(",\"simCount\":").append(simCount);

        String phoneNumber = getAvailablePhoneNumber();
        json.append(",\"phoneNumber\":\"").append(phoneNumber != null ? phoneNumber : "").append("\"");

        json.append("}");
        return json.toString();
    }

    /**
     * 单卡情况下获取号码
     */
    private static String getSingleSimNumber(TelephonyManager tm) {
        if (tm.getSimState() != TelephonyManager.SIM_STATE_READY) {
            return "";
        }
        String number = tm.getLine1Number();
        return (number != null && !number.isEmpty()) ? number : "";
    }
}