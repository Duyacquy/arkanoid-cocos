import { _decorator, Component, Node, Vec3, Animation, Collider2D, Contact2DType, IPhysics2DContact, UITransform } from 'cc';
import { GameCtrl } from './GameCtrl';
const { ccclass, property } = _decorator;

export enum PowerUpType {
    DUPLICATE = 'PowerUpDuplicate',
    EXPAND = 'PowerUpExpand',
    LASER = 'PowerUpLaser',
    SLOW = 'PowerUpSlow'
}

@ccclass('PowerUpCtrl')
export class PowerUpCtrl extends Component {

    @property
    public fallSpeed: number = 200;

    private minHeight: number = -800;
    private currentType: PowerUpType = PowerUpType.DUPLICATE;
    private gameCtrl: GameCtrl = null!;

    start() {
        const collider = this.getComponent(Collider2D);
        if (collider) {
            collider.on(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
        }
    }

    public initPowerUp(type: PowerUpType, gameCtrl: GameCtrl) {
        this.currentType = type;
        this.gameCtrl = gameCtrl;

        if (this.gameCtrl && this.gameCtrl.ballCtrl) {
            const playZoneNode = this.gameCtrl.ballCtrl.playZone; 
            
            if (playZoneNode && this.node.parent) {
                // 1. Lấy UITransform của PlayZone và Node cha của PowerUp
                const zoneUITransform = playZoneNode.getComponent(UITransform);
                const parentUITransform = this.node.parent.getComponent(UITransform);

                if (zoneUITransform && parentUITransform) {
                    const zoneHeight = zoneUITransform.contentSize.height;
                    const rawMinY = -zoneHeight / 2 + 400; 

                    const worldPos = zoneUITransform.convertToWorldSpaceAR(new Vec3(0, rawMinY, 0));
                    
                    const localPos = parentUITransform.convertToNodeSpaceAR(worldPos);
                    
                    this.minHeight = localPos.y;
                }
            }
        }

        const anim = this.getComponent(Animation);
        if (anim) {
            anim.play(this.currentType); 
        }
    }

    update(dt: number) {
        // Cho vật phẩm rơi xuống theo trục Y
        let pos = this.node.getPosition();
        pos.y -= this.fallSpeed * dt;
        this.node.setPosition(pos);

        // Nếu rơi quá màn hình thì tự hủy (ví dụ dưới -600)
        if (pos.y < this.minHeight) {
            this.node.destroy();
        }
    }

    private onBeginContact(selfCollider: Collider2D, otherCollider: Collider2D, contact: IPhysics2DContact | null) {
        console.log(otherCollider.node.name);
        if (otherCollider.node.name === 'Paddle' || otherCollider.node.getComponent('PaddleCtrl')) {
            
            if (this.gameCtrl) {
                this.gameCtrl.activatePowerUp(this.currentType);
            }

            // Hủy item sau khi ăn
            this.node.destroy();
        }
    }
}