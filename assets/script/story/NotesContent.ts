import { _decorator, Component, Node, PageView, Prefab, instantiate, Sprite, Label, SpriteFrame } from 'cc';
import { ResLoader } from '../common/download/ResLoader';
import { ViewPath } from '../common/utils/Define';
import { UIManager } from '../common/utils/UIManager';
const { ccclass, property } = _decorator;

export interface PhotoData {
    /** 照片资源路径（resources 下相对路径） */
    iconPath: string;
    /** 显示名字 */
    name: string;
    /** 是否已解锁/已获得 */
    unlocked: boolean;
}

export interface DiaryData {
    /** 日期文字 */
    date: string;
    /** 故事描述 */
    story: string;
    /** 照片资源路径 */
    photoPath: string;
    /** 物品图标资源路径 */
    itemIconPath: string;
    /** 物品描述 */
    itemDesc: string;
    /** 宠物形象资源路径 */
    petPath: string;
}

@ccclass('NotesContent')
export class NotesContent extends Component {
    @property(Node)
    nd_notes_1: Node = null
    @property(Node)
    nd_notes_2: Node = null
    @property(PageView)
    pg_photo: PageView = null
    @property(PageView)
    pg_diary: PageView = null

    /** 每页照片墙显示数量（PhotoCellLayer 预制体内含 6 个 cell） */
    private readonly PHOTO_PER_PAGE = 6;

    show(layerIndex: number) {
        if (!layerIndex) {
            this.close()
            return
        }
        console.log("layerIndex========",layerIndex)
        switch (Number(layerIndex)) {
            case 1:
                this.showPhotoNotesView()
                break;
            case 2:
                this.showDiaryNotesView()
                break;
            default:
                break;
        }
    }
    onClickClose(){
        console.log("onClickClose=========")
        UIManager.ins.hideView(this.node)
    }
    // ==================== 照片墙 notes_1 ====================

    async showPhotoNotesView() {
        this.resetView()
        this.nd_notes_1.active = true

        const list = this.getPhotoMockData()
        console.log("mockData list",list)
        const pageCount = Math.ceil(list.length / this.PHOTO_PER_PAGE)

        for (let i = 0; i < pageCount; i++) {
            const pageData = list.slice(i * this.PHOTO_PER_PAGE, (i + 1) * this.PHOTO_PER_PAGE)
            const pageNode = await this.createPhotoPage(pageData)
            if (pageNode) {
                this.pg_photo.addPage(pageNode)
            }
        }
    }

    private async createPhotoPage(pageData: PhotoData[]): Promise<Node | null> {
        console.log("createPhotoPage")
        const prefab = await ResLoader.ins.loadResAsync(ViewPath.PhotoCellLayer, Prefab)
        if (!prefab) return null

        const page = instantiate(prefab)
        const layout = page.getChildByName('Layout')
        if (!layout) return page

        for (let i = 0; i < this.PHOTO_PER_PAGE; i++) {
            const cell = layout.getChildByName('cell_' + i)
            const data = pageData[i]
            if (cell && data) {
                this.refreshPhotoCell(cell, data)
            } else if (cell) {
                cell.active = false
            }
        }
        return page
    }

    private async refreshPhotoCell(cell: Node, data: PhotoData) {
        cell.active = true
        const iconNode = cell.getChildByName('icon')
        const nameNode = cell.getChildByName('name')

        if (data.unlocked) {
            if (iconNode) {
                const sprite = iconNode.getComponent(Sprite)
                if (sprite && data.iconPath) {
                    sprite.spriteFrame = await this.loadSpriteFrame(data.iconPath)
                }
            }
            if (nameNode) {
                const label = nameNode.getComponent(Label)
                if (label) label.string = data.name
            }
        } else {
            // 未解锁显示问号占位，可替换为锁定图标
            if (nameNode) {
                const label = nameNode.getComponent(Label)
                if (label) label.string = '???'
            }
        }
    }

    // ==================== 日记 notes_2 ====================

    async showDiaryNotesView() {
        this.resetView()
        this.nd_notes_2.active = true

        const list = this.getDiaryMockData()
        for (const data of list) {
            const pageNode = await this.createDiaryPage(data)
            if (pageNode) {
                this.pg_diary.addPage(pageNode)
            }
        }
    }

    private async createDiaryPage(data: DiaryData): Promise<Node | null> {
        const prefab = await ResLoader.ins.loadResAsync(ViewPath.DiaryNotesCell, Prefab)
        if (!prefab) return null

        const page = instantiate(prefab)
        this.refreshDiaryPage(page, data)
        return page
    }

    private async refreshDiaryPage(page: Node, data: DiaryData) {
        const lbDateTitle = page.getChildByName('lb_date_title')?.getComponent(Label)
        const lbStory = page.getChildByName('lb_story')?.getComponent(Label)
        const spPhoto = page.getChildByName('sp_photo')?.getComponent(Sprite)
        const spItem = page.getChildByName('sp_item')?.getComponent(Sprite)
        const lbItemDesc = page.getChildByName('lb_item_desc')?.getComponent(Label)
        const spPet = page.getChildByName('sp_pet')?.getComponent(Sprite)
        const btnLeft = page.getChildByName('btn_left')
        const btnRight = page.getChildByName('btn_right')

        if (lbDateTitle) lbDateTitle.string = data.date
        if (lbStory) lbStory.string = data.story
        if (lbItemDesc) lbItemDesc.string = data.itemDesc

        if (spPhoto && data.photoPath) spPhoto.spriteFrame = await this.loadSpriteFrame(data.photoPath)
        if (spItem && data.itemIconPath) spItem.spriteFrame = await this.loadSpriteFrame(data.itemIconPath)
        if (spPet && data.petPath) spPet.spriteFrame = await this.loadSpriteFrame(data.petPath)

        // 左右箭头翻页
        btnLeft?.on(Node.EventType.TOUCH_END, () => {
            this.turnDiaryPage(-1)
        }, this)
        btnRight?.on(Node.EventType.TOUCH_END, () => {
            this.turnDiaryPage(1)
        }, this)
    }

    private turnDiaryPage(delta: number) {
        if (!this.pg_diary) return
        const cur = this.pg_diary.curPageIdx
        const next = cur + delta
        if (next >= 0 && next < this.pg_diary.getPages().length) {
            this.pg_diary.scrollToPage(next, 0.3)
        }
    }

    // ==================== 通用 ====================

    private resetView() {
        this.nd_notes_1.active = false
        this.nd_notes_2.active = false
        this.clearPages(this.pg_photo)
        this.clearPages(this.pg_diary)
    }

    private clearPages(pageView: PageView) {
        if (!pageView) return
        const pages = pageView.getPages()
        for (const page of pages) {
            pageView.removePage(page)
            page.destroy()
        }
    }

    private async loadSpriteFrame(path: string): Promise<SpriteFrame | null> {
        if (!path) return null
        try {
            return await ResLoader.ins.loadResAsync(path, SpriteFrame)
        } catch (error) {
            console.error('loadSpriteFrame error:', path, error)
            return null
        }
    }

    close() {
        console.log("close================")
        this.node.destroy()
    }

    // ==================== 测试数据 ====================

    private getPhotoMockData(): PhotoData[] {
        const list: PhotoData[] = []
        for (let i = 0; i < 18; i++) {
            list.push({
                iconPath: i < 3 ? 'textures/photo/photo_' + (i + 1) : '',
                name: '名字',
                unlocked: i < 3,
            })
        }
        return list
    }

    private getDiaryMockData(): DiaryData[] {
        return [
            {
                date: '2026.06.20',
                story: '名字名字名字名字名字名字名字名字名字名字名字名字名字名字名字名字名字名字名字名字名字名字名字名字名字名字名字名字名字名字名字名字名字名字名字名字名字名字',
                photoPath: '',
                itemIconPath: '',
                itemDesc: '名字名字名字名字名字名字名字名字名字名字名字名字名字名字名字',
                petPath: '',
            },
            {
                date: '2026.06.21',
                story: '名字名字名字名字名字名字名字名字名字名字名字名字名字名字名字名字名字名字名字名字名字名字名字名字名字名字名字名字名字名字名字名字名字名字名字名字名字名字',
                photoPath: '',
                itemIconPath: '',
                itemDesc: '名字名字名字名字名字名字名字名字名字名字名字名字名字名字名字',
                petPath: '',
            },
        ]
    }
}
