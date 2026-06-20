import { _decorator, Component, Node, Vec3, Animation, UITransform } from 'cc';
import { GameCtrl } from './GameCtrl';
import { Physics2DHelper } from './Physics2DHelper';

const { ccclass, property } = _decorator;

export enum PowerUpType {
    DUPLICATE = 'PowerUpDuplicate',
    EXPAND = 'PowerUpExpand',
    LASER = 'PowerUpLaser',
    SLOW = 'PowerUpSlow'
}

@ccclass('PowerUpCtrl')
export class PowerUpCtrl extends Component {
    @property
    public fallSpeed: number = 220;

    private minHeight: number = -600;
    private currentType: PowerUpType = PowerUpType.DUPLICATE;
    private gameCtrl: GameCtrl = null!;

    public initPowerUp(type: PowerUpType, gameCtrl: GameCtrl) {
        this.currentType = type;
        this.gameCtrl = gameCtrl;

        // Tính toán biên dưới xóa item dựa vào PlayZone
        if (this.gameCtrl && this.gameCtrl.ballCtrl) {
            const playZoneNode = this.gameCtrl.ballCtrl.playZone;
            if (playZoneNode && this.node.parent) {
                const zoneUITransform = playZoneNode.getComponent(UITransform);
                const parentUITransform = this.node.parent.getComponent(UITransform);
                if (zoneUITransform && parentUITransform) {
                    const zoneHeight = zoneUITransform.contentSize.height;
                    const worldPos = zoneUITransform.convertToWorldSpaceAR(new Vec3(0, -zoneHeight / 2 - 50, 0));
                    this.minHeight = parentUITransform.convertToNodeSpaceAR(worldPos).y;
                }
            }
        }

        const anim = this.getComponent(Animation);
        if (anim) {
            anim.play(this.currentType);
        }
    }

    update(dt: number) {
        if (!this.gameCtrl) return;

        // 1. Cập nhật vị trí rơi
        let pos = this.node.getPosition();
        pos.y -= this.fallSpeed * dt;
        this.node.setPosition(pos);

        // 2. Quét va chạm Custom với Paddle
        if (this.gameCtrl.paddle && Physics2DHelper.isRectHit(this.node, this.gameCtrl.paddle)) {
            this.gameCtrl.activatePowerUp(this.currentType);
            this.node.destroy();
            return;
        }

        // 3. Tự hủy khi rơi quá màn hình
        if (pos.y < this.minHeight) {
            this.node.destroy();
        }
    }
}