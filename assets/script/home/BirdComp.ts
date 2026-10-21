import { _decorator, Component, game, Node, sp, tween, Tween, UITransform, Vec3 } from 'cc';
import { SocketManager, SocketMSgId } from '../common/network/SocketManager';
import { ChatManager } from '../chat/ChatManager';
import { DataManager } from '../Data/DataManager';
import { DispatchEvent } from '../common/utils/DispatchEvent';
import { BIRD_ID, EventType } from '../common/utils/Define';
const { ccclass, property } = _decorator;

@ccclass('BirdComp')
export class BirdComp extends Component {
    @property(Node)
    sk_bird: Node = null;
    @property(Node)
    nd_tips:Node = null
    state = 0 ; //0空闲1,飞走 2，飞回 3.奖励未领取
    /** 当前飞行 tween，用于中途停止 */
    private _flyTween: Tween<Node> | null = null;

    /** 缓存的 Spine 组件 */
    private get _spine(): sp.Skeleton | null {
        return this.sk_bird?.getComponent(sp.Skeleton);
    }

    /** 是否正在随机播放待机动画 */
    private _isRandomPlaying: boolean = false;

    /** 待机动画列表（图中框住的动画） */
    private readonly _idleAnimations: string[] = [
        'idle',
        'jizha',
        'jump-1',
        'JUMP',
        'jizha',
        'tan',
        'tan_idle',
        'waitou_zuo',
        'waitou_you'
    ];
    onTouchBird(){
        console.log("onTouchBird", this.state)
        if(this.state == 1 || this.state == 2)return
        console.log("user id==============",BIRD_ID)
        ChatManager.ins.openChat({user_id:BIRD_ID})
    }
    onLoad() {
        this.loadBird()
        DispatchEvent.ins.on(EventType.GetMaQueRewardFinish, this.hide, this)
        this.intSocketEvent();
        // this.startRandomIdleAnimation()

    }
    hide(){
        this.showTips(false)
    }
    loadBird(){
        this.showTips(false)
        var userInfo = DataManager.ins.getUserInfo()
        if(!userInfo)return 
        this.sk_bird.active = false
        switch (userInfo.sparrowStatus) {
            case 0:
                this.sk_bird.active = false
                break;
            case 1:
                this.sk_bird.active = false
                break;            
            case 2:
                this.sk_bird.active = true
                if(userInfo.sparrowHasUnclaimed){
                    this.setState(3)
                }else{
                    this.setState(0)
                }
                break;            
            default:
                break;
        }

       


    }
    showTips(bool){
        if(!this.nd_tips)return
        this.nd_tips.active = bool
    }
    getWindowPos(){
        var gameNode = this.node.parent
        if(!gameNode)return 
        var window = gameNode.getChildByName("nd_window")
        if(!window)return
        var out = new Vec3()
        this.node.inverseTransformPoint(out,window.worldPosition)
        return out
    }
    onDestroy() {
        SocketManager.instance.off(SocketMSgId.SparrowFlybackNotify, this.onFlyBack.bind(this));
        SocketManager.instance.off(SocketMSgId.SparrowFlyoutNotify, this.onFlyOut.bind(this));
        this._flyTween?.stop();
    }
    getState(){
        return this.state   
    }
    setState(state:number){
        this.state = state
        console.log("set state========", this.state)
        switch (this.state) {
            case 0:
                this.startRandomIdleAnimation()
                break;
            case 1:
                this.runFlyOut(this.getWindowPos())
                break;   
            case 2:
                this.runFlyBack(this.getWindowPos())
                break;   
            case 3:
                this.showTips(true)
                this.startRandomIdleAnimation()
                break;   
            default:
                break;
        }
    }
    intSocketEvent() {
        SocketManager.instance.on(SocketMSgId.SparrowFlybackNotify, this.onFlyBack.bind(this));
        SocketManager.instance.on(SocketMSgId.SparrowFlyoutNotify, this.onFlyOut.bind(this));
    }
    runFlyOut(position:Vec3){
        console.log("onFlyOut res", position);
        if (!this.sk_bird) return;
        this.state = 1
        this._flyTween?.stop();
        this.stopRandomIdleAnimation();
        const spine = this._spine;
        spine?.clearTracks();

        // 从 (0, 0) 出发
        this.sk_bird.setPosition(0, 0, 0);

        const duration = 3;

        // 播放 fly-back（一次），完成后切换到 fly-back-2（循环）
        const track = spine?.setAnimation(0, 'fly-back', false);
        if (track && spine) {
            spine.setTrackCompleteListener(track, (entry: sp.spine.TrackEntry) => {
                if (entry.animation.name === 'fly-back') {
                    spine.setAnimation(0, 'fly-back-2', true);
                        this._flyTween = tween(this.sk_bird)
                    .to(duration, { position: new Vec3(position.x, position.y, 0), scale:new Vec3(0.3, 0.3, 0)})
                    .call(() => {
                        spine?.clearTracks();
                        var track = spine?.setAnimation(0, 'fly-back-3', false);
                        spine.setTrackCompleteListener(track, ()=>{
                            this.sk_bird.active = false
                        })
                    })
                    .start();    
                }
            });
        }

        // 同时 tween 移动到目标位置

    }
    /**
     * 开始随机播放待机动画（图中框住的动画）
     * 播放完一个后继续随机播放下一个，循环往复
     */
    startRandomIdleAnimation(): void {
        if (this._isRandomPlaying) return;
        if (!this.sk_bird) return;
        const spine = this._spine;
        if (!spine) return;

        this._isRandomPlaying = true;
        this.sk_bird.active = true;
        spine.clearTracks();
        this._playNextRandomIdle();
    }

    /**
     * 停止随机播放待机动画
     */
    stopRandomIdleAnimation(): void {
        this._isRandomPlaying = false;
        const spine = this._spine;
        spine?.clearTracks();
    }

    /**
     * 随机播放下一个待机动画
     */
    private _playNextRandomIdle(): void {
        if (!this._isRandomPlaying) return;

        const spine = this._spine;
        if (!spine) return;

        const idx = Math.floor(Math.random() * this._idleAnimations.length);
        const animName = this._idleAnimations[idx];
        spine.setAnimation(0, animName, false);
        spine.setCompleteListener((trackEntry: sp.spine.TrackEntry) => {
            if (this._isRandomPlaying) {
                this._playNextRandomIdle();
            }
        });
    }

    runFlyBack(position:Vec3){
        console.log("onFlyBack res", position);
        if (!this.sk_bird) return;
        this._flyTween?.stop();
        this.stopRandomIdleAnimation();
        const spine = this._spine;
        spine?.clearTracks();
        this.state = 2
        // 显示节点并设置起始位置
        this.sk_bird.active = true;
        this.sk_bird.scale = new Vec3(0.3,0.3,0) 
        this.sk_bird.setPosition(position.x, position.y, 0);

        const duration = 3;

        // 播放 fly（一次），完成后切换到 fly2（循环）
        const track = spine?.setAnimation(0, 'fly', false);
        if (track && spine) {
            spine.setTrackCompleteListener(track, (entry: sp.spine.TrackEntry) => {
                if (entry.animation.name === 'fly') {
                    spine.setAnimation(0, 'fly2', true);
                            // 同时 tween 移动到 (0, 0)
                    this._flyTween = tween(this.sk_bird)
                        .to(duration, { position: new Vec3(0, 0, 0),scale:new Vec3(1,1,0) })
                        .call(() => {
                            spine?.clearTracks();
                            var track = spine?.setAnimation(0, 'fly5', false);
                            spine?.setTrackCompleteListener(track, () => {
                               this.setState(3)
                            });
                        })
                        .start();
                    }
            });
        }


    }
    /**
     * 收到飞回通知：从传入位置飞到 (0, 0)
     * 动画：fly（一次） -> fly2（循环） -> 到达后 fly5（一次）
     */
    onFlyBack() {
        this.setState(2)
    }

    /**
     * 收到飞出通知：从 (0, 0) 飞到指定位置
     * 动画：fly-back（一次） -> fly-back-2（循环） -> 到达后 fly-back-3（一次）
     */
    onFlyOut() {
       this.setState(1)
    }
}
