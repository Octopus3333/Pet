import { _decorator, Component } from 'cc';
import { UIManager } from '../common/utils/UIManager';
import { ViewPath } from '../common/utils/Define';
import { NotesContent } from './NotesContent';
import { ToastManager } from '../common/utils/ToastManager';

const { ccclass } = _decorator;

@ccclass('TreatureNotes')
export class TreatureNotes extends Component {

    async onClickEnter(sender, data) {
        console.log("onClickEnter===", data)
        switch (data) {
            case 'photo':
                UIManager.ins.show(ViewPath.PhotoPanel);
                break;
            case 'diary':
                ToastManager.ins.showToast('敬请期待');
                break;
            case 'item':
                ToastManager.ins.showToast('敬请期待');
                break;
            case 'story':
                ToastManager.ins.showToast('敬请期待');
                break;
            default:
                var layer = await UIManager.ins.show(ViewPath.NotesContent);
                var comp = layer.getComponent(NotesContent);
                comp.show(data);
                break;
        }
    }

    onClickClose() {
        UIManager.ins.hideView(this.node);
    }
}