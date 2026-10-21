import { _decorator, Component, Node } from 'cc';
import { DispatchEvent } from '../common/utils/DispatchEvent';
import { AgreementType, AgreementUrl, EventType } from '../common/utils/Define';
import { UIManager } from '../common/utils/UIManager';
import { ToastManager } from '../common/utils/ToastManager';
import { showPrivacyPanel } from '../common/utils/UiTools';
const { ccclass, property } = _decorator;

@ccclass('ProtoPanel')
export class ProtoPanel extends Component {

    start() {

    }
    onClickAgree(){
        UIManager.ins.hideView(this.node)
        DispatchEvent.ins.emit(EventType.AgreeProto)
    }
    onClickClose(){
        UIManager.ins.hideView(this.node)
    }
    onClickYinsi(){
        showPrivacyPanel(AgreementUrl.Privacy, AgreementType.Privacy);
    }
    onClickUser(){
        showPrivacyPanel(AgreementUrl.User, AgreementType.User);
    }

}


