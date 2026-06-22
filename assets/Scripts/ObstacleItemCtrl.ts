import { _decorator, Component, Node, Vec3, UITransform, Animation, AnimationClip } from 'cc';
import { Physics2DHelper } from './Physics2DHelper';

const { ccclass, property } = _decorator;

@ccclass('ObstacleItemCtrl')
export class ObstacleItemCtrl extends Component {
    @property
    public fallSpeed: number = 72;

    @property
    public chaseSpeed: number = 58;

    @property
    public avoidSpeed: number = 62;

    @property
    public chaseStartOffsetFromPaddle: number = 300;

    private gameCtrl: any = null;
    private brickContainer: Node | null = null;
    
    private avoidDir: number = 0;
    private swayTime: number = 0;
    private swaySeed: number = 0;
    private isExploding: boolean = false;
    private isInitialized: boolean = false; 

    private leftLimit: number = 0;
    private rightLimit: number = 0;
    private bottomLimit: number = -600;

    start() {
        this.swaySeed = Math.random() * Math.PI * 2;
    }

    /** Khởi tạo thuộc tính responsive từ vùng chơi PlayZone */
    public initObstacle(gameCtrl: any, brickContainer: Node | null, playZoneNode: Node | null) {
        this.gameCtrl = gameCtrl;
        this.brickContainer = brickContainer;

        if (playZoneNode && this.node.parent) {
            const zoneUITransform = playZoneNode.getComponent(UITransform);
            const parentUITransform = this.node.parent.getComponent(UITransform);
            const myUITransform = this.getComponent(UITransform);

            if (zoneUITransform && parentUITransform) {
                const zoneWidth = zoneUITransform.contentSize.width;
                const zoneHeight = zoneUITransform.contentSize.height;
                
                const myHalfWidth = myUITransform ? (myUITransform.width * Math.abs(this.node.scale.x)) / 2 : 20;

                // Tính toán biên Left / Right dựa trên trục Center (0,0) của PlayZone
                this.leftLimit = -zoneWidth / 2 + myHalfWidth;
                this.rightLimit = zoneWidth / 2 - myHalfWidth;

                // Tính toán biên đáy để tự hủy chuẩn hệ tọa độ Local của cha (parent)
                const worldPosBottom = zoneUITransform.convertToWorldSpaceAR(new Vec3(0, -zoneHeight / 2 - 80, 0));
                this.bottomLimit = parentUITransform.convertToNodeSpaceAR(worldPosBottom).y;
            }
        } else {
            this.leftLimit = -250;
            this.rightLimit = 250;
            this.bottomLimit = -600;
        }

        this.isInitialized = true;

        const anim = this.getComponent(Animation);
        if (anim && anim.getState('EnemyCone')) {
            anim.play('EnemyCone');
        }
    }

    update(dt: number) {
        if (!this.gameCtrl || this.isExploding) return;

        const paddle = this.gameCtrl.paddle;
        if (!paddle) return;

        const oldPos = this.node.position.clone();
        const newPos = oldPos.clone();

        // --- BƯỚC 1: ĐỊNH VỊ BIÊN CỦA CỤM GẠCH ĐỂ NÉ THÔNG MINH ---
        let isInsideBrickZoneX = true;
        let isAboveBrickBottomY = true;

        if (this.brickContainer && this.brickContainer.children.length > 0) {
            const bricks = this.brickContainer.children;
            
            // Tìm viên gạch nằm ngoài cùng bên trái, bên phải và viên thấp nhất
            let minBrickX = 9999;
            let maxBrickX = -9999;
            let minBrickY = 9999;

            for (let i = 0; i < bricks.length; i++) {
                const bPos = bricks[i].position;
                if (bPos.x < minBrickX) minBrickX = bPos.x;
                if (bPos.x > maxBrickX) maxBrickX = bPos.x;
                if (bPos.y < minBrickY) minBrickY = bPos.y;
            }

            // Cộng thêm khoảng trừ hao (ví dụ 40px) kích thước viên gạch
            minBrickX -= 40;
            maxBrickX += 40;
            minBrickY -= 20;

            // Kiểm tra xem quái vật có đang nằm trong phạm vi ngang của tháp gạch không
            isInsideBrickZoneX = (oldPos.x >= minBrickX && oldPos.x <= maxBrickX);
            // Kiểm tra xem quái vật đã rơi vượt qua khỏi đáy gạch thấp nhất chưa
            isAboveBrickBottomY = (oldPos.y >= minBrickY);
        }

        // --- BƯỚC 2: LOGIC BÁM ĐUỔI PADDLE (CHỈ BẬT KHI AN TOÀN) ---
        const shouldChasePaddle = oldPos.y <= paddle.position.y + this.chaseStartOffsetFromPaddle;
        
        const canStartChasing = !isAboveBrickBottomY || !isInsideBrickZoneX;

        if (shouldChasePaddle && canStartChasing) {
            const diffX = paddle.position.x - oldPos.x;
            const maxMoveX = this.chaseSpeed * dt;
            newPos.x += Physics2DHelper.clamp(diffX, -maxMoveX, maxMoveX);
        }

        // --- BƯỚC 3: TÍNH TOÁN HƯỚNG RƠI TỰ DO VÀ LẮC LƯ MẶC ĐỊNH ---
        this.swayTime += dt;
        
        let targetY = oldPos.y - this.fallSpeed * dt;
        
        if (this.avoidDir === 0) {
            newPos.x += Math.sin(this.swayTime * 2.4 + this.swaySeed) * 18 * dt;
        }
        newPos.x = Physics2DHelper.clamp(newPos.x, this.leftLimit, this.rightLimit);

        this.node.angle = Math.sin(this.swayTime * 3.2 + this.swaySeed) * 4;


        // --- BƯỚC 4: LOGIC QUÉT VÀ NÉ TRÁNH GẠCH (LƯỢN NGANG DỌC VUÔNG GÓC) ---
        if (this.isTouchingAnyBrick()) {
            if (this.avoidDir === 0) {
                this.avoidDir = oldPos.x >= 0 ? 1 : -1;
            }
            
            const sideStep = this.avoidSpeed * dt;
            const resolvedX = oldPos.x + this.avoidDir * sideStep;
            newPos.x = Physics2DHelper.clamp(resolvedX, this.leftLimit, this.rightLimit);
            
            this.node.setPosition(newPos.x, oldPos.y, 0); 
            
        } else {
            // ✅ ĐÃ THOÁT GẠCH: Tắt chế độ đi ngang, trả lại quyền rơi dọc xuống
            this.avoidDir = 0;
            
            // Cho phép quái vật cập nhật tọa độ Y mới để tiếp tục lao xuống dưới
            newPos.y = targetY;
            this.node.setPosition(newPos.x, newPos.y, 0);
        }

        // --- BƯỚC 5: VA CHẠM PADDLE VÀ TỰ HỦY ---
        if (Physics2DHelper.isRectHit(this.node, paddle)) {
            this.explodeAndDestroy();
            if (this.gameCtrl.playPaddleHitEffect) {
                this.gameCtrl.playPaddleHitEffect();
            }
            return;
        }

        if (this.node.position.y < this.bottomLimit) {
            this.node.destroy();
        }
    }

    private isTouchingAnyBrick(): boolean {
        if (!this.brickContainer) return false;
        const bricks = this.brickContainer.children;
        for (let i = 0; i < bricks.length; i++) {
            if (Physics2DHelper.isRectHit(this.node, bricks[i])) return true;
        }
        return false;
    }

    /** Hàm xử lý nổ quái vật khi bị bóng đập trúng hoặc đâm vào paddle */
    public explodeAndDestroy() {
        if (this.isExploding) return;
        this.isExploding = true;

        if (this.gameCtrl && this.gameCtrl.removeObstacleFromList) {
            this.gameCtrl.removeObstacleFromList(this.node);
        }

        const anim = this.getComponent(Animation);
        if (anim) {
            anim.stop();
            if (anim.getState('EnemyExplosion')) {
                anim.play('EnemyExplosion');
                anim.once(Animation.EventType.FINISHED, () => {
                    this.node.destroy();
                }, this);
                return;
            }
        }
        
        this.node.destroy();
    }
}