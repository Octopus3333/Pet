import { _decorator, Component } from 'cc';
import { PhotoCell } from './PhotoCell';

const { ccclass } = _decorator;

@ccclass('PhotoCellLayer')
export class PhotoCellLayer extends Component {
    private _cells: PhotoCell[] = [];
    private _clickCallback: ((data: any, index: number) => void) | null = null;

    protected onLoad(): void {
        // 获取所有子组件（如果预制体中有隐藏的 cell，请确保它们初始激活后再通过代码隐藏）
        console.log("PhotoCellLayer onLoad")


        this._cells = this.node.getComponentsInChildren(PhotoCell);
        this.clearAllCells();
        console.log("this._cells", this._cells.length)
    }
    protected start(): void {
        // this._cells = []
        // for(var obj of this.node.children){
        //     var comp =  obj.getComponent(PhotoCell)
        //     if(comp){
        //         this._cells.push(comp)
        //     }
        // }
        // this.clearAllCells();
        // console.log("this._cells", this._cells.length)
    }
    public setClickCallback(callback: (data: any, index: number) => void): void {
        this._clickCallback = callback;
    }

    public clearAllCells(): void {
        for (const cell of this._cells) {
            cell.clearDisplay();
            cell.node.active = false;          // 隐藏所有格子
        }
    }

    async setData(photoList: any[], startIndex: number, total: number): Promise<void> {
        const loadTasks: Promise<void>[] = [];
        console.log("this.cells", this._cells.length)
        for (let i = 0; i < this._cells.length; i++) {
            console.log("photo list cellsiiii", i)
            const globalIndex = startIndex + i;
            const data = photoList[i];
            console.log("photo list globalIndex",globalIndex)
            if (globalIndex < total && data) {
                console.log(" photo list cell active true")
                this._cells[i].node.active = true;
                this._cells[i].setClickCallback((d, idx) => {
                    if (this._clickCallback) {
                        this._clickCallback(d, globalIndex);
                    }
                }, globalIndex);
                // ★ 不 await，收集 Promise
                loadTasks.push(this._cells[i].loadData(data));
            } else {
                this._cells[i].node.active = false;
            }
        }

        // ★ 等所有 Cell 并行加载完
        await Promise.all(loadTasks);
    }
}