import { _decorator, Node, UITransform, Vec3 } from 'cc';

export class Physics2DHelper {
    /** Kiểm tra va chạm giữa 2 Node dạng chữ nhật (AABB) */
    public static isRectHit(a: Node, b: Node): boolean {
        const aUI = a.getComponent(UITransform);
        const bUI = b.getComponent(UITransform);
        if (!aUI || !bUI) return false;

        const aPos = a.position;
        const bPos = b.position;

        const aHalfW = (aUI.width * Math.abs(a.scale.x)) / 2;
        const aHalfH = (aUI.height * Math.abs(a.scale.y)) / 2;

        const bHalfW = (bUI.width * Math.abs(b.scale.x)) / 2;
        const bHalfH = (bUI.height * Math.abs(b.scale.y)) / 2;

        const hitX = Math.abs(aPos.x - bPos.x) <= aHalfW + bHalfW;
        const hitY = Math.abs(aPos.y - bPos.y) <= aHalfH + bHalfH;

        return hitX && hitY;
    }

    /** Giới hạn giá trị trong khoảng min - max */
    public static clamp(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, value));
    }
}