import { _decorator, Component, Node, Button, Label, Sprite, JsonAsset, find } from 'cc';
import { DispatchEvent } from '../common/utils/DispatchEvent';
import { EventType, Common } from '../common/utils/Define';
import { UIManager } from '../common/utils/UIManager';
import { ResLoader } from '../common/download/ResLoader';
import { SocketManager, SocketMSgId } from '../common/network/SocketManager';
import { DataManager } from '../Data/DataManager';
import { PatternManager } from '../Data/PatternManager';

const { ccclass, property } = _decorator;

export interface QuizResult {
    nature: number;//json里存的是数字
    pet: number;
}

interface QuizQuestion {
    question: string;
    options: string[];
}

interface QuizConfigData {
    questions: QuizQuestion[];
    results: Record<string, QuizResult>;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

@ccclass('QuizPanel')
export class QuizPanel extends Component {

    @property(Node)
    paper: Node = null;

    @property(Label)
    questionNum: Label = null;

    @property(Label)
    questionText: Label = null;

    @property(Button)
    btn_a: Button = null;
    @property(Button)
    btn_b: Button = null;
    @property(Button)
    btn_c: Button = null;
    @property(Button)
    btn_d: Button = null;

    @property(Button)
    btn_pre: Button = null;
    @property(Button)
    btn_next: Button = null;
    @property(Button)
    btn_submit: Button = null;

    private _optionButtons: Button[] = [];
    private _optionLabels: Label[] = [];
    private _optionSelects: Sprite[] = [];


    private _config: QuizConfigData = null;
    private _current = 0;
    private _selected: number[] = [];

    protected onLoad(): void {
        this._optionButtons = [this.btn_a, this.btn_b, this.btn_c, this.btn_d];
        this._optionLabels = this._optionButtons.map(btn => {
            if (!btn) return null;
            return btn.node.getChildByName('label')?.getComponent(Label);
        });
        this._optionSelects = this._optionButtons.map(btn => {
            if (!btn) return null;
            return btn.node.getChildByName('sp_select')?.getComponent(Sprite);
        });

        this._optionButtons.forEach((btn, index) => {
            if (btn) {
                btn.node.on(Button.EventType.CLICK, () => this._onSelectOption(index), this);
            }
        });

    }

    protected onDestroy(): void {
        this._optionButtons.forEach((btn) => {
            if (btn) btn.node.off(Button.EventType.CLICK);
        });
    }

    protected async start(): Promise<void> {
        await this._loadConfig();
        await PatternManager.ins.ready();
        this._resetQuiz();
        this._showQuestion(0);
    }

    private async _loadConfig(): Promise<void> {
        try {
            const asset = await ResLoader.ins.loadResAsync(Common.configPath + 'quizConfig', JsonAsset);
            this._config = asset.json as QuizConfigData;
        } catch (error) {
            console.error('QuizPanel load config error', error);
        }
    }

    private _resetQuiz(): void {
        this._current = 0;
        const count = this._config?.questions?.length ?? 0;
        this._selected = new Array(count).fill(-1);
    }


    private _onSelectOption(index: number): void {
        if (!this._config) return;
        this._selected[this._current] = index;
        this._updateOptionVisuals();

        //const isLast = this._current >= this._config.questions.length - 1;
        this._updateNavButtons();

        // if (!isLast) {
        //     this.scheduleOnce(() => {
        //         this.onNext();
        //     }, 0);
        // }
    }

     onPrev(): void {
        if (this._current > 0) {
            this._showQuestion(this._current - 1);
        }
    }

     onNext(): void {
        if (!this._config) return;
        if (this._current < this._config.questions.length - 1 && this._selected[this._current] !== -1) {
            this._showQuestion(this._current + 1);
        }
    }

    onSubmit(): void {
        if (!this._config) return;
        const lastIndex = this._config.questions.length - 1;
        if (this._selected[lastIndex] === -1) return;
        const result = this._buildResult();
        const pattern = Math.floor(Math.random() * 12) + 1;
        console.log("sub=======================")
        SocketManager.instance.sendDataWithCallback(
            SocketMSgId.UserInfoUpdate, 
            {
                nature: result.nature,
                pet_type: result.pet,
                color: pattern
            },
            (res) => {
                console.log("res", res);
                DataManager.ins.updateUserData({
                    nature: result.nature,
                    pet_type: result.pet,
                    color: pattern
                });
                console.log(`[问卷结果] 物种ID: ${result.pet}, 性格ID: ${result.nature}, 花色: ${pattern}`);
                UIManager.ins.hide('QuizPanel');
                DispatchEvent.ins.emit(EventType.StoryNext);
            }
        );
    }

    private _buildResult(): QuizResult {
        const key = this._selected.map(i => OPTION_LETTERS[i]).join('');
        return this._config.results?.[key];
    }

    private _showQuestion(index: number): void {
        if (!this._config || index < 0 || index >= this._config.questions.length) return;
        this._current = index;

        const data = this._config.questions[index];
        const total = this._config.questions.length;

        if (this.questionNum) {
            this.questionNum.string = `· 第${index + 1}题 ·`;
        }
        if (this.questionText) {
            this.questionText.string = data.question;
        }

        this._optionLabels.forEach((label, i) => {
            if (!label) return;
            const text = data.options[i];
            label.string = text != null ? `${OPTION_LETTERS[i]}. ${text}` : '';
        });

        this._updateOptionVisuals();
        this._updateNavButtons();
    }

    private _updateOptionVisuals(): void {
        const selected = this._selected[this._current];
        this._optionSelects.forEach((sprite, i) => {
            if (!sprite) return;
            sprite.grayscale = i !== selected;
        });
    }

    private _updateNavButtons(): void {
        if (!this._config) return;

        const total = this._config.questions.length;
        const hasSelected = this._selected[this._current] !== -1;
        const spNext = this.btn_next?.node.getChildByName('sp_next')?.getComponent(Sprite);
        const spSubmit = this.btn_submit?.node.getChildByName('sp_submit')?.getComponent(Sprite);

        if (this.btn_pre) {
            this.btn_pre.node.active = this._current > 0;
        }
        if (this.btn_next) {
            const isLast = this._current >= total - 1;
            //this.btn_next.node.active = !isLast && hasSelected;
            // this.btn_next.interactable = hasSelected;
            this.btn_next.node.active = !isLast;
            if (spNext) spNext.node.active = hasSelected;
            this.btn_next.interactable = hasSelected;
        }
        if (this.btn_submit) {
            const isLast = this._current >= total - 1;
            this.btn_submit.node.active = isLast;
            if (spSubmit) spSubmit.node.active = hasSelected;
            this.btn_submit.interactable = hasSelected;
        }
    }
}
