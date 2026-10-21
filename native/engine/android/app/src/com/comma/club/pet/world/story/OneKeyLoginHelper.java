package com.comma.club.pet.world.story;

import android.app.Activity;
import android.content.Context;
import android.graphics.Color;
import android.util.DisplayMetrics;
import android.util.Log;

import com.cocos.lib.JsbBridge;
import com.mobile.auth.gatewayauth.AuthUIConfig;
import com.mobile.auth.gatewayauth.PhoneNumberAuthHelper;
import com.mobile.auth.gatewayauth.TokenResultListener;
import com.mobile.auth.gatewayauth.model.TokenRet;

import org.json.JSONObject;

/**
 * 阿里云一键登录桥接类
 * 通过 JsbBridge 与 TS 层通信
 */
public class OneKeyLoginHelper {

    private static final String TAG = "OneKeyLoginHelper";
    private static final String EVENT_RESULT = "oneKeyLoginResult";

    private static Activity sActivity;
    private static PhoneNumberAuthHelper mAuthHelper;
    private static boolean sInitialized = false;

    /**
     * 初始化，在 AppActivity.onCreate 中调用
     */
    public static void init(Activity activity) {
        sActivity = activity;
        Log.d(TAG, "init called");
    }

    /**
     * 设置 SDK 密钥并初始化认证实例
     * TS 调用: native.reflection.callStaticMethod(..., "setAuthSDKInfo", "(Ljava/lang/String;)V", secretKey)
     */
    public static void setAuthSDKInfo(String secretKey) {
        Log.e(TAG,"java setAuthSDKInfo:run");
        if (sActivity == null) {
            Log.e(TAG, "setAuthSDKInfo: Activity not initialized" + secretKey);
            sendResultToScript(600002, "初始化失败：Activity为空");
            return;
        }
        try {
            mAuthHelper = PhoneNumberAuthHelper.getInstance(
                sActivity.getApplicationContext(),
                new TokenResultListener() {
                    @Override
                    public void onTokenSuccess(String s) {
                        Log.d(TAG, "onTokenSuccess: " + s);
                        try {
                            JSONObject json = new JSONObject(s);
                            int resultCode = json.optInt("resultCode", 600000);
                            if (resultCode == 600000) {
                                // 成功获取Token
                                String token = json.optString("token", "");
                                sendResultToScript(600000, token);
                            } else if (resultCode == 600001) {
                                // 授权页唤起成功
                                sendResultToScript(600001, "授权页唤起成功");
                            } else {
                                sendResultToScript(resultCode, json.optString("msg", ""));
                            }
                        } catch (Exception e) {
                            sendResultToScript(600000, s);
                        }
                    }

                    @Override
                    public void onTokenFailed(String s) {
                        Log.e(TAG, "cocos onTokenFailed: " + s);
                        try {
                            JSONObject json = new JSONObject(s);
                            int resultCode = json.optInt("resultCode", 600002);
                            sendResultToScript(resultCode, json.optString("msg", s));
                        } catch (Exception e) {
                            sendResultToScript(600002, s);
                        }
                    }
                }
            );
            
            // 打印 App 信息（包名 + SHA1 签名）
            printAppInfo();

            mAuthHelper.setAuthSDKInfo("HoE10vpm6NQ+KEqKGMt7TziJcYG8he4WyRCy5kvtY4o+WGAv62FvirFWJspoJ4CAnc2rWHQ49AeDKtIJjk0uXVX8uXVsolyYoaQas7C+nHfb7JOduXkwGWtKlIkCXIxX3M4K5vSdrUz4vJEd0Pr6+kRkRKzTMZaoC+iD2J6TnEXKShv/7VhFGdh9Q7FcW/hIsRCFCXPf1b3GMXX8/hh2amW6BYMiA54pd2g5hNmlHWO6FtdtJc5nIPRWmKAESgMJMNdxRl/QQeWj2A2ws/v5rH8vJ03G3MocYYYFX2KM4o50Oo4XN/ag8UG1znPHT8bM");

            // 配置一键登录授权页 UI
            configureAuthUI();

            sInitialized = true;
            Log.d(TAG, "SDK initialized successfully");
        } catch (Exception e) {
            Log.e(TAG, "setAuthSDKInfo error: " + e.getMessage());
            sendResultToScript(600002, "初始化异常: " + e.getMessage());
        }
    }

    /**
     * 一键登录获取Token
     * TS 调用: native.reflection.callStaticMethod(..., "getLoginToken", "(I)V", timeout)
     * @param timeout 超时时间（毫秒），默认5000
     */
    public static void getLoginToken(int timeout) {
        if (!sInitialized || mAuthHelper == null) {
            Log.e(TAG, "getLoginToken: SDK not initialized");
            sendResultToScript(600002, "SDK未初始化，请先调用setAuthSDKInfo");
            return;
        }
        if (timeout <= 0) {
            timeout = 5000;
        }
        try {
            mAuthHelper.getLoginToken(sActivity, timeout);
            Log.d(TAG, "getLoginToken called, timeout=" + timeout);
        } catch (Exception e) {
            Log.e(TAG, "getLoginToken error: " + e.getMessage());
            sendResultToScript(600002, "拉起授权页异常: " + e.getMessage());
        }
    }

    /**
     * 退出授权页
     * TS 调用: native.reflection.callStaticMethod(..., "quitLoginPage", "()V")
     */
    public static void quitLoginPage() {
        if (mAuthHelper != null) {
            try {
                mAuthHelper.quitLoginPage();
                Log.d(TAG, "quitLoginPage called");
            } catch (Exception e) {
                Log.e(TAG, "quitLoginPage error: " + e.getMessage());
            }
        }
    }

    /**
     * 检查环境是否支持一键登录
     * TS 调用: native.reflection.callStaticMethod(..., "checkEnvAvailable", "()V")
     */
    public static void checkEnvAvailable() {
        if (!sInitialized || mAuthHelper == null) {
            sendResultToScript(600002, "SDK未初始化");
            return;
        }
        try {
            mAuthHelper.checkEnvAvailable(PhoneNumberAuthHelper.SERVICE_TYPE_LOGIN);
        } catch (Exception e) {
            Log.e(TAG, "checkEnvAvailable error: " + e.getMessage());
            sendResultToScript(600002, "环境检查异常: " + e.getMessage());
        }
    }

    /**
     * 预取号（加速拉起授权页）
     * TS 调用: native.reflection.callStaticMethod(..., "accelerateLoginPage", "(I)V", timeout)
     */
    public static void accelerateLoginPage(int timeout) {
        if (!sInitialized || mAuthHelper == null) {
            sendResultToScript(600002, "SDK未初始化");
            return;
        }
        if (timeout <= 0) {
            timeout = 5000;
        }
        try {
            mAuthHelper.accelerateLoginPage(timeout, null);
        } catch (Exception e) {
            Log.e(TAG, "accelerateLoginPage error: " + e.getMessage());
        }
    }

    /**
     * 获取运营商名称
     * TS 调用: native.reflection.callStaticMethod(..., "getCurrentCarrierName", "()Ljava/lang/String;")
     * @return CMCC/CUCC/CTCC 或空字符串
     */
    public static String getCurrentCarrierName() {
        if (mAuthHelper != null) {
            try {
                return mAuthHelper.getCurrentCarrierName();
            } catch (Exception e) {
                Log.e(TAG, "getCurrentCarrierName error: " + e.getMessage());
            }
        }
        return "";
    }

    /**
     * 发送结果给 TS 层
     */
    private static void sendResultToScript(int code, String msg) {
        try {
            JSONObject json = new JSONObject();
            json.put("code", code);
            json.put("msg", msg);
            JsbBridge.sendToScript(EVENT_RESULT, json.toString());
        } catch (Exception e) {
            Log.e(TAG, "sendResultToScript error: " + e.getMessage());
        }
    }

    /**
     * 配置一键登录授权页 UI（匹配效果图样式）
     */
    private static void configureAuthUI() {
        if (mAuthHelper == null || sActivity == null) return;
        try {
            DisplayMetrics dm = sActivity.getResources().getDisplayMetrics();
            int screenWidth = dm.widthPixels;
            int screenHeight = dm.heightPixels;

            // 颜色
            int primaryBrown = Color.parseColor("#6F4018");
            int bgYellow = Color.parseColor("#FFF9E6");
            int protocolGray = Color.parseColor("#999999");

            // 尺寸（按 1080p 基准等比缩放，SDK 的偏移/宽高一般用 px）
            float scale = screenWidth / 1080f;
            int logoWidth = (int) (420 * scale);
            int logoHeight = (int) (360 * scale);
            int logoOffsetY = (int) (160 * scale);
            int numberOffsetY = logoOffsetY + logoHeight + (int) (120 * scale);
            int switchOffsetY = numberOffsetY + (int) (90 * scale);
            int logBtnWidth = (int) (330 * scale);
            int logBtnHeight = (int) (126 * scale);
            int logBtnOffsetY = switchOffsetY + (int) (90 * scale);
            int sloganOffsetY = logBtnOffsetY + logBtnHeight + (int) (60 * scale);

            AuthUIConfig.Builder builder = new AuthUIConfig.Builder();
            builder.setNavHidden(true)
                .setNavReturnHidden(true)
                .setSwitchAccHidden(false)
                .setLogoHidden(false)
                .setSloganHidden(true)

                // 页面背景（如需爪印背景请提供背景图后用 setPageBackgroundPath）
                // .setPageBackgroundPath("login_page_bg")

                // Logo（逗号家族）
                .setLogoImgPath("login_logo")
                .setLogoWidth(logoWidth)
                .setLogoHeight(logoHeight)
                .setLogoOffsetY(logoOffsetY)

                // 手机号
                .setNumFieldOffsetY(numberOffsetY)
                .setNumberSizeDp(28)
                .setNumberColor(primaryBrown)

                // 切换账号
                .setSwitchAccText("切换账号")
                .setSwitchAccTextColor(primaryBrown)
                .setSwitchAccTextSizeDp(14)
                .setSwitchOffsetY(switchOffsetY)

                // 一键登录按钮
                .setLogBtnText("一键登录")
                .setLogBtnTextColor(primaryBrown)
                .setLogBtnTextSizeDp(18)
                .setLogBtnWidth(logBtnWidth)
                .setLogBtnHeight(logBtnHeight)
                // .setLogBtnOffsetY(logBtnOffsetY)
                // .setLogBtnOffsetX((screenWidth - logBtnWidth) / 2)
                .setLogBtnBackgroundPath("login_btn_bg")

                // 隐私协议
                .setPrivacyState(false)
                .setCheckboxHidden(false)
                .setAppPrivacyOne("《用户协议》", "https://www.baidu.com")
                .setAppPrivacyTwo("《隐私协议》", "https://www.baidu.com")
                .setPrivacyConectTexts(new String[]{"未注册的手机号将自动创建账号，登录即代表您同意", "和"})
                .setPrivacyOperatorIndex(2)
                .setAppPrivacyColor(protocolGray, primaryBrown)
                .setPrivacyOffsetY_B((int) (80 * scale))
                .setPrivacyTextSizeDp(11);

            mAuthHelper.setAuthUIConfig(builder.create());
            Log.d(TAG, "configureAuthUI success");
        } catch (Exception e) {
            Log.e(TAG, "configureAuthUI error: " + e.getMessage());
        }
    }

    /**
     * 打印 App 信息（包名 + SHA1 签名）
     */
    private static void printAppInfo() {
        if (sActivity == null) {
            Log.e(TAG, "========== print App Info ==========");
            return;
        }

        try {
            String packageName = sActivity.getPackageName();
            android.content.pm.PackageInfo packageInfo = sActivity.getPackageManager()
                .getPackageInfo(packageName, android.content.pm.PackageManager.GET_SIGNATURES);
            
            StringBuilder sha1Builder = new StringBuilder();
            if (packageInfo.signatures != null && packageInfo.signatures.length > 0) {
                java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA1");
                md.update(packageInfo.signatures[0].toByteArray());
                byte[] digest = md.digest();
                for (byte b : digest) {
                    sha1Builder.append(String.format("%02X", b));
                }
            }
            
            Log.e(TAG, "========== App Info ==========");
            Log.e(TAG, "Package Name: " + packageName);
            Log.e(TAG, "SHA1: " + sha1Builder.toString());
            Log.e(TAG, "==============================");
        } catch (Exception e) {
            Log.e(TAG, "printAppInfo error: " + e.getMessage());
        }
    }
}