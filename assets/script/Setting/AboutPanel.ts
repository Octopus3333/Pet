import { _decorator, Component, Node } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('AboutPanel')
export class AboutPanel extends Component
{
    @property(Node)
    btn_douyin_1: Node = null;

    @property(Node)
    btn_xiaohongshu_1: Node = null;

    @property(Node)
    btn_douyin_2: Node = null;

    @property(Node)
    btn_xiaohongshu_2: Node = null;

    private _douyinDaily = 'https://www.douyin.com/user/MS4wLjABAAAACUNATcF1SGW6U9bhH_v7J_HZFs6f4IWYr28sbJh3D8tWhFw9BxTYzpyIKxdKb3Z9';
    private _douyinOfficial = 'https://www.douyin.com/user/MS4wLjABAAAAXitK6f_uwnCREjMbgzvTv35vecB4HALL3Kxr9VUG-tDmbEohjeAlIGs1V9U2pzp9';
    private _xhsDaily = 'https://xhslink.com/m/6Jm1i7IiSQB';
    private _xhsOfficial = 'https://xhslink.com/m/6v55XMqw38B';

    protected onLoad(): void
    {
        this.btn_douyin_1?.on(Node.EventType.TOUCH_END, this.onClickDouyinDaily, this);
        this.btn_xiaohongshu_1?.on(Node.EventType.TOUCH_END, this.onClickXhsDaily, this);
        this.btn_douyin_2?.on(Node.EventType.TOUCH_END, this.onClickDouyinOfficial, this);
        this.btn_xiaohongshu_2?.on(Node.EventType.TOUCH_END, this.onClickXhsOfficial, this);
    }

    private openUrl(url: string): void
    {
        window.open(url, '_blank');
    }

    private onClickDouyinDaily(): void { this.openUrl(this._douyinDaily); }
    private onClickXhsDaily(): void { this.openUrl(this._xhsDaily); }
    private onClickDouyinOfficial(): void { this.openUrl(this._douyinOfficial); }
    private onClickXhsOfficial(): void { this.openUrl(this._xhsOfficial); }
}