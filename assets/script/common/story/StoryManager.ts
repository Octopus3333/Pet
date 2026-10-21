import { StepContent, StoryData, StoryStep } from "./StoryStep";
import { ResLoader } from "../download/ResLoader";
import { JsonAsset, View, find } from "cc";
import { Common, EventType, ViewPath } from "../utils/Define";
import { DispatchEvent } from "../utils/DispatchEvent";
import { StoryFullAnima } from "./StoryFullAnima";
import { UIManager } from "../utils/UIManager";
import { MaskPanel } from "./MaskPanel";
import { DataManager } from "../../Data/DataManager";
import { HttpClient } from "../network/HttpClient";

export class StoryManager {
    private static _ins: StoryManager = null!;

    curStory: StoryData;
    curStep: number = 0;
    curIndex: number = 0;
    isLock: boolean = false;    
    curView: string = "";
    curPlayData:{curStep:number, curIndex:number} = {}
    static get ins(): StoryManager {
        if (!StoryManager._ins) {
            StoryManager._ins = new StoryManager();
        }
        return StoryManager._ins;
    }

    private constructor() {
        DispatchEvent.ins.on(EventType.StoryLoadFinish, this.onStoryLoadFinish, this);
        DispatchEvent.ins.on(EventType.StoryNext, this.next, this);
    }

    async loadStory(storyName: string) {
        this.curStep = DataManager.ins.getUserLead()
        console.log("curstep", this.curStep)
        try {
            const res = await ResLoader.ins.loadResAsync(Common.configPath + "storyConfig/" + storyName, JsonAsset);
            console.log("res=======", res);
            if (!res) return;
            this.curStory = new StoryData();
            this.curStory.steps = res.json as StoryStep[];
        } catch (error) {
            console.error("load story error", error);
        }
    }

    lock() {
        this.isLock = true;
    }

    unlock() {
        this.isLock = false;
    }

    onStoryLoadFinish() {
        this.unlock();
    }

    next() {
        if (this.isLock) return;
        console.log("next============");
        this.runStory();
    }
    clean(){
        if (this.curView) {
            UIManager.ins.hide(this.curView);
        }
        UIManager.ins.hide(ViewPath.MaskPanel)
    }
    async startStory(storyName: string): Promise<void> {
        if (!this.curStory) {
            await this.loadStory(storyName);
        }
        this.runStory();
    }
    stopStory(){
        this.clean()
        UIManager.ins.show(ViewPath.HomePanel)
        DispatchEvent.ins.emit(EventType.StoryFinish)
    }
    async runStory() {
        if (this.checkFinishStory()) {
            console.log("story finish");
            this.clean()

            UIManager.ins.show(ViewPath.HomePanel)
            return;
        }
        this.clean()
        this.playContent();
        this.curIndex++;
        if (this.checkFinishStep()) {
            await HttpClient.instance.post("/user/update",{new_user_lead:this.curStep})
            this.curStep++;
            this.curIndex = 0;
            console.log("next step", this.curStep);
        } else {
            console.log("next index", this.curIndex);
        }
    }

    async playContent() {
        if (!this.curStory || !this.curStory.steps) {
            console.log("story Error");
            return;
        }
        if (!this.curStory.steps[this.curStep]) {
            console.log("stepsDataError", this.curStep, this.curStory.steps);
            return;
        }
        const stepData = this.curStory.steps[this.curStep];
        if (!stepData.content || this.curIndex >= stepData.content.length) {
            console.log("cur content error", this.curIndex, stepData.content);
            return;
        }
        const contentData = stepData.content[this.curIndex];
        console.log("stepData", stepData, contentData, this.curIndex);
        this.curPlayData.curIndex = this.curIndex
        this.curPlayData.curStep = this.curStep


        switch (contentData.showType) {
            case 1:
                console.log("play story anima");
                const pb = await UIManager.ins.show("StoryFullAnima");
                this.curView = "StoryFullAnima";
                const comp = pb.getComponent(StoryFullAnima);
                comp.init(contentData.animaPath);
                break;
            case 2:
                console.log("jump Scene");
                const panelNode = await UIManager.ins.show(contentData.panelName);
                this.curView = contentData.panelName;
                if (contentData.needMask && contentData.maskTarget && panelNode) {
                    const targetNode = find(contentData.maskTarget, panelNode);
                    console.log("targetNode", targetNode, panelNode);
                    if (targetNode) {
                        const maskPanel = await UIManager.ins.show(ViewPath.MaskPanel);
                        const maskComp = maskPanel.getComponent(MaskPanel);
                        maskComp.showGuideMask(targetNode);
                    }
                }
                break;
            default:
                console.error("story type not exist");
                break;
        }
    }

    checkFinishStep() {
        if (!this.curStory) return true;
        if (!this.curStory.steps) return true;
        const stepData = this.curStory.steps[this.curStep];
        if (this.curIndex >= stepData.content.length) return true;
        return false;
    }

    checkFinishStory() {
        console.log("cur step", this.curStep, "cur story", this.curStory);
        if (!this.curStory) return true;
        if (!this.curStory.steps) return true;
        if (this.curStep >= this.curStory.steps.length) return true;
        return false;
    }
}