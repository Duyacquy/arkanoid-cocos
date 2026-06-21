import { _decorator, Component, Node, EventTouch, Vec3, Prefab, instantiate, UITransform, Animation, Label, sys, tween, AudioClip, AudioSource } from 'cc';
import { BallCtrl } from './BallCtrl';
import { PowerUpType } from './PowerUpCtrl';
import { LevelManager } from './LevelManager';
import { PowerUpManager } from './PowerUpManager';
import { ObstacleItemCtrl } from './ObstacleItemCtrl';
import { Physics2DHelper } from './Physics2DHelper';

const { ccclass, property } = _decorator;

@ccclass('GameCtrl')
export class GameCtrl extends Component {
    @property(AudioSource)
    public audioSource: AudioSource = null!; 

    @property(AudioClip)
    public sndBallLoss: AudioClip = null!; 

    @property(AudioClip)
    public sndBlockDestroy: AudioClip = null!;

    @property(AudioClip)
    public sndGameOver: AudioClip = null!; 

    @property(AudioClip)
    public sndLaserShot: AudioClip = null!;

    @property(AudioClip)
    public sndPaddleHit: AudioClip = null!; 

    @property(AudioClip)
    public sndRoundStart: AudioClip = null!;

    @property(AudioClip)
    public sndPowerUpReceived: AudioClip = null!;

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

    @property({ type: [Node] })
    public paddleLivesUI: Node[] = [];

    @property(Label)
    public scoreLabel: Label = null!; 

    @property(Label)
    public bestLabel: Label = null!;  

    @property(Node)
    public resultPanel: Node = null!; 

    @property(Label)
    public panelTitleLabel: Label = null!; 

    @property(Label)
    public panelScoreLabel: Label = null!; 

    @property(Node)
    public playAgainButton: Node = null!;

    @property(Node)
    public edgeTop: Node = null!;

    @property(Prefab)
    public obstaclePrefab: Prefab = null!;

    @property([Node])
    public obstacleSpawnPoints: Node[] = [];

    @property({ tooltip: 'Thời gian giãn cách giữa mỗi lượt bắn Laser (giây)' })
    public laserFireInterval: number = 0.5;

    @property({ tooltip: 'Khoảng cách vị trí nòng súng thụt vào từ 2 đầu mép Paddle (px)' })
    public laserMuzzleOffset: number = 18;

    @property({ tooltip: 'Tổng thời gian duy trì trạng thái bắn Laser (giây)' })
    public laserDuration: number = 10;

    private obstaclesList: Node[] = [];
    private obstacleTimer: number = 0;
    private readonly obstacleInterval: number = 20;

    private activeBalls: Node[] = [];
    private isPlaying: boolean = true;
    private lives: number = 3;
    private isDying: boolean = false;

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

    private currentScore: number = 0;
    private bestScore: number = 0;

    start() {
        this.currentScore = 0;
        this.loadBestScore();
        this.updateScoreUI();

        this.controlButton.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.controlButton.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.controlButton.on(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);

        if (this.resultPanel) {
            this.resultPanel.active = false;
        }

        // Lắng nghe sự kiện click bằng mã code từ node bấm
        if (this.playAgainButton) {
            this.playAgainButton.on(Node.EventType.TOUCH_END, this.onClickPlayAgain, this);
        }

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

        this.lives = 3;
        this.isDying = false;
        this.updateLivesUI();

        this.obstaclesList = [];
        this.obstacleTimer = 0;

        this.playSound(this.sndRoundStart);
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
        if (this.isDying) return;

        if (this.isPlaying && this.currentPaddleMode === 'LASER') {
            this.laserFireTimer += dt;
            if (this.laserFireTimer >= this.laserFireInterval) {
                this.laserFireTimer = 0;
                PowerUpManager.handleFireLaser(this.paddle, this.laserBulletPrefab, this.laserMuzzleOffset);
                this.playSound(this.sndLaserShot, 0.4);
            }
        }

        if (this.isPlaying) {
            this.obstacleTimer += dt;
            if (this.obstacleTimer >= this.obstacleInterval) {
                this.obstacleTimer = 0;
                this.handleGateOpeningAndSpawn();
            }

            this.checkBallObstacleCollision();
        }
    }

    public playSound(clip: AudioClip, volume: number = 1.0) {
        if (this.audioSource && clip) {
            this.audioSource.playOneShot(clip, volume);
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
        if (this.isDying || !this.isPlaying) return;

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
        if (this.isDying || !this.isPlaying) return;

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
        this.playSound(this.sndPowerUpReceived);

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

    private updateLivesUI() {
        for (let i = 0; i < this.paddleLivesUI.length; i++) {
            if (this.paddleLivesUI[i]) {
                this.paddleLivesUI[i].active = i < (this.lives - 1);
            }
        }
    }

    public addScore(amount: number) {
        if (!this.isPlaying) return;
        
        this.currentScore += amount;
        
        if (this.currentScore > this.bestScore) {
            this.bestScore = this.currentScore;
            this.saveBestScore();
        }
        
        this.updateScoreUI();
    }

    private updateScoreUI() {
        if (this.scoreLabel) this.scoreLabel.string = `SCORE\n${this.currentScore}`;
        if (this.bestLabel) this.bestLabel.string = `BEST\n${this.bestScore}`;
    }

    private loadBestScore() {
        const savedBest = sys.localStorage.getItem('BrickBreaker_BestScore');
        this.bestScore = savedBest ? parseInt(savedBest) : 0;
    }

    private saveBestScore() {
        sys.localStorage.setItem('BrickBreaker_BestScore', this.bestScore.toString());
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
            if (this.isDying) return;
            this.isDying = true;
            
            this.lives--;
            this.updateLivesUI(); 
            
            this.playSound(this.sndBallLoss);

            this.currentPaddleMode = 'NONE';
            this.paddleBuffToken++;
    
            const anim = this.paddle.getComponent(Animation);
            if (anim) {
                anim.stop();
                anim.play('PaddleExplode'); 
                
                anim.once(Animation.EventType.FINISHED, () => {
                    if (this.lives <= 0) {
                        this.gameOver(false); 
                    } else {
                        this.scheduleOnce(() => {
                            this.respawnPaddleAndBall();
                        }, 0.8); 
                    }
                }, this);
            } else {
                if (this.lives <= 0) {
                    this.gameOver(false);
                } else {
                    this.respawnPaddleAndBall();
                }
            }
        } else {
            console.log(`Vẫn còn ${this.activeBalls.length} quả bóng trên sân, tiếp tục chơi!`);
        }
    }

    public gameOver(isWin: boolean = false) {
        this.isPlaying = false;
        
        if (this.ballCtrl) {
            this.ballCtrl.resetBall();
        }

        if (this.resultPanel) {
            this.resultPanel.active = true;

            this.resultPanel.setScale(new Vec3(0, 0, 1));

            this.playSound(this.sndGameOver);

            if (this.panelTitleLabel) {
                if (isWin) {
                    this.panelTitleLabel.string = "VICTORY";
                } else {
                    this.panelTitleLabel.string = "GAME OVER";
                }
            }

            if (this.panelScoreLabel) {
                this.panelScoreLabel.string = `SCORE\n${this.currentScore}`;
            }

            // Bước D: Chạy hiệu ứng Tween Pop-up (Phóng to kết hợp hiệu ứng Đàn hồi nhẹ)
            tween(this.resultPanel)
                .to(0.15, { scale: new Vec3(1.1, 1.1, 1) }, { easing: 'quadOut' }) 
                .to(0.08, { scale: new Vec3(1, 1, 1) }, { easing: 'quadIn' })  
                .start();
        }
    }

    public onClickPlayAgain() {
        this.playSound(this.sndRoundStart);

        this.currentScore = 0;
        this.lives = 3;
        this.isPlaying = true;
        this.isDying = false;

        for (let i = 0; i < this.paddleLivesUI.length; i++) {
            if (this.paddleLivesUI[i]) this.paddleLivesUI[i].active = true;
        }

        if (this.resultPanel) {
            this.resultPanel.active = false;
        }

        this.updateScoreUI();

        for (let i = 0; i < this.obstaclesList.length; i++) {
            if (this.obstaclesList[i] && this.obstaclesList[i].isValid) {
                this.obstaclesList[i].destroy();
            }
        }
        this.obstaclesList = [];
        this.obstacleTimer = 0;

        if (this.levelManager) {
            if (this.levelManager.brickContainer) {
                this.levelManager.brickContainer.removeAllChildren();
            }
            this.levelManager.generateLevel(); 
        }

        this.respawnPaddleAndBall();
    }

    private respawnPaddleAndBall() {
        this.isDying = false;

        PowerUpManager.handleExpandPaddle(this.paddle, this.normalPaddleWidth, (width) => {
            this.updatePaddleBounds(width);
        });

        this.playSound(this.sndRoundStart);

        this.ballCtrl.node.active = true;
        this.ballCtrl.resetBall();
        this.activeBalls.push(this.ballCtrl.node);

        this.playPaddleIntroSequence();
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

    /** Xử lý chạy animation mở cổng trước khi thả quái vật */
    private handleGateOpeningAndSpawn() {
        if (!this.obstaclePrefab || this.obstacleSpawnPoints.length === 0) return;

        // Chọn ngẫu nhiên index cổng: 0 là Cổng Trái, 1 là Cổng Phải
        const gateIndex = Math.floor(Math.random() * this.obstacleSpawnPoints.length);
        const spawnPoint = this.obstacleSpawnPoints[gateIndex];
        if (!spawnPoint) return;

        // Gọi Animation mở cổng trên EdgeTop
        if (this.edgeTop) {
            const anim = this.edgeTop.getComponent(Animation);
            if (anim) {
                const openAnimName = (gateIndex === 0) ? 'DoorTopLeft' : 'DoorTopRight';
                const closeAnimName = (gateIndex === 0) ? 'DoorTopLeftRevert' : 'DoorTopRightRevert';
                
                if (anim.getState(openAnimName)) {
                    // 1. Chạy hiệu ứng mở cửa
                    anim.play(openAnimName);

                    // 2. Lắng nghe sự kiện khi animation mở cửa kết thúc để tự động đóng lại
                    anim.once(Animation.EventType.FINISHED, () => {
                        // Đợi 0.1s sau khi mở hết cỡ rồi đóng lại cho mượt mà
                        this.scheduleOnce(() => {
                            if (anim.getState(closeAnimName)) {
                                anim.play(closeAnimName);
                            }
                        }, 0.1);
                    }, this);
                }
            }
        }

        // Chờ 0.24 giây cho cổng kịp hé mở rồi mới tiến hành sinh quái vật rơi xuống
        this.scheduleOnce(() => {
            this.spawnObstacleAt(spawnPoint);
        }, 0.24);
    }

    /** Sinh quái vật tại điểm chỉ định */
    private spawnObstacleAt(spawnPoint: Node) {
        if (!this.isPlaying) return; 

        const obstacleNode = instantiate(this.obstaclePrefab);
        
        // BƯỚC 1: ĐẶT CHA TRƯỚC (Để đồng bộ Hệ tọa độ Local)
        if (this.ballCtrl && this.ballCtrl.node.parent) {
            obstacleNode.parent = this.ballCtrl.node.parent;
        } else {
            obstacleNode.parent = this.node.parent;
        }

        // BƯỚC 2: ĐẶT VỊ TRÍ SAU (Lấy vị trí World của ống chuyển sang Local của cha mới)
        const spawnWorldPos = spawnPoint.parent!.getComponent(UITransform)!.convertToWorldSpaceAR(spawnPoint.position);
        const localPos = obstacleNode.parent.getComponent(UITransform)!.convertToNodeSpaceAR(spawnWorldPos);
        obstacleNode.setPosition(localPos);

        const brickContainer = this.levelManager ? this.levelManager.brickContainer : null;
        const playZoneNode = this.ballCtrl ? this.ballCtrl.playZone : null;

        // BƯỚC 3: KHỞI TẠO RESPONSIVE & CHẠY ANIMATION DI CHUYỂN MẶC ĐỊNH
        const ctrl = obstacleNode.getComponent(ObstacleItemCtrl);
        if (ctrl) {
            ctrl.initObstacle(this, brickContainer, playZoneNode);
        }

        this.obstaclesList.push(obstacleNode);
    }

    private checkBallObstacleCollision() {
        if (this.activeBalls.length === 0 || this.obstaclesList.length === 0) return;

        for (let b = 0; b < this.activeBalls.length; b++) {
            const ballNode = this.activeBalls[b];
            const ballCtrl = ballNode.getComponent(BallCtrl);
            if (!ballCtrl) continue;

            for (let o = this.obstaclesList.length - 1; o >= 0; o--) {
                const obstacleNode = this.obstaclesList[o];

                if (Physics2DHelper.isRectHit(ballNode, obstacleNode)) {
                    // Xử lý nảy hướng bóng (Không tăng tốc độ bóng)
                    let velocity = ballCtrl.getVelocity();
                    const ballPos = ballNode.position;
                    const obsPos = obstacleNode.position;

                    if (Math.abs(ballPos.x - obsPos.x) > Math.abs(ballPos.y - obsPos.y)) {
                        velocity.x *= -1; // Đập hông -> nảy ngang
                    } else {
                        velocity.y *= -1; // Đập đỉnh/đáy -> nảy dọc
                    }
                    ballCtrl.setVelocity(velocity);

                    this.playSound(this.sndBlockDestroy, 0.8);

                    const obsCtrl = obstacleNode.getComponent(ObstacleItemCtrl);
                    if (obsCtrl) {
                        obsCtrl.explodeAndDestroy();
                    }
                    break;
                }
            }
        }
    }

    /** Hàm bổ trợ giúp Obstacle tự xóa mình khỏi mảng quản lý khi nổ */
    public removeObstacleFromList(obstacleNode: Node) {
        const idx = this.obstaclesList.indexOf(obstacleNode);
        if (idx > -1) {
            this.obstaclesList.splice(idx, 1);
        }
    }

    /** Hiệu ứng co giãn nhẹ Paddle khi va chạm */
    public playPaddleHitEffect() {
        if (!this.paddle) return;
        this.paddle.setScale(1, 1, 1);
        tween(this.paddle)
            .to(0.06, { scale: new Vec3(1.12, 0.82, 1) })
            .to(0.08, { scale: new Vec3(1, 1, 1) })
            .start();
    }
}