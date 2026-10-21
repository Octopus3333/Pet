/****************************************************************************
 * 相册保存工具（iOS）
 *
 * 与 TS 通信走 Cocos JsbBridge（platform/apple/JsbBridge.h）：
 *   - TS -> Native: native.bridge.sendToNative(event, arg)
 *       JsbBridge 单一回调 setCallback: 会收到 (event, arg)，由 setup 注册并在
 *       handleScriptEvent:arg: 中按 event 分发。
 *   - Native -> TS: [JsbBridge sendToScript:event arg1:data]
 *       TS 侧通过 native.bridge.onNative(event, cb) 接收。
 *
 * 事件约定（与 TS 端 AlbumSaver.ts 一致）：
 *   - albumPermission  入参 { action: "check" | "request" }   回 albumPermissionResult { state }
 *   - albumSave        入参 { filePath, width, height }         回 albumSaveResult { success, msg, path? }
 *
 * 像素约定：filePath 指向一个 RGBA8888 裸数据文件，行序为「顶到底」（TS 已翻转）。
 ****************************************************************************/

#import <Foundation/Foundation.h>

@interface AlbumSaver : NSObject

+ (instancetype)shared;

/** 注册 JsbBridge 单一回调（接管 TS -> Native 事件分发）。
 *  注意：Cocos 的 JsbBridge 在该版本只有一个全局回调，故集中在此分发；
 *  若以后新增其它 TS -> Native 通信，请在 handleScriptEvent:arg: 中追加路由。 */
- (void)setup;

/** TS -> Native 事件入口（由 setup 注册的回调转发过来） */
- (void)handleScriptEvent:(NSString *)event arg:(NSString *)arg;

@end
