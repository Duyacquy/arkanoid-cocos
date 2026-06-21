import { _decorator, Component, Node, EventTouch, Vec3, Prefab, instantiate, UITransform, Animation } from 'cc';
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
    public laserBulletPrefab: Prefab = null!;

    @property(LevelManager)
    public levelManager: LevelManager = null!;

    // --- CẤU HÌNH ĐƯỢC ĐƯA RA INSPECTOR THEO YÊU CẦU ---
    @property({ tooltip: 'Thời gian giãn cách giữa mỗi lượt bắn Laser (giây)' })
    public laserFireInterval: number = 0.5;

    @property({ tooltip: 'Khoảng cách vị trí nòng súng thụt vào từ 2 đầu mép Paddle (px)' })
    public laserMuzzleOffset: number = 18;

    @property({ tooltip: 'Tổng thời gian duy trì trạng thái bắn Laser (giây)' })
    public laserDuration: number = 10;

    private activeBalls: Node[] = [];
    private isPlaying: boolean = true;
    
    private currentPaddleMode: 'NONE' | 'EXPAND' | 'LASER' = 'NONE';
    private paddleBuffToken: number = 0; 

    private normalPaddleWidth: number = 180;
    private extendedPaddleWidth: number = 240; 

    private ballSlowScale: number = 0.7;
    private ballSlowToken: number = 0;
    private resetBallSpeed: Function = null!;
    private isBallSlowed: boolean = false;

    private laserFireTimer: number = 0;

    private minX: number = 0;
    private maxX: number = 0;
    private paddleMinX: number = 0;
    private paddleMaxX: number = 0;

    start() {
        this.controlButton.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.controlButton.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.controlButton.on(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);

        if (this.ballCtrl) {
            this.ballCtrl.setGameCtrl(this);
            this.activeBalls.push(this.ballCtrl.node);
        }

        if (this.paddle) {
            const paddleTransform = this.paddle.getComponent(UITransform);
            if (paddleTransform) {
                this.normalPaddleWidth = paddleTransform.width;
            }
        }
        
        this.calculateResponsiveBounds();
        this.playPaddleIntroSequence();
    }

    private playPaddleIntroSequence() {
        if (!this.paddle) return;
        const anim = this.paddle.getComponent(Animation);
        if (anim) {
            anim.stop();
            anim.play('PaddleSpawn'); 
            
            anim.once(Animation.EventType.FINISHED, () => {
                if (this.currentPaddleMode === 'NONE') {
                    anim.play('PaddlePulsate');
                }
            }, this);
        }
    }

    update(dt: number) {
        if (this.isPlaying && this.currentPaddleMode === 'LASER') {
            this.laserFireTimer += dt;
            if (this.laserFireTimer >= this.laserFireInterval) {
                this.laserFireTimer = 0;
                // Truyền thông số offset cấu hình sang cho Manager xử lý bắn
                PowerUpManager.handleFireLaser(this.paddle, this.laserBulletPrefab, this.laserMuzzleOffset);
            }
        }
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
            const ballNodes = this.ballCtrl.node.parent.children.filter(child => {
                const ctrl = child.getComponent(BallCtrl);
                return ctrl !== null && child.isValid && child.activeInHierarchy;
            });
            
            this.activeBalls = ballNodes;
        }
    }

    public activatePowerUp(type: PowerUpType) {
        console.log("Đã ăn vật phẩm: ", type);
        
        switch (type) {
            case PowerUpType.DUPLICATE:
                this.refreshActiveBalls();
                if (this.activeBalls.length > 0) {
                    PowerUpManager.handleDuplicateBall(this.activeBalls[0]);
                    this.refreshActiveBalls();
                }
                break;
            
            case PowerUpType.SLOW:
                this.refreshActiveBalls();
                this.ballSlowToken++; 
                const currentSlowToken = this.ballSlowToken;
        
                if (!this.isBallSlowed) {
                    this.isBallSlowed = true;
                    PowerUpManager.handleSlowBalls(this.activeBalls, this.ballSlowScale); 
                    console.log("Bóng bắt đầu chạy chậm.");
                }
        
                this.unschedule(this.resetBallSpeed);
                this.scheduleOnce(this.resetBallSpeed = () => {
                    if (currentSlowToken === this.ballSlowToken) {
                        this.refreshActiveBalls();
                        PowerUpManager.handleSlowBalls(this.activeBalls, 1.0 / this.ballSlowScale);
                        this.isBallSlowed = false; 
                        console.log("Hết thời gian làm chậm! Bóng tăng tốc trở lại.");
                    }
                }, 10); 
                break;

            case PowerUpType.EXPAND:
                if (this.currentPaddleMode === 'LASER') {
                    PowerUpManager.handleDisableLaser(this.paddle);
                }

                this.currentPaddleMode = 'EXPAND';
                this.paddleBuffToken++;
                const currentExpandToken = this.paddleBuffToken;

                PowerUpManager.handleExpandPaddle(this.paddle, this.extendedPaddleWidth, (width) => {
                    this.updatePaddleBounds(width);
                });

                this.scheduleOnce(() => {
                    if (currentExpandToken === this.paddleBuffToken && this.currentPaddleMode === 'EXPAND') {
                        this.currentPaddleMode = 'NONE';
                        PowerUpManager.handleExpandPaddle(this.paddle, this.normalPaddleWidth, (width) => {
                            this.updatePaddleBounds(width);
                        });
                        const anim = this.paddle.getComponent(Animation);
                        if (anim) anim.play('PaddlePulsate');
                        console.log("Hết thời gian phóng to! Paddle co lại.");
                    }
                }, 10);
                break;

            case PowerUpType.LASER:
                if (this.currentPaddleMode === 'EXPAND') {
                    this.paddleBuffToken++; 
                    PowerUpManager.handleExpandPaddle(this.paddle, this.normalPaddleWidth, (width) => {
                        this.updatePaddleBounds(width);
                    });
                }

                this.currentPaddleMode = 'LASER';
                this.paddleBuffToken++;
                const currentLaserToken = this.paddleBuffToken;
                
                this.laserFireTimer = this.laserFireInterval; 

                PowerUpManager.handleEnableLaser(this.paddle, () => {
                    console.log("Hệ thống Laser đã khởi động xong!");
                });

                this.scheduleOnce(() => {
                    if (currentLaserToken === this.paddleBuffToken && this.currentPaddleMode === 'LASER') {
                        this.currentPaddleMode = 'NONE';
                        PowerUpManager.handleDisableLaser(this.paddle);
                    }
                }, this.laserDuration); 
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
    
        this.refreshActiveBalls();
    
        if (this.activeBalls.length === 0) {
            console.log("Hết sạch bóng! Bạn đã mất 1 mạng.");
            
            this.ballCtrl.node.active = true;
            this.ballCtrl.resetBall();
            this.activeBalls.push(this.ballCtrl.node);
            
            const paddleTransform = this.paddle.getComponent(UITransform);
            if (paddleTransform) {
                this.updatePaddleBounds(paddleTransform.width);
            }
            
            this.currentPaddleMode = 'NONE';
            this.playPaddleIntroSequence();
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