import { _decorator, Component, Node, RigidBody2D, Vec2, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('BallCtrl')
export class BallCtrl extends Component {

    @property(Node)
    public paddle: Node = null!;

    @property
    public ballSpeed: number = 500; 

    private rb: RigidBody2D = null!;
    private isLaunched: boolean = false;
    private offsetFromPaddle: Vec3 = new Vec3(0, 35, 0); // Khoảng cách bóng nằm trên paddle

    onLoad() {
        this.rb = this.getComponent(RigidBody2D)!;
    }

    start() {
        this.resetBall();
    }

    update(dt: number) {
        // Nếu bóng chưa bắn, liên tục "dính" theo vị trí X của Paddle
        if (!this.isLaunched && this.paddle) {
            let paddlePos = this.paddle.getPosition();
            this.node.setPosition(paddlePos.add(this.offsetFromPaddle));
        }

        // Nếu bóng rơi xuống dưới biên màn hình -> Reset
        if (this.node.getPosition().y < -600) {
            this.resetBall();
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