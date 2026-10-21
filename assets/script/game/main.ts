import { _decorator, Component } from 'cc';
import { UIManager } from '../common/utils/UIManager';
import { ViewPath } from '../common/utils/Define';
import { MainController } from './MainController';

const { ccclass, property } = _decorator;

@ccclass('main')
export class main extends Component {
    protected async onLoad(): Promise<void> {
        MainController.ins.init();
        MainController.ins.startApp();
    }

    update(deltaTime: number) {}
}
