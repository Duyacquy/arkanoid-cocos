import { _decorator, Component, Sprite, SpriteFrame, UITransform, Prefab, instantiate, Node } from 'cc';
import { PowerUpCtrl, PowerUpType } from './PowerUpCtrl';

const { ccclass, property } = _decorator;

export enum BrickType { SILVER = 1, GREEN = 2, CYAN = 3, RED = 4, YELLOW = 5 }

@ccclass('BrickCtrl')
export class BrickCtrl extends Component {
    @property(Prefab)
    public powerUpPrefab: Prefab = null!;

    @property([SpriteFrame])
    public brickTextures: SpriteFrame[] = []; 

    private hp: number = 1;
    private currentType: BrickType = BrickType.YELLOW;
    private gameCtrl: any = null; 

    public setGameCtrl(gameCtrl: any) {
        this.gameCtrl = gameCtrl;
    }

    public initBrick(type: BrickType, width: number, height: number) {
        this.currentType = type;
        this.hp = (type === BrickType.SILVER) ? 2 : 1;

        const sprite = this.getComponent(Sprite);
        if (sprite && this.brickTextures[type - 1]) {
            sprite.spriteFrame = this.brickTextures[type - 1];
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        }

        const uiTransform = this.getComponent(UITransform);
        if (uiTransform) {
            uiTransform.setContentSize(width, height);
        }
    }

    /** Hàm xử lý sát thương do Ball điều hướng bắn sang */
    public takeDamage() {
        this.hp--;
        if (this.hp <= 0) {
            this.spawnPowerUp();
            this.node.destroy();
        }
    }

    private spawnPowerUp() {
        if (Math.random() > 0.2) return; // 20% tỉ lệ xuất hiện item
        if (!this.powerUpPrefab || !this.node.parent) return;

        const powerUpNode = instantiate(this.powerUpPrefab);
        powerUpNode.parent = this.node.parent.parent;
        powerUpNode.setPosition(this.node.getPosition());

        // const types = [PowerUpType.DUPLICATE, PowerUpType.EXPAND, PowerUpType.SLOW];
        const types = [PowerUpType.DUPLICATE];
        const randomType = types[Math.floor(Math.random() * types.length)];

        const ctrl = powerUpNode.getComponent(PowerUpCtrl);
        if (ctrl) {
            ctrl.initPowerUp(randomType, this.gameCtrl);
        }
    }
}