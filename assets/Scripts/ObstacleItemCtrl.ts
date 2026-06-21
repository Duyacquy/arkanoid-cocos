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
        // Chỉ chạy logic di chuyển khi đã hoàn tất khởi tạo initObstacle và chưa nổ
        if (!this.isInitialized || !this.gameCtrl || this.isExploding) return;

        const paddle = this.gameCtrl.paddle;
        if (!paddle) return;

        const oldPos = this.node.position.clone();
        const newPos = oldPos.clone();

        // 1. Logic bám đuổi Paddle theo trục X khi đến gần
        const shouldChasePaddle = oldPos.y <= paddle.position.y + this.chaseStartOffsetFromPaddle;
        if (shouldChasePaddle) {
            const diffX = paddle.position.x - oldPos.x;
            const maxMoveX = this.chaseSpeed * dt;
            newPos.x += Physics2DHelper.clamp(diffX, -maxMoveX, maxMoveX);
        }

        // 2. Logic rơi tự do kết hợp lắc lư (Swaying) sinh động
        this.swayTime += dt;
        newPos.y -= this.fallSpeed * dt;
        newPos.x += Math.sin(this.swayTime * 2.4 + this.swaySeed) * 18 * dt;
        newPos.x = Physics2DHelper.clamp(newPos.x, this.leftLimit, this.rightLimit);

        // Áp góc nghiêng nhẹ cho thân quái vật khi lướt sóng qua lại
        this.node.angle = Math.sin(this.swayTime * 3.2 + this.swaySeed) * 4;
        this.node.setPosition(newPos);

        // 3. Logic kiểm tra va chạm để né tránh gạch (Bricks)
        if (this.isTouchingAnyBrick()) {
            if (this.avoidDir === 0) {
                this.avoidDir = paddle.position.x >= oldPos.x ? 1 : -1;
            }
            const sideStep = this.avoidSpeed * dt;
            const resolvedX = oldPos.x + this.avoidDir * sideStep;
            newPos.x = Physics2DHelper.clamp(resolvedX, this.leftLimit, this.rightLimit);
            this.node.setPosition(newPos.x, oldPos.y, 0); // Giữ Y cũ, chỉ lách né X
        } else {
            this.avoidDir = 0;
        }

        // 4. Quét va chạm với Paddle người chơi
        if (Physics2DHelper.isRectHit(this.node, paddle)) {
            this.explodeAndDestroy();
            if (this.gameCtrl.playPaddleHitEffect) {
                this.gameCtrl.playPaddleHitEffect();
            }
            return;
        }

        // 5. Tự hủy khi rơi lọt đáy màn hình
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