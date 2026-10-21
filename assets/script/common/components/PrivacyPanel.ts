import { _decorator, Component, Label, Node, WebView } from 'cc';
import { UIManager } from '../utils/UIManager';
import { DispatchEvent } from '../utils/DispatchEvent';
import { EventType } from '../utils/Define';
const { ccclass, property } = _decorator;

@ccclass('PrivacyPanel')
export class PrivacyPanel extends Component {
    @property(WebView)
    wb_content:WebView = null
    @property(Label)
    lb_name:Label = null
    agreeCb = null
    show(url, agreeCb?, name?){
        if(!url ||!this.wb_content){
            UIManager.ins.hideView(this.node)
            return
        }
        this.agreeCb = agreeCb
        console.log("url==================",url)
        this.wb_content.url = url
        if(name && this.lb_name){
            this.lb_name.string = name
        }
    }

    onClickAgree()
    {
        this.agreeCb&&this.agreeCb()
        UIManager.ins.hideView(this.node)

    }
    onClickDisagree(){
        UIManager.ins.hideView(this.node)
    }
}


