import { _decorator, EditBox, Size, UITransform } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 修复 Cocos 3.8.x EditBox 强制覆盖子 Label 位置 / 尺寸 / 对齐 的问题。
 *
 * 引擎会在以下时机强制重置 TEXT_LABEL / PLACEHOLDER_LABEL：
 *   - _updateLabelPosition(size)    : setPosition / setContentSize / verticalAlign / enableWrapText
 *   - _resizeChildNodes()           : 监听 SIZE_CHANGED，setPosition / setContentSize
 *   - _updateTextLabel()            : verticalAlign / enableWrapText
 *   - _updatePlaceholderLabel()     : enableWrapText
 *  把本组件替换掉节点上的原生 EditBox 即可（保留原 EditBox 上的 textLabel / placeholderLabel / 输入参数配置）。
 *
 * 用法：
 *   1. 节点上的 cc.EditBox 删掉，改加 CustomEditBox；
 *   2. 重新拖拽 textLabel / placeholderLabel；
 *   3. 在编辑器里自由调整子 Label 的 position / anchor / 对齐；
 *   4. 保持 preserveChildLayout = true。
 */
@ccclass('CustomEditBox')
export class CustomEditBox extends EditBox {
    @property({ tooltip: '保留子 Label 在编辑器里设置的 position / anchor / 尺寸 / 对齐，不被引擎强制覆盖' })
    preserveChildLayout: boolean = true;

    /**
     * 覆盖引擎的 _updateLabelPosition。
     * 原实现会强制 setPosition / setContentSize / 修改 verticalAlign 与 enableWrapText，
     * 当 preserveChildLayout = true 时跳过这些写入，保留编辑器里的设置。
     * @param size EditBox 当前 contentSize，preserveChildLayout 为 true 时不使用
     */
    protected _updateLabelPosition(size: Size): void {
        if (!this.preserveChildLayout) {
            super._updateLabelPosition(size);
        }
    }

    /**
     * 拦截 _updateTextLabel，避免引擎覆盖 verticalAlign / enableWrapText。
     * 仍同步输入文本内容，保证 EditBox.string 正常显示。
     */
    protected _updateTextLabel(): void {
        if (!this.preserveChildLayout) {
            super._updateTextLabel();
            return;
        }

        const textLabel = this._textLabel;
        if (!textLabel) {
            return;
        }
        textLabel.string = this._updateLabelStringStyle(this._string);
    }

    /**
     * 拦截 _updatePlaceholderLabel，避免引擎覆盖 enableWrapText。
     * 仍同步占位符文本，保证 placeholder 正常显示。
     */
    protected _updatePlaceholderLabel(): void {
        if (!this.preserveChildLayout) {
            super._updatePlaceholderLabel();
            return;
        }

        const placeholderLabel = this._placeholderLabel;
        if (!placeholderLabel) {
            return;
        }
        placeholderLabel.string = this.placeholder;
    }

    /**
     * 拦截 _resizeChildNodes，避免 SIZE_CHANGED 时覆盖子 Label 位置与尺寸。
     * 仅同步背景 Sprite 尺寸并刷新 impl，不触碰子 Label 布局。
     */
    protected _resizeChildNodes(): void {
        if (!this.preserveChildLayout) {
            super._resizeChildNodes();
            return;
        }

        const trans = this.node.getComponent(UITransform);
        if (!trans) {
            return;
        }

        const bgNode = (this as unknown as { _background: { node: { getComponent<T>(type: new (...args: never[]) => T): T | null } } | null })._background?.node;
        const bgTrans = bgNode?.getComponent(UITransform);
        bgTrans?.setContentSize(trans.contentSize);

        (this as unknown as { _syncSize: () => void })._syncSize();
    }
}
