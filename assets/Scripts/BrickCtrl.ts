import { _decorator, Component, Sprite, SpriteFrame, Collider2D, Contact2DType, IPhysics2DContact, UITransform, BoxCollider2D, Prefab, instantiate, Node } from 'cc';
import { BallCtrl } from './BallCtrl'; 
import { PowerUpCtrl, PowerUpType } from './PowerUpCtrl';

const { ccclass, property } = _decorator;

export enum BrickType {
    SILVER = 1,
    GREEN = 2,
    CYAN = 3,
    RED = 4,
    YELLOW = 5
}

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

    start() {
        // Đăng ký lắng nghe sự kiện va chạm
        const collider = this.getComponent(Collider2D);
        if (collider) {
            collider.on(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
        }
    }

    // Hàm thiết lập loại gạch VÀ kích thước chuẩn Responsive
    public initBrick(type: BrickType, width: number, height: number) {
        this.currentType = type;
        
        // Thiết lập HP: Silver = 2, còn lại = 1
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

        const boxCollider = this.getComponent(BoxCollider2D);
        if (boxCollider) {
            boxCollider.size.width = width;
            boxCollider.size.height = height;
            boxCollider.offset.set(0, 0); 
            boxCollider.apply();
        }
    }

    // Xử lý va chạm
    private onBeginContact(selfCollider: Collider2D, otherCollider: Collider2D, contact: IPhysics2DContact | null) {
        const ball = otherCollider.node.getComponent(BallCtrl);
        
        if (ball) {
            this.hp--;

            if (this.hp <= 0) {
                this.spawnPowerUp();
                setTimeout(() => {
                    if (this.node && this.node.isValid) {
                        this.node.destroy();
                    }
                }, 0);
            }
        }
    }

    private spawnPowerUp() {
        if (Math.random() > 0.2) return; 
    
        if (!this.powerUpPrefab) return;
    
        const powerUpNode = instantiate(this.powerUpPrefab);
        powerUpNode.parent = this.node.parent?.parent; 
        powerUpNode.setPosition(this.node.getPosition());
    
        // Chọn ngẫu nhiên 1 trong 4 loại thuốc
        const types = [PowerUpType.DUPLICATE, PowerUpType.EXPAND, PowerUpType.LASER, PowerUpType.SLOW];
        const randomType = types[Math.floor(Math.random() * types.length)];
    
        const ctrl = powerUpNode.getComponent(PowerUpCtrl);
        if (ctrl) {
            // Tìm GameCtrl trong scene để truyền vào (hoặc truyền qua LevelManager lúc tạo gạch)
            ctrl.initPowerUp(randomType, this.gameCtrl);
        }
    }
}