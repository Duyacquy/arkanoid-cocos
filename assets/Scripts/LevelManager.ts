import { _decorator, Component, Node, Prefab, instantiate, Vec3, UITransform, PhysicsSystem2D } from 'cc';
import { BrickCtrl } from './BrickCtrl';
import { GameCtrl } from './GameCtrl';
const { ccclass, property } = _decorator;

@ccclass('LevelManager')
export class LevelManager extends Component {

    @property(Prefab)
    public brickPrefab: Prefab = null!;

    @property(Node)
    public brickContainer: Node = null!; 

    @property(GameCtrl)
    public gameCtrl: GameCtrl = null!;

    private levelData: number[][] = [
        [0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0],
        [1, 1, 4, 4, 0, 0, 0, 4, 4, 1, 1],
        [1, 4, 4, 4, 4, 0, 4, 4, 4, 4, 1],
        [1, 4, 4, 4, 4, 4, 4, 4, 4, 4, 1],
        [1, 4, 4, 3, 3, 4, 3, 3, 4, 4, 1],
        [1, 4, 4, 3, 3, 4, 3, 3, 4, 4, 1],
        [1, 1, 4, 4, 4, 4, 4, 4, 4, 1, 1],
        [0, 1, 1, 4, 4, 4, 4, 4, 1, 1, 0],
        [0, 0, 1, 1, 4, 4, 4, 1, 1, 0, 0],
        [0, 0, 0, 1, 1, 4, 1, 1, 0, 0, 0],
        [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    ];

    // private levelData: number[][] = [
    //     [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    //     [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    //     [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    //     [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    //     [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    //     [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    //     [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    //     [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    //     [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // ];

    private brickWidth: number = 70;
    private brickHeight: number = 35;
    private spacingX: number = 2; 
    private spacingY: number = 2; 

    start() {
        this.generateLevel();
    }

    public generateLevel() {
        // 1. Xóa sạch gạch cũ nếu có
        this.brickContainer.removeAllChildren();

        const rowCount = this.levelData.length;
        const colCount = this.levelData[0].length;

        // 2. Tính toán startX để toàn bộ cụm gạch nằm CĂN GIỮA theo chiều ngang (Trục X)
        const totalWidth = colCount * this.brickWidth + (colCount - 1) * this.spacingX;
        const startX = -totalWidth / 2 + this.brickWidth / 2;

        // 3. Vì Tâm Y của brickContainer là 1 (ở đỉnh), hàng đầu tiên sẽ lùi xuống nửa chiều cao gạch
        const startY = -this.brickHeight / 2;

        // 4. Vòng lặp sinh gạch
        for (let row = 0; row < rowCount; row++) {
            for (let col = 0; col < colCount; col++) {
                const brickType = this.levelData[row][col];

                // Nếu là số 0 thì bỏ qua không sinh gạch
                if (brickType === 0) continue;

                // Tạo Node gạch từ Prefab và bỏ vào Container
                const brickNode = instantiate(this.brickPrefab);
                brickNode.parent = this.brickContainer;

                // Tính toán tọa độ Local tương đối
                const posX = startX + col * (this.brickWidth + this.spacingX);
                const posY = startY - row * (this.brickHeight + this.spacingY); // Trừ đi Y để xếp thấp dần xuống dưới
                
                brickNode.setPosition(new Vec3(posX, posY, 0));

                // Khởi tạo thuộc tính máu, ảnh cho gạch
                const brickCtrl = brickNode.getComponent(BrickCtrl);
                if (brickCtrl) {
                    brickCtrl.initBrick(brickType, this.brickWidth, this.brickHeight);
                    
                    // 3. TRUYỀN LIÊN KẾT GAMECTRL SANG CHO VIÊN GẠCH Ở ĐÂY
                    brickCtrl.setGameCtrl(this.gameCtrl);
                }
            }
        }

        PhysicsSystem2D.instance.syncSceneToPhysics();
    }
}