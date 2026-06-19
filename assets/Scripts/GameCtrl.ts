import { _decorator, Component, Node, EventTouch, Vec3, Animation, Prefab } from 'cc';
import { BallCtrl } from './BallCtrl';
import { PowerUpType } from './PowerUpCtrl';

const { ccclass, property } = _decorator;

@ccclass('GameCtrl')
export class GameCtrl extends Component {

    @property(Node)
    public paddle: Node = null!;

    @property(Node)
    public scrollBar: Node = null!;

    @property(Node)
    public controlButton: Node = null!;

    @property(BallCtrl)
    public ballCtrl: BallCtrl = null!;

    @property(Prefab)
    public ballPrefab: Prefab = null!;

    @property
    public paddleMinX!: number;
    @property
    public paddleMaxX!: number;

    private minX: number = 0;
    private maxX: number = 0;

    start() {
        const barWidth = this.scrollBar.getComponent(cc.UITransform)?.contentSize.width || 200;
        const btnWidth = this.controlButton.getComponent(cc.UITransform)?.contentSize.width || 40;
        
        this.minX = - (barWidth + btnWidth * 4.5);
        this.maxX = barWidth + btnWidth * 4.5;

        this.controlButton.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.controlButton.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.controlButton.on(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);

        this.playPaddleSpawn();
    }

    public playPaddleSpawn() {
        if (this.paddle) {
            const anim = this.paddle.getComponent(Animation);
            if (anim) {
                anim.play('PaddleSpawn'); 
            }
        }
    }

    public activatePowerUp(type: PowerUpType) {
        console.log("Đã ăn vật phẩm: ", type);
        
        switch (type) {
            case PowerUpType.DUPLICATE:
                this.handleDuplicateBall();
                break;
            case PowerUpType.EXPAND:
                this.handleExpandPaddle();
                break;
            case PowerUpType.LASER:
                this.handleLaserActive();
                break;
            case PowerUpType.SLOW:
                this.handleSlowBall();
                break;
        }
    }

    // 1. Tạo ra 3 quả bóng ở 3 phía
    private handleDuplicateBall() {
        if (!this.ballCtrl) return;
        
        const currentBallNode = this.ballCtrl.node;
        const currentVelocity = this.ballCtrl.getComponent(cc.RigidBody2D)!.linearVelocity;

        // Tạo thêm quả bóng số 2 (lệch trái 30 độ)
        this.spawnExtraBall(currentBallNode.getPosition(), new cc.Vec2(currentVelocity.x - 150, currentVelocity.y));
        
        // Tạo thêm quả bóng số 3 (lệch phải 30 độ)
        this.spawnExtraBall(currentBallNode.getPosition(), new cc.Vec2(currentVelocity.x + 150, currentVelocity.y));
    }

    private spawnExtraBall(position: cc.Vec3, velocity: cc.Vec2) {
        if (!this.ballPrefab) return;
        const extraBall = cc.instantiate(this.ballPrefab);
        extraBall.parent = this.ballCtrl.node.parent;
        extraBall.setPosition(position);
        
        const ctrl = extraBall.getComponent(BallCtrl);
        if (ctrl) {
            ctrl.launchBall(); // Kích hoạt bóng bay luôn
            const rb = extraBall.getComponent(cc.RigidBody2D);
            if (rb) rb.linearVelocity = velocity;
        }
    }

    // 2. Mở rộng kích thước Paddle
    private handleExpandPaddle() {
        if (!this.paddle) return;
        const uiTransform = this.paddle.getComponent(cc.UITransform);
        if (uiTransform) {
            const originalWidth = uiTransform.contentSize.width;
            uiTransform.setContentSize(originalWidth * 1.5, uiTransform.contentSize.height);
            
            // Cập nhật lại BoxCollider2D của Paddle nếu có để va chạm chuẩn xác hơn
            const collider = this.paddle.getComponent(cc.BoxCollider2D);
            if (collider) {
                collider.size.width = originalWidth * 1.5;
                collider.apply();
            }

            // Sau 10 giây quay về kích thước cũ
            this.scheduleOnce(() => {
                uiTransform.setContentSize(originalWidth, uiTransform.contentSize.height);
                if (collider) {
                    collider.size.width = originalWidth;
                    collider.apply();
                }
            }, 10);
        }
    }

    // 3. Làm chậm bóng
    private handleSlowBall() {
        // Tìm tất cả các quả bóng đang có trong bàn chơi và giảm speed
        const balls = this.node.parent?.addComponent(cc.Canvas).node.getComponentsInChildren(BallCtrl); 
        // Hoặc quản lý mảng bóng riêng. Tạm thời chỉnh quả bóng chính:
        if (this.ballCtrl) {
            const rb = this.ballCtrl.getComponent(cc.RigidBody2D);
            if (rb) {
                rb.linearVelocity = rb.linearVelocity.multiplyScalar(0.5); // Giảm nửa tốc độ
                
                // Sau 5 giây hồi phục lại tốc độ cũ
                this.scheduleOnce(() => {
                    rb.linearVelocity = rb.linearVelocity.multiplyScalar(2);
                }, 5);
            }
        }
    }

    // 4. Bắn Lazer từ Paddle
    private handleLaserActive() {
        // Tính năng này bạn cần làm thêm một Prefab đạn Lazer.
        // Cứ mỗi 0.5 giây tự động sinh ra 2 tia lazer ở 2 rìa Paddle bay thẳng lên trên.
        console.log("Paddle đang bắn Laser!");
        // Bạn có thể dùng hàm schedule để bắn liên tục trong 5 giây.
    }

    private onTouchMove(event: EventTouch) {
        const delta = event.getUIDelta();
        let currentPos = this.controlButton.getPosition();
        let newX = currentPos.x + delta.x;

        if (newX < this.minX) newX = this.minX;
        if (newX > this.maxX) newX = this.maxX;

        this.controlButton.setPosition(new Vec3(newX, currentPos.y, currentPos.z));

        const range = this.maxX - this.minX;
        const ratio = (newX - this.minX) / range;

        const paddleRange = this.paddleMaxX - this.paddleMinX;
        const paddleNewX = this.paddleMinX + (ratio * paddleRange);

        let paddlePos = this.paddle.getPosition();
        this.paddle.setPosition(new Vec3(paddleNewX, paddlePos.y, paddlePos.z));
    }

    private onTouchEnd(event: EventTouch) {
        if (this.ballCtrl) {
            this.ballCtrl.launchBall();
        }
    }

    protected onDestroy(): void {
        if (this.controlButton) {
            this.controlButton.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
            this.controlButton.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
            this.controlButton.off(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
        }
    }
}