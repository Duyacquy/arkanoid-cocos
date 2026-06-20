import { _decorator, Component, Node, EventTouch, Vec3, Prefab, instantiate, UITransform } from 'cc';
import { BallCtrl } from './BallCtrl';
import { PowerUpType } from './PowerUpCtrl';
import { LevelManager } from './LevelManager';
import { PowerUpManager } from './PowerUpManager';

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

    @property(LevelManager)
    public levelManager: LevelManager = null!;

    private activeBalls: Node[] = [];
    
    // Quản lý trạng thái Buff mở rộng thanh trượt
    private normalPaddleWidth: number = 180;
    private extendedPaddleWidth: number = 240; 
    private paddleBuffToken: number = 0;

    // Quản lý trạng thái Buff làm chậm bóng 
    private ballSlowToken: number = 0;
    private resetPaddleSize: Function = null!;
    private resetBallSpeed: Function = null!;
    private isBallSlowed: boolean = false;

    private minX: number = 0;
    private maxX: number = 0;
    
    private paddleMinX: number = 0;
    private paddleMaxX: number = 0;

    start() {
        this.controlButton.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.controlButton.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.controlButton.on(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);

        // Đăng ký bóng ban đầu vào mảng quản lý
        if (this.ballCtrl) {
            this.ballCtrl.setGameCtrl(this);
            this.activeBalls.push(this.ballCtrl.node);
        }

        // Tự động lấy chiều rộng chuẩn của Paddle được thiết kế từ Editor làm mốc gốc
        if (this.paddle) {
            const paddleTransform = this.paddle.getComponent(UITransform);
            if (paddleTransform) {
                this.normalPaddleWidth = paddleTransform.width;
            }
        }
        
        this.calculateResponsiveBounds();
    }

    private calculateResponsiveBounds() {
        const barTransform = this.scrollBar.getComponent(UITransform);
        const btnTransform = this.controlButton.getComponent(UITransform);
        
        if (barTransform && btnTransform) {
            const barWidth = barTransform.contentSize.width;
            const btnWidth = btnTransform.contentSize.width;
            
            this.maxX = (barWidth - btnWidth) / 2;
            this.minX = -this.maxX;
        }

        if (this.ballCtrl && this.ballCtrl.playZone) {
            const zoneTransform = this.ballCtrl.playZone.getComponent(UITransform);
            const paddleTransform = this.paddle.getComponent(UITransform);

            if (zoneTransform && paddleTransform) {
                const playableWidth = zoneTransform.contentSize.width; 
                const paddleWidth = paddleTransform.contentSize.width;

                this.paddleMaxX = (playableWidth - paddleWidth) / 2;
                this.paddleMinX = -this.paddleMaxX;
            }
        } else {
            this.paddleMaxX = 250;
            this.paddleMinX = -250;
        }
    }

    private onTouchMove(event: EventTouch) {
        const delta = event.getUIDelta();
        
        let currentBtnPos = this.controlButton.getPosition();
        let newBtnX = currentBtnPos.x + delta.x;
        newBtnX = Math.max(this.minX, Math.min(this.maxX, newBtnX));
        this.controlButton.setPosition(new Vec3(newBtnX, currentBtnPos.y, currentBtnPos.z));

        const range = this.maxX - this.minX;
        const ratio = range === 0 ? 0.5 : (newBtnX - this.minX) / range;

        const paddleRange = this.paddleMaxX - this.paddleMinX;
        const newPaddleX = this.paddleMinX + (ratio * paddleRange);

        let currentPaddlePos = this.paddle.getPosition();
        this.paddle.setPosition(new Vec3(newPaddleX, currentPaddlePos.y, currentPaddlePos.z));
    }

    private onTouchEnd() {
        if (this.ballCtrl) {
            this.ballCtrl.launchBall();
        }
    }

    public refreshActiveBalls() {
        if (this.ballCtrl && this.ballCtrl.node.parent) {
            const ballNodes = this.ballCtrl.node.parent.children.filter(child => child.getComponent(BallCtrl) !== null);
            this.activeBalls = ballNodes;
        }
    }

    public activatePowerUp(type: PowerUpType) {
        console.log("Đã ăn vật phẩm: ", type);
        
        switch (type) {
            case PowerUpType.DUPLICATE:
                if (this.activeBalls.length > 0 && this.ballPrefab) {
                    PowerUpManager.handleDuplicateBall(this.activeBalls[0], this.ballPrefab);
                    this.refreshActiveBalls();
                }
                break;

            case PowerUpType.EXPAND:
                this.paddleBuffToken++; // Tăng định danh lượt ăn vật phẩm chống trùng đè Timer
                const currentToken = this.paddleBuffToken;

                // 1. Phóng to thanh trượt qua PowerUpManager
                PowerUpManager.handleExpandPaddle(this.paddle, this.extendedPaddleWidth, (width) => {
                    this.updatePaddleBounds(width);
                });

                // 2. Lên lịch trả lại kích thước cũ sau 7 giây
                this.unscheduleAllCallbacks(); 
                this.scheduleOnce(() => {
                    if (currentToken === this.paddleBuffToken) {
                        PowerUpManager.handleExpandPaddle(this.paddle, this.normalPaddleWidth, (width) => {
                            this.updatePaddleBounds(width);
                        });
                    }
                }, 15);
                break;
            case PowerUpType.SLOW:
                this.refreshActiveBalls();
                
                this.ballSlowToken++; 
                const currentSlowToken = this.ballSlowToken;
        
                if (!this.isBallSlowed) {
                    this.isBallSlowed = true;
                    PowerUpManager.handleSlowBalls(this.activeBalls, 0.7); 
                    console.log("Bóng bắt đầu chạy chậm.");
                } else {
                    console.log("Bóng đang chậm sẵn rồi, chỉ reset lại thời gian đếm ngược 5 giây!");
                }
        
                // Hủy lịch hẹn cũ để làm tươi thời gian
                this.unschedule(this.resetBallSpeed);
        
                // Lên lịch sau 5 giây hồi phục
                this.scheduleOnce(this.resetBallSpeed = () => {
                    if (currentSlowToken === this.ballSlowToken) {
                        this.refreshActiveBalls();
                        
                        // Trả lại tốc độ gốc và gỡ cờ trạng thái chậm
                        PowerUpManager.handleSlowBalls(this.activeBalls, 2); // Nhân đôi để về ban đầu
                        this.isBallSlowed = false; 
                        
                        console.log("Hết thời gian làm chậm! Bóng tăng tốc trở lại.");
                    }
                }, 10); 
                break;
        }
    }

    public handleBallLost(ballNode: Node) {
        const index = this.activeBalls.indexOf(ballNode);
        if (index > -1) {
            this.activeBalls.splice(index, 1);
        }

        if (ballNode !== this.ballCtrl.node) {
            ballNode.destroy();
        } else {
            ballNode.active = false; 
        }

        if (this.activeBalls.length === 0) {
            console.log("Hết sạch bóng! Bạn đã mất 1 mạng.");
            
            this.ballCtrl.node.active = true;
            this.ballCtrl.resetBall();
            this.activeBalls.push(this.ballCtrl.node);
            
            // Cập nhật lại biên chuẩn cho Paddle lúc hồi sinh phòng hờ khi đang còn kích thước buff
            const paddleTransform = this.paddle.getComponent(UITransform);
            if (paddleTransform) {
                this.updatePaddleBounds(paddleTransform.width);
            }
        } else {
            console.log(`Vẫn còn ${this.activeBalls.length} quả bóng trên sân, tiếp tục chơi!`);
        }
    }

    public updatePaddleBounds(currentPaddleWidth: number) {
        if (this.ballCtrl && this.ballCtrl.playZone) {
            const zoneTransform = this.ballCtrl.playZone.getComponent(UITransform);
            if (zoneTransform) {
                const playableWidth = zoneTransform.contentSize.width;
                
                this.paddleMaxX = (playableWidth - currentPaddleWidth) / 2;
                this.paddleMinX = -this.paddleMaxX;

                let currentPos = this.paddle.getPosition();
                let clampedX = Math.max(this.paddleMinX, Math.min(this.paddleMaxX, currentPos.x));
                if (clampedX !== currentPos.x) {
                    this.paddle.setPosition(clampedX, currentPos.y, currentPos.z);
                }
            }
        }
    }
}