import { _decorator, Component, Node, path, Sprite } from 'cc';
import { UserInfo } from '../utils/InterfaceDefine';
import { loadAvatar, loadImg } from '../utils/UiTools';
import { Common } from '../utils/Define';
const { ccclass, property } = _decorator;

@ccclass('HeadComp')
export class HeadComp extends Component {
    @property(Sprite)
    avatar:Sprite = null
    @property(Sprite)
    pet:Sprite = null
    curHeadUrl = ""
    setData(data) {
        if(this.curHeadUrl != data.head_img){
            loadAvatar(this.avatar, data.head_img)       
            this.curHeadUrl = data.head_img
        }

        var petType = data.pet_type || 1
        var color = (data.color || 1)
        var petImgPath = Common.texturePath + "common/pet/" + "pet_"  + petType + "/color_" + color + "/spriteFrame"
        loadImg(this.pet, petImgPath)        
    }

}


