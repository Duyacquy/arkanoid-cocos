import { _decorator, Component, Node, Vec3, Animation, Collider2D, Contact2DType, IPhysics2DContact } from 'cc';
import { GameCtrl } from './GameCtrl';
const { ccclass, property } = _decorator;

export enum PowerUpType {
    DUPLICATE = 'powerup_duplicate_1',
    EXPAND = 'powerup_expand_1',
    LASER = 'powerup_laser_1',
    SLOW = 'powerup_slow_1'
}

@ccclass('PowerUpCtrl')
export class PowerUpCtrl extends Component {

    @property
    public fallSpeed: number = 200; // Tốc độ rơi của vật phẩm

    private currentType: PowerUpType = PowerUpType.DUPLICATE;
    private gameCtrl: GameCtrl = null!;

    start() {
        // Đăng ký va chạm để check khi chạm vào Paddle
        const collider = this.getComponent(Collider2D);
        if (collider) {
            collider.on(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
        }
    }

    public initPowerUp(type: PowerUpType, gameCtrl: GameCtrl) {
        this.currentType = type;
        this.gameCtrl = gameCtrl;

        // Chạy animation tương ứng (Ví dụ từ powerup_warp_1 đến 8 hoặc chính tên loại)
        const anim = this.getComponent(Animation);
        if (anim) {
            // Đảm bảo trong Clip Animation của bạn có tên tương ứng với enum
            anim.play(this.currentType); 
        }
    }

    update(dt: number) {
        // Cho vật phẩm rơi xuống theo trục Y
        let pos = this.node.getPosition();
        pos.y -= this.fallSpeed * dt;
        this.node.setPosition(pos);

        // Nếu rơi quá màn hình thì tự hủy (ví dụ dưới -600)
        if (pos.y < -600) {
            this.node.destroy();
        }
    }

    private onBeginContact(selfCollider: Collider2D, otherCollider: Collider2D, contact: IPhysics2DContact | null) {
        // Kiểm tra nếu va chạm với Paddle (Bạn có thể check qua tên node hoặc Component)
        if (otherCollider.node.name === 'Paddle' || otherCollider.node.getComponent('PaddleCtrl')) {
            
            // Kích hoạt tính năng tương ứng trong GameCtrl
            if (this.gameCtrl) {
                this.gameCtrl.activatePowerUp(this.currentType);
            }

            // Hủy item sau khi ăn
            this.node.destroy();
        }
    }
}