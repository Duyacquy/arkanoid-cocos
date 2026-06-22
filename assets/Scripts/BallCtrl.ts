import { _decorator, Component, Node, Vec3, UITransform, Sprite, UIOpacity, Color, tween } from 'cc';
import { Physics2DHelper } from './Physics2DHelper';
import { BrickCtrl } from './BrickCtrl';

const { ccclass, property } = _decorator;

@ccclass('BallCtrl')
export class BallCtrl extends Component {
    @property(Node)
    public paddle: Node = null!;

    @property(Node)
    public playZone: Node = null!;

    @property
    public ballSpeed: number = 500;

    private isLaunched: boolean = false;
    private offsetFromPaddle: Vec3 = new Vec3(0, 35, 0);
    
    // Core Physics Properties
    private velocity: Vec3 = new Vec3(0, 0, 0);
    private ballRadius: number = 15;
    
    private minPlayX: number = 0;
    private maxPlayX: number = 0;
    private maxPlayY: number = 0;
    private minPlayY: number = 0;
    private trailTimer: number = 0;
    private readonly trailInterval: number = 0.025;

    private gameCtrl: any = null;

    public setGameCtrl(gameCtrl: any) {
        this.gameCtrl = gameCtrl;
    }

    start() {
        this.calculateBoundsFromZone();
        
        if (!this.isLaunched) {
            this.resetBall();
        }
    }

    /** Hàm khởi tạo đặc biệt dành riêng cho bóng phụ khi phân thân */
    public initExtraBall(parent: Node, pos: Vec3, vel: Vec3, speed: number) {
        this.node.parent = parent;
    
        this.isLaunched = true;
        this.ballSpeed = speed;
        this.setVelocity(vel);
    
        this.node.setPosition(pos.clone());
        console.log(pos);
        this.node.active = true; 
    }

    private calculateBoundsFromZone() {
        if (!this.playZone) return;
        const uiTransform = this.playZone.getComponent(UITransform);
        if (uiTransform) {
            const zoneWidth = uiTransform.contentSize.width;
            const zoneHeight = uiTransform.contentSize.height;
            this.minPlayX = -zoneWidth / 2 + this.ballRadius;
            this.maxPlayX = zoneWidth / 2 - this.ballRadius;
            this.maxPlayY = zoneHeight / 2 - this.ballRadius;
            this.minPlayY = -zoneHeight / 2;
        }
    }

    public setVelocity(vel: Vec3) {
        this.velocity = vel.clone();
    }

    public getVelocity(): Vec3 {
        return this.velocity;
    }

    update(dt: number) {
        if (!this.isLaunched && this.paddle) {
            let paddlePos = this.paddle.getPosition();
            this.node.setPosition(paddlePos.add(this.offsetFromPaddle));
            return;
        }

        if (this.isLaunched) {
            this.simulatePhysics(dt);
            this.updateBallTrail(dt);
        }
    }

    private updateBallTrail(dt: number) {
        this.trailTimer += dt;

        if (this.trailTimer >= this.trailInterval) {
            this.trailTimer = 0;
            this.createSingleTrailGhost();
        }
    }

    private createSingleTrailGhost() {
        const mySprite = this.getComponent(Sprite);
        const myUI = this.getComponent(UITransform);

        if (!mySprite || !mySprite.spriteFrame || !myUI || !this.node.parent) return;

        const trailNode = new Node('BallBlurGhost');
        
        trailNode.parent = this.node.parent;
        
        // Đẩy bóng mờ xuống dưới cùng danh sách con để bóng thật đè lên trên
        const currentBallIndex = this.node.getSiblingIndex();
        trailNode.setSiblingIndex(currentBallIndex > 0 ? currentBallIndex - 1 : 0); 
        
        // Đồng bộ vị trí, góc xoay và kích thước
        trailNode.setPosition(this.node.position.clone());
        trailNode.setScale(this.node.scale.clone());

        const trailUI = trailNode.addComponent(UITransform);
        trailUI.setContentSize(myUI.contentSize);

        const trailSprite = trailNode.addComponent(Sprite);
        trailSprite.spriteFrame = mySprite.spriteFrame;
        
        trailSprite.color = new Color(140, 230, 255, 255); 

        const opacityComp = trailNode.addComponent(UIOpacity);
        opacityComp.opacity = 200; 

        tween(trailNode)
            .to(0.08, { scale: new Vec3(this.node.scale.x * 0.3, this.node.scale.y * 0.3, 1) })
            .start();

        tween(opacityComp)
            .to(0.08, { opacity: 0 })
            .call(() => {
                if (trailNode && trailNode.isValid) {
                    trailNode.destroy(); 
                }
            })
            .start();
    }

    private simulatePhysics(dt: number) {
        const speed = this.velocity.length();
        const travel = speed * dt;
        
        const substepDistance = 10;
        let steps = Math.ceil(travel / substepDistance);
        steps = Physics2DHelper.clamp(steps, 1, 10);
        const h = dt / steps;

        for (let s = 0; s < steps; s++) {
            // 1. Di chuyển bóng từng bước nhỏ
            let pos = this.node.getPosition();
            pos.x += this.velocity.x * h;
            pos.y += this.velocity.y * h;
            this.node.setPosition(pos);

            // 2. Kiểm tra biên tường
            this.checkWallCollision();

            // 3. Kiểm tra chạm Paddle
            this.checkPaddleCollision();

            // 4. Kiểm tra chạm Gạch
            this.checkBricksCollision();

            // 5. Kiểm tra rớt đáy (Thua mạng)
            if (this.node.position.y < this.minPlayY + 300) {
                if (this.gameCtrl && this.gameCtrl.handleBallLost) {
                    this.gameCtrl.handleBallLost(this.node);
                }
                break;
            }
        }
    }

    private checkWallCollision() {
        let pos = this.node.getPosition();
        if (pos.x < this.minPlayX) {
            pos.x = this.minPlayX;
            this.velocity.x = Math.abs(this.velocity.x);
        } else if (pos.x > this.maxPlayX) {
            pos.x = this.maxPlayX;
            this.velocity.x = -Math.abs(this.velocity.x);
        }

        if (pos.y > this.maxPlayY) {
            pos.y = this.maxPlayY;
            this.velocity.y = -Math.abs(this.velocity.y);
        }
        this.node.setPosition(pos);
    }

    private checkPaddleCollision() {
        if (this.velocity.y > 0 || !this.paddle) return;

        if (Physics2DHelper.isRectHit(this.node, this.paddle)) {
            const ballPos = this.node.position;
            const paddlePos = this.paddle.position;
            const paddleUI = this.paddle.getComponent(UITransform)!;

            // Tính góc nảy dựa trên vị trí va chạm của bóng trên thanh paddle
            const offsetRaw = (ballPos.x - paddlePos.x) / (paddleUI.width / 2);
            const offset = Physics2DHelper.clamp(offsetRaw, -1, 1);

            const maxAngle = 60 * Math.PI / 180; // Tối đa 60 độ
            const angle = offset * maxAngle;
            const speed = this.velocity.length();

            this.velocity.x = Math.sin(angle) * speed;
            this.velocity.y = Math.cos(angle) * speed;

            if (this.gameCtrl) {
                this.gameCtrl.playSound(this.gameCtrl.sndPaddleHit);
            }

            if (this.gameCtrl && this.gameCtrl.playPaddleHitEffect) {
                this.gameCtrl.playPaddleHitEffect();
            }
            
            // Đẩy bóng lên đỉnh thanh paddle ngay lập tức để tránh dính đúp va chạm
            const newY = paddlePos.y + paddleUI.height / 2 + this.ballRadius;
            this.node.setPosition(ballPos.x, newY, 0);
        }
    }

    private checkBricksCollision() {
        if (!this.gameCtrl || !this.gameCtrl.levelManager) return;
        
        const brickContainer = this.gameCtrl.levelManager.brickContainer;
        if (!brickContainer) return;

        const bricks = brickContainer.children;
        for (let i = bricks.length - 1; i >= 0; i--) {
            const brick = bricks[i];
            if (Physics2DHelper.isRectHit(this.node, brick)) {
                
                const ballPos = this.node.position;
                const brickPos = brick.position;
                const brickUI = brick.getComponent(UITransform)!;

                const diffX = Math.abs(ballPos.x - brickPos.x) / (brickUI.width / 2);
                const diffY = Math.abs(ballPos.y - brickPos.y) / (brickUI.height / 2);

                if (diffX > diffY) {
                    this.velocity.x *= -1;
                } else {
                    this.velocity.y *= -1; 
                }

                if (this.gameCtrl) {
                    this.gameCtrl.addScore(10); 
                }

                if (this.gameCtrl) {
                    this.gameCtrl.playSound(this.gameCtrl.sndBlockDestroy, 0.85);
                }

                const ctrl = brick.getComponent(BrickCtrl);
                if (ctrl) {
                    ctrl.takeDamage();
                }
                break;
            }
        }
    }

    public resetBall() {
        this.isLaunched = false;
        this.velocity.set(0, 0, 0);
        if (this.paddle) {
            let paddlePos = this.paddle.getPosition();
            this.node.setPosition(paddlePos.add(this.offsetFromPaddle));
        }
    }

    public launchBall() {
        if (this.isLaunched) return;
        this.isLaunched = true;

        let randomX = (Math.random() - 0.5) * 2;
        let dir = new Vec3(randomX, 1, 0).normalize();
        this.velocity = dir.multiplyScalar(this.ballSpeed);
    }
}