import { _decorator, Component, Node, RigidBody2D, Vec2, Vec3, UITransform } from 'cc'; // Thêm UITransform
const { ccclass, property } = _decorator;

@ccclass('BallCtrl')
export class BallCtrl extends Component {

    @property(Node)
    public paddle: Node = null!;

    @property(Node)
    public playZone: Node = null!; 

    @property
    public ballSpeed: number = 500; 

    private rb: RigidBody2D = null!;
    private isLaunched: boolean = false;
    private offsetFromPaddle: Vec3 = new Vec3(0, 35, 0);

    private minPlayX: number = 0;
    private maxPlayX: number = 0;
    private maxPlayY: number = 0;
    private minPlayY: number = 0;

    onLoad() {
        this.rb = this.getComponent(RigidBody2D)!;
    }

    start() {
        this.calculateBoundsFromZone();
        this.resetBall();
    }

    private calculateBoundsFromZone() {
        if (!this.playZone) {
            console.warn("Chưa kéo thả Node PlayZone vào BallCtrl!");
            return;
        }

        const uiTransform = this.playZone.getComponent(UITransform);
        if (uiTransform) {
            const zoneWidth = uiTransform.contentSize.width;
            const zoneHeight = uiTransform.contentSize.height;

            const ballRadius = 15;

            this.minPlayX = -zoneWidth / 2 + ballRadius;
            this.maxPlayX = zoneWidth / 2 - ballRadius;
            this.maxPlayY = zoneHeight / 2 - ballRadius;
            
            this.minPlayY = -zoneHeight / 2 + 300; 
        }
    }

    update(dt: number) {
        // Nếu bóng chưa bắn, liên tục "dính" theo vị trí X của Paddle
        if (!this.isLaunched && this.paddle) {
            let paddlePos = this.paddle.getPosition();
            this.node.setPosition(paddlePos.add(this.offsetFromPaddle));
        }

        // Nếu bóng rơi xuống dưới biên màn hình -> Reset (Dùng biến động)
        if (this.node.getPosition().y < this.minPlayY) {
            this.resetBall();
        }

        // "Nhốt" bóng trong vùng chơi Responsive
        if (this.isLaunched && this.rb) {
            let currentPos = this.node.getPosition();
            let velocity = this.rb.linearVelocity;
            let changed = false;

            // Kiểm tra biên trái
            if (currentPos.x < this.minPlayX) {
                currentPos.x = this.minPlayX;
                velocity.x = Math.abs(velocity.x); // Nảy sang phải
                changed = true;
            }
            // Kiểm tra biên phải
            else if (currentPos.x > this.maxPlayX) {
                currentPos.x = this.maxPlayX;
                velocity.x = -Math.abs(velocity.x); // Nảy sang trái
                changed = true;
            }

            // Kiểm tra biên trên
            if (currentPos.y > this.maxPlayY) {
                currentPos.y = this.maxPlayY;
                velocity.y = -Math.abs(velocity.y); // Nảy xuống
                changed = true;
            }

            if (changed) {
                this.node.setPosition(currentPos);
                this.rb.linearVelocity = velocity;
            }
        }
    }

    public resetBall() {
        this.isLaunched = false;
        
        if (this.rb) {
            this.rb.linearVelocity = new Vec2(0, 0);
            this.rb.enabledContactListener = false; 
            this.rb.type = 0;
        }

        if (this.paddle) {
            let paddlePos = this.paddle.getPosition();
            this.node.setPosition(paddlePos.add(this.offsetFromPaddle));
        }
    }

    public launchBall() {
        if (this.isLaunched) return; 

        this.isLaunched = true;

        if (this.rb) {
            // BẬT lại vật lý Dynamic cho bóng trước khi bắn
            this.rb.type = 2; // 2 = Dynamic
            this.rb.enabledContactListener = true;
            
            // Góc bắn ngẫu nhiên hướng lên trên
            let randomX = (Math.random() - 0.5) * 2; 
            let launchDirection = new Vec2(randomX, 1).normalize(); 

            this.rb.linearVelocity = launchDirection.multiplyScalar(this.ballSpeed);
        }
    }
}