import { _decorator, Component, Sprite, SpriteFrame, UITransform, Prefab, instantiate, Node, Color, Animation } from 'cc';
import { PowerUpCtrl, PowerUpType } from './PowerUpCtrl';

const { ccclass, property } = _decorator;

export enum BrickType { SILVER = 1, GREEN = 2, BLUE = 3, RED = 4, YELLOW = 5 }

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

            sprite.color = Color.WHITE;
        }

        const uiTransform = this.getComponent(UITransform);
        if (uiTransform) {
            uiTransform.setContentSize(width, height);
        }
    }

    /** Hàm xử lý sát thương do Ball điều hướng bắn sang */
    public takeDamage() {
        this.hp--;

        if (this.currentType === BrickType.SILVER && this.hp === 1) {
            const anim = this.getComponent(Animation);
            const sprite = this.getComponent(Sprite);

            if (anim && anim.getState('BrickSliver')) {
                anim.play('BrickSliver');

                anim.once(Animation.EventType.FINISHED, () => {
                    if (sprite && this.isValid) { 
                        sprite.color = new Color(180, 180, 180, 255); 
                    }
                }, this);

            } else {
                console.warn("Chưa kéo thả Clip 'BrickSliver' hoặc không có component Animation!");
                if (sprite) {
                    sprite.color = new Color(180, 180, 180, 255); 
                }
            }
        }

        if (this.hp <= 0) {
            this.spawnPowerUp();
            this.node.destroy();

            if (this.gameCtrl && this.gameCtrl.checkVictory) {
                this.gameCtrl.checkVictory();
            }
        }
    }

    private spawnPowerUp() {
        if (Math.random() > 0.9) return;
        if (!this.powerUpPrefab || !this.node.parent) return;

        if (this.gameCtrl.refreshActiveBalls) {
            this.gameCtrl.refreshActiveBalls();
        }

        const currentBallCount = this.gameCtrl.activeBalls ? this.gameCtrl.activeBalls.length : 1;
        let types = [PowerUpType.DUPLICATE, PowerUpType.EXPAND, PowerUpType.SLOW, PowerUpType.LASER];

        if (currentBallCount >= 2) {
            types = types.filter(type => type !== PowerUpType.DUPLICATE);
        }

        const randomType = types[Math.floor(Math.random() * types.length)];

        // 5. Sinh Node vật phẩm rơi xuống
        const powerUpNode = instantiate(this.powerUpPrefab);
        powerUpNode.parent = this.node.parent.parent;
        powerUpNode.setPosition(this.node.getPosition());

        const ctrl = powerUpNode.getComponent(PowerUpCtrl);
        if (ctrl) {
            ctrl.initPowerUp(randomType, this.gameCtrl);
        }
    }
}