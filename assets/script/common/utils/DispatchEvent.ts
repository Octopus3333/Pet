export type EventCallback = (...args: unknown[]) => void;

interface EventListener {
    callback: EventCallback;
    target: any;
}

export class DispatchEvent {
    private static _ins: DispatchEvent;
    private _listeners: Map<string, EventListener[]> = new Map();

    static get ins(): DispatchEvent {
        if (!this._ins) {
            this._ins = new DispatchEvent();
        }
        return this._ins;
    }

    /**
     * 注册事件监听
     */
    public on(event: string, callback: EventCallback, target): void {
        if (!this._listeners.has(event)) {
            this._listeners.set(event, []);
        }
        this._listeners.get(event)!.push({ callback, target });
    }

    /**
     * 移除事件监听
     */
    public off(event: string, callback: EventCallback, target): void {
        const listeners = this._listeners.get(event);
        if (listeners) {
            const index = listeners.findIndex(l => l.callback === callback && l.target === target);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }

    /**
     * 派发事件
     */
    public emit(event: string, ...args: unknown[]): void {
        const listeners = this._listeners.get(event);
        if (listeners) {
            listeners.forEach((listener) => {
                try {
                    // 跳过已被销毁的组件目标
                    if (listener.target && listener.target.isValid === false) {
                        return;
                    }
                    listener.callback.call(listener.target, ...args);
                } catch (error) {
                    console.error(`Error in event listener for "${event}":`, error);
                }
            });
        }
    }

    /**
     * 移除指定事件的所有监听
     */
    public removeAll(event: string): void {
        this._listeners.delete(event);
    }

    /**
     * 清除所有事件监听
     */
    public clear(): void {
        this._listeners.clear();
    }
}