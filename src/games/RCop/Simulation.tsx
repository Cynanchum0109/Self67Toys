import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';

interface SimulationProps {
  onClose: () => void;
  lang?: 'zh' | 'en';
}

// 界面文案（英文为草译，待审校 → translations-review.md）
const UI_TEXT = {
  zh: {
    title: 'R公司孵化场观测',
    start: '开始观测',
    reclone: '重新克隆',
    pause: '暂停',
    resume: '继续',
    hint: '点击场地投放药物',
    statReindeer: 'Reindeer驯鹿',
    statRabbit: 'Rabbit兔子',
    statPower: '战力',
  },
  en: {
    title: 'R Corp Hatchery Observation',
    start: 'Begin Observation',
    reclone: 'Re-clone',
    pause: 'Pause',
    resume: 'Resume',
    hint: 'Click the field to drop drugs',
    statReindeer: 'Reindeer',
    statRabbit: 'Rabbit',
    statPower: 'Power',
  },
};

// 结局文案（英文为草译，待审校）
const ENDING_TEXTS: Record<string, { zh: { pre: string; title: string }; en: { pre: string; title: string } }> = {
  escape: {
    zh: {
      pre: '“……我们开了一间小事务所。他还会头疼，我的手也时不时颤抖。我们仍从噩梦中惊醒，然后共享一个夜晚。生活就是这样开始的。”',
      title: '逃 脱',
    },
    en: {
      pre: '“…We opened a small office. He still gets headaches; my hands still tremble now and then. We still wake from nightmares — and then we share the night. That is how life begins.”',
      title: 'ESCAPE',
    },
  },
  survive: {
    zh: {
      pre: '“两人同行总会好些。\n  如果我们无法前进，\n  就让我们死在途中。\n  让我们死在一起。”',
      title: '存 活',
    },
    en: {
      pre: '“It is always better, two together.\n  If we cannot go on,\n  let us die on the way.\n  Let us die together.”',
      title: 'SURVIVE',
    },
  },
  rabbit_kills_reindeer: {
    zh: {
      pre: '“你可要痛快咬住我的脖子。\n 红血滴落。\n草脏了，天近了。两颗眼珠上映现出彩虹。\n我淡笑着，死了。\n我一直等候着呢，这一刻。”',
      title: '兔子 击杀 驯鹿',
    },
    en: {
      pre: '“Bite deep into my neck, and make it clean.\n Red blood drips down.\nThe grass is stained; the sky draws near. Rainbows shimmer in two eyes.\nSmiling faintly, I died.\nI have been waiting for it — this very moment.”',
      title: 'Rabbit Slays Reindeer',
    },
  },
  reindeer_kills_rabbit: {
    zh: {
      pre: '“哈，我输了，你征服了我。我就把自己给你。\n摄食我吧，我们当合为一体。\n你要问我："这是最后的挣扎？假意屈服的计谋？"\n我回答："吃吧，你早已涎水直流了。"”',
      title: '驯鹿 击杀 兔子',
    },
    en: {
      pre: '“Ha — I lost; you have conquered me. Then I give myself to you.\nDevour me, and let us become one flesh.\nYou will ask: "A final struggle? A ruse of feigned surrender?"\nI answer: "Eat. Your mouth has long been watering."”',
      title: 'Reindeer Slays Rabbit',
    },
  },
  rabbit_survives: {
    zh: {
      pre: '“我们既不想预见结局，\n  又不能一起生存，——\n  哪怕是无休无止的爱，\n  哪怕是报以整个身心的恨。”',
      title: '兔子 存活',
    },
    en: {
      pre: '“We neither wish to foresee the ending,\n  nor can we live as one —\n  be it a love that knows no end,\n  be it a hatred of the whole body and soul.”',
      title: 'Rabbit Survives',
    },
  },
  reindeer_survives: {
    zh: {
      pre: '“世间仍存在的幸福——\n    被所爱杀死。\n  谁怀着一个疲惫的灵魂，\n  闪烁着半疯半醒的幻想？——\n    你，还是我？”',
      title: '驯鹿 存活',
    },
    en: {
      pre: '“There is still one happiness left in this world —\n    to be killed by the one you love.\n  Who bears a weary soul,\n  flickering with visions half-mad, half-waking? —\n    You, or I?”',
      title: 'Reindeer Survives',
    },
  },
};

// 结局展示元数据：标题颜色、覆盖层底色、是否带血色渲染
const ENDING_META: Record<string, { color: string; backdrop: string; blood?: boolean }> = {
  escape: {
    color: '#E8833A',
    backdrop: 'radial-gradient(ellipse at center, rgba(255,251,246,0.96) 55%, rgba(232,131,58,0.18) 100%)',
  },
  survive: {
    color: '#D9A02B',
    backdrop: 'radial-gradient(ellipse at center, rgba(255,251,246,0.96) 55%, rgba(217,160,43,0.16) 100%)',
  },
  reindeer_kills_rabbit: {
    color: '#2FA38C',
    backdrop: 'radial-gradient(ellipse at center, rgba(253,250,250,0.95) 50%, rgba(178,34,34,0.22) 100%)',
    blood: true,
  },
  rabbit_kills_reindeer: {
    color: '#7C55B0',
    backdrop: 'radial-gradient(ellipse at center, rgba(253,250,250,0.95) 50%, rgba(178,34,34,0.22) 100%)',
    blood: true,
  },
  reindeer_survives: {
    color: '#1F6B58',
    backdrop: 'radial-gradient(ellipse at center, rgba(252,249,249,0.95) 45%, rgba(139,26,26,0.28) 100%)',
    blood: true,
  },
  rabbit_survives: {
    color: '#553380',
    backdrop: 'radial-gradient(ellipse at center, rgba(252,249,249,0.95) 45%, rgba(139,26,26,0.28) 100%)',
    blood: true,
  },
};
const DEFAULT_ENDING_META: { color: string; backdrop: string; blood?: boolean } = {
  color: '#E8833A',
  backdrop: 'rgba(255,251,246,0.95)',
};

interface Agent {
  id: number;
  x: number;
  y: number;
  team: 0 | 1; // 0: Reindeer驯鹿(绿色), 1: Rabbit兔子(紫色)
  power: number;
  velocityX: number;
  velocityY: number;
  protected: boolean; // 终局保护
  truceUntil: number; // 停战时间戳
  wanderTargetX?: number; // 探索目标点X
  wanderTargetY?: number; // 探索目标点Y
  lastWanderChange?: number; // 上次改变探索方向的时间
  lastHeartEffectTime?: number; // 上次触发爱心特效的时间
}

interface PinkMistEffect {
  x: number;
  y: number;
  time: number;
  radius: number;
}

interface HeartEffect {
  x: number;
  y: number;
  time: number;
  scale: number;
}

interface DrugPoint {
  id: number;
  x: number;
  y: number;
  radius: number;
  ttl: number; // 剩余时间（毫秒）
  createdAt: number;
}

const Simulation: React.FC<SimulationProps> = ({ onClose, lang = 'zh' }) => {
  const T = UI_TEXT[lang];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const pausedRef = useRef(false);
  const speedRef = useRef(1);
  const [gameEnded, setGameEnded] = useState(false);
  const [ending, setEnding] = useState<string | null>(null);
  const finalBattleRef = useRef<{ a0: Agent | null; a1: Agent | null; started: boolean }>({ a0: null, a1: null, started: false });
  const gameEndedRef = useRef(false);
  // 碰撞后延迟结算，给观众留出反应时间
  const clashRef = useRef<{ at: number; ending: string } | null>(null);
  const CLASH_DELAY = 1200; // 碰撞特效停留时间（毫秒）
  // 配对羁绊：记录每一对agent之间发生过多少次互相增强（按相遇次数去重，不按帧数）
  const pairBondRef = useRef<Map<string, { count: number; last: number }>>(new Map());
  const BOND_ENCOUNTER_GAP = 1000; // 同一对1秒内的连续增强只算一次相遇
  const BOND_ESCAPE_COUNT = 3; // 羁绊达到3次相遇，终局中间档升格为逃脱

  const agentsRef = useRef<Agent[]>([]);
  const drugPointsRef = useRef<DrugPoint[]>([]);
  const animationFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const isRunningRef = useRef<boolean>(false);
  const darkeningEffectsRef = useRef<Array<{ x: number; y: number; time: number }>>([]);
  const pinkMistEffectsRef = useRef<PinkMistEffect[]>([]);
  const heartEffectsRef = useRef<HeartEffect[]>([]);
  const lastEncounterTimeRef = useRef<number>(0);
  const arenaBoundsRef = useRef({ left: 0, right: 1200, top: 0, bottom: 800 });

  const CANVAS_WIDTH = 1200;
  const CANVAS_HEIGHT = 800;
  const AGENT_SIZE = 4;
  const INITIAL_AGENTS_PER_TEAM = 200;
  const DRUG_RADIUS = 50;
  const DRUG_TTL = 5000; // 5秒（减短）
  const DRUG_ATTRACTION_RADIUS = 500; // 药物吸引范围（大范围，增加到500像素）
  const TRUCE_DURATION = 2000; // 2秒
  const SENSE_RADIUS = 100;
  const REINDEER_MAX_SPEED = 2; // 驯鹿速度
  const RABBIT_MAX_SPEED = 3; // 兔子速度更快
  const REINDEER_AGGRESSIVENESS = 0.3; // 驯鹿攻击性阈值
  const RABBIT_AGGRESSIVENESS = 0.25; // 兔子攻击性阈值（降低攻击欲望）
  const POWER_GAIN_ON_DRUG = 5;
  const POWER_GAIN_ON_CROSS_TEAM = 3;
  const POWER_GAIN_ON_CROSS_TEAM_REINDEER = 4; // 驯鹿队跨队增强加成
  const CROSS_TEAM_GROWTH_THRESHOLD = 0.5; // 跨队共同增强的阈值（提高阈值，让更多异队碰撞触发共同增强）
  const HEART_EFFECT_COOLDOWN = 500; // 爱心特效冷却时间（0.5秒）
  const NO_ENCOUNTER_TIME = 5000; // 5秒没有相遇开始缩圈（缩短）
  const SHRINK_RATE = 10; // 每秒缩小10像素（更快）
  const FINAL_BOOST_DIFF = 0.1; // 小差距：逃脱（增强）
  const FINAL_MID_DIFF = 0.35;   // 中差距：中间范畴
  
  // 统一的结束函数（防止覆盖）；文案由 ENDING_TEXTS 按语言渲染
  const endGame = (endingKey: string) => {
    if (gameEndedRef.current) return;
    gameEndedRef.current = true;
    setEnding(endingKey);
    setGameEnded(true);
    isRunningRef.current = false;
    setIsRunning(false);
    finalBattleRef.current = { a0: null, a1: null, started: false };
  };

  // 记录一次跨队互相增强的羁绊（1秒内重复触发只算一次相遇）
  const recordBond = (idA: number, idB: number, now: number) => {
    const key = idA < idB ? `${idA}-${idB}` : `${idB}-${idA}`;
    const entry = pairBondRef.current.get(key);
    if (!entry) {
      pairBondRef.current.set(key, { count: 1, last: now });
    } else if (now - entry.last >= BOND_ENCOUNTER_GAP) {
      entry.count += 1;
      entry.last = now;
    } else {
      entry.last = now;
    }
  };

  const getBondCount = (idA: number, idB: number) => {
    const key = idA < idB ? `${idA}-${idB}` : `${idB}-${idA}`;
    return pairBondRef.current.get(key)?.count ?? 0;
  };

  // 初始化agents
  const initializeAgents = () => {
    const agents: Agent[] = [];
    const now = Date.now();
    
    // Reindeer驯鹿队（左侧，绿色）
    for (let i = 0; i < INITIAL_AGENTS_PER_TEAM; i++) {
      const x = Math.random() * (CANVAS_WIDTH * 0.3) + 50;
      const y = Math.random() * (CANVAS_HEIGHT - 100) + 50;
      agents.push({
        id: i,
        x,
        y,
        team: 0,
        power: 1.5 + Math.random() * 2.5, // 驯鹿初始战力稍高
        velocityX: 0,
        velocityY: 0,
        protected: false,
        truceUntil: 0,
        wanderTargetX: x + (Math.random() - 0.5) * 200, // 初始探索目标
        wanderTargetY: y + (Math.random() - 0.5) * 200,
        lastWanderChange: now
      });
    }
    
    // Rabbit兔子队（右侧，紫色）
    for (let i = 0; i < INITIAL_AGENTS_PER_TEAM; i++) {
      const x = Math.random() * (CANVAS_WIDTH * 0.3) + CANVAS_WIDTH * 0.7 - 50;
      const y = Math.random() * (CANVAS_HEIGHT - 100) + 50;
      agents.push({
        id: INITIAL_AGENTS_PER_TEAM + i,
        x,
        y,
        team: 1,
        power: 1 + Math.random() * 2,
        velocityX: 0,
        velocityY: 0,
        protected: false,
        truceUntil: 0,
        wanderTargetX: x + (Math.random() - 0.5) * 200,
        wanderTargetY: y + (Math.random() - 0.5) * 200,
        lastWanderChange: now
      });
    }
    
    agentsRef.current = agents;
    lastEncounterTimeRef.current = Date.now();
    arenaBoundsRef.current = { left: 0, right: CANVAS_WIDTH, top: 0, bottom: CANVAS_HEIGHT };
  };

  // 计算距离
  const distance = (x1: number, y1: number, x2: number, y2: number) => {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  };

  // 查找最近的药物（大范围吸引）
  const findNearestDrug = (agent: Agent): DrugPoint | null => {
    let nearest: DrugPoint | null = null;
    let minDist = Infinity;
    
    drugPointsRef.current.forEach(drug => {
      const dist = distance(agent.x, agent.y, drug.x, drug.y);
      if (dist < DRUG_ATTRACTION_RADIUS && dist < minDist) {
        minDist = dist;
        nearest = drug;
      }
    });
    
    return nearest;
  };

  // 查找附近的敌人/盟友
  const findNearbyAgents = (agent: Agent, radius: number = SENSE_RADIUS) => {
    return agentsRef.current.filter(a => {
      if (a.id === agent.id) return false;
      return distance(agent.x, agent.y, a.x, a.y) < radius;
    });
  };

  // 更新agent移动
  const updateAgentMovement = (agent: Agent, deltaTime: number) => {
    // 如果正在进行终局战斗，且这个agent是参与者，不执行正常移动逻辑
    if (finalBattleRef.current.started && !gameEnded) {
      const battle = finalBattleRef.current;
      if (battle.a0 && battle.a1 && (agent.id === battle.a0.id || agent.id === battle.a1.id)) {
        return; // 终局战斗由processFinalBattle处理
      }
    }
    
    const now = Date.now();
    const maxSpeed = agent.team === 0 ? REINDEER_MAX_SPEED : RABBIT_MAX_SPEED;
    const aggressiveness = agent.team === 0 ? REINDEER_AGGRESSIVENESS : RABBIT_AGGRESSIVENESS;
    
    // 检查药物（最高优先级，大范围吸引）
    const nearestDrug = findNearestDrug(agent);
    if (nearestDrug) {
      const dx = nearestDrug.x - agent.x;
      const dy = nearestDrug.y - agent.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0) {
        agent.velocityX = (dx / dist) * maxSpeed;
        agent.velocityY = (dy / dist) * maxSpeed;
      }
      // 不要return，继续执行位置更新
    } else {
      // 战斗/躲避逻辑
      const nearby = findNearbyAgents(agent);
      let targetAgent: Agent | null = null;
      let isPursuing = false;
      
      nearby.forEach(other => {
        if (now < agent.truceUntil && other.team !== agent.team) return; // 停战期间
        
        const powerDiff = (other.power - agent.power) / Math.max(agent.power, other.power);
        
        if (other.team !== agent.team) {
          // 跨队
          if (powerDiff > aggressiveness) {
            // 敌人更强，躲避
            targetAgent = other;
            isPursuing = false;
          } else if (powerDiff < -aggressiveness) {
            // 我更强，追击
            targetAgent = other;
            isPursuing = true;
          }
        } else {
          // 同队
          if (powerDiff > aggressiveness) {
            // 队友更强，可能被杀，躲避
            targetAgent = other;
            isPursuing = false;
          } else if (powerDiff < -aggressiveness) {
            // 我更强，可能杀队友
            targetAgent = other;
            isPursuing = true;
          }
        }
      });
      
      if (targetAgent) {
        const dx = targetAgent.x - agent.x;
        const dy = targetAgent.y - agent.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
          if (isPursuing) {
            agent.velocityX = (dx / dist) * maxSpeed;
            agent.velocityY = (dy / dist) * maxSpeed;
          } else {
            agent.velocityX = -(dx / dist) * maxSpeed;
            agent.velocityY = -(dy / dist) * maxSpeed;
          }
        }
      } else {
        // 随机游走 - 使用探索目标点系统，避免频繁切换方向
        const bounds = arenaBoundsRef.current;
        const now = Date.now();
        
        // 确保有探索目标点
        if (!agent.wanderTargetX || !agent.wanderTargetY) {
          agent.wanderTargetX = agent.x + (Math.random() - 0.5) * 300;
          agent.wanderTargetY = agent.y + (Math.random() - 0.5) * 300;
          agent.lastWanderChange = now;
        }
        
        // 计算到目标点的距离
        const dx = agent.wanderTargetX - agent.x;
        const dy = agent.wanderTargetY - agent.y;
        const distToTarget = Math.sqrt(dx * dx + dy * dy);
        
        // 如果到达目标点附近（30像素内）或超过3秒，选择新目标
        const timeSinceLastChange = now - (agent.lastWanderChange || 0);
        const shouldChangeTarget = distToTarget < 30 || timeSinceLastChange > 3000;
        
        if (shouldChangeTarget) {
          // 选择新的探索目标点（在边界内）
          const angle = Math.random() * Math.PI * 2;
          const targetDistance = 150 + Math.random() * 200; // 150-350像素距离
          agent.wanderTargetX = Math.max(
            bounds.left + 50,
            Math.min(bounds.right - 50, agent.x + Math.cos(angle) * targetDistance)
          );
          agent.wanderTargetY = Math.max(
            bounds.top + 50,
            Math.min(bounds.bottom - 50, agent.y + Math.sin(angle) * targetDistance)
          );
          agent.lastWanderChange = now;
        }
        
        // 朝向目标点移动
        if (distToTarget > 0) {
          const targetSpeed = maxSpeed * 0.6; // 探索时使用60%速度，保持稳定
          agent.velocityX = (dx / distToTarget) * targetSpeed;
          agent.velocityY = (dy / distToTarget) * targetSpeed;
        } else {
          // 如果已经在目标点，给一个小的随机速度
          const angle = Math.random() * Math.PI * 2;
          agent.velocityX = Math.cos(angle) * maxSpeed * 0.3;
          agent.velocityY = Math.sin(angle) * maxSpeed * 0.3;
        }
      }
    }
    
    // 更新位置（所有情况都会执行到这里）
    agent.x += agent.velocityX;
    agent.y += agent.velocityY;
    
    // 边界检查（使用动态边界）
    const bounds = arenaBoundsRef.current;
    agent.x = Math.max(bounds.left + AGENT_SIZE, Math.min(bounds.right - AGENT_SIZE, agent.x));
    agent.y = Math.max(bounds.top + AGENT_SIZE, Math.min(bounds.bottom - AGENT_SIZE, agent.y));
  };

  // 处理药物交互
  const processDrugInteractions = () => {
    const now = Date.now();
    const drugsToRemove: number[] = [];
    
    drugPointsRef.current.forEach(drug => {
      const agentsInRadius = agentsRef.current.filter(agent => {
        return distance(agent.x, agent.y, drug.x, drug.y) < drug.radius;
      });
      
      if (agentsInRadius.length === 0) return;
      
      const teamsInRadius = new Set(agentsInRadius.map(a => a.team));
      
      if (teamsInRadius.size === 2) {
        // 两队都在 - 明显的粉色烟雾和爱心特效
        const randomAgent = agentsInRadius[Math.floor(Math.random() * agentsInRadius.length)];
        agentsInRadius.forEach(agent => {
          agent.power += POWER_GAIN_ON_DRUG;
          agent.truceUntil = now + TRUCE_DURATION;
        });
        agentsInRadius.forEach(agent => {
          // 检查爱心特效冷却时间
          const canTriggerHeart = !agent.lastHeartEffectTime || (now - agent.lastHeartEffectTime) >= HEART_EFFECT_COOLDOWN;
          if (canTriggerHeart) {
            // 爱心特效固定在原位置，不跟随agent移动
            const heartX = agent.x;
            const heartY = agent.y;
            pinkMistEffectsRef.current.push({ x: heartX, y: heartY, time: now, radius: 0 });
            heartEffectsRef.current.push({ x: heartX, y: heartY, time: now, scale: 0 });
            agent.lastHeartEffectTime = now; // 更新冷却时间
          } else {
            // 即使不能触发爱心，也要添加粉色烟雾
            const heartX = agent.x;
            const heartY = agent.y;
            pinkMistEffectsRef.current.push({ x: heartX, y: heartY, time: now, radius: 0 });
          }
        });
        // 在药物位置也添加特效
        pinkMistEffectsRef.current.push({ x: drug.x, y: drug.y, time: now, radius: 0 });
        heartEffectsRef.current.push({ x: drug.x, y: drug.y, time: now, scale: 0 });
        drugsToRemove.push(drug.id);
        lastEncounterTimeRef.current = now; // 更新相遇时间
      } else if (now - drug.createdAt >= drug.ttl) {
        // 药物过期（受保护的agent不会被杀死）
        agentsInRadius.forEach(agent => {
          if (!agent.protected) {
            agentsRef.current = agentsRef.current.filter(a => a.id !== agent.id);
            darkeningEffectsRef.current.push({ x: agent.x, y: agent.y, time: now });
          }
        });
        drugsToRemove.push(drug.id);
      }
    });
    
    drugPointsRef.current = drugPointsRef.current.filter(d => !drugsToRemove.includes(d.id));
  };

  // 处理agent交互
  const processAgentInteractions = () => {
    // 终局1v1战斗已开始时，跳过所有普通交互，避免干扰processFinalBattle的碰撞结算
    if (finalBattleRef.current.started) return;

    const now = Date.now();
    const agentsToRemove: number[] = [];
    let hasEncounter = false;

    agentsRef.current.forEach(agent => {
      if (agentsToRemove.includes(agent.id)) return;
      
      const nearby = findNearbyAgents(agent, AGENT_SIZE * 3);
      
      nearby.forEach(other => {
        if (agentsToRemove.includes(other.id)) return;
        if (now < agent.truceUntil && other.team !== agent.team) return;
        
        const aggressiveness = agent.team === 0 ? REINDEER_AGGRESSIVENESS : RABBIT_AGGRESSIVENESS;
        const powerDiff = (other.power - agent.power) / Math.max(agent.power, other.power);
        
        if (agent.team === other.team) {
          // 同队：根据战力差距和aggressiveness决定是否击杀
          // 注意：受保护对象不会遇到同队（因为保护时该队只剩1个）
          if (Math.abs(powerDiff) > 0.001) { // 避免浮点数误差
            // 如果战力差距大于aggressiveness，直接击杀
            // 如果战力差距小于等于aggressiveness，20%概率击杀
            const shouldKill = Math.abs(powerDiff) > aggressiveness || Math.random() < 0.2;
            
            if (shouldKill) {
            if (powerDiff > 0) {
                // other更强，杀agent
                // 如果是驯鹿击杀，获得更多战力加成
                const killBonus = other.team === 0 ? 0.65 : 0.5;
                other.power += agent.power * killBonus;
                agentsToRemove.push(agent.id);
                darkeningEffectsRef.current.push({ x: agent.x, y: agent.y, time: now });
            } else {
                // agent更强，杀other
                // 如果是驯鹿击杀，获得更多战力加成
                const killBonus = agent.team === 0 ? 0.65 : 0.5;
                agent.power += other.power * killBonus;
                agentsToRemove.push(other.id);
                darkeningEffectsRef.current.push({ x: other.x, y: other.y, time: now });
              }
            }
          }
        } else {
          // 跨队相遇
          hasEncounter = true;
          // 异队：只在战力差距 > aggressiveness 时击杀，否则共同增强
          if (Math.abs(powerDiff) > aggressiveness) {
            if (powerDiff > 0) {
              // other更强，杀agent（但受保护的agent不会被击杀，改为共同增强）
              if (!agent.protected) {
                // 如果是驯鹿击杀，获得更多战力加成
                const killBonus = other.team === 0 ? 0.65 : 0.5;
                other.power += agent.power * killBonus;
                agentsToRemove.push(agent.id);
                darkeningEffectsRef.current.push({ x: agent.x, y: agent.y, time: now });
              } else {
                // 受保护的agent遇到击杀情况，改为共同增强
                agent.power += agent.team === 0 ? POWER_GAIN_ON_CROSS_TEAM_REINDEER : POWER_GAIN_ON_CROSS_TEAM;
                other.power += other.team === 0 ? POWER_GAIN_ON_CROSS_TEAM_REINDEER : POWER_GAIN_ON_CROSS_TEAM;
                recordBond(agent.id, other.id, now);
                const agentCanTriggerHeart = !agent.lastHeartEffectTime || (now - agent.lastHeartEffectTime) >= HEART_EFFECT_COOLDOWN;
                const otherCanTriggerHeart = !other.lastHeartEffectTime || (now - other.lastHeartEffectTime) >= HEART_EFFECT_COOLDOWN;
                const heartX = agent.x;
                const heartY = agent.y;
                const otherHeartX = other.x;
                const otherHeartY = other.y;
                pinkMistEffectsRef.current.push({ x: heartX, y: heartY, time: now, radius: 0 });
                pinkMistEffectsRef.current.push({ x: otherHeartX, y: otherHeartY, time: now, radius: 0 });
                if (agentCanTriggerHeart) {
                  heartEffectsRef.current.push({ x: heartX, y: heartY, time: now, scale: 0 });
                  agent.lastHeartEffectTime = now;
                }
                if (otherCanTriggerHeart) {
                  heartEffectsRef.current.push({ x: otherHeartX, y: otherHeartY, time: now, scale: 0 });
                  other.lastHeartEffectTime = now;
                }
              }
            } else {
              // agent更强，杀other（但受保护的other不会被击杀，改为共同增强）
              if (!other.protected) {
                // 如果是驯鹿击杀，获得更多战力加成
                const killBonus = agent.team === 0 ? 0.65 : 0.5;
                agent.power += other.power * killBonus;
                agentsToRemove.push(other.id);
                darkeningEffectsRef.current.push({ x: other.x, y: other.y, time: now });
              } else {
                // 受保护的other遇到击杀情况，改为共同增强
                agent.power += agent.team === 0 ? POWER_GAIN_ON_CROSS_TEAM_REINDEER : POWER_GAIN_ON_CROSS_TEAM;
                other.power += other.team === 0 ? POWER_GAIN_ON_CROSS_TEAM_REINDEER : POWER_GAIN_ON_CROSS_TEAM;
                recordBond(agent.id, other.id, now);
                const agentCanTriggerHeart = !agent.lastHeartEffectTime || (now - agent.lastHeartEffectTime) >= HEART_EFFECT_COOLDOWN;
                const otherCanTriggerHeart = !other.lastHeartEffectTime || (now - other.lastHeartEffectTime) >= HEART_EFFECT_COOLDOWN;
                const heartX = agent.x;
                const heartY = agent.y;
                const otherHeartX = other.x;
                const otherHeartY = other.y;
                pinkMistEffectsRef.current.push({ x: heartX, y: heartY, time: now, radius: 0 });
                pinkMistEffectsRef.current.push({ x: otherHeartX, y: otherHeartY, time: now, radius: 0 });
                if (agentCanTriggerHeart) {
                  heartEffectsRef.current.push({ x: heartX, y: heartY, time: now, scale: 0 });
                  agent.lastHeartEffectTime = now;
                }
                if (otherCanTriggerHeart) {
                  heartEffectsRef.current.push({ x: otherHeartX, y: otherHeartY, time: now, scale: 0 });
                  other.lastHeartEffectTime = now;
                }
              }
            }
          } else {
            // 战力差距 <= aggressiveness，触发共同增强（提高阈值让更多情况触发）
            // 只要在阈值内就触发共同增强，不需要再检查 CROSS_TEAM_GROWTH_THRESHOLD
            if (Math.abs(powerDiff) <= CROSS_TEAM_GROWTH_THRESHOLD) {
            // 力量相近（使用扩大的阈值），都增长
              agent.power += agent.team === 0 ? POWER_GAIN_ON_CROSS_TEAM_REINDEER : POWER_GAIN_ON_CROSS_TEAM;
              other.power += other.team === 0 ? POWER_GAIN_ON_CROSS_TEAM_REINDEER : POWER_GAIN_ON_CROSS_TEAM;
              recordBond(agent.id, other.id, now);
            
            // 检查爱心特效冷却时间
            const agentCanTriggerHeart = !agent.lastHeartEffectTime || (now - agent.lastHeartEffectTime) >= HEART_EFFECT_COOLDOWN;
            const otherCanTriggerHeart = !other.lastHeartEffectTime || (now - other.lastHeartEffectTime) >= HEART_EFFECT_COOLDOWN;
            
            // 爱心特效固定在原位置，不跟随agent移动
            const heartX = agent.x;
            const heartY = agent.y;
            const otherHeartX = other.x;
            const otherHeartY = other.y;
            
            pinkMistEffectsRef.current.push({ x: heartX, y: heartY, time: now, radius: 0 });
            pinkMistEffectsRef.current.push({ x: otherHeartX, y: otherHeartY, time: now, radius: 0 });
            
            if (agentCanTriggerHeart) {
              heartEffectsRef.current.push({ x: heartX, y: heartY, time: now, scale: 0 });
              agent.lastHeartEffectTime = now; // 更新冷却时间
            }
            if (otherCanTriggerHeart) {
              heartEffectsRef.current.push({ x: otherHeartX, y: otherHeartY, time: now, scale: 0 });
              other.lastHeartEffectTime = now; // 更新冷却时间
              }
            }
          }
        }
      });
    });
    
    if (hasEncounter) {
      lastEncounterTimeRef.current = now;
    }
    
    agentsRef.current = agentsRef.current.filter(a => !agentsToRemove.includes(a.id));
  };
  
  
  // 处理缩圈
  const processArenaShrink = (deltaTime: number) => {
    const now = Date.now();
    const timeSinceLastEncounter = now - lastEncounterTimeRef.current;
    
    if (timeSinceLastEncounter > NO_ENCOUNTER_TIME) {
      const shrinkAmount = (SHRINK_RATE * deltaTime) / 1000;
      const bounds = arenaBoundsRef.current;
      const MIN_SIZE = 200;

      // 两轴独立收缩，到达最小尺寸即停在原位，避免跳变
      if (bounds.right - bounds.left - shrinkAmount * 2 >= MIN_SIZE) {
        bounds.left += shrinkAmount;
        bounds.right -= shrinkAmount;
      } else {
        const centerX = (bounds.left + bounds.right) / 2;
        bounds.left = centerX - MIN_SIZE / 2;
        bounds.right = centerX + MIN_SIZE / 2;
      }
      if (bounds.bottom - bounds.top - shrinkAmount * 2 >= MIN_SIZE) {
        bounds.top += shrinkAmount;
        bounds.bottom -= shrinkAmount;
      } else {
        const centerY = (bounds.top + bounds.bottom) / 2;
        bounds.top = centerY - MIN_SIZE / 2;
        bounds.bottom = centerY + MIN_SIZE / 2;
      }
      
      // 将超出边界的agents移回
      agentsRef.current.forEach(agent => {
        agent.x = Math.max(bounds.left + AGENT_SIZE, Math.min(bounds.right - AGENT_SIZE, agent.x));
        agent.y = Math.max(bounds.top + AGENT_SIZE, Math.min(bounds.bottom - AGENT_SIZE, agent.y));
      });
    }
  };

  // 溅血特效：击杀点主血渍 + 附近一两处飞溅
  const spawnBloodSplash = (x: number, y: number, now: number) => {
    darkeningEffectsRef.current.push({ x, y, time: now });
    for (let i = 0; i < 2; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 10 + Math.random() * 14;
      darkeningEffectsRef.current.push({
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        time: now + 80 + Math.random() * 150,
      });
    }
  };

  // 处理终局战斗（两个agent慢速对峙靠近，碰撞后延迟结算）
  const processFinalBattle = (a0: Agent, a1: Agent) => {
    if (gameEndedRef.current || clashRef.current) return;

    const dx0 = a1.x - a0.x;
    const dy0 = a1.y - a0.y;
    const dist0 = Math.sqrt(dx0 * dx0 + dy0 * dy0);
    const collisionDistance = AGENT_SIZE * 2;
    // 对峙开始时减速到60%，随着距离拉近逐渐恢复原速
    const baseSpeed = Math.max(REINDEER_MAX_SPEED, RABBIT_MAX_SPEED);
    const speedFactor = 0.6 + 0.4 * (1 - Math.min(dist0, 400) / 400);
    const maxSpeed = baseSpeed * speedFactor;
    const relativeSpeed = maxSpeed * 2;

    // 碰撞：记录结局，特效停留 CLASH_DELAY 后再结算（四结局）
    if (dist0 <= collisionDistance + relativeSpeed) {
      const midX = (a0.x + a1.x) / 2;
      const midY = (a0.y + a1.y) / 2;
      const now = Date.now();

      const powerDiff = (a1.power - a0.power) / Math.max(a0.power, a1.power);
      const d = Math.abs(powerDiff);
      const bond = getBondCount(a0.id, a1.id);
      // 调参观测：终局碰撞时的战力差与羁绊数
      console.log(`[RCop终局] d=${d.toFixed(3)} bond=${bond} (逃脱: d≤${FINAL_BOOST_DIFF} 或 bond≥${BOND_ESCAPE_COUNT}且d<${FINAL_MID_DIFF})`);

      // 1) 逃脱结局：势均力敌，或这一对有足够羁绊史且差距未到击杀档
      if (d <= FINAL_BOOST_DIFF || (bond >= BOND_ESCAPE_COUNT && d < FINAL_MID_DIFF)) {
        pinkMistEffectsRef.current.push({ x: midX, y: midY, time: now, radius: 0 });
        heartEffectsRef.current.push({ x: midX, y: midY, time: now, scale: 0 });
        clashRef.current = { at: now, ending: 'escape' };
        return;
      }

      // 2) 中间范畴（非击杀、非逃脱）
      if (d < FINAL_MID_DIFF) {
        pinkMistEffectsRef.current.push({ x: midX, y: midY, time: now, radius: 0 });
        heartEffectsRef.current.push({ x: midX, y: midY, time: now, scale: 0 });
        clashRef.current = { at: now, ending: 'survive' };
        return;
      }

      // 3) 击杀范畴：谁强谁杀（兔杀鹿 / 鹿杀兔）
      if (powerDiff > 0) {
        // 兔子更强 → 兔杀鹿（终局击杀结局）
        spawnBloodSplash(a0.x, a0.y, now);
        agentsRef.current = agentsRef.current.filter(a => a.id !== a0.id);

        clashRef.current = { at: now, ending: 'rabbit_kills_reindeer' };
        return;
      } else {
        // 驯鹿更强 → 鹿杀兔（终局击杀结局）
        spawnBloodSplash(a1.x, a1.y, now);
        agentsRef.current = agentsRef.current.filter(a => a.id !== a1.id);

        clashRef.current = { at: now, ending: 'reindeer_kills_rabbit' };
        return;
      }
    }
    
    // 还没碰撞：继续互相靠近
    if (dist0 > 0) {
      a0.velocityX = (dx0 / dist0) * maxSpeed;
      a0.velocityY = (dy0 / dist0) * maxSpeed;
    }
    
    const dx1 = a0.x - a1.x;
    const dy1 = a0.y - a1.y;
    const dist1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    
    if (dist1 > 0) {
      a1.velocityX = (dx1 / dist1) * maxSpeed;
      a1.velocityY = (dy1 / dist1) * maxSpeed;
    }
    
    a0.x += a0.velocityX;
    a0.y += a0.velocityY;
    a1.x += a1.velocityX;
    a1.y += a1.velocityY;
  };

  // 检查终局
  const checkEndgame = () => {
    if (gameEndedRef.current) return;

    // 碰撞已发生：等特效播完再正式结算
    if (clashRef.current) {
      if (Date.now() - clashRef.current.at >= CLASH_DELAY) {
        const { ending: pendingEnding } = clashRef.current;
        clashRef.current = null;
        endGame(pendingEnding);
      }
      return;
    }

    const team0 = agentsRef.current.filter(a => a.team === 0);
    const team1 = agentsRef.current.filter(a => a.team === 1);
    
    // 1) 先判定终局战斗（只要 1v1 就进入）
    if (team0.length === 1 && team1.length === 1) {
      const a0 = team0[0];
      const a1 = team1[0];

      // 关闭保护，避免影响终局
      a0.protected = false;
      a1.protected = false;
      
      if (!finalBattleRef.current.started) {
        finalBattleRef.current = { a0, a1, started: true };
      } else {
        finalBattleRef.current.a0 = a0;
        finalBattleRef.current.a1 = a1;
      }
      
        processFinalBattle(a0, a1);
      return; // ⚠️ 关键：1v1 直接返回，绝不走归0结局
    } else {
      finalBattleRef.current = { a0: null, a1: null, started: false };
    }

    // 2) 如果没进入终局战斗，再判定归0 → 存活结局（两个）
    if (team0.length === 0 && team1.length > 0) {
      const now = Date.now();
      team1.forEach(agent => spawnBloodSplash(agent.x, agent.y, now));
      clashRef.current = { at: now, ending: 'rabbit_survives' };
      return;
    }

    if (team1.length === 0 && team0.length > 0) {
      const now = Date.now();
      team0.forEach(agent => spawnBloodSplash(agent.x, agent.y, now));
      clashRef.current = { at: now, ending: 'reindeer_survives' };
      return;
    }

    // 3) 保护逻辑（只在非1v1且未结束时运行）
    if (team0.length === 1 && team1.length > 1) team0[0].protected = true;
    else team0.forEach(a => (a.protected = false));

    if (team1.length === 1 && team0.length > 1) team1[0].protected = true;
    else team1.forEach(a => (a.protected = false));
  };

  // 游戏循环
  const gameLoop = (currentTime: number) => {
    if (!isRunningRef.current && !gameEnded) return;
    
    const deltaTime = currentTime - lastTimeRef.current;
    lastTimeRef.current = currentTime;
    
    // 如果游戏未结束且未暂停，更新游戏逻辑
    if (!gameEnded && !pausedRef.current) {
      // 按速度档位多次执行移动与交互
      // 每步都检查终局，避免倍速下一帧内穿过1v1状态、终局战斗被跳过
      const steps = speedRef.current;
      for (let s = 0; s < steps; s++) {
        agentsRef.current.forEach(agent => {
          updateAgentMovement(agent, deltaTime);
        });
        processDrugInteractions();
        processAgentInteractions();
        checkEndgame();
        // 进入终局战斗/结算延迟/已结束后，终局固定按原速演出，不再倍速推进
        if (gameEndedRef.current || clashRef.current || finalBattleRef.current.started) break;
      }
      processArenaShrink(deltaTime * steps);
      
      // 更新药物TTL
      const now = Date.now();
      drugPointsRef.current = drugPointsRef.current.filter(drug => {
        return now - drug.createdAt < drug.ttl;
      });
      
      // 更新视觉效果
      darkeningEffectsRef.current = darkeningEffectsRef.current.filter(e => now - e.time < 1400);
      pinkMistEffectsRef.current = pinkMistEffectsRef.current.map(effect => {
        const age = now - effect.time;
        if (age > 2000) return null;
        return { ...effect, radius: Math.min(60, age / 10) };
      }).filter((e): e is PinkMistEffect => e !== null);
      // 爱心特效只过滤过期，不更新坐标（确保固定在原位置）
      heartEffectsRef.current = heartEffectsRef.current.filter(e => now - e.time < 1500);
      
    }
    
    // 绘制（无论游戏是否结束都要绘制，以显示结局文字）
    draw();
    
    // 如果游戏未结束，继续循环
    if (isRunningRef.current && !gameEnded) {
      animationFrameRef.current = requestAnimationFrame(gameLoop);
    } else if (gameEnded) {
      // 游戏结束时，停止循环（结局文字已经显示）
      // 不需要继续循环，因为draw()已经在上面调用了
    }
  };

  // 绘制
  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // 清空画布
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    const now = Date.now();
    
    // 绘制药物（逐渐减淡）和吸引范围
    drugPointsRef.current.forEach(drug => {
      const age = now - drug.createdAt;
      const remaining = drug.ttl - age;
      const alpha = Math.max(0.2, remaining / drug.ttl); // 从1.0逐渐减淡到0.2
      
      // 绘制吸引范围（半透明圆圈）
      ctx.strokeStyle = `rgba(255, 200, 150, ${alpha * 0.2})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(drug.x, drug.y, DRUG_ATTRACTION_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // 绘制药物本身
      ctx.fillStyle = `rgba(255, 200, 150, ${alpha * 0.8})`;
      ctx.beginPath();
      ctx.arc(drug.x, drug.y, drug.radius, 0, Math.PI * 2);
      ctx.fill();
    });
    
    // 绘制缩圈边界
    const bounds = arenaBoundsRef.current;
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 5]);
    ctx.strokeRect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);
    ctx.setLineDash([]);
    
    // 绘制击杀特效：不规则血渍，快速晕开后慢慢干涸淡出 - 在agents下方
    darkeningEffectsRef.current.forEach(effect => {
      const age = now - effect.time;
      if (age < 0 || age > 1400) return;
      const t = age / 1400;
      const alpha = (1 - t) * 0.75;
      // 基于位置的确定性伪随机，保证血渍形状每帧稳定
      const seed = Math.abs(Math.sin(effect.x * 12.9898 + effect.y * 78.233)) * 43758.5453;
      const rand = (i: number) => {
        const v = Math.sin(seed + i * 91.17) * 10000;
        return v - Math.floor(v);
      };
      // 晕开：前0.25快速扩张到最大，之后保持
      const spread = Math.min(t / 0.25, 1);
      // 主血泊 + 周围数个小血点，整体范围与粉雾相当（~30px 半径）
      const blobs = 5;
      for (let i = 0; i < blobs; i++) {
        const angle = rand(i) * Math.PI * 2;
        const dist = (i === 0 ? 0 : 8 + rand(i + 10) * 30) * spread;
        const bx = effect.x + Math.cos(angle) * dist;
        const by = effect.y + Math.sin(angle) * dist;
        const r = (i === 0 ? 12 + rand(i + 20) * 6 : 3 + rand(i + 20) * 5) * (0.4 + 0.6 * spread);
        const g = ctx.createRadialGradient(bx, by, 0, bx, by, r);
        g.addColorStop(0, `rgba(150, 15, 25, ${alpha})`);
        g.addColorStop(0.7, `rgba(130, 10, 20, ${alpha * 0.8})`);
        g.addColorStop(1, 'rgba(130, 10, 20, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        // 主血泊压扁成椭圆更像积血
        if (i === 0) {
          ctx.ellipse(bx, by, r * (1.2 + rand(30) * 0.4), r * 0.8, rand(31) * Math.PI, 0, Math.PI * 2);
        } else {
          ctx.arc(bx, by, r, 0, Math.PI * 2);
        }
        ctx.fill();
      }
    });
    
    // 绘制粉色烟雾（在原地弥漫开逐渐消失）- 在agents下方
    pinkMistEffectsRef.current.forEach(effect => {
      const age = now - effect.time;
      if (age > 2000) return;
      const alpha = 1 - (age / 2000);
      const radius = effect.radius;
      
      // 创建渐变
      const gradient = ctx.createRadialGradient(effect.x, effect.y, 0, effect.x, effect.y, radius);
      gradient.addColorStop(0, `rgba(242, 182, 251, ${alpha * 0.8})`);
      gradient.addColorStop(0.5, `rgba(242, 182, 251, ${alpha * 0.4})`);
      gradient.addColorStop(1, `rgba(242, 182, 251, 0)`);
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2);
      ctx.fill();
    });
    
    // 绘制爱心特效（固定在原位置，不拖尾）- 在agents下方
    heartEffectsRef.current.forEach(effect => {
      const age = now - effect.time;
      if (age > 1500) return;
      const alpha = 1 - (age / 1500);
      // 爱心在原地逐渐放大并淡出，不跟随agent移动
      const scale = 0.5 + (age / 1500) * 1.0; // 从0.5放大到1.5
      
      ctx.save();
      ctx.translate(effect.x, effect.y - (age / 1500) * 14); // 缓缓上浮
      ctx.scale(scale, scale);
      ctx.fillStyle = `rgba(255, 120, 170, ${alpha * 0.9})`;
      ctx.shadowColor = `rgba(255, 120, 170, ${alpha * 0.6})`;
      ctx.shadowBlur = 8;

      // 标准爱心形状（两个圆弧+尖底）
      const s = 5;
      ctx.beginPath();
      ctx.moveTo(0, s * 0.6);
      ctx.bezierCurveTo(-s * 1.6, -s * 0.8, -s * 0.6, -s * 1.8, 0, -s * 0.5);
      ctx.bezierCurveTo(s * 0.6, -s * 1.8, s * 1.6, -s * 0.8, 0, s * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });
    
    // 绘制agents（在特效上方）
    agentsRef.current.forEach(agent => {
      ctx.fillStyle = agent.team === 0 ? '#2FB39A' : '#7C55B0'; // 驯鹿薄荷绿，兔子紫（白底上清晰）
      if (agent.protected) {
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(agent.x, agent.y, AGENT_SIZE + 2, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(agent.x, agent.y, AGENT_SIZE, 0, Math.PI * 2);
      ctx.fill();
    });
    
    
    // 绘制统计信息
    const team0Count = agentsRef.current.filter(a => a.team === 0).length;
    const team1Count = agentsRef.current.filter(a => a.team === 1).length;
    const totalPower0 = agentsRef.current.filter(a => a.team === 0).reduce((sum, a) => sum + a.power, 0);
    const totalPower1 = agentsRef.current.filter(a => a.team === 1).reduce((sum, a) => sum + a.power, 0);
    const avgPower0 = team0Count > 0 ? totalPower0 / team0Count : 0;
    const avgPower1 = team1Count > 0 ? totalPower1 / team1Count : 0;
    
    ctx.font = '16px "Source Sans 3"';
    ctx.fillStyle = '#2FB39A';
    ctx.fillText(`${T.statReindeer}: ${team0Count} (${T.statPower}: ${avgPower0.toFixed(1)})`, 20, 30);
    ctx.fillStyle = '#7C55B0';
    ctx.fillText(`${T.statRabbit}: ${team1Count} (${T.statPower}: ${avgPower1.toFixed(1)})`, 20, 50);
    
  };

  // 处理点击添加药物
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isRunning || gameEnded) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    // 计算缩放比例（Canvas实际尺寸 vs 显示尺寸）
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    // 将鼠标坐标转换为Canvas坐标
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    // 检查是否在缩圈边界内
    const bounds = arenaBoundsRef.current;
    if (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom) {
      return; // 超出边界，不投放
    }
    
    drugPointsRef.current.push({
      id: Date.now(),
      x,
      y,
      radius: DRUG_RADIUS,
      ttl: DRUG_TTL,
      createdAt: Date.now()
    });
  }, [isRunning, gameEnded]);

  // 开始游戏
  const startSimulation = () => {
    initializeAgents();
    isRunningRef.current = true;
    setIsRunning(true);
    pausedRef.current = false;
    setIsPaused(false);
    setGameEnded(false);
    setEnding(null);
    gameEndedRef.current = false;
    finalBattleRef.current = { a0: null, a1: null, started: false };
    clashRef.current = null;
    pairBondRef.current.clear();
    lastTimeRef.current = performance.now();
    animationFrameRef.current = requestAnimationFrame(gameLoop);
  };

  // 重置游戏
  const resetSimulation = () => {
    isRunningRef.current = false;
    setIsRunning(false);
    pausedRef.current = false;
    setIsPaused(false);
    setGameEnded(false);
    setEnding(null);
    gameEndedRef.current = false;
    finalBattleRef.current = { a0: null, a1: null, started: false };
    clashRef.current = null;
    pairBondRef.current.clear();
    drugPointsRef.current = [];
    darkeningEffectsRef.current = [];
    pinkMistEffectsRef.current = [];
    heartEffectsRef.current = [];
    lastEncounterTimeRef.current = Date.now();
    arenaBoundsRef.current = { left: 0, right: CANVAS_WIDTH, top: 0, bottom: CANVAS_HEIGHT };
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    initializeAgents();
    // 强制清除画布并重新绘制，确保结局文本被清除
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }
    }
    draw();
  };

  // 结局展示改由 HTML 覆盖层负责，这里只需保证画布停在最后一帧
  useEffect(() => {
    draw();
  }, [gameEnded]);

  // 初始化
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    
    initializeAgents();
    draw();
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-[#1A1512]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[2rem] shadow-[0_25px_50px_-12px_rgba(26,21,18,0.3)] border border-[#F6D8B5]/60 p-4 md:p-6 max-w-6xl w-full max-h-[95vh] overflow-y-auto animate-float-in">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl md:text-2xl font-bold text-[#C96A24] serif-text">{T.title}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#FFF6EC] rounded-full transition-colors duration-300"
            aria-label="Close simulation"
          >
            <X size={22} strokeWidth={1.5} className="text-[#C96A24]" />
          </button>
        </div>

        <div className="relative bg-[#FFFFFF] rounded-3xl p-4 border border-[#F6D8B5]/70 mb-4">
          <style>{`
            @keyframes rcopEndingFade {
              from { opacity: 0; transform: scale(0.98); }
              to { opacity: 1; transform: scale(1); }
            }
          `}</style>
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            className="w-full h-auto border border-[#F6D8B5] rounded-2xl cursor-crosshair"
            style={{ maxHeight: '600px' }}
          />

          {/* 倍速小按钮（画布右上角） */}
          {isRunning && !gameEnded && (
            <button
              onClick={() => {
                const next = speedRef.current === 1 ? 2 : speedRef.current === 2 ? 4 : 1;
                speedRef.current = next;
                setSpeed(next);
              }}
              className="absolute top-6 right-6 px-2.5 py-1 text-xs bg-white/85 border border-[#F6D8B5] text-[#C96A24] hover:bg-[#FFF1E2] rounded-full font-bold transition-colors shadow-sm"
            >
              ×{speed}
            </button>
          )}

          {/* 结局覆盖层 */}
          {gameEnded && ending && (() => {
            const meta = ENDING_META[ending] ?? DEFAULT_ENDING_META;
            const texts = ENDING_TEXTS[ending]?.[lang] ?? ENDING_TEXTS[ending]?.zh;
            if (!texts) return null;
            return (
              <div
                className="absolute inset-4 flex items-center justify-center rounded-2xl overflow-y-auto"
                style={{ background: meta.backdrop, animation: 'rcopEndingFade 1.2s ease-out both' }}
              >
                <div className="max-w-2xl px-4 md:px-8 py-3 text-center space-y-3 md:space-y-7 my-auto">
                  {texts.pre && (
                    <p className="serif-text text-gray-700 text-[11px] md:text-lg leading-[1.7] md:leading-[2.1] whitespace-pre-line tracking-[0.03em] md:tracking-[0.05em]">
                      {texts.pre}
                    </p>
                  )}
                  <div className="mx-auto w-12 h-px" style={{ backgroundColor: meta.color }} />
                  <h3
                    className="serif-text font-bold text-base md:text-4xl tracking-[0.25em] md:tracking-[0.35em] indent-[0.25em] md:indent-[0.35em]"
                    style={{ color: meta.color, textShadow: meta.blood ? '0 1px 12px rgba(178,34,34,0.25)' : `0 1px 12px ${meta.color}33` }}
                  >
                    {texts.title.split(' ').map((word, i) => (
                      <span
                        key={i}
                        style={
                          word === '兔子' || word === 'Rabbit'
                            ? { color: '#7C55B0' }
                            : word === '驯鹿' || word === 'Reindeer'
                            ? { color: '#2FB39A' }
                            : undefined
                        }
                      >
                        {i > 0 ? ' ' : ''}{word}
                      </span>
                    ))}
                  </h3>
                </div>
              </div>
            );
          })()}
        </div>
        
        <div className="flex flex-wrap gap-3 justify-center">
          {!isRunning && !gameEnded && (
            <button
              onClick={startSimulation}
              className="px-8 py-2.5 bg-[#E8833A] hover:bg-[#D9741F] text-white rounded-full font-semibold text-sm uppercase tracking-widest transition-all duration-300 shadow-[0_10px_15px_-3px_rgba(232,131,58,0.25)] active:scale-95"
            >
              {T.start}
            </button>
          )}
          {isRunning && !gameEnded && (
            <>
              <button
                onClick={() => {
                  pausedRef.current = !pausedRef.current;
                  setIsPaused(pausedRef.current);
                }}
                className="px-8 py-2.5 bg-[#E8833A] hover:bg-[#D9741F] text-white rounded-full font-semibold text-sm uppercase tracking-widest transition-all duration-300 shadow-[0_10px_15px_-3px_rgba(232,131,58,0.25)] active:scale-95"
              >
                {isPaused ? T.resume : T.pause}
              </button>
            </>
          )}
          {(isRunning || gameEnded) && (
            <button
              onClick={resetSimulation}
              className="px-8 py-2.5 bg-[#E8833A] hover:bg-[#C96A24] text-white rounded-full font-semibold text-sm uppercase tracking-widest transition-all duration-300 shadow-[0_10px_15px_-3px_rgba(232,131,58,0.25)] active:scale-95"
            >
              {T.reclone}
            </button>
          )}
        </div>

        <div className="mt-4 text-sm text-gray-600 text-center">
          <p>{T.hint}</p>
        </div>
      </div>
    </div>
  );
};

export default Simulation;

