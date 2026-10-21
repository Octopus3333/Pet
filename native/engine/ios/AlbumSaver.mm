#import "AlbumSaver.h"
#import <Photos/Photos.h>
#import <UIKit/UIKit.h>
#import <CoreGraphics/CoreGraphics.h>

// Cocos JsbBridge（TS <-> Native 桥）
#import "platform/apple/JsbBridge.h"

static NSString * const EVT_PERM        = @"albumPermission";
static NSString * const EVT_SAVE        = @"albumSave";
static NSString * const EVT_PERM_RESULT = @"albumPermissionResult";
static NSString * const EVT_SAVE_RESULT = @"albumSaveResult";

@implementation AlbumSaver

+ (instancetype)shared {
    static AlbumSaver *sInstance = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        sInstance = [[AlbumSaver alloc] init];
    });
    return sInstance;
}

- (void)setup {
    // 该版本 JsbBridge 只有一个全局回调，集中在此分发
    [[JsbBridge sharedInstance] setCallback:^(NSString *event, NSString *arg) {
        [[AlbumSaver shared] handleScriptEvent:event arg:arg];
    }];
}

- (void)handleScriptEvent:(NSString *)event arg:(NSString *)arg {
    NSDictionary *dict = [self dictFromJson:arg];
    if ([event isEqualToString:EVT_PERM]) {
        NSString *action = dict[@"action"];
        if ([action isEqualToString:@"request"]) {
            [self requestPermission];
        } else {
            [self checkPermission];
        }
    } else if ([event isEqualToString:EVT_SAVE]) {
        [self saveImageWithDict:dict];
    }
}

#pragma mark - Permission

- (void)checkPermission {
    PHAuthorizationStatus status = [self currentPermissionStatus];
    [self sendPermResult:[self permissionStateToString:status]];
}

- (void)requestPermission {
    if (@available(iOS 14, *)) {
        [PHPhotoLibrary requestAuthorizationForAccessLevel:PHAccessLevelAddOnly
                                                 handler:^(PHAuthorizationStatus s) {
            [self sendPermResult:[self permissionStateToString:s]];
        }];
    } else {
        [PHPhotoLibrary requestAuthorization:^(PHAuthorizationStatus s) {
            [self sendPermResult:[self permissionStateToString:s]];
        }];
    }
}

- (PHAuthorizationStatus)currentPermissionStatus {
    if (@available(iOS 14, *)) {
        return [PHPhotoLibrary authorizationStatusForAccessLevel:PHAccessLevelAddOnly];
    }
    return [PHPhotoLibrary authorizationStatus];
}

- (NSString *)permissionStateToString:(PHAuthorizationStatus)s {
    switch (s) {
        case PHAuthorizationStatusAuthorized:     return @"granted";
        case PHAuthorizationStatusLimited:        return @"granted"; // iOS14+ 受限授权，仍可写入
        case PHAuthorizationStatusDenied:         return @"denied";
        case PHAuthorizationStatusRestricted:      return @"denied";
        case PHAuthorizationStatusNotDetermined:   return @"not_determined";
        default:                                   return @"not_determined";
    }
}

- (void)sendPermResult:(NSString *)state {
    NSDictionary *d = @{ @"state": state ?: @"denied" };
    [[JsbBridge sharedInstance] sendToScript:EVT_PERM_RESULT arg1:[self jsonFromDict:d]];
}

#pragma mark - Save

- (void)saveImageWithDict:(NSDictionary *)dict {
    NSString *filePath = dict[@"filePath"];
    NSInteger width  = [dict[@"width"]  integerValue];
    NSInteger height = [dict[@"height"] integerValue];

    dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
        @try {
            UIImage *image = [self imageFromRgbaFile:filePath
                                                width:(int)width
                                               height:(int)height];
            if (!image) {
                [self sendSaveResult:NO msg:@"创建图片失败"];
                return;
            }
            [self saveImageToPhotos:image];
        } @catch (NSException *ex) {
            [self sendSaveResult:NO msg:[NSString stringWithFormat:@"保存异常: %@", ex.reason]];
        }
    });
}

/** 从 RGBA 裸数据文件构造 UIImage（直通 alpha，保持原始像素） */
- (UIImage *)imageFromRgbaFile:(NSString *)path width:(int)w height:(int)h {
    if (!path || w <= 0 || h <= 0) return nil;
    NSData *data = [NSData dataWithContentsOfFile:path];
    NSUInteger expected = (NSUInteger)w * (NSUInteger)h * 4;
    if (!data || data.length < expected) return nil;

    CGColorSpaceRef cs = CGColorSpaceCreateDeviceRGB();
    CGDataProviderRef provider = CGDataProviderCreateWithCFData((__bridge CFDataRef)data);
    // kCGImageAlphaLast = 直通 alpha（非预乘）；kCGBitmapByteOrder32Big = R,G,B,A 字节序
    CGImageRef cg = CGImageCreate(w, h,
                                  8, 32,
                                  w * 4,
                                  cs,
                                  kCGImageAlphaLast | kCGBitmapByteOrder32Big,
                                  provider,
                                  NULL,
                                  false,
                                  kCGRenderingIntentDefault);
    CGColorSpaceRelease(cs);
    CGDataProviderRelease(provider);
    if (!cg) return nil;

    UIImage *image = [UIImage imageWithCGImage:cg];
    CGImageRelease(cg);
    return image;
}

- (void)saveImageToPhotos:(UIImage *)image {
    [[PHPhotoLibrary sharedPhotoLibrary] performChanges:^{
        [PHAssetChangeRequest creationRequestForAssetFromImage:image];
    } completionHandler:^(BOOL success, NSError *error) {
        dispatch_async(dispatch_get_main_queue(), ^{
            if (success) {
                [self sendSaveResult:YES msg:@"保存成功"];
            } else {
                NSString *msg = error ? error.localizedDescription : @"保存失败";
                [self sendSaveResult:NO msg:msg];
            }
        });
    }];
}

- (void)sendSaveResult:(BOOL)success msg:(NSString *)msg {
    NSDictionary *d = @{
        @"success": @(success),
        @"msg": msg ?: @""
    };
    [[JsbBridge sharedInstance] sendToScript:EVT_SAVE_RESULT arg1:[self jsonFromDict:d]];
}

#pragma mark - JSON

- (NSDictionary *)dictFromJson:(NSString *)json {
    if (json.length == 0) return @{};
    NSData *data = [json dataUsingEncoding:NSUTF8StringEncoding];
    NSError *err = nil;
    id obj = [NSJSONSerialization JSONObjectWithData:data options:0 error:&err];
    return ([obj isKindOfClass:[NSDictionary class]]) ? obj : @{};
}

- (NSString *)jsonFromDict:(NSDictionary *)d {
    NSError *err = nil;
    NSData *data = [NSJSONSerialization dataWithJSONObject:d options:0 error:&err];
    if (!data) return @"{}";
    return [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding] ?: @"{}";
}

@end
