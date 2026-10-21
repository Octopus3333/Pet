import { _decorator, Component, Button, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('HomeTop')
export class HomeTop extends Component {

    @property(Button)
    btn_fold: Button = null;

    @property(Button)
    btn_expand: Button = null;

    protected onLoad(): void {
        this.bindButton(this.btn_fold, this.onFoldClick);
        this.bindButton(this.btn_expand, this.onExpandClick);
    }

    private bindButton(btn: Button, callback: Function): void {
        if (btn) {
            btn.node.on(Button.EventType.CLICK, callback, this);
        }
    }

    private onFoldClick(): void {
        this.node.children.forEach(child => {
            if (child !== this.btn_expand?.node) {
                child.active = false;
            }else{
                child.active = true;
            }
        });
    }

    private onExpandClick(): void {
        this.node.children.forEach(child => {
            if (child !== this.btn_expand?.node) {
                child.active = true;
            }else{
                child.active = false;
            }
        });
    }
}