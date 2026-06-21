import { _decorator, Component, Node, Prefab, instantiate, Vec3, UITransform } from 'cc';
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

    // --- MA TRẬN 1: MÀN CHƠI KIỂU TRUYỀN THỐNG (MÀU SẮC ĐA DẠNG) ---
    // private levelData: number[][] = [
    //     [0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0],
    //     [1, 1, 4, 4, 0, 0, 0, 4, 4, 1, 1],
    //     [1, 4, 4, 4, 4, 0, 4, 4, 4, 4, 1],
    //     [1, 4, 4, 4, 4, 4, 4, 4, 4, 4, 1],
    //     [1, 4, 4, 3, 3, 4, 3, 3, 4, 4, 1],
    //     [1, 4, 4, 3, 3, 4, 3, 3, 4, 4, 1],
    //     [1, 1, 4, 4, 4, 4, 4, 4, 4, 1, 1],
    //     [0, 1, 1, 4, 4, 4, 4, 4, 1, 1, 0],
    //     [0, 0, 1, 1, 4, 4, 4, 1, 1, 0, 0],
    //     [0, 0, 0, 1, 1, 4, 1, 1, 0, 0, 0],
    //     [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
    //     [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0], 
    // ];

    // --- MA TRẬN 3: MÀN CHƠI FULL GẠCH VÀNG (MẶC ĐỊNH ĐANG BẬT) ---
    private levelData: number[][] = [
        [3, 3, 3, 3, 3, 3, 3, 3],
        [3, 3, 3, 3, 3, 3, 3, 3],
        [3, 3, 3, 3, 3, 3, 3, 3],
        [3, 3, 3, 3, 3, 3, 3, 3],
        [3, 3, 3, 3, 3, 3, 3, 3],
        [3, 3, 3, 3, 3, 3, 3, 3],
        [3, 3, 3, 3, 3, 3, 3, 3],
        [3, 3, 3, 3, 3, 3, 3, 3],
        [3, 3, 3, 3, 3, 3, 3, 3],
    ];

    // private levelData: number[][] = [
    //     [3, 3, 3, 3, 3, 3, 3, 3]
    // ];

    private brickWidth: number = 70;
    private brickHeight: number = 35;
    private spacingX: number = 2; 
    private spacingY: number = 2; 

    start() {
        this.generateLevel();
    }

    public generateLevel() {
        this.brickContainer.removeAllChildren();

        const rowCount = this.levelData.length;
        const colCount = this.levelData[0].length;

        const totalWidth = colCount * this.brickWidth + (colCount - 1) * this.spacingX;
        const totalHeight = rowCount * this.brickHeight + (rowCount - 1) * this.spacingY;

        const startX = -totalWidth / 2 + this.brickWidth / 2;

        let startY = 0;
        
        const zoneTransform = this.brickContainer.parent?.getComponent(UITransform);
        
        if (zoneTransform) {
            const zoneHeight = zoneTransform.contentSize.height;
            
            const topEdge = zoneHeight / 2;
            
            const marginTop = 180; 
            
            startY = topEdge - marginTop - this.brickHeight / 2;
        } else {
            const topOffset = 350; 
            startY = topOffset + (totalHeight / 2) - this.brickHeight / 2;
        }

        for (let row = 0; row < rowCount; row++) {
            for (let col = 0; col < colCount; col++) {
                const brickType = this.levelData[row][col];

                if (brickType === 0) continue;

                const brickNode = instantiate(this.brickPrefab);
                brickNode.parent = this.brickContainer;

                const posX = startX + col * (this.brickWidth + this.spacingX);
                const posY = startY - row * (this.brickHeight + this.spacingY);
                
                brickNode.setPosition(new Vec3(posX, posY, 0));

                const brickCtrl = brickNode.getComponent(BrickCtrl);
                if (brickCtrl) {
                    brickCtrl.initBrick(brickType, this.brickWidth, this.brickHeight);
                    brickCtrl.setGameCtrl(this.gameCtrl);
                }
            }
        }
    }
}