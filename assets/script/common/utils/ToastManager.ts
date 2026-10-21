import { tween, Vec3 } from "cc"
import { ViewPath } from "./Define"
import { addPrefab } from "./UiTools"
import { UiToast } from "./UiToast"

export class ToastManager {
    static _ins:ToastManager = null
    private maxToastNum = 10
    private toastList = []
    private defaultPos: Vec3 = new Vec3(0, 0, 0)
    private static duration = 2

    static get ins(): ToastManager {
        if (!this._ins) {
            this._ins = new ToastManager()
        }
        return this._ins
    }

    async showToast(str: string, parent?) {
        var toastItem
        if (this.toastList.length >= this.maxToastNum) {
            toastItem = this.toastList.shift()
        } else {
            toastItem = await addPrefab(ViewPath.Toast, parent)
        }
        var toast = toastItem.getComponent(UiToast)
        toast.show(str)
        tween(toastItem).stop()
        toastItem.setPosition(this.defaultPos)
        this.toastList.push(toastItem)
        tween(toastItem).delay(ToastManager.duration).call(() => {
            var index = this.toastList.indexOf(toastItem)
            if (index !== -1) {
                this.toastList.splice(index, 1)
            }
            tween(toastItem).stop()
            toastItem.destroy()
        }).start()
    }
}


