package com.comma.club.pet.world.story;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Log;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.cocos.lib.JsbBridge;

import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;

/**
 * 相册保存工具（Android）
 *
 * TS 调用方式（native.reflection.callStaticMethod）：
 *   - hasWritePermission()  : ()Z
 *   - requestWritePermission() : ()V   （异步，结果通过 JsbBridge.sendToScript 回传）
 *   - saveImage(filePath, w, h) : (Ljava/lang/String;II)V  （异步，结果通过 JsbBridge 回传）
 *
 * 像素约定：filePath 指向一个 RGBA8888 的裸数据文件，行序为「顶到底」（TS 已翻转）。
 */
public class AlbumSaver {

    private static final String TAG = "AlbumSaver";

    private static final int REQ_WRITE_STORAGE = 1002;

    // 与 TS 通信的事件名
    private static final String EVT_PERM_RESULT = "albumPermissionResult";
    private static final String EVT_SAVE_RESULT = "albumSaveResult";

    private static Activity activity;
    private static Context appContext;

    /**
     * 初始化，需要在 AppActivity.onCreate 中调用
     */
    public static void init(Activity act) {
        activity = act;
        appContext = act.getApplicationContext();
    }

    // =========================================================================
    // 权限
    // =========================================================================

    /**
     * 是否已有写相册权限。
     * Android 10+ 写 MediaStore 不需要 WRITE_EXTERNAL_STORAGE 权限（作用域存储）。
     * TS 调用: ()Z
     */
    public static boolean hasWritePermission() {
        if (appContext == null) return false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) return true;
        return ContextCompat.checkSelfPermission(appContext, android.Manifest.permission.WRITE_EXTERNAL_STORAGE)
                == PackageManager.PERMISSION_GRANTED;
    }

    /**
     * 申请写相册权限（异步）。结果通过 JsbBridge.sendToScript("albumPermissionResult", json) 回传。
     * TS 调用: ()V
     */
    public static void requestWritePermission() {
        if (hasWritePermission()) {
            sendPermResult("granted");
            return;
        }
        if (activity == null) {
            sendPermResult("denied");
            return;
        }
        // Android 10+ 不需要权限；这里仅处理 < 10 的情况
        ActivityCompat.requestPermissions(activity,
                new String[]{android.Manifest.permission.WRITE_EXTERNAL_STORAGE},
                REQ_WRITE_STORAGE);
    }

    /**
     * 由 AppActivity.onRequestPermissionsResult 转发过来
     */
    public static void onPermissionResult(int requestCode, String[] permissions, int[] grantResults) {
        if (requestCode != REQ_WRITE_STORAGE) return;
        boolean granted = grantResults != null && grantResults.length > 0
                && grantResults[0] == PackageManager.PERMISSION_GRANTED;
        sendPermResult(granted ? "granted" : "denied");
    }

    private static void sendPermResult(String state) {
        try {
            JSONObject json = new JSONObject();
            json.put("state", state);
            JsbBridge.sendToScript(EVT_PERM_RESULT, json.toString());
        } catch (Exception e) {
            Log.e(TAG, "sendPermResult", e);
        }
    }

    // =========================================================================
    // 保存
    // =========================================================================

    /**
     * 把 RGBA 裸数据文件解码为 Bitmap 并保存到相册（PNG）。
     * 异步执行，结果通过 JsbBridge.sendToScript("albumSaveResult", json) 回传。
     * TS 调用: (Ljava/lang/String;II)V
     *
     * @param filePath RGBA 文件绝对路径
     * @param width    图片宽度
     * @param height   图片高度
     */
    public static void saveImage(String filePath, int width, int height) {
        new Thread(() -> {
            try {
                byte[] rgba = readFileBytes(filePath);
                if (rgba == null) {
                    sendSaveResult(false, "读取像素文件失败", null);
                    return;
                }
                int expected = width * height * 4;
                if (rgba.length < expected) {
                    sendSaveResult(false, "像素数据长度不足: 期望 " + expected + " 实际 " + rgba.length, null);
                    return;
                }

                Bitmap bmp = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
                // 直通 alpha，避免系统对像素做预乘，保持原始 RGBA
                bmp.setPremultiplied(false);
                bmp.copyPixelsFromBuffer(ByteBuffer.wrap(rgba));

                String savedPath = saveBitmapToGallery(bmp);
                bmp.recycle();

                if (savedPath != null) {
                    sendSaveResult(true, "保存成功", savedPath);
                } else {
                    sendSaveResult(false, "写入相册失败", null);
                }
            } catch (Exception e) {
                Log.e(TAG, "saveImage", e);
                sendSaveResult(false, "保存异常: " + e.getMessage(), null);
            }
        }).start();
    }

    /** 读取文件全部字节 */
    private static byte[] readFileBytes(String path) {
        FileInputStream fis = null;
        FileChannel ch = null;
        try {
            fis = new FileInputStream(path);
            ch = fis.getChannel();
            long size = ch.size();
            ByteBuffer buf = ByteBuffer.allocate((int) size);
            ch.read(buf);
            buf.flip();
            return buf.array();
        } catch (Exception e) {
            Log.e(TAG, "readFileBytes", e);
            return null;
        } finally {
            try { if (ch != null) ch.close(); } catch (Exception ignore) {}
            try { if (fis != null) fis.close(); } catch (Exception ignore) {}
        }
    }

    /**
     * 保存 Bitmap 到系统相册的 Pictures/CocosAlbum 目录（PNG）。
     * - Android 10+：使用 MediaStore + 作用域存储
     * - Android 9 及以下：写入公共 Pictures 目录并通知媒体扫描
     *
     * @return 保存成功时返回文件路径（或 MediaStore Uri 字符串），失败返回 null
     */
    private static String saveBitmapToGallery(Bitmap bmp) {
        String fileName = "cocos_" + System.currentTimeMillis() + ".png";
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            // 作用域存储：MediaStore
            try {
                ContentResolver cr = appContext.getContentResolver();
                ContentValues cv = new ContentValues();
                cv.put(MediaStore.Images.Media.DISPLAY_NAME, fileName);
                cv.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
                cv.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/CocosAlbum");
                cv.put(MediaStore.Images.Media.IS_PENDING, 1);

                Uri uri = cr.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, cv);
                if (uri == null) return null;

                OutputStream os = cr.openOutputStream(uri);
                if (os == null) return null;
                boolean ok = bmp.compress(Bitmap.CompressFormat.PNG, 100, os);
                os.close();
                if (!ok) return null;

                cv.clear();
                cv.put(MediaStore.Images.Media.IS_PENDING, 0);
                cr.update(uri, cv, null, null);
                return uri.toString();
            } catch (Exception e) {
                Log.e(TAG, "saveBitmapToGallery (Q+)", e);
                return null;
            }
        } else {
            // Android 9 及以下：直接写公共目录
            try {
                File dir = new File(
                        Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES),
                        "CocosAlbum");
                if (!dir.exists() && !dir.mkdirs()) return null;
                File file = new File(dir, fileName);
                FileOutputStream fos = new FileOutputStream(file);
                boolean ok = bmp.compress(Bitmap.CompressFormat.PNG, 100, fos);
                fos.close();
                if (!ok) return null;
                // 通知媒体扫描器，让图片立刻出现在相册
                MediaScannerConnection.scanFile(appContext,
                        new String[]{file.getAbsolutePath()},
                        new String[]{"image/png"},
                        null);
                return file.getAbsolutePath();
            } catch (Exception e) {
                Log.e(TAG, "saveBitmapToGallery (pre-Q)", e);
                return null;
            }
        }
    }

    private static void sendSaveResult(boolean success, String msg, String path) {
        try {
            JSONObject json = new JSONObject();
            json.put("success", success);
            json.put("msg", msg == null ? "" : msg);
            if (path != null) json.put("path", path);
            JsbBridge.sendToScript(EVT_SAVE_RESULT, json.toString());
        } catch (Exception e) {
            Log.e(TAG, "sendSaveResult", e);
        }
    }
}
