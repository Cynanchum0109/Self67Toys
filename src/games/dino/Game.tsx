
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, ArrowUp, Trophy } from 'lucide-react';
import Leaderboard from '@/shared/Leaderboard';
import { BOARD_DINO, decodeDino, DINO_THEME, encodeDino } from '@/shared/boards';
import { hasRankApi, submitScore } from '@/shared/toy';
import walk1Image from './Assets/07_walk1.png';
import walk2Image from './Assets/07_walk2.png';
import walk3Image from './Assets/07_walk3.png';
import obstacleWalk1 from './Assets/06_walk1.png';
import obstacleWalk2 from './Assets/06_walk2.png';
import obstacleWalk3 from './Assets/06_walk3.png';

interface GameProps {
  onClose: () => void;
  lang?: 'zh' | 'en';
}

const Game: React.FC<GameProps> = ({ onClose, lang = 'zh' }) => {
  // 英文为草译，待审校 → translations-review.md
  const T = lang === 'en'
    ? { win: 'Happily wed!', retry: 'Press Space to try again', cheer: 'Go, Heathcliff~', jump: 'Jump', hintDesktopPre: 'Press ', hintDesktopKey: 'Space', hintDesktopPost: ' to start / jump', hintMobile: 'Tap the button above to start / jump', rank: 'Leaderboard', sec: 's' }
    : { win: '喜结连理！', retry: '按下空格再试一次', cheer: '希斯克利夫加油～', jump: '跳跃', hintDesktopPre: '按 ', hintDesktopKey: '空格键', hintDesktopPost: ' 开始/跳跃', hintMobile: '点击上方按钮开始/跳跃', rank: '排行榜', sec: '秒' };
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showRank, setShowRank] = useState(false);
  
  // 图片引用（主角行走动画）
  const walkImagesRef = useRef<HTMLImageElement[]>([]);
  const imagesLoadedRef = useRef(false);
  const animationFrameRef = useRef(0);
  // 障碍物图片（行走动画）
  const obstacleImagesRef = useRef<HTMLImageElement[]>([]);
  const obstacleImagesLoadedRef = useRef(false);
  // 障碍物尺寸（固定 38x43 px）
  const obstacleSizeRef = useRef<{ width: number; height: number }>({
    width: 38,
    height: 43,
  });
  
  // 游戏状态
  const gameState = useRef({
    dino: { x: 50, y: 106, width: 28, height: 44, velocityY: 0, isJumping: false },
    obstacles: [] as Array<{ x: number; y: number; width: number; height: number }>,
    groundY: 106,
    speed: 3,
    gravity: 0.4,
    jumpPower: -10,
    animationId: 0,
    lastObstacleX: 0, // 记录最后一个障碍物的位置
    minObstacleDistance: 300, // 障碍物之间的最小距离
    gameStartTime: 0, // 游戏开始时间
    lastScoreUpdate: 0, // 上次更新分数的时间
    animationFrameInterval: 12, // 动画帧切换间隔，初始12帧，随着难度增加而减少（动画更快）
  });

  // 加载图片
  useEffect(() => {
    // 主角行走动画
    const walkImages: HTMLImageElement[] = [];
    let walkLoadedCount = 0;
    
    const loadImage = (src: string, index: number) => {
      const img = new Image();
      img.onload = () => {
        walkLoadedCount++;
        if (walkLoadedCount === 3) {
          imagesLoadedRef.current = true;
        }
      };
      img.src = src;
      walkImages[index] = img;
    };
    
    loadImage(walk1Image, 0);
    loadImage(walk2Image, 1);
    loadImage(walk3Image, 2);
    
    walkImagesRef.current = walkImages;

    // 障碍物行走动画
    const obstacleImages: HTMLImageElement[] = [];
    let obstacleLoadedCount = 0;

    const loadObstacleImage = (src: string, index: number) => {
      const img = new Image();
      img.onload = () => {
        obstacleLoadedCount++;
        if (obstacleLoadedCount === 3) {
          obstacleImagesLoadedRef.current = true;
        }
      };
      img.src = src;
      obstacleImages[index] = img;
    };

    loadObstacleImage(obstacleWalk1, 0);
    loadObstacleImage(obstacleWalk2, 1);
    loadObstacleImage(obstacleWalk3, 2);

    obstacleImagesRef.current = obstacleImages;
  }, []);

  // 初始化游戏
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 设置画布尺寸
    canvas.width = 600;
    canvas.height = 200;

    const draw = () => {
      if (!ctx) return;

      // 清空画布
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 绘制背景
      ctx.fillStyle = '#F8F6FA';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 绘制地面
      ctx.fillStyle = '#E8F9F6';
      ctx.fillRect(
        0,
        gameState.current.groundY + gameState.current.dino.height,
        canvas.width,
        10
      );

      const state = gameState.current;

      // 绘制角色（使用图片）
      if (imagesLoadedRef.current && walkImagesRef.current.length === 3) {
        // 根据时间切换动画帧（使用动态帧间隔，随着难度增加而加快）
        // 跳跃时显示第一帧，行走时切换三帧
        const frameIndex = state.dino.isJumping 
          ? 0 
          : Math.floor(animationFrameRef.current / state.animationFrameInterval) % 3;
        const currentImage = walkImagesRef.current[frameIndex];
        if (currentImage && currentImage.complete) {
          ctx.drawImage(currentImage, state.dino.x, state.dino.y, state.dino.width, state.dino.height);
        }
      } else {
        // 如果图片未加载，显示占位矩形
      ctx.fillStyle = '#7B5B89';
      ctx.fillRect(state.dino.x, state.dino.y, state.dino.width, state.dino.height);
      }

      // 绘制障碍物（使用图片行走动画，如果未加载则回退为薄荷绿矩形）
      state.obstacles.forEach(obstacle => {
        if (obstacleImagesLoadedRef.current && obstacleImagesRef.current.length === 3) {
          const frameIndex =
            Math.floor(animationFrameRef.current / state.animationFrameInterval) % 3;
          const currentObstacleImage =
            obstacleImagesRef.current[frameIndex] ?? obstacleImagesRef.current[0];
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(
            currentObstacleImage,
            obstacle.x,
            obstacle.y,
            obstacle.width,
            obstacle.height
          );
        } else {
        ctx.fillStyle = '#6BD4C0';
        ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
        }
      });

      // 绘制分数（根据数字改变颜色）
      const scoreStr = score.toString();
      const hasSix = scoreStr.includes('6');
      const hasSeven = scoreStr.includes('7');
      const indexOfSix = scoreStr.indexOf('6');
      const indexOfSeven = scoreStr.indexOf('7');
      
      if (hasSix && hasSeven && indexOfSix < indexOfSeven) {
        // 6在7前面（如67、167）：粉色
        ctx.fillStyle = 'rgba(242, 182, 251, 0.9)';
      } else if (hasSix) {
        // 包含6：薄荷绿
        ctx.fillStyle = '#6BD4C0';
      } else if (hasSeven) {
        // 包含7：浅紫色
        ctx.fillStyle = '#9D8AB5';
      } else {
        // 都不包含：深紫色
        ctx.fillStyle = '#796384';
      }
      
      ctx.font = '20px "Source Sans 3"';
      ctx.fillText(`Score: ${score}`, 20, 30);

      if (gameOver) {
        // 游戏结束界面（去掉变暗效果）
        ctx.fillStyle = 'rgba(251, 182, 206, 0.9)'; // 浅粉色带透明度
        ctx.font = 'bold 32px "Source Sans 3"';
        ctx.textAlign = 'center';
        ctx.fillText(T.win, canvas.width / 2, canvas.height / 2 - 30);
        
        // 按下空格再试一次 - 深紫色
        ctx.fillStyle = '#7B5B89'; // 深紫色
        ctx.font = '18px "Source Sans 3"';
        ctx.fillText(T.retry, canvas.width / 2, canvas.height / 2 + 5);
        
        // 希斯克利夫加油～ - 小字细字薄荷绿
        ctx.fillStyle = '#6BD4C0'; // 薄荷绿
        ctx.font = '14px "Source Sans 3"';
        ctx.fillText(T.cheer, canvas.width / 2, canvas.height / 2 + 30);
        
        ctx.textAlign = 'left';
      } else if (!isPlaying) {
        ctx.fillStyle = '#7B5B89';
        ctx.font = '20px "Source Sans 3"';
        ctx.textAlign = 'center';
        ctx.fillText('Press SPACE to start', canvas.width / 2, canvas.height / 2);
        ctx.textAlign = 'left';
      }
    };

    const update = () => {
      if (!isPlaying || gameOver) {
        draw();
        return;
      }

      const state = gameState.current;

      // 更新角色（跳跃物理）
      if (state.dino.isJumping) {
        state.dino.velocityY += state.gravity;
        state.dino.y += state.dino.velocityY;

        if (state.dino.y >= state.groundY) {
          state.dino.y = state.groundY;
          state.dino.velocityY = 0;
          state.dino.isJumping = false;
        }
      }

      // 生成障碍物（提高生成频率，并确保有足够距离，游戏开始3秒后才生成）
      const timeSinceStart = Date.now() - state.gameStartTime;
      const shouldSpawn = isPlaying && 
                          timeSinceStart > 500 && // 游戏开始3秒后才生成障碍物
                          Math.random() < 0.01 && // 提高生成概率
                          (canvas.width - state.lastObstacleX) >= state.minObstacleDistance;
      
      if (shouldSpawn) {
        const obstacleWidth = obstacleSizeRef.current.width;
        const obstacleHeight = obstacleSizeRef.current.height;
        // 让障碍物底部与主角脚下的地面对齐
        const groundBottomY = state.groundY + state.dino.height;
        state.obstacles.push({
          x: canvas.width,
          y: groundBottomY - obstacleHeight,
          width: obstacleWidth,
          height: obstacleHeight,
        });
        state.lastObstacleX = canvas.width;
      }
      
      // 更新最后一个障碍物位置
      if (state.obstacles.length > 0) {
        const rightmostObstacle = state.obstacles.reduce((rightmost, obstacle) => 
          obstacle.x > rightmost.x ? obstacle : rightmost
        );
        state.lastObstacleX = rightmostObstacle.x;
      }

      // 更新障碍物
      state.obstacles = state.obstacles
        .map(obstacle => ({
          ...obstacle,
          x: obstacle.x - state.speed,
        }))
        .filter(obstacle => obstacle.x > -obstacle.width);
      
      // 更新动画帧（游戏进行中时持续更新）
      if (isPlaying) {
        animationFrameRef.current++;
      }

      // 碰撞检测（添加一些容差，避免过于敏感）
      state.obstacles.forEach(obstacle => {
        const dinoRight = state.dino.x + state.dino.width;
        const dinoBottom = state.dino.y + state.dino.height;
        const obstacleRight = obstacle.x + obstacle.width;
        const obstacleBottom = obstacle.y + obstacle.height;
        
        // 检查是否有重叠（添加5像素容差）
        if (
          state.dino.x < obstacleRight - 5 &&
          dinoRight > obstacle.x + 5 &&
          state.dino.y < obstacleBottom - 5 &&
          dinoBottom > obstacle.y + 5
        ) {
          setGameOver(true);
          setIsPlaying(false);
          // 结算：坚持的秒数就是分数
          if (score > 0 && hasRankApi()) submitScore(BOARD_DINO, encodeDino(score));
        }
      });

      // 更新分数（每秒增加1分）
      const now = Date.now();
      if (now - state.lastScoreUpdate >= 1000) { // 每1000毫秒（1秒）更新一次
        setScore(prev => {
          const newScore = prev + 1;
        // 增加难度（速度增长和动画加快）
        if (newScore % 6 === 0 && newScore > 0) {
          state.speed += 0.2;
          // 减少动画帧间隔，让行走动画更快（最小值为4，避免太快）
          // 每次减少0.3，让动画加快更慢一些
          if (state.animationFrameInterval > 4) {
            state.animationFrameInterval -= 0.3;
          }
        }
          return newScore;
        });
        state.lastScoreUpdate = now;
      }

      draw();
    };

    const gameLoop = () => {
      update();
      gameState.current.animationId = requestAnimationFrame(gameLoop);
    };

    gameLoop();

    return () => {
      cancelAnimationFrame(gameState.current.animationId);
    };
  }, [isPlaying, gameOver, score]);

  // 键盘控制
  const handleKeyPress = useCallback((e: KeyboardEvent) => {
    if (e.code === 'Space') {
      e.preventDefault();
      const state = gameState.current;

      if (gameOver) {
        // 重置游戏
        setGameOver(false);
        setScore(0);
        setIsPlaying(true);
        const now = Date.now();
        state.dino.y = state.groundY;
        state.dino.velocityY = 0;
        state.dino.isJumping = false;
        state.obstacles = [];
        state.speed = 3;
        state.animationFrameInterval = 12;
        state.lastObstacleX = 0;
        state.gameStartTime = now;
        state.lastScoreUpdate = now;
        animationFrameRef.current = 0;
      } else if (!isPlaying) {
        setIsPlaying(true);
        const now = Date.now();
        gameState.current.gameStartTime = now;
        gameState.current.lastScoreUpdate = now;
      } else if (!state.dino.isJumping) {
        // 跳跃
        state.dino.velocityY = state.jumpPower;
        state.dino.isJumping = true;
      }
    }
  }, [isPlaying, gameOver]);

  // 处理跳跃动作（用于按钮点击和触摸）
  const handleJump = useCallback(() => {
    const state = gameState.current;

    if (gameOver) {
      // 重置游戏
      setGameOver(false);
      setScore(0);
      setIsPlaying(true);
      const now = Date.now();
      state.dino.y = state.groundY;
      state.dino.velocityY = 0;
      state.dino.isJumping = false;
      state.obstacles = [];
      state.speed = 2.5;
        state.animationFrameInterval = 12;
      state.lastObstacleX = 0;
      state.gameStartTime = now;
      state.lastScoreUpdate = now;
        animationFrameRef.current = 0;
    } else if (!isPlaying) {
      setIsPlaying(true);
      const now = Date.now();
      gameState.current.gameStartTime = now;
      gameState.current.lastScoreUpdate = now;
    } else if (!state.dino.isJumping) {
      // 跳跃
      state.dino.velocityY = state.jumpPower;
      state.dino.isJumping = true;
    }
  }, [isPlaying, gameOver]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  return (
    <div className="fixed inset-0 bg-[#2D2438]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#FDFCFA] rounded-[2rem] shadow-[0_25px_50px_-12px_rgba(45,58,49,0.2)] border border-[#EAE5F0] p-6 max-w-2xl w-full animate-float-in">
        <div className="flex justify-end items-center gap-1 mb-4">
          <button
            onClick={() => setShowRank(true)}
            className="p-2 hover:bg-[#E8F9F6] rounded-full transition-colors duration-300"
            aria-label={T.rank}
          >
            <Trophy size={22} strokeWidth={1.5} className="text-[#7B5B89]" />
          </button>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#E8F9F6] rounded-full transition-colors duration-300"
            aria-label="Close game"
          >
            <X size={22} strokeWidth={1.5} className="text-[#7B5B89]" />
          </button>
        </div>
        <div className="bg-[#F8F6FA] rounded-3xl p-4 border border-[#E8F9F6]"
          onPointerDown={handleJump}
          style={{ touchAction: 'manipulation' }}>
          <canvas
            ref={canvasRef}
            className="w-full h-auto border border-[#D4F4EC] rounded-2xl"
            style={{ maxHeight: '400px' }}
          />
        </div>
        {/* 移动端跳跃按钮 */}
        <button
          onClick={handleJump}
          className="md:hidden w-full mt-4 py-4 bg-[#E8E0ED] hover:bg-[#9D8AB5] active:bg-[#7B5B89] text-[#7B5B89] hover:text-white rounded-full font-semibold text-sm uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 shadow-[0_10px_15px_-3px_rgba(123,91,137,0.15)] active:scale-95"
        >
          <ArrowUp size={20} strokeWidth={1.5} />
          <span>{T.jump}</span>
        </button>
        <div className="mt-4 text-sm text-gray-500 text-center">
          <p className="hidden md:block">{T.hintDesktopPre}<kbd className="px-2 py-1 bg-[#E8F9F6] rounded-full text-[#7B5B89]">{T.hintDesktopKey}</kbd>{T.hintDesktopPost}</p>
          <p className="md:hidden">{T.hintMobile}</p>
        </div>
      </div>

      {showRank && (
        <Leaderboard
          board={BOARD_DINO}
          lang={lang}
          title={T.rank}
          theme={DINO_THEME}
          renderScore={(score, l) => (
            <span className="font-mono text-[12px] font-bold text-[#7B5B89]">
              {decodeDino(score)}{l === 'en' ? 's' : '秒'}
            </span>
          )}
          onClose={() => setShowRank(false)}
        />
      )}
    </div>
  );
};

export default Game;

