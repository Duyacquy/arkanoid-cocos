import { _decorator, Component, Node, Vec3, Vec2, UITransform } from 'cc';
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
        // 1. GÁN CHA TRƯỚC để xác định hệ tọa độ Local
        this.node.parent = parent;
    
        // 2. BẬT CỜ để không bị dính vào logic update bám Paddle
        this.isLaunched = true;
        this.ballSpeed = speed;
        this.setVelocity(vel);
    
        // 3. ĐẶT VỊ TRÍ CUỐI CÙNG (Trùng khớp 100% vị trí bóng gốc tại frame đó)
        this.node.setPosition(pos.clone());
        console.log(pos);
        // Đảm bảo bóng phụ hiển thị lên bình thường
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
        }
    }

    /** Chia nhỏ frame (Sub-stepping) để quét va chạm chính xác cao */
    private simulatePhysics(dt: number) {
        const speed = this.velocity.length();
        const travel = speed * dt;
        
        // Cứ mỗi 10px chiều dài di chuyển ta quét va chạm 1 lần để tránh lọt lưới gạch
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