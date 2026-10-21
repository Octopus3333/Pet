/**
 * Cocos Creator JSB native 类型声明
 * 统一使用 native 全局对象调用原生接口
 */
declare namespace native {
    /** 反射调用 Java 静态方法（Android） */
    namespace reflection {
        /**
         * 调用 Java 静态方法
         * @param className 类名，使用 / 分隔，如 "com/comma/club/pet/world/story/SimCardHelper"
         * @param methodName 方法名
         * @param methodSignature JNI 方法签名，如 "()Ljava/lang/String;"
         * @param args 方法参数
         */
        function callStaticMethod(
            className: string,
            methodName: string,
            methodSignature: string,
            ...args: any[]
        ): any;
    }

    /** JsbBridge 事件桥接（Java: JsbBridge.sendToScript / TS: native.bridge.onNative） */
    const bridge: {
        sendToNative: (eventName: string, param?: string) => void;
        onNative: (eventName: string, callback: ((param: string) => void) | null) => void;
    };
}