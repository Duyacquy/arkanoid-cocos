import { _decorator, Component, Node, EventTouch, Vec3, Animation } from 'cc';
import { BallCtrl } from './BallCtrl';
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