import { _decorator, Node, instantiate, Vec3, UITransform, tween } from 'cc';
import { BallCtrl } from './BallCtrl';

export class PowerUpManager {
    /**
     * Xử lý kỹ năng Phân thân quả bóng hiện tại thành 3 quả (Không dùng Prefab)
     * @param currentBall Quả bóng gốc đang bay trên sân
     */
    public static handleDuplicateBall(currentBall: Node) {
        if (!currentBall) return;

        const ballCtrl = currentBall.getComponent(BallCtrl);
        if (!ballCtrl) return;

        const startPos = currentBall.getPosition();
        const currentVelocity = ballCtrl.getVelocity();
        const currentSpeed = currentVelocity.length();

        if (currentSpeed <= 0) return;

        const angle = 30 * Math.PI / 180; 
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);

        const vel1 = new Vec3(
            currentVelocity.x * cosA - currentVelocity.y * (-sinA),
            currentVelocity.x * (-sinA) + currentVelocity.y * cosA,
            0
        );

        const vel2 = new Vec3(
            currentVelocity.x * cosA - currentVelocity.y * sinA,
            currentVelocity.x * sinA + currentVelocity.y * cosA,
            0
        );

        // Truyền thẳng Node gốc currentBall vào làm mẫu để sao chép visual
        this.spawnExtraBall(currentBall.parent!, currentBall, startPos, vel1, ballCtrl.ballSpeed);
        this.spawnExtraBall(currentBall.parent!, currentBall, startPos, vel2, ballCtrl.ballSpeed);
    }

    private static spawnExtraBall(parent: Node, sampleBallNode: Node, pos: Vec3, vel: Vec3, speed: number) {
        // CLONE CHÍNH NODE BÓNG TRÊN SÂN
        const extraBallNode = instantiate(sampleBallNode); 
        const ctrl = extraBallNode.getComponent(BallCtrl);
        
        if (ctrl) {
            // Sao chép các liên kết GameCtrl, Paddle giống bóng gốc
            const mainBallCtrl = sampleBallNode.getComponent(BallCtrl);
            if (mainBallCtrl) {
                ctrl.paddle = mainBallCtrl.paddle;
                ctrl.playZone = mainBallCtrl.playZone;
                if (mainBallCtrl['gameCtrl']) {
                    ctrl.setGameCtrl(mainBallCtrl['gameCtrl']);
                }
            }

            // Kích hoạt nạp dữ liệu di chuyển cho bóng phụ
            ctrl.initExtraBall(parent, pos, vel, speed);
        }
    }

    /**
     * Xử lý kỹ năng phóng to thanh trượt Paddle
     * @param paddle Node thanh trượt
     * @param isExtended Trạng thái kiểm soát đã phóng to hay chưa
     * @param onSizeChanged Callback thông báo lại cho GameCtrl tính lại giới hạn biên di chuyển
     */
    public static handleExpandPaddle(paddle: Node, targetWidth: number, onSizeChanged: (currentWidth: number) => void) {
        if (!paddle) return;

        const uiTransform = paddle.getComponent(UITransform);
        if (!uiTransform) return;

        // Dừng mọi hiệu ứng scale/co giãn cũ đang chạy trên Paddle để tránh xung đột
        tween(paddle).stop();
        
        // Hiệu ứng "Squash & Stretch" (Bè ngang ra rồi nảy nhẹ) để tạo cảm giác cơ học
        const originalScale = 1; // Giữ scale bằng 1, chỉ đổi ContentSize
        
        // Tạo một object trung gian để tween thuộc tính width
        const sizeObj = { width: uiTransform.width };
        
        tween(sizeObj)
            .to(0.3, { width: targetWidth }, {
                onUpdate: () => {
                    // Cập nhật contentSize thực tế cho Paddle từng khung hình
                    uiTransform.setContentSize(sizeObj.width, uiTransform.height);
                    // Gọi callback báo cho GameCtrl cập nhật lại biên chặn di chuyển ngay lập tức
                    onSizeChanged(sizeObj.width);
                }
            })
            .start();

        // Thêm một tí hiệu ứng nảy nhẹ trên trục Y cho sinh động
        paddle.setScale(new Vec3(originalScale, 0.7, 1));
        tween(paddle)
            .to(0.15, { scale: new Vec3(originalScale, 1.1, 1) })
            .to(0.1, { scale: new Vec3(originalScale, 1, 1) })
            .start();
    }

    /**
     * Xử lý kỹ năng làm chậm toàn bộ bóng trên sân
     * @param activeBalls Danh sách các Node bóng đang chạy trong GameCtrl
     * @param factor Tỷ lệ thay đổi tốc độ (0.5 là giảm nửa, 2 là gấp đôi)
     */
    public static handleSlowBalls(activeBalls: Node[], factor: number) {
        if (!activeBalls || activeBalls.length === 0) return;

        activeBalls.forEach(ballNode => {
            if (!ballNode || !ballNode.isValid) return;

            const ballCtrl = ballNode.getComponent(BallCtrl);
            if (ballCtrl) {
                // 1. Lấy vận tốc hiện tại
                let currentVel = ballCtrl.getVelocity();
                
                // 2. Thay đổi độ lớn vận tốc (ballSpeed) dựa theo hệ số factor
                ballCtrl.ballSpeed = ballCtrl.ballSpeed * factor;

                // 3. Cập nhật lại hướng Vector vận tốc mới tương ứng với tốc độ mới
                let dir = currentVel.clone().normalize();
                Vec3.multiplyScalar(currentVel, dir, ballCtrl.ballSpeed);
                ballCtrl.setVelocity(currentVel);

                // 4. Thêm hiệu ứng đổi màu nháy nhẹ để người chơi biết bóng đang bị dính hiệu ứng (tùy chọn)
                // Duy có thể thêm logic đổi màu Sprite của bóng ở đây nếu thích
            }
        });
    }
}