import { _decorator, Component, Label, Node } from 'cc';
import { WalkUser } from '../../common/utils/InterfaceDefine';
import { DispatchEvent } from '../../common/utils/DispatchEvent';
import { EventType } from '../../common/utils/Define';
import { addHeadPb } from '../../common/utils/UiTools';
const { ccclass, property } = _decorator;

@ccclass('WalkUserInfo')
export class WalkUserInfo extends Component {
    @property(Label)
    lb_clean_num:Label = null
    @property(Label)
    lb_energy_num:Label = null
    @property(Label)
    lb_xinqing_num:Label = null
    @property(Node)
    nd_head:Node = null
    @property(Label)
    lb_user_name:Label = null

    private _data: WalkUser = null
    private _energy: number = 0
    private _timerRunning: boolean = false

    protected onLoad(): void {
        DispatchEvent.ins.on(EventType.TeamUserUpdate, this._onTeamUserUpdate, this)
    }

    protected onDestroy(): void {
        DispatchEvent.ins.off(EventType.TeamUserUpdate, this._onTeamUserUpdate, this)
        this.unschedule(this._onEnergyTick)
    }

    loadData(data:WalkUser){
        this._data = data
        this._energy = data.energy || 0

        if(this.lb_clean_num){
            this.lb_clean_num.string = data.clean.toString()
        }
        this._updateEnergyLabel()
        if(this.lb_xinqing_num){
            this.lb_xinqing_num.string = (data.mood || 0).toString()
        }
        this.lb_user_name.string = data.nickname
        addHeadPb(this.nd_head, data, 0.6)
    }

    /**
     * 开始体力定时器（每秒体力-1）
     */
    startEnergyTimer(): void {
        if (this._timerRunning) return
        this._timerRunning = true
        this.schedule(this._onEnergyTick, 1)
    }

    /**
     * 暂停体力定时器
     */
    pauseEnergyTimer(): void {
        if (!this._timerRunning) return
        this._timerRunning = false
        this.unschedule(this._onEnergyTick)
    }

    /**
     * 恢复体力定时器
     */
    resumeEnergyTimer(): void {
        if (this._timerRunning) return
        this._timerRunning = true
        this.schedule(this._onEnergyTick, 1)
    }

    /**
     * 外部数据同步接口（待定）
     * @param data 服务端同步的体力等数据
     */
    syncEnergy(data: { energy?: number; clean?: number; mood?: number }): void {
        if (data.energy !== undefined) {
            this._energy = data.energy
            this._updateEnergyLabel()
        }
        if (data.clean !== undefined && this.lb_clean_num) {
            this.lb_clean_num.string = data.clean.toString()
        }
        if (data.mood !== undefined && this.lb_xinqing_num) {
            this.lb_xinqing_num.string = data.mood.toString()
        }
    }

    /** 获取当前体力值 */
    getEnergy(): number {
        return this._energy
    }

    /**
     * 收到 TeamUserUpdate 事件，根据 user_id 匹配更新数据
     */
    private _onTeamUserUpdate(users: WalkUser[]): void {
        console.log("_onTeamUserUpdate", users)
        if (!this._data || !users) return
        const match = users.find(u => u.user_id === this._data.user_id)
        if (match) {
            this.syncEnergy({
                energy: match.energy,
                clean: match.clean,
                mood: match.mood,
            })
        }
    }

    private _onEnergyTick(): void {
        if (this._energy <= 0) return
        this._energy -= 1
        this._updateEnergyLabel()
    }

    private _updateEnergyLabel(): void {
        if (this.lb_energy_num) {
            this.lb_energy_num.string = this._energy.toString()
        }
    }
}