import { _decorator, Component, Node, Vec3, UITransform } from 'cc';
import { Physics2DHelper } from './Physics2DHelper';
import { BrickCtrl } from './BrickCtrl';

const { ccclass, property } = _decorator;

@ccclass('LaserBulletCtrl')
export class LaserBulletCtrl extends Component {
    @property
    public speed: number = 700; 

    private maxPlayY: number = 0;
    private brickContainer: Node | null = null;

    start() {
        if (this.node.parent) {
            const uiTransform = this.node.parent.getComponent(UITransform);
            if (uiTransform) {
                this.maxPlayY = uiTransform.contentSize.height / 2;
            }

            this.brickContainer = this.node.parent.getChildByName("BrickContainer");
        }
    }

    update(dt: number) {
        // 1. Di chuyển đạn tịnh tiến đi lên
        let pos = this.node.getPosition();
        pos.y += this.speed * dt;
        this.node.setPosition(pos);

        // 2. Kiểm tra tự hủy chuẩn responsive khi vượt quá đỉnh vùng chơi
        if (pos.y > this.maxPlayY + 20) { // Cộng thêm 20px trừ hao đạn bay khuất hẳn rồi mới hủy
            this.node.destroy();
            return;
        }

        // 3. Quét va chạm với Gạch (Bricks)
        this.checkBricksCollision();
    }

    private checkBricksCollision() {
        if (!this.brickContainer) return;

        const bricks = this.brickContainer.children;
        
        // Quét ngược từ dưới lên để tránh lỗi bỏ sót phần tử khi có gạch bị hủy
        for (let i = bricks.length - 1; i >= 0; i--) {
            const brick = bricks[i];
            
            if (Physics2DHelper.isRectHit(this.node, brick)) {
                // Gọi gạch nhận sát thương
                const ctrl = brick.getComponent(BrickCtrl);
                if (ctrl) {
                    ctrl.takeDamage();
                }
                
                // Đạn trúng gạch -> Hủy đạn lập tức
                this.node.destroy();
                break;
            }
        }
    }
}