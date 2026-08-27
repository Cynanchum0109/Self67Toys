import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Volume2, VolumeX, Trophy, RotateCw } from 'lucide-react';
import Leaderboard from '@/shared/Leaderboard';
import { encodeScore, hasRankApi, submitScore } from '@/shared/toy';

// 存活榜：击杀数为主，用时为辅（见 shared/toy.ts 的分数编码）
const RANK_BOARD = 1;

// ============================================================
// 孵化场 —— R公司克隆体大逃杀（类吸血鬼幸存者）
// 世界观：孵化场量产克隆体，互杀至只剩一只方可出厂；寿命≤7天
// 机制：自动武器 + 鼠标点击主动技能 / 吃尸体回血+经验 / 升级三选一
//       死亡视角切换到击杀者（编号制：你永远是80个产品序列号之一）
// ============================================================

interface HatchGameProps {
  onClose: () => void;
  lang?: 'zh' | 'en';
  /** 独立发布（Toy）时没有可返回的上级页面：隐藏关闭按钮，改挂中英切换 */
  onToggleLang?: () => void;
}

type Faction = 'rabbit' | 'reindeer';
type Phase = 'title' | 'playing' | 'levelup' | 'ended';

// —— 画布与对局 ——
const W = 1200;
const H = 800;
const WALL = 24;
const POOL_TOTAL = 160; // 克隆体总数（含玩家）——有限池但供给远超玩家成长
const INITIAL_CLONES = 12;
const WAVE_SIZE = 8; // 基础波次大小，随天数变陡
const WAVE_DAY_GROWTH = 1.5; // 每天波次+1.5只
const WAVE_INTERVAL = 8000;
const DURATION = 180_000; // 3分钟 = 7天
const DAY_MS = DURATION / 7;
const CORPSE_TTL = 10_000;
const CLONE_EAT_CD = 3000;
const TAKEOVER_SLOWMO = 900;

// —— 阵营基础数值 ——
// 鹿场克隆攻击性更弱：盯人半径小、出手更慢（但单下更疼）
const FACTION_BASE = {
  rabbit: { hp: 60, speed: 3.2, color: '#7C55B0', corpseHeal: 20, corpseXp: 10, eatFreeze: 300, aggro: 260, contactCd: 700, cloneDmg: 6 },
  reindeer: { hp: 90, speed: 2.5, color: '#2FA38C', corpseHeal: 10, corpseXp: 15, eatFreeze: 500, aggro: 190, contactCd: 950, cloneDmg: 8 },
};

// —— 武器等级表 ——
// 兔·主动：枪（点击朝鼠标方向射击，弹匣制，子弹随时间回填）
const GUN_LEVELS = [
  { cd: 220, dmg: 10, mag: 6, reload: 1500, pierce: 1 },
  { cd: 220, dmg: 12, mag: 7, reload: 1300, pierce: 1 },
  { cd: 200, dmg: 14, mag: 8, reload: 1150, pierce: 2 },
  { cd: 200, dmg: 16, mag: 9, reload: 1000, pierce: 2 },
  { cd: 180, dmg: 19, mag: 10, reload: 850, pierce: 3 },
];
// 兔·自动：匕首（自动朝最近敌人挥砍，命中触发短暂加速）
const DAGGER_LEVELS = [
  { cd: 900, dmg: 10, range: 60, arc: 2.4, haste: 500 },
  { cd: 800, dmg: 13, range: 66, arc: 2.6, haste: 600 },
  { cd: 700, dmg: 15, range: 72, arc: 2.8, haste: 700 },
  { cd: 600, dmg: 18, range: 78, arc: 3.0, haste: 800 },
  { cd: 500, dmg: 22, range: 84, arc: 3.2, haste: 900 },
];
const HASTE_MUL = 1.55; // 匕首命中加速倍率
// 鹿·自动：精神干扰（自身发出的细小电流束，弧跳到近处克隆，小伤+减速）
const PSY_LEVELS = [
  { cd: 1100, dmg: 5, count: 1, range: 150, slow: 600 },
  { cd: 1000, dmg: 6, count: 2, range: 160, slow: 800 },
  { cd: 900, dmg: 7, count: 2, range: 170, slow: 900 },
  { cd: 800, dmg: 8, count: 3, range: 180, slow: 1000 },
  { cd: 700, dmg: 10, count: 3, range: 190, slow: 1200 },
];
// 鹿·主动：大雷电（追踪瞄准方向附近的数个敌人，粗电流束+麻痹；释放后随机自我debuff）
const BOLT_LEVELS = [
  { cd: 3000, dmg: 22, count: 2, range: 320, width: 16, stun: 400 },
  { cd: 2700, dmg: 26, count: 3, range: 340, width: 18, stun: 500 },
  { cd: 2400, dmg: 30, count: 3, range: 360, width: 20, stun: 600 },
  { cd: 2100, dmg: 35, count: 4, range: 380, width: 22, stun: 700 },
  { cd: 1800, dmg: 42, count: 5, range: 400, width: 24, stun: 800 },
];
const BOLT_CONE = 1.0; // 大雷电追踪的方向锥（弧度，±约57°）
const MAX_WEAPON_LEVEL = 5;
// 鹿主动技能自我debuff
const DEBUFF_DARK_MS = 2500; // 屏幕变暗
const DEBUFF_SLOW_MS = 1500; // 行动迟缓
// 体力持续流失（只能靠吃尸体回复）
const HP_DRAIN_PER_SEC = { rabbit: 1.2, reindeer: 0.9 };
// 克隆成长与精英制：互杀/抢食会变强，杀满2个升精英解锁远程（误伤同类）
const CLONE_KILL_HP_GAIN = 6;
const CLONE_KILL_DMG_GAIN = 1;
const CLONE_EAT_MAXHP_GAIN = 4;
const CLONE_EAT_DMG_GAIN = 0.5; // 克隆抢食也涨攻击
const ELITE_KILLS = 2;
const ELITE_SHOT_CD = 3000;
const ELITE_BULLET_SPEED = 4.5;
const ELITE_ZAP_RANGE = 130; // 鹿场精英短距电流
const ELITE_ZAP_SLOW = 800;
// 波次数值成长
const WAVE_HP_GAIN = 3;
const WAVE_DMG_GAIN = 0.3;
const WAVE_SPEED_GAIN = 0.03;
// 换体无敌 / 开局倒数
const INVULN_MS = 2500;
const START_COUNTDOWN_MS = 3000;
// 止痛药（鹿场专属）：免疫减速与黑屏一段时间
const PILL_INTERVAL = 15000;
const PILL_TTL = 8000;
const PILL_MAX = 2;
const PILL_IMMUNE_MS = 6000;
// 后期进一步施压：克隆也自掉血（吃不到尸体的饿死）、第六天狂暴、杀满5个升头狼
const CLONE_DRAIN_PER_SEC = 0.5;
const FRENZY_AFTER_DAY = 5; // 过完第5天（即第6天起）狂暴
const FRENZY_SPEED_MUL = 1.25;
const FRENZY_DMG_MUL = 1.3;
const ALPHA_KILLS = 5; // 头狼：永远追杀玩家、射速加快
// 补给舱：定时空投随机增益
const SUPPLY_INTERVAL = 25000;
const SUPPLY_TTL = 10000;
// 连杀：窗口内连续击杀涨层数（纯展示与统计，不计分）
const COMBO_WINDOW = 4000;
// 升级排队：换体后至少稳定这么久才弹升级
const LEVELUP_SAFE_MS = 800;
// 终局缩圈：池空且场上仅剩少数时开始收缩
const ENDGAME_MOBS = 8;
const SHRINK_SPEED = 14; // 每秒每边收缩px
const ARENA_MIN_W = 340;
const ARENA_MIN_H = 280;
// 第七天清算者：无敌、无差别猎杀，碰到玩家即终局
const REAPER_SPEED = 3.6;
// 升级稀有度：精良/异常
const RARITY_FINE_CHANCE = 0.3;
const RARITY_ANOM_CHANCE = 0.1;
const EAT_COOLDOWN = 400; // 吃完一具后的短冷却，期间不主动吃下一具，避免连续硬直
const DEER_EAT_CHANCE = 0.5; // 鹿不一定肯吃：50%概率拒食（犹豫一会儿再说）
const DEER_SHUN_MS = 1200; // 拒食后对该尸体的犹豫时长

// —— 被动（换体清空）——
type PassiveKey = 'mov' | 'vit' | 'cdr' | 'pick';
const PASSIVE_MAX = 4;
const PASSIVE_STEP: Record<PassiveKey, number> = { mov: 0.08, vit: 15, cdr: 0.08, pick: 14 };
const BASE_PICKUP = 26;

const xpNeed = (level: number) => Math.round(30 * Math.pow(1.35, level - 1));

// —— 实体 ——
interface Mob {
  id: number;
  serial: number; // 出厂编号（1~80）
  x: number; y: number;
  hp: number; maxHp: number;
  speed: number;
  dmg: number;
  lastAtk: number;
  lastEat: number;
  slowUntil: number;
  stunUntil: number;
  hitUntil: number; // 受击闪烁
  wobble: number;
  kills: number; // 互杀战果，≥ELITE_KILLS 为精英
  lastShot: number; // 精英远程冷却
}
interface Corpse { id: number; x: number; y: number; bornAt: number; big: boolean; shunUntil?: number }
interface Pill { id: number; x: number; y: number; bornAt: number }
interface Supply { id: number; x: number; y: number; bornAt: number }
interface Bullet { x: number; y: number; vx: number; vy: number; dmg: number; pierce: number; hit: Set<number> }
interface EnemyBullet { x: number; y: number; vx: number; vy: number; dmg: number; fromId: number }
interface FilamentFx { x1: number; y1: number; x2: number; y2: number; time: number }
interface BeamFx { x1: number; y1: number; x2: number; y2: number; width: number; time: number }
interface SlashFx { x: number; y: number; angle: number; arc: number; range: number; time: number }
interface BloodFx { x: number; y: number; time: number }
interface EatFx { x: number; y: number; time: number; big: boolean }
interface DmgNum { x: number; y: number; v: number; time: number }

type Rarity = 'normal' | 'fine' | 'anomalous';
interface UpgradeOption {
  key: 'auto' | 'active' | PassiveKey | 'heal';
  title: string;
  desc: string;
  rarity: Rarity;
}

const HatchGame: React.FC<HatchGameProps> = ({ onClose, lang = 'zh', onToggleLang }) => {
  // 英文为草译，待审校 → translations-review.md
  const T = lang === 'en' ? {
    title: 'R Corp Hatchery — Live',
    subtitle: 'Ensure your own survival.',
    rabbitName: 'Happy Rabbit',
    reindeerName: 'Not-So-Happy Reindeer',
    rabbitDesc: 'Auto dagger strikes at close range; hits grant a burst of speed. Click / stick: rapid suppression. Go tear into the fresh grass!',
    reindeerDesc: 'Auto energy blasts that seek nearby foes. Click / stick: Mind Whip. Unbearable — it always has been…',
    day: 'Day',
    kills: 'Kills',
    rankView: 'Leaderboard',
    rankSending: '…',
    rankSent: '✓',
    rankFailed: '×',
    body: 'Body',
    left: 'Left',
    serial: 'No.',
    levelup: 'HUNT',
    win: 'QUALIFIED — SHIPPED OUT',
    lose: 'DAY 7 — ALL RETRIEVED',
    winSub: 'Only one may leave the hatchery.',
    loseSub: 'The taboo allows no clone to live past seven days.',
    statKills: 'Kills',
    statEaten: 'Selves devoured',
    statTime: 'Time',
    statTimeUnit: 'days',
    statCombo: 'Best combo',
    statBodies: 'Bodies replaced',
    retry: 'Clone again',
    reaping: 'RETRIEVAL IN PROGRESS',
    rarityFine: 'SUPERIOR',
    rarityAnom: 'ANOMALOUS',
    takeover: 'PERSPECTIVE SHIFTED',
    takeoverSub: (dead: number, next: number) => `No.${dead} dead — perspective shifts to No.${next}`,
    takeoverQuote: '“I am large, I contain multitudes.” — Walt Whitman',
    hint: 'WASD / Arrows to move · Click / stick to cast · Stand on a corpse to devour it and grow · Play in landscape on mobile',
    upgrades: {
      gun: ['Gun', 'Bigger magazine', 'Fast reload', 'Focused fire', 'Annihilation'],
      dagger: ['Dagger', 'Swiftness', 'Vigor', 'Obsession', 'Tear the Fresh Grass'],
      bolt: ['Mind Whip', 'Attack capacity', 'Beam charge', 'Focused mind', 'Get away!'],
      psy: ['Energy Blast', 'Double blast', 'Convergence', 'Stasis', 'Chaos'],
      mov: 'Move Speed +8%',
      vit: 'Max HP +15',
      cdr: 'Reload time -8%',
      pick: 'Pickup Range +',
      heal: 'Emergency Ration',
      healDesc: 'HP Round',
    },
  } : {
    title: 'R公司孵化场实况',
    subtitle: '保证存活',
    rabbitName: '高兴的兔子',
    reindeerName: '不太高兴的驯鹿',
    rabbitDesc: '靠近敌人自动匕首攻击，命中后短暂加速。鼠标点击/摇杆：快速压制。去痛快地撕咬鲜草吧！',
    reindeerDesc: '自动发动追踪敌人的能量轰击。鼠标点击/摇杆：精神鞭挞。难以忍受，一直都是……',
    day: '第',
    kills: '击杀',
    rankView: '排行榜',
    rankSending: '…',
    rankSent: '✓',
    rankFailed: '×',
    body: '第',
    left: '剩余',
    serial: '编号',
    levelup: '猎 取',
    win: '合格 —— 出厂',
    lose: '第七日 —— 全部回收',
    winSub: '仅有一只能离开孵化场。',
    loseSub: '禁忌不允许任何克隆体活过七天。',
    statKills: '击杀',
    statEaten: '吞食自我',
    statTime: '用时',
    statTimeUnit: '天',
    statCombo: '最高连杀',
    statBodies: '更换次数',
    retry: '重新克隆',
    reaping: '回收执行中',
    rarityFine: '优越',
    rarityAnom: '异常',
    takeover: '视角移交',
    takeoverSub: (dead: number, next: number) => `编号${dead} 死亡，视角移交编号${next}`,
    takeoverQuote: '“我辽阔，我包含众多”——惠特曼',
    hint: 'WASD/方向键移动 · 鼠标/摇杆释放技能 · 停留在尸体上可以吃掉增强 · 手机请横屏游玩',
    upgrades: {
      gun: ['枪', '弹匣扩容', '快速装填', '火力集中', '歼灭'],
      dagger: ['匕首', '迅捷', '强壮', '执念', '撕咬鲜草'],
      bolt: ['精神鞭挞', '攻击容量', '集束充能', '心神凝聚', '滚开！'],
      psy: ['能量轰击', '双重轰击', '集束', '凝滞', '混乱'],
      mov: '移速 +8%',
      vit: '最大生命 +15',
      cdr: '装填时间 -8%',
      pick: '拾取范围 +',
      heal: '应急口粮',
      healDesc: 'HP弹',
    },
  };

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>('title');
  const phaseRef = useRef<Phase>('title');
  const countdownNumRef = useRef(0);
  // 触屏设备检测：决定是否显示虚拟摇杆（不能按宽度判断，横屏手机宽度常≥768px）
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    const mqTouch = window.matchMedia('(pointer: coarse)');
    const update = () => setIsTouch(mqTouch.matches);
    update();
    mqTouch.addEventListener('change', update);
    return () => mqTouch.removeEventListener('change', update);
  }, []);
  // 触屏设备：用JS读真实视口像素定窗口尺寸/旋转（部分内核vh/dvh不可靠，CSS单位算不准）
  const [vp, setVp] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!isTouch) return;
    const update = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    update();
    // 进出全屏/转屏后视口尺寸会变，稍延迟再量一次确保拿到最终值
    const delayed = () => { update(); setTimeout(update, 300); };
    window.addEventListener('resize', delayed);
    window.addEventListener('orientationchange', delayed);
    document.addEventListener('fullscreenchange', delayed);
    return () => {
      window.removeEventListener('resize', delayed);
      window.removeEventListener('orientationchange', delayed);
      document.removeEventListener('fullscreenchange', delayed);
    };
  }, [isTouch]);
  // 触屏设备：窗口固定按桌面尺寸(1152宽)排版，再整体transform等比缩放适配屏幕，
  // 这样按钮/文字/画布全部与桌面同比例。竖屏时再旋转90°横置。
  const isPortrait = vp.h >= vp.w;
  // 部分内核不支持锁定横屏，留一个手动开关，按一下翻转当前朝向
  const [forceRotate, setForceRotate] = useState(false);
  const rotated = forceRotate ? !isPortrait : isPortrait;
  const DESIGN_W = 1152; // 桌面 max-w-6xl
  const DESIGN_H = 816;  // 标题栏约48 + 画布1150*(2/3)
  const shellStyle: React.CSSProperties | undefined = isTouch && vp.w > 0
    ? (rotated
        ? { width: DESIGN_W, transform: `rotate(90deg) scale(${Math.min((vp.h - 8) / DESIGN_W, (vp.w - 8) / DESIGN_H)})`, animation: 'none', maxWidth: 'none', flex: 'none' }
        : { width: DESIGN_W, transform: `scale(${Math.min((vp.w - 8) / DESIGN_W, (vp.h - 8) / DESIGN_H)})`, animation: 'none', maxWidth: 'none', flex: 'none' })
    : undefined;
  const canvasStyle: React.CSSProperties = isTouch && vp.w > 0
    ? { maxWidth: '100%', width: 'auto', height: 'auto' }
    : { maxWidth: '100%', maxHeight: 'calc(100dvh - 60px)', width: 'auto', height: 'auto' };
  const [upgradeOptions, setUpgradeOptions] = useState<UpgradeOption[]>([]);
  const [endInfo, setEndInfo] = useState<{ win: boolean; kills: number; eaten: number; daysUsed: number; maxCombo: number; bodies: number; elapsedMs: number } | null>(null);
  const [showRank, setShowRank] = useState(false);
  const [rankState, setRankState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

  const S = useRef({
    faction: 'rabbit' as Faction,
    // 玩家
    px: W / 2, py: H / 2,
    hp: 60, maxHp: 60,
    facing: 0,
    aimAngle: -Math.PI / 2,          // 主动技能瞄准方向（武器指示物朝向）
    aimSrc: '' as '' | 'mouse' | 'joy', // 最近一次瞄准来源，用于每帧更新aimAngle
    eatingUntil: 0,
    eatStart: 0,   // 本次进食开始时刻（画进度环用）
    eatCdUntil: 0, // 进食后短冷却，到点前不主动吃，给玩家时间走开
    playerSerial: 1, // 当前身体的出厂编号
    prevSerial: 1, // 上一具身体的编号（换体提示用）
    wAuto: 1, wActive: 1, // 自动/主动武器等级
    lastAuto: 0, lastActive: -99999,
    ammo: 6, lastReload: 0, // 兔枪弹匣
    passives: { mov: 0, vit: 0, cdr: 0, pick: 0 } as Record<PassiveKey, number>,
    xp: 0, level: 1,
    kills: 0, bodies: 1,
    lastDamagerId: -1,
    darkUntil: 0, // 鹿debuff：屏幕变暗
    selfSlowUntil: 0, // 鹿debuff：行动迟缓
    hasteUntil: 0, // 兔匕首加速
    invulnUntil: 0, // 换体无敌
    freezeUntil: 0, // 开局倒数
    painFreeUntil: 0, // 止痛药：免疫减速/黑屏
    firing: false, // 鼠标按住连发
    pills: [] as Pill[],
    lastPillSpawn: 0,
    supplies: [] as Supply[],
    lastSupplySpawn: 0,
    combo: 0, comboUntil: 0, maxCombo: 0,
    eaten: 0, // 吞食尸体数
    pendingLevelups: 0, lastTakeoverAt: -99999,
    arena: { l: WALL, t: WALL, r: W - WALL, b: H - WALL }, // 终局缩圈用
    reaper: null as { x: number; y: number } | null,
    shakeUntil: 0, shakeAmp: 0, hitstopUntil: 0,
    // 瞄准
    aimX: W / 2, aimY: 0,
    // 场面
    mobs: [] as Mob[],
    corpses: [] as Corpse[],
    bullets: [] as Bullet[],
    enemyBullets: [] as EnemyBullet[],
    filamentFx: [] as FilamentFx[],
    beamFx: [] as BeamFx[],
    slashFx: [] as SlashFx[],
    bloodFx: [] as BloodFx[],
    eatFx: [] as EatFx[],
    dmgNums: [] as DmgNum[],
    poolLeft: 0,
    lastWave: 0,
    nextId: 1,
    serialNext: 1, // 出厂编号发放
    startAt: 0,
    slowmoUntil: 0,
    flashUntil: 0,
    takeoverMsgUntil: 0,
    keys: { up: false, down: false, left: false, right: false },
    joy: { x: 0, y: 0, active: false },
    animId: 0,
    lastFrame: 0,
  });

  // ---------- 音效（WebAudio合成，无素材文件） ----------
  const audioRef = useRef<AudioContext | null>(null);
  const mutedRef = useRef(localStorage.getItem('hatch-muted') === '1');
  const [muted, setMuted] = useState(mutedRef.current);
  const toggleMute = () => {
    mutedRef.current = !mutedRef.current;
    setMuted(mutedRef.current);
    localStorage.setItem('hatch-muted', mutedRef.current ? '1' : '0');
  };
  const tone = (opts: { f: number; f2?: number; t?: number; type?: OscillatorType; v?: number; delay?: number }) => {
    if (mutedRef.current) return;
    let ctx = audioRef.current;
    if (!ctx) {
      try { ctx = new AudioContext(); } catch { return; }
      audioRef.current = ctx;
    }
    if (ctx.state === 'suspended') ctx.resume();
    const { f, f2, t = 0.08, type = 'square', v = 0.1, delay = 0 } = opts;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const t0 = ctx.currentTime + delay;
    o.type = type;
    o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(30, f2), t0 + t);
    g.gain.setValueAtTime(v, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + t);
    o.connect(g).connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + t + 0.02);
  };
  const sfx = {
    shoot: () => tone({ f: 820, f2: 360, t: 0.05, type: 'square', v: 0.06 }),
    slash: () => tone({ f: 300, f2: 900, t: 0.06, type: 'triangle', v: 0.07 }),
    bolt: () => { tone({ f: 140, f2: 60, t: 0.16, type: 'sawtooth', v: 0.12 }); tone({ f: 1200, f2: 300, t: 0.1, type: 'square', v: 0.05 }); },
    psy: () => tone({ f: 1400, f2: 900, t: 0.04, type: 'sine', v: 0.035 }),
    kill: (combo: number) => tone({ f: 220 * Math.pow(1.06, Math.min(combo, 12)), f2: 110, t: 0.07, type: 'square', v: 0.09 }),
    eat: () => tone({ f: 520, f2: 780, t: 0.07, type: 'sine', v: 0.09 }),
    levelup: () => { tone({ f: 440, t: 0.08, type: 'triangle', v: 0.09 }); tone({ f: 554, t: 0.08, type: 'triangle', v: 0.09, delay: 0.08 }); tone({ f: 659, t: 0.12, type: 'triangle', v: 0.09, delay: 0.16 }); },
    takeover: () => { tone({ f: 110, f2: 45, t: 0.4, type: 'sawtooth', v: 0.14 }); tone({ f: 880, f2: 220, t: 0.25, type: 'sine', v: 0.07, delay: 0.05 }); },
    pod: () => { tone({ f: 660, t: 0.06, type: 'sine', v: 0.09 }); tone({ f: 990, t: 0.1, type: 'sine', v: 0.09, delay: 0.06 }); },
    alarm: () => { for (let i = 0; i < 3; i++) { tone({ f: 700, t: 0.14, type: 'square', v: 0.1, delay: i * 0.3 }); tone({ f: 500, t: 0.14, type: 'square', v: 0.1, delay: i * 0.3 + 0.15 }); } },
    tick: () => tone({ f: 600, t: 0.05, type: 'square', v: 0.07 }),
    go: () => tone({ f: 880, f2: 1100, t: 0.18, type: 'square', v: 0.1 }),
  };

  // ---------- 工具 ----------
  const factionOf = () => FACTION_BASE[S.current.faction];

  // 屏震+顿帧
  const addShake = (amp: number, ms: number) => {
    const s = S.current;
    const now = performance.now();
    s.shakeAmp = Math.max(s.shakeAmp, amp);
    s.shakeUntil = Math.max(s.shakeUntil, now + ms);
  };
  const addHitstop = (ms: number) => {
    S.current.hitstopUntil = Math.max(S.current.hitstopUntil, performance.now() + ms);
  };
  const playerSpeed = () => {
    const s = S.current;
    const now = performance.now();
    const slowMul = now < s.selfSlowUntil ? 0.5 : 1;
    const hasteMul = now < s.hasteUntil ? HASTE_MUL : 1;
    return factionOf().speed * (1 + s.passives.mov * PASSIVE_STEP.mov) * slowMul * hasteMul;
  };
  const cdMul = () => 1 - S.current.passives.cdr * PASSIVE_STEP.cdr;
  const pickupRange = () => BASE_PICKUP + S.current.passives.pick * PASSIVE_STEP.pick;

  const dist2 = (ax: number, ay: number, bx: number, by: number) => {
    const dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy;
  };

  const takeSerial = () => {
    const s = S.current;
    // 玩家的编号在开局时预留，克隆发号时跳过它
    let n = s.serialNext++;
    if (n === s.playerSerial) n = s.serialNext++;
    return n;
  };

  const spawnClone = (x: number, y: number, waveIdx: number) => {
    const s = S.current;
    // 后出场的批次天生更强
    const hp = 22 + waveIdx * WAVE_HP_GAIN;
    s.mobs.push({
      id: s.nextId++,
      serial: takeSerial(),
      x, y,
      hp, maxHp: hp,
      speed: 1.5 + Math.random() * 0.7 + waveIdx * WAVE_SPEED_GAIN,
      dmg: factionOf().cloneDmg + waveIdx * WAVE_DMG_GAIN,
      lastAtk: 0, lastEat: 0, slowUntil: 0, stunUntil: 0, hitUntil: 0,
      wobble: Math.random() * Math.PI * 2,
      kills: 0, lastShot: 0,
    });
  };

  // 克隆互杀战果：变强，杀满2个升精英
  const creditCloneKill = (killer: Mob) => {
    killer.kills++;
    killer.maxHp += CLONE_KILL_HP_GAIN;
    killer.hp = Math.min(killer.maxHp, killer.hp + CLONE_KILL_HP_GAIN);
    killer.dmg += CLONE_KILL_DMG_GAIN;
  };

  const spawnWave = (count: number, now: number) => {
    const s = S.current;
    const n = Math.min(count, s.poolLeft);
    const waveIdx = Math.floor((now - s.startAt) / WAVE_INTERVAL);
    for (let i = 0; i < n; i++) {
      const tube = i % 3;
      const tx = W * (0.25 + tube * 0.25) + (Math.random() - 0.5) * 60;
      spawnClone(tx, WALL + 20 + Math.random() * 40, waveIdx);
    }
    s.poolLeft -= n;
  };

  const hurtMob = (m: Mob, dmg: number, now: number): boolean => {
    const s = S.current;
    m.hp -= dmg;
    m.hitUntil = now + 130;
    s.dmgNums.push({ x: m.x + (Math.random() - 0.5) * 10, y: m.y - 10, v: dmg, time: now });
    if (s.dmgNums.length > 60) s.dmgNums.splice(0, s.dmgNums.length - 60);
    if (m.hp <= 0) {
      const wasElite = m.kills >= ELITE_KILLS;
      s.mobs = s.mobs.filter(x => x.id !== m.id);
      s.corpses.push({ id: s.nextId++, x: m.x, y: m.y, bornAt: now, big: false });
      s.bloodFx.push({ x: m.x, y: m.y, time: now });
      s.kills++;
      // 连杀：窗口内连续击杀涨层数
      s.combo = now < s.comboUntil ? s.combo + 1 : 1;
      s.comboUntil = now + COMBO_WINDOW;
      s.maxCombo = Math.max(s.maxCombo, s.combo);
      sfx.kill(s.combo);
      // 击杀不震屏，血迹即可（震动只留给主动技能等大动作）
      if (wasElite) addHitstop(45);
      return true;
    }
    return false;
  };

  // 克隆互杀致死（不计玩家击杀数）
  const cloneKillClone = (victim: Mob, now: number) => {
    const s = S.current;
    s.mobs = s.mobs.filter(x => x.id !== victim.id);
    s.corpses.push({ id: s.nextId++, x: victim.x, y: victim.y, bornAt: now, big: false });
    s.bloodFx.push({ x: victim.x, y: victim.y, time: now });
  };

  // ---------- 升级 ----------
  const buildUpgradePool = (): UpgradeOption[] => {
    const s = S.current;
    const U = T.upgrades;
    const pool: UpgradeOption[] = [];
    const isRabbit = s.faction === 'rabbit';
    const autoNames = isRabbit ? U.dagger : U.psy;
    const activeNames = isRabbit ? U.gun : U.bolt;
    if (s.wAuto < MAX_WEAPON_LEVEL) pool.push({ key: 'auto', title: `${autoNames[0]} Lv.${s.wAuto + 1}`, desc: autoNames[s.wAuto], rarity: 'normal' });
    if (s.wActive < MAX_WEAPON_LEVEL) pool.push({ key: 'active', title: `${activeNames[0]} Lv.${s.wActive + 1}`, desc: activeNames[s.wActive], rarity: 'normal' });
    (['mov', 'vit', 'cdr', 'pick'] as PassiveKey[]).forEach(k => {
      if (s.passives[k] < PASSIVE_MAX) {
        const label = k === 'mov' ? U.mov : k === 'vit' ? U.vit : k === 'cdr' ? U.cdr : U.pick;
        pool.push({ key: k, title: label, desc: `Lv.${s.passives[k] + 1}/${PASSIVE_MAX}`, rarity: 'normal' });
      }
    });
    if (pool.length === 0) pool.push({ key: 'heal', title: U.heal, desc: U.healDesc, rarity: 'normal' });
    return pool;
  };

  const rollRarity = (): Rarity => {
    const r = Math.random();
    if (r < RARITY_ANOM_CHANCE) return 'anomalous';
    if (r < RARITY_ANOM_CHANCE + RARITY_FINE_CHANCE) return 'fine';
    return 'normal';
  };

  const openLevelup = () => {
    const pool = buildUpgradePool();
    const picked: UpgradeOption[] = [];
    const copy = [...pool];
    while (picked.length < 3 && copy.length > 0) {
      const opt = copy.splice(Math.floor(Math.random() * copy.length), 1)[0];
      // 稀有度：精良/异常翻倍收益（回血选项不掉稀有）
      opt.rarity = opt.key === 'heal' ? 'normal' : rollRarity();
      picked.push(opt);
    }
    setUpgradeOptions(picked);
    sfx.levelup();
    phaseRef.current = 'levelup';
    setPhase('levelup');
  };

  const applyUpgrade = (opt: UpgradeOption) => {
    const s = S.current;
    // 稀有度倍数：普通1 / 精良2 / 异常3（武器为+1级/+1级并回血/+2级）
    const mult = opt.rarity === 'anomalous' ? 3 : opt.rarity === 'fine' ? 2 : 1;
    if (opt.key === 'auto' || opt.key === 'active') {
      const lvGain = opt.rarity === 'anomalous' ? 2 : 1;
      if (opt.key === 'auto') s.wAuto = Math.min(MAX_WEAPON_LEVEL, s.wAuto + lvGain);
      else s.wActive = Math.min(MAX_WEAPON_LEVEL, s.wActive + lvGain);
      if (opt.rarity === 'fine') s.hp = Math.min(s.maxHp, s.hp + 15);
    } else if (opt.key === 'heal') {
      s.hp = s.maxHp;
    } else {
      s.passives[opt.key] = Math.min(PASSIVE_MAX, s.passives[opt.key] + mult);
      if (opt.key === 'vit') {
        s.maxHp = factionOf().hp + s.passives.vit * PASSIVE_STEP.vit;
        s.hp = Math.min(s.maxHp, s.hp + PASSIVE_STEP.vit * mult);
      }
    }
    phaseRef.current = 'playing';
    setPhase('playing');
    S.current.lastFrame = performance.now();
  };

  const gainXp = (amount: number) => {
    const s = S.current;
    s.xp += amount;
    // 升级排队：不立刻弹，帧末在局面稳定时统一弹出（多级连弹）
    while (s.xp >= xpNeed(s.level)) {
      s.xp -= xpNeed(s.level);
      s.level++;
      s.pendingLevelups++;
    }
  };

  // ---------- 自动武器 ----------
  const fireAutoWeapon = (now: number) => {
    const s = S.current;
    // 兔枪弹匣回填（不依赖场上有无敌人）
    if (s.faction === 'rabbit') {
      const g = GUN_LEVELS[s.wActive - 1];
      const reload = g.reload * cdMul();
      while (s.ammo < g.mag && now - s.lastReload >= reload) {
        s.ammo++;
        s.lastReload += reload;
      }
      if (s.ammo >= g.mag) s.lastReload = now;
    }
    if (s.mobs.length === 0) return;
    const isRabbit = s.faction === 'rabbit';

    if (isRabbit) {
      // 匕首：自动朝最近敌人挥砍，命中触发短暂加速
      const d = DAGGER_LEVELS[s.wAuto - 1];
      if (now - s.lastAuto >= d.cd * cdMul()) {
        const nearest = [...s.mobs].sort((a, b) => dist2(s.px, s.py, a.x, a.y) - dist2(s.px, s.py, b.x, b.y))[0];
        if (nearest && dist2(s.px, s.py, nearest.x, nearest.y) <= d.range * d.range) {
          s.lastAuto = now;
          const angle = Math.atan2(nearest.y - s.py, nearest.x - s.px);
          s.facing = angle;
          sfx.slash();
          s.slashFx.push({ x: s.px, y: s.py, angle, arc: d.arc, range: d.range, time: now });
          let hitAny = false;
          s.mobs.slice().forEach(m => {
            const dd = Math.sqrt(dist2(s.px, s.py, m.x, m.y));
            if (dd > d.range) return;
            let da = Math.atan2(m.y - s.py, m.x - s.px) - angle;
            while (da > Math.PI) da -= Math.PI * 2;
            while (da < -Math.PI) da += Math.PI * 2;
            if (Math.abs(da) <= d.arc / 2) {
              hitAny = true;
              hurtMob(m, d.dmg, now);
            }
          });
          if (hitAny) s.hasteUntil = now + d.haste;
        }
      }
    } else {
      const p = PSY_LEVELS[s.wAuto - 1];
      if (now - s.lastAuto >= p.cd * cdMul()) {
        const inRange = s.mobs
          .filter(m => dist2(s.px, s.py, m.x, m.y) <= p.range * p.range)
          .sort((a, b) => dist2(s.px, s.py, a.x, a.y) - dist2(s.px, s.py, b.x, b.y))
          .slice(0, p.count);
        if (inRange.length > 0) {
          s.lastAuto = now;
          sfx.psy();
          inRange.forEach(m => {
            s.filamentFx.push({ x1: s.px, y1: s.py, x2: m.x, y2: m.y, time: now });
            m.slowUntil = now + p.slow;
            hurtMob(m, p.dmg, now);
          });
        }
      }
    }

    // 子弹飞行与命中
    s.bullets = s.bullets.filter(b => {
      b.x += b.vx; b.y += b.vy;
      if (b.x < 0 || b.x > W || b.y < 0 || b.y > H) return false;
      for (const m of s.mobs.slice()) {
        if (b.hit.has(m.id)) continue;
        if (dist2(b.x, b.y, m.x, m.y) < 16 * 16) {
          b.hit.add(m.id);
          hurtMob(m, b.dmg, now);
          if (b.hit.size > b.pierce) return false;
        }
      }
      return true;
    });
  };

  // ---------- 主动技能（鼠标点击/摇杆释放） ----------
  const castActive = (dirX: number, dirY: number) => {
    const s = S.current;
    if (phaseRef.current !== 'playing') return;
    const now = performance.now();
    if (now < s.freezeUntil) return;
    if (now < s.eatingUntil) return;
    const len = Math.sqrt(dirX * dirX + dirY * dirY);
    if (len < 0.001) return;
    const nx = dirX / len, ny = dirY / len;
    const angle = Math.atan2(ny, nx);

    if (s.faction === 'rabbit') {
      // 枪：朝鼠标方向打一发，消耗弹匣
      const g = GUN_LEVELS[s.wActive - 1];
      if (now - s.lastActive < g.cd) return;
      if (s.ammo <= 0) return;
      if (s.ammo >= g.mag) s.lastReload = now; // 从满匣开始计回填
      s.ammo--;
      s.lastActive = now;
      s.facing = angle;
      sfx.shoot();
      addShake(1.5, 60);
      s.bullets.push({ x: s.px, y: s.py, vx: nx * 8, vy: ny * 8, dmg: g.dmg, pierce: g.pierce, hit: new Set() });
    } else {
      // 大雷电：追踪瞄准方向锥内最近的数个敌人
      const b = BOLT_LEVELS[s.wActive - 1];
      if (now - s.lastActive < b.cd * cdMul()) return;
      const inRange = s.mobs.filter(m => dist2(s.px, s.py, m.x, m.y) <= b.range * b.range);
      if (inRange.length === 0) return; // 范围内没人，不浪费冷却
      const withAngle = inRange.map(m => {
        let da = Math.atan2(m.y - s.py, m.x - s.px) - angle;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        return { m, da, d: dist2(s.px, s.py, m.x, m.y) };
      });
      const inCone = withAngle.filter(t => Math.abs(t.da) <= BOLT_CONE).sort((a, b2) => a.d - b2.d);
      // 锥内不够就用范围内最近的补足
      const rest = withAngle.filter(t => Math.abs(t.da) > BOLT_CONE).sort((a, b2) => a.d - b2.d);
      const targets = [...inCone, ...rest].slice(0, b.count);
      s.lastActive = now;
      s.facing = angle;
      sfx.bolt();
      addShake(3, 150);
      targets.forEach(t => {
        s.beamFx.push({ x1: s.px, y1: s.py, x2: t.m.x, y2: t.m.y, width: b.width, time: now });
        t.m.stunUntil = now + b.stun;
        hurtMob(t.m, b.dmg, now);
      });
      // 精神反噬：随机屏幕变暗或行动迟缓（止痛药期间免疫）
      if (now >= s.painFreeUntil) {
        if (Math.random() < 0.5) s.darkUntil = now + DEBUFF_DARK_MS;
        else s.selfSlowUntil = now + DEBUFF_SLOW_MS;
      }
    }
  };

  // ---------- 换体 ----------
  const takeover = (now: number) => {
    const s = S.current;
    // 找不到最后伤害者（如饿死）时，移交给最近的克隆
    const nearest = [...s.mobs].sort((a, b) => dist2(s.px, s.py, a.x, a.y) - dist2(s.px, s.py, b.x, b.y))[0];
    const killer = s.mobs.find(m => m.id === s.lastDamagerId) ?? nearest;
    if (!killer) { s.hp = 1; return; } // 场上已无克隆：吊着一口气等待终局结算
    s.corpses.push({ id: s.nextId++, x: s.px, y: s.py, bornAt: now, big: true });
    s.bloodFx.push({ x: s.px, y: s.py, time: now });
    // 接管击杀者：武器保留（你的熟练度），被动清空（身体素质归零）
    s.mobs = s.mobs.filter(m => m.id !== killer.id);
    s.px = killer.x; s.py = killer.y;
    s.prevSerial = s.playerSerial;
    s.playerSerial = killer.serial;
    s.passives = { mov: 0, vit: 0, cdr: 0, pick: 0 };
    s.maxHp = factionOf().hp;
    s.hp = Math.round(s.maxHp * 0.7);
    s.bodies++;
    s.darkUntil = 0; s.selfSlowUntil = 0; s.hasteUntil = 0;
    s.invulnUntil = now + INVULN_MS; // 换体无敌
    s.lastTakeoverAt = now;
    sfx.takeover();
    addShake(4, 300);
    // 新身体满弹匣
    if (s.faction === 'rabbit') { s.ammo = GUN_LEVELS[s.wActive - 1].mag; s.lastReload = now; }
    s.slowmoUntil = now + TAKEOVER_SLOWMO;
    s.flashUntil = now + 350;
    s.takeoverMsgUntil = now + 2600;
  };

  // ---------- 结束（纯统计，不计分） ----------
  const finish = (win: boolean, now: number) => {
    const s = S.current;
    const daysUsed = Math.min(7, Math.max(0, (now - s.startAt) / DAY_MS));
    const elapsedMs = Math.max(0, now - s.startAt);
    setEndInfo({
      win,
      kills: s.kills,
      eaten: s.eaten,
      daysUsed: Math.round(daysUsed * 10) / 10,
      maxCombo: s.maxCombo,
      bodies: s.bodies,
      elapsedMs,
    });
    // 上传成绩：击杀数优先，同击杀比用时
    if (hasRankApi()) {
      setRankState('sending');
      submitScore(RANK_BOARD, encodeScore(s.kills, elapsedMs)).then(ok => setRankState(ok ? 'sent' : 'failed'));
    }
    phaseRef.current = 'ended';
    setPhase('ended');
  };

  // ---------- 主循环 ----------
  const step = (now: number) => {
    const s = S.current;
    if (phaseRef.current !== 'playing') return;
    const rawDt = Math.min(50, now - s.lastFrame);
    s.lastFrame = now;
    // 开局倒数：世界静止
    if (now < s.freezeUntil) {
      const n = Math.ceil((s.freezeUntil - now) / 1000);
      if (n !== countdownNumRef.current) {
        countdownNumRef.current = n;
        sfx.tick();
      }
      return;
    }
    if (countdownNumRef.current !== 0) {
      countdownNumRef.current = 0;
      sfx.go();
    }
    // 顿帧
    if (now < s.hitstopUntil) return;
    const timeScale = now < s.slowmoUntil ? 0.3 : 1;
    const dt = (rawDt / 16.67) * timeScale;
    const f = factionOf();

    const elapsed = now - s.startAt;
    // 第七天：清算者进场（不再直接判负）
    if (elapsed >= DURATION && !s.reaper) {
      s.reaper = { x: W / 2, y: -30 };
      sfx.alarm();
      addShake(5, 500);
    }
    // 第六天起全场狂暴
    const frenzy = elapsed >= FRENZY_AFTER_DAY * DAY_MS;

    // 体力持续流失：只能靠吃尸体回复（换体无敌期间暂停）
    if (now >= s.invulnUntil) {
      s.hp -= HP_DRAIN_PER_SEC[s.faction] * (rawDt / 1000) * timeScale;
      if (s.hp <= 0) {
        takeover(now);
        return;
      }
    }

    // 止痛药（鹿场）：定时刷新、过期消失、拾取免疫
    if (s.faction === 'reindeer') {
      if (now - s.lastPillSpawn >= PILL_INTERVAL && s.pills.length < PILL_MAX) {
        s.lastPillSpawn = now;
        s.pills.push({
          id: s.nextId++,
          x: s.arena.l + 60 + Math.random() * (s.arena.r - s.arena.l - 120),
          y: s.arena.t + 60 + Math.random() * (s.arena.b - s.arena.t - 120),
          bornAt: now,
        });
      }
      s.pills = s.pills.filter(p => now - p.bornAt < PILL_TTL);
      const pr = pickupRange();
      const got = s.pills.find(p => dist2(s.px, s.py, p.x, p.y) < pr * pr);
      if (got) {
        s.pills = s.pills.filter(p => p.id !== got.id);
        s.painFreeUntil = now + PILL_IMMUNE_MS;
        s.darkUntil = 0;
        s.selfSlowUntil = 0;
        s.eatFx.push({ x: got.x, y: got.y, time: now, big: true });
      }
    }

    // 武器指示物朝向 = 主动技能瞄准/锥心方向：摇杆优先，否则鼠标（松开摇杆保持上次角度）
    const sdAim = skillDirRef.current;
    if (sdAim.x !== 0 || sdAim.y !== 0) s.aimAngle = Math.atan2(sdAim.y, sdAim.x);
    else if (s.aimSrc === 'mouse') s.aimAngle = Math.atan2(s.aimY - s.py, s.aimX - s.px);

    // 连发：鼠标按住朝准星，或右摇杆推着朝摇杆方向（鹿仍为锥形索敌，方向决定锥心）
    if (s.firing) {
      castActive(s.aimX - s.px, s.aimY - s.py);
    } else {
      const sd = skillDirRef.current;
      if (Math.sqrt(sd.x * sd.x + sd.y * sd.y) > 0.3) castActive(sd.x, sd.y);
    }

    // 波次随天数变陡
    if (s.poolLeft > 0 && now - s.lastWave >= WAVE_INTERVAL) {
      s.lastWave = now;
      const dayIdx = Math.floor(elapsed / DAY_MS);
      spawnWave(Math.round(WAVE_SIZE + dayIdx * WAVE_DAY_GROWTH), now);
    }

    // 补给舱：定时空投，捡到随机增益
    if (!s.reaper && now - s.lastSupplySpawn >= SUPPLY_INTERVAL) {
      s.lastSupplySpawn = now;
      s.supplies.push({
        id: s.nextId++,
        x: s.arena.l + 50 + Math.random() * (s.arena.r - s.arena.l - 100),
        y: s.arena.t + 50 + Math.random() * (s.arena.b - s.arena.t - 100),
        bornAt: now,
      });
    }
    s.supplies = s.supplies.filter(p => now - p.bornAt < SUPPLY_TTL);
    {
      const pr = pickupRange();
      const got = s.supplies.find(p => dist2(s.px, s.py, p.x, p.y) < pr * pr);
      if (got) {
        s.supplies = s.supplies.filter(p => p.id !== got.id);
        s.eatFx.push({ x: got.x, y: got.y, time: now, big: true });
        sfx.pod();
        const roll = Math.random();
        if (roll < 0.34) {
          // 军备：满弹匣/技能立即就绪 + 回血
          if (s.faction === 'rabbit') s.ammo = GUN_LEVELS[s.wActive - 1].mag;
          else s.lastActive = -99999;
          s.hp = Math.min(s.maxHp, s.hp + 20);
        } else if (roll < 0.67) {
          // 全场麻痹
          s.mobs.forEach(m => { m.stunUntil = now + 1500; });
        } else {
          // 营养剂：直接喂经验
          gainXp(40);
        }
      }
    }

    // 终局缩圈：池空且场上仅剩少数克隆
    if (s.poolLeft === 0 && s.mobs.length <= ENDGAME_MOBS && s.mobs.length > 0) {
      const dsec = (rawDt / 1000) * timeScale;
      if (s.arena.r - s.arena.l > ARENA_MIN_W) { s.arena.l += SHRINK_SPEED * dsec; s.arena.r -= SHRINK_SPEED * dsec; }
      if (s.arena.b - s.arena.t > ARENA_MIN_H) { s.arena.t += SHRINK_SPEED * dsec; s.arena.b -= SHRINK_SPEED * dsec; }
    }

    // —— 玩家移动 ——
    const eating = now < s.eatingUntil;
    let mx = (s.keys.right ? 1 : 0) - (s.keys.left ? 1 : 0) + s.joy.x;
    let my = (s.keys.down ? 1 : 0) - (s.keys.up ? 1 : 0) + s.joy.y;
    const mlen = Math.sqrt(mx * mx + my * my);
    if (mlen > 0.15 && !eating) {
      mx /= mlen; my /= mlen;
      s.px += mx * playerSpeed() * dt;
      s.py += my * playerSpeed() * dt;
      s.facing = Math.atan2(my, mx);
    }
    s.px = Math.max(s.arena.l + 10, Math.min(s.arena.r - 10, s.px));
    s.py = Math.max(s.arena.t + 10, Math.min(s.arena.b - 10, s.py));

    // —— 克隆AI：互杀+盯玩家混合（鹿场攻击性更弱） ——
    s.mobs.slice().forEach(m => {
      // 克隆也自掉血：吃不到尸体的饿死（自然精选）
      m.hp -= CLONE_DRAIN_PER_SEC * (rawDt / 1000) * timeScale;
      if (m.hp <= 0) {
        cloneKillClone(m, now);
        return;
      }
      if (now < m.stunUntil) return;
      const slowMul = (now < m.slowUntil ? 0.5 : 1) * (frenzy ? FRENZY_SPEED_MUL : 1);
      const isAlpha = m.kills >= ALPHA_KILLS;
      let tx = s.px, ty = s.py;
      let targetMob: Mob | null = null;
      const dp = dist2(m.x, m.y, s.px, s.py);
      // 头狼永远追杀玩家
      if (!isAlpha && dp > f.aggro * f.aggro) {
        let bestD = Infinity;
        for (const o of s.mobs) {
          if (o.id === m.id) continue;
          const d = dist2(m.x, m.y, o.x, o.y);
          if (d < bestD) { bestD = d; targetMob = o; }
        }
        if (targetMob && bestD < dp) { tx = targetMob.x; ty = targetMob.y; }
        else targetMob = null;
      }
      const dx = tx - m.x, dy = ty - m.y;
      const dd = Math.sqrt(dx * dx + dy * dy) || 1;
      m.wobble += 0.08 * dt;
      const wob = Math.sin(m.wobble) * 0.4;
      m.x += ((dx / dd) * m.speed + Math.cos(m.wobble) * wob * 0.3) * slowMul * dt;
      m.y += ((dy / dd) * m.speed + Math.sin(m.wobble) * wob * 0.3) * slowMul * dt;
      m.x = Math.max(s.arena.l + 8, Math.min(s.arena.r - 8, m.x));
      m.y = Math.max(s.arena.t + 8, Math.min(s.arena.b - 8, m.y));

      const atkDmg = m.dmg * (frenzy ? FRENZY_DMG_MUL : 1);
      if (now - m.lastAtk >= f.contactCd) {
        if (targetMob) {
          if (dist2(m.x, m.y, targetMob.x, targetMob.y) < 18 * 18) {
            m.lastAtk = now;
            targetMob.hp -= atkDmg;
            if (targetMob.hp <= 0) {
              cloneKillClone(targetMob, now);
              creditCloneKill(m);
            }
          }
        } else if (dist2(m.x, m.y, s.px, s.py) < 20 * 20 && now >= s.invulnUntil) {
          m.lastAtk = now;
          s.hp -= atkDmg;
          s.lastDamagerId = m.id;
          s.bloodFx.push({ x: s.px, y: s.py, time: now });
          if (s.hp <= 0) takeover(now);
        }
      }

      // 精英远程（杀满2个解锁）：兔场开枪 / 鹿场短距电流；头狼射速加快
      const shotCd = isAlpha ? ELITE_SHOT_CD * 0.6 : ELITE_SHOT_CD;
      if (m.kills >= ELITE_KILLS && now - m.lastShot >= shotCd) {
        const aimPlayer = !targetMob;
        const tx2 = aimPlayer ? s.px : targetMob!.x;
        const ty2 = aimPlayer ? s.py : targetMob!.y;
        if (s.faction === 'rabbit') {
          const dd2 = Math.sqrt(dist2(m.x, m.y, tx2, ty2)) || 1;
          m.lastShot = now + Math.random() * 800;
          s.enemyBullets.push({
            x: m.x, y: m.y,
            vx: ((tx2 - m.x) / dd2) * ELITE_BULLET_SPEED,
            vy: ((ty2 - m.y) / dd2) * ELITE_BULLET_SPEED,
            dmg: Math.round(m.dmg + 2),
            fromId: m.id,
          });
        } else if (dist2(m.x, m.y, tx2, ty2) <= ELITE_ZAP_RANGE * ELITE_ZAP_RANGE) {
          m.lastShot = now + Math.random() * 800;
          s.filamentFx.push({ x1: m.x, y1: m.y, x2: tx2, y2: ty2, time: now });
          if (aimPlayer) {
            if (now >= s.invulnUntil) {
              s.hp -= Math.round(m.dmg * 0.6);
              s.lastDamagerId = m.id;
              // 止痛药期间免疫减速
              if (now >= s.painFreeUntil) s.selfSlowUntil = Math.max(s.selfSlowUntil, now + ELITE_ZAP_SLOW);
              if (s.hp <= 0) takeover(now);
            }
          } else {
            targetMob!.hp -= Math.round(m.dmg * 0.6);
            targetMob!.slowUntil = now + ELITE_ZAP_SLOW;
            if (targetMob!.hp <= 0) {
              cloneKillClone(targetMob!, now);
              creditCloneKill(m);
            }
          }
        }
      }

      if (now - m.lastEat >= CLONE_EAT_CD) {
        const c = s.corpses.find(c => !c.big && dist2(m.x, m.y, c.x, c.y) < 16 * 16);
        if (c) {
          m.lastEat = now;
          // 吃出来的强：血上限+攻击都涨
          m.maxHp += CLONE_EAT_MAXHP_GAIN;
          m.dmg += CLONE_EAT_DMG_GAIN;
          m.hp = Math.min(m.maxHp, m.hp + 10);
          s.corpses = s.corpses.filter(x => x.id !== c.id);
          s.eatFx.push({ x: c.x, y: c.y, time: now, big: false });
        }
      }
    });

    // —— 精英子弹（误伤同类） ——
    s.enemyBullets = s.enemyBullets.filter(b => {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < WALL || b.x > W - WALL || b.y < WALL || b.y > H - WALL) return false;
      // 打中玩家（无敌期间穿过）
      if (now >= s.invulnUntil && dist2(b.x, b.y, s.px, s.py) < 14 * 14) {
        s.hp -= b.dmg;
        s.lastDamagerId = b.fromId;
        s.bloodFx.push({ x: s.px, y: s.py, time: now });
        if (s.hp <= 0) takeover(now);
        return false;
      }
      // 误伤同类（不打发射者自己）
      for (const m of s.mobs) {
        if (m.id === b.fromId) continue;
        if (dist2(b.x, b.y, m.x, m.y) < 11 * 11) {
          m.hp -= b.dmg;
          m.hitUntil = now + 130;
          if (m.hp <= 0) {
            cloneKillClone(m, now);
            const shooter = s.mobs.find(x => x.id === b.fromId);
            if (shooter) creditCloneKill(shooter);
          }
          return false;
        }
      }
      return true;
    });

    // —— 玩家吃尸体 ——（进食硬直结束后还有一小段冷却，避免连吃卡住）
    if (!eating && now >= s.eatCdUntil) {
      const pr = pickupRange();
      const c = s.corpses.find(c => dist2(s.px, s.py, c.x, c.y) < pr * pr && !(c.shunUntil && now < c.shunUntil));
      if (c) {
        const consume = () => {
          // 兔全额回血；鹿的减半已体现在corpseHeal基础值里
          const cc = S.current.corpses.find(x => x.id === c.id);
          if (!cc) return;
          const heal = cc.big ? S.current.maxHp : f.corpseHeal;
          S.current.hp = Math.min(S.current.maxHp, S.current.hp + heal);
          S.current.corpses = S.current.corpses.filter(x => x.id !== cc.id);
          S.current.eatFx.push({ x: cc.x, y: cc.y, time: performance.now(), big: cc.big });
          S.current.eaten++;
          sfx.eat();
          gainXp((cc.big ? 3 : 1) * f.corpseXp);
        };
        // 鹿不一定肯吃：50%拒食，对这具尸体犹豫一阵（自己的旧身体不拒）
        if (s.faction === 'reindeer' && !c.big && Math.random() >= DEER_EAT_CHANCE) {
          c.shunUntil = now + DEER_SHUN_MS;
        } else {
          // 两阵营都要在尸体上停一小会儿才吞下（期间尸体可能被抢走）
          s.eatStart = now;
          s.eatingUntil = now + f.eatFreeze;
          s.eatCdUntil = now + f.eatFreeze + EAT_COOLDOWN;
          setTimeout(() => {
            if (phaseRef.current === 'playing') consume();
          }, f.eatFreeze);
        }
      }
    }

    s.corpses = s.corpses.filter(c => now - c.bornAt < CORPSE_TTL * (c.big ? 2 : 1));

    fireAutoWeapon(now);

    // 特效过期
    s.filamentFx = s.filamentFx.filter(fx => now - fx.time < 220);
    s.beamFx = s.beamFx.filter(fx => now - fx.time < 320);
    s.slashFx = s.slashFx.filter(fx => now - fx.time < 180);
    s.bloodFx = s.bloodFx.filter(fx => now - fx.time < 1200);
    s.eatFx = s.eatFx.filter(fx => now - fx.time < 450);
    s.dmgNums = s.dmgNums.filter(d => now - d.time < 600);

    // —— 清算者：无敌、无差别猎杀最近目标；碰到玩家即终局 ——
    if (s.reaper) {
      const rp = s.reaper;
      // 目标：最近的克隆，没有克隆则是玩家
      let tx = s.px, ty = s.py;
      let bestD = dist2(rp.x, rp.y, s.px, s.py);
      let targetMob: Mob | null = null;
      for (const m of s.mobs) {
        const d = dist2(rp.x, rp.y, m.x, m.y);
        if (d < bestD) { bestD = d; targetMob = m; tx = m.x; ty = m.y; }
      }
      const dd = Math.sqrt(dist2(rp.x, rp.y, tx, ty)) || 1;
      rp.x += ((tx - rp.x) / dd) * REAPER_SPEED * dt;
      rp.y += ((ty - rp.y) / dd) * REAPER_SPEED * dt;
      // 碰到克隆：即刻清算
      if (targetMob && dist2(rp.x, rp.y, targetMob.x, targetMob.y) < 16 * 16) {
        cloneKillClone(targetMob, now);
      }
      // 碰到玩家：终局（清算无视换体无敌）
      if (dist2(rp.x, rp.y, s.px, s.py) < 18 * 18) {
        addShake(6, 400);
        finish(false, now);
        return;
      }
    }

    // 通关：杀空全场（清算者进场后不再有通关，只能被追上）
    if (!s.reaper && s.poolLeft === 0 && s.mobs.length === 0) {
      finish(true, now);
      return;
    }

    // 排队的升级：局面稳定（离上次换体足够久）才弹出
    if (s.pendingLevelups > 0 && now - s.lastTakeoverAt >= LEVELUP_SAFE_MS) {
      s.pendingLevelups--;
      openLevelup();
    }
  };

  // ---------- 绘制 ----------
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const s = S.current;
    const now = performance.now();

    ctx.fillStyle = '#15110C';
    ctx.fillRect(0, 0, W, H);
    // 屏震：整个战场随机偏移
    const shaking = now < s.shakeUntil;
    ctx.save();
    if (shaking) {
      ctx.translate((Math.random() - 0.5) * s.shakeAmp * 2, (Math.random() - 0.5) * s.shakeAmp * 2);
    } else {
      s.shakeAmp = 0;
    }
    const A = s.arena;
    // 缩圈外区域压暗
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, 0, W, A.t);
    ctx.fillRect(0, A.b, W, H - A.b);
    ctx.fillRect(0, A.t, A.l, A.b - A.t);
    ctx.fillRect(A.r, A.t, W - A.r, A.b - A.t);
    ctx.strokeStyle = 'rgba(232,131,58,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(A.l, A.t, A.r - A.l, A.b - A.t);
    ctx.strokeStyle = 'rgba(232,131,58,0.11)';
    ctx.lineWidth = 1;
    for (let gx = WALL; gx <= W - WALL; gx += 60) {
      ctx.beginPath(); ctx.moveTo(gx, WALL); ctx.lineTo(gx, H - WALL); ctx.stroke();
    }
    for (let gy = WALL; gy <= H - WALL; gy += 60) {
      ctx.beginPath(); ctx.moveTo(WALL, gy); ctx.lineTo(W - WALL, gy); ctx.stroke();
    }
    for (let t = 0; t < 3; t++) {
      const tx = W * (0.25 + t * 0.25);
      ctx.fillStyle = 'rgba(232,131,58,0.18)';
      ctx.fillRect(tx - 34, 0, 68, WALL + 6);
      ctx.fillStyle = '#E8833A';
      ctx.fillRect(tx - 34, WALL + 4, 68, 3);
    }

    if (phaseRef.current === 'title') { ctx.restore(); return; }

    const f = FACTION_BASE[s.faction];

    // 血渍
    s.bloodFx.forEach(b => {
      const age = (now - b.time) / 1200;
      ctx.fillStyle = `rgba(150,30,20,${0.5 * (1 - age)})`;
      ctx.beginPath(); ctx.arc(b.x, b.y, 9 + age * 6, 0, Math.PI * 2); ctx.fill();
    });

    // 尸体（比背景更亮一档，带淡橙描边好辨认）
    s.corpses.forEach(c => {
      const age = (now - c.bornAt) / (CORPSE_TTL * (c.big ? 2 : 1));
      const alpha = Math.max(0.35, 1 - age);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = c.big ? '#E8833A' : '#8F7A64';
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.big ? 13 : 9, c.big ? 8 : 5.5, 0.5, 0, Math.PI * 2);
      ctx.fill();
      if (!c.big) {
        ctx.strokeStyle = 'rgba(232,131,58,0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      if (c.big) {
        ctx.strokeStyle = 'rgba(232,131,58,0.8)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(c.x, c.y, 17 + Math.sin(now / 200) * 2, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    });

    // 克隆
    s.mobs.forEach(m => {
      const stunned = now < m.stunUntil;
      const slowed = now < m.slowUntil;
      const hit = now < m.hitUntil;
      const elite = m.kills >= ELITE_KILLS;
      const r = elite ? 8.5 : 7;
      ctx.fillStyle = hit ? '#FFF7EE' : f.color;
      ctx.globalAlpha = 0.6 + 0.4 * (m.hp / m.maxHp);
      ctx.beginPath(); ctx.arc(m.x, m.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      if (elite) {
        // 精英金边；头狼双环
        ctx.strokeStyle = '#F5D061';
        ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.arc(m.x, m.y, r + 3, 0, Math.PI * 2); ctx.stroke();
        if (m.kills >= ALPHA_KILLS) {
          ctx.beginPath(); ctx.arc(m.x, m.y, r + 6.5, 0, Math.PI * 2); ctx.stroke();
        }
      }
      if (stunned) {
        ctx.strokeStyle = '#F5D061'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(m.x, m.y, 10, 0, Math.PI * 2); ctx.stroke();
      } else if (slowed) {
        ctx.strokeStyle = 'rgba(120,160,255,0.7)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(m.x, m.y, 9, 0, Math.PI * 2); ctx.stroke();
      }
    });

    // 止痛药（白色胶囊+橙十字）
    s.pills.forEach(p => {
      const blink = (now - p.bornAt) > PILL_TTL - 2000 ? (Math.sin(now / 100) > 0 ? 0.4 : 1) : 1;
      ctx.save();
      ctx.globalAlpha = blink;
      ctx.fillStyle = '#FFF7EE';
      ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#E8833A';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x - 4, p.y); ctx.lineTo(p.x + 4, p.y);
      ctx.moveTo(p.x, p.y - 4); ctx.lineTo(p.x, p.y + 4);
      ctx.stroke();
      ctx.restore();
    });

    // 补给舱（橙色板条箱，快过期时闪烁）
    s.supplies.forEach(p => {
      const blink = (now - p.bornAt) > SUPPLY_TTL - 2500 ? (Math.sin(now / 110) > 0 ? 0.4 : 1) : 1;
      ctx.save();
      ctx.globalAlpha = blink;
      ctx.fillStyle = '#1A140E';
      ctx.strokeStyle = '#E8833A';
      ctx.lineWidth = 2;
      ctx.fillRect(p.x - 9, p.y - 9, 18, 18);
      ctx.strokeRect(p.x - 9, p.y - 9, 18, 18);
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#E8833A';
      ctx.fillText('R', p.x, p.y + 4);
      ctx.restore();
    });

    // 玩家子弹（大弹头+拖尾）
    s.bullets.forEach(b => {
      ctx.strokeStyle = 'rgba(245,164,91,0.45)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 2.2, b.y - b.vy * 2.2);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.fillStyle = '#FFC98A';
      ctx.beginPath(); ctx.arc(b.x, b.y, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#F5A45B';
      ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill();
    });

    // 精英子弹（敌方，偏红）
    ctx.fillStyle = '#FF7A5C';
    s.enemyBullets.forEach(b => {
      ctx.beginPath(); ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2); ctx.fill();
    });

    // 精神细束（细小电流：自身→目标的抖动折线）
    s.filamentFx.forEach(fx => {
      const age = (now - fx.time) / 220;
      ctx.strokeStyle = `rgba(159,226,214,${0.9 * (1 - age)})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      const segs = 6;
      ctx.moveTo(fx.x1, fx.y1);
      for (let i = 1; i < segs; i++) {
        const t = i / segs;
        const bx = fx.x1 + (fx.x2 - fx.x1) * t + (Math.random() - 0.5) * 10;
        const by = fx.y1 + (fx.y2 - fx.y1) * t + (Math.random() - 0.5) * 10;
        ctx.lineTo(bx, by);
      }
      ctx.lineTo(fx.x2, fx.y2);
      ctx.stroke();
    });

    // 大雷电：与精神细束同款的电流质感，只是更粗更大，沿传播路径自然分叉
    s.beamFx.forEach(fx => {
      const age = (now - fx.time) / 320;
      const dx = fx.x2 - fx.x1, dy = fx.y2 - fx.y1;
      const blen = Math.sqrt(dx * dx + dy * dy) || 1;
      const px2 = -dy / blen, py2 = dx / blen; // 垂直方向
      // 生成抖动主路径（每帧重生成→天然闪烁）
      const segs = 10;
      const pts: Array<{ x: number; y: number }> = [{ x: fx.x1, y: fx.y1 }];
      for (let i = 1; i < segs; i++) {
        const t = i / segs;
        const jitter = (Math.random() - 0.5) * fx.width * 1.6 * Math.sin(Math.PI * t);
        pts.push({ x: fx.x1 + dx * t + px2 * jitter, y: fx.y1 + dy * t + py2 * jitter });
      }
      pts.push({ x: fx.x2, y: fx.y2 });
      const tracePath = () => {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      };
      ctx.save();
      ctx.globalAlpha = 1 - age;
      ctx.lineCap = 'round';
      // 辉光→主束→白芯，三层同一条抖动路径
      ctx.strokeStyle = 'rgba(245,208,97,0.25)';
      ctx.lineWidth = fx.width + 8;
      tracePath();
      ctx.strokeStyle = 'rgba(245,208,97,0.85)';
      ctx.lineWidth = Math.max(2, fx.width * 0.45 * (1 - age * 0.5));
      tracePath();
      ctx.strokeStyle = '#FFFDF2';
      ctx.lineWidth = 1.5;
      tracePath();
      // 传播式分叉：沿主路径挑2~3个中段顶点，向外劈出渐细的支流
      const forks = 2 + Math.floor(Math.random() * 2);
      for (let k = 0; k < forks; k++) {
        const idx = 2 + Math.floor(Math.random() * (segs - 4));
        const base = pts[idx];
        const mainAngle = Math.atan2(dy, dx);
        const forkAngle = mainAngle + (Math.random() < 0.5 ? 1 : -1) * (0.5 + Math.random() * 0.6);
        let bx = base.x, by = base.y;
        let flen = blen * (0.15 + Math.random() * 0.2);
        ctx.strokeStyle = 'rgba(245,208,97,0.7)';
        ctx.lineWidth = Math.max(1, fx.width * 0.2);
        ctx.beginPath();
        ctx.moveTo(bx, by);
        const fsegs = 4;
        for (let i = 1; i <= fsegs; i++) {
          bx += Math.cos(forkAngle) * (flen / fsegs) + (Math.random() - 0.5) * 8;
          by += Math.sin(forkAngle) * (flen / fsegs) + (Math.random() - 0.5) * 8;
          ctx.lineTo(bx, by);
        }
        ctx.stroke();
      }
      // 命中点电花
      ctx.fillStyle = 'rgba(245,208,97,0.7)';
      ctx.beginPath(); ctx.arc(fx.x2, fx.y2, 10 * (1 - age) + 3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });

    // 挥刀弧
    s.slashFx.forEach(fx => {
      const age = (now - fx.time) / 180;
      ctx.strokeStyle = `rgba(255,235,210,${1 - age})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, fx.range * (0.7 + 0.3 * age), fx.angle - fx.arc / 2, fx.angle + fx.arc / 2);
      ctx.stroke();
    });

    // 进食闪光（吃尸体时的亮环+光点）
    s.eatFx.forEach(fx => {
      const age = (now - fx.time) / 450;
      const r = (fx.big ? 30 : 20) * age + 6;
      ctx.strokeStyle = `rgba(255,240,200,${0.9 * (1 - age)})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(fx.x, fx.y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = `rgba(255,220,150,${0.7 * (1 - age)})`;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + fx.time % 10;
        ctx.beginPath();
        ctx.arc(fx.x + Math.cos(a) * r, fx.y + Math.sin(a) * r, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // 伤害数字
    ctx.textAlign = 'center';
    ctx.font = 'bold 11px monospace';
    s.dmgNums.forEach(d => {
      const age = (now - d.time) / 600;
      ctx.fillStyle = `rgba(255,200,140,${1 - age})`;
      ctx.fillText(String(d.v), d.x, d.y - age * 18);
    });

    // 清算者（黑核+橙十字旋转+外圈警示）
    if (s.reaper) {
      const rp = s.reaper;
      const rot = now / 300;
      ctx.save();
      ctx.translate(rp.x, rp.y);
      ctx.fillStyle = 'rgba(232,131,58,0.15)';
      ctx.beginPath(); ctx.arc(0, 0, 22 + Math.sin(now / 120) * 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#080604';
      ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#E8833A';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.stroke();
      ctx.rotate(rot);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-8, 0); ctx.lineTo(8, 0);
      ctx.moveTo(0, -8); ctx.lineTo(0, 8);
      ctx.stroke();
      ctx.restore();
    }

    // 玩家
    const eating = now < s.eatingUntil;
    const hasted = now < s.hasteUntil;
    if (hasted) {
      // 加速残影
      ctx.fillStyle = 'rgba(255,247,238,0.18)';
      ctx.beginPath(); ctx.arc(s.px - Math.cos(s.facing) * 10, s.py - Math.sin(s.facing) * 10, 8, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = f.color;
    ctx.beginPath(); ctx.arc(s.px, s.py, 9, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#FFF7EE';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(s.px, s.py, 13, 0, Math.PI * 2); ctx.stroke();
    // 换体无敌：闪烁白护罩
    if (now < s.invulnUntil) {
      ctx.strokeStyle = `rgba(255,255,255,${0.35 + 0.35 * Math.sin(now / 90)})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(s.px, s.py, 24, 0, Math.PI * 2); ctx.stroke();
    }
    // 止痛药生效：头顶白色小胶囊
    if (now < s.painFreeUntil) {
      ctx.fillStyle = '#FFF7EE';
      ctx.beginPath(); ctx.arc(s.px + 14, s.py - 32, 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#E8833A';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(s.px + 11.5, s.py - 32); ctx.lineTo(s.px + 16.5, s.py - 32);
      ctx.stroke();
    }
    // 主动技能冷却光圈：逐渐填满，满圈发亮=就绪
    // 兔=下一发子弹的回填进度（满弹匣时整圈亮）；鹿=大雷电冷却
    let cdFrac = 1;
    if (s.faction === 'rabbit') {
      const g = GUN_LEVELS[s.wActive - 1];
      cdFrac = s.ammo >= g.mag ? 1 : Math.min(1, (now - s.lastReload) / (g.reload * cdMul()));
    } else {
      const b = BOLT_LEVELS[s.wActive - 1];
      cdFrac = Math.min(1, (now - s.lastActive) / (b.cd * cdMul()));
    }
    const ringReady = s.faction === 'rabbit' ? s.ammo > 0 : cdFrac >= 1;
    if (cdFrac >= 1 && ringReady) {
      const pulse = 0.75 + 0.25 * Math.sin(now / 150);
      ctx.strokeStyle = `rgba(232,131,58,${pulse})`;
      ctx.lineWidth = 4.5;
      ctx.beginPath(); ctx.arc(s.px, s.py, 19, 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.strokeStyle = ringReady ? 'rgba(232,131,58,0.45)' : 'rgba(232,131,58,0.25)';
      ctx.lineWidth = 4.5;
      ctx.beginPath(); ctx.arc(s.px, s.py, 19, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(232,131,58,0.85)';
      ctx.beginPath();
      ctx.arc(s.px, s.py, 19, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * cdFrac);
      ctx.stroke();
    }
    // 兔：弹匣格（脚下一排小格）
    if (s.faction === 'rabbit') {
      const g = GUN_LEVELS[s.wActive - 1];
      const pw = 5, gap = 2;
      const total = g.mag * pw + (g.mag - 1) * gap;
      for (let i = 0; i < g.mag; i++) {
        ctx.fillStyle = i < s.ammo ? '#F5A45B' : 'rgba(232,131,58,0.2)';
        ctx.fillRect(s.px - total / 2 + i * (pw + gap), s.py + 24, pw, 3.5);
      }
    }
    // 武器标记：兔=枪管，鹿=法杖，指向当前瞄准方向(facing)
    ctx.save();
    ctx.translate(s.px, s.py);
    ctx.rotate(s.aimAngle);
    if (s.faction === 'rabbit') {
      ctx.fillStyle = '#FFF7EE';
      ctx.fillRect(8, -2.5, 15, 5);      // 枪管
      ctx.fillStyle = '#F5A45B';
      ctx.fillRect(21, -3.5, 4, 7);       // 枪口
    } else {
      ctx.strokeStyle = '#FFF7EE';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(23, 0); ctx.stroke(); // 杖杆
      ctx.fillStyle = '#8FDCCB';
      ctx.beginPath(); ctx.arc(26, 0, 4, 0, Math.PI * 2); ctx.fill();       // 顶端能量球
      ctx.strokeStyle = 'rgba(143,220,203,0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(26, 0, 7, 0, Math.PI * 2); ctx.stroke();     // 球外光环
    }
    ctx.restore();
    if (eating) {
      // 进食进度环：绕玩家一圈随进度填满，满圈=吃完（放开可动）
      const p = Math.min(1, Math.max(0, (now - s.eatStart) / Math.max(1, s.eatingUntil - s.eatStart)));
      const ringTrack = s.faction === 'rabbit' ? 'rgba(155,120,214,0.25)' : 'rgba(143,220,203,0.25)';
      const ringFill = s.faction === 'rabbit' ? '#B69AE0' : '#9BE8D6';
      ctx.lineCap = 'round';
      ctx.strokeStyle = ringTrack;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(s.px, s.py, 27, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = ringFill;
      ctx.beginPath(); ctx.arc(s.px, s.py, 27, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p); ctx.stroke();
      ctx.lineCap = 'butt';
      // 咀嚼小圆点：随进度轻微跳动
      ctx.fillStyle = 'rgba(255,247,238,0.9)';
      const bob = 2 * Math.sin(now / 70);
      ctx.beginPath(); ctx.arc(s.px, s.py - 30 + bob, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    // 玩家编号（只显示自己的）
    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = '#FFF7EE';
    ctx.fillText(`#${s.playerSerial}`, s.px, s.py - 32);
    // 血条（红色，持续流失，靠吃尸体回复）
    const hpw = 36;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(s.px - hpw / 2, s.py - 25, hpw, 5);
    ctx.fillStyle = s.hp / s.maxHp > 0.35 ? '#C9372C' : '#FF5C40';
    ctx.fillRect(s.px - hpw / 2, s.py - 25, hpw * Math.max(0, s.hp / s.maxHp), 5);

    // —— HUD ——（倒数期间按0计）
    const elapsed = Math.max(0, now - s.startAt);
    const day = Math.min(7, Math.floor(elapsed / DAY_MS) + 1);
    const remain = Math.max(0, DURATION - elapsed);
    const mm = Math.floor(remain / 60000);
    const ss = Math.floor((remain % 60000) / 1000).toString().padStart(2, '0');
    // HUD文字加深色阴影，暗底上更清晰
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 4;
    ctx.textAlign = 'left';
    ctx.font = 'bold 21px monospace';
    if (s.reaper) {
      ctx.fillStyle = Math.sin(now / 180) > 0 ? '#FF5C40' : '#FF9A6B';
      ctx.fillText(T.reaping, WALL + 10, WALL + 26);
    } else {
      ctx.fillStyle = '#FFA35A';
      ctx.fillText(lang === 'en' ? `${T.day} ${day}/7 · ${mm}:${ss}` : `${T.day}${day}天/7 · ${mm}:${ss}`, WALL + 10, WALL + 26);
    }
    // 连杀显示（×2就显示，窗口4秒更易触发）
    if (s.combo >= 2 && now < s.comboUntil) {
      const fresh = Math.min(1, (s.comboUntil - now) / COMBO_WINDOW);
      ctx.textAlign = 'center';
      ctx.font = `bold ${26 + Math.min(s.combo, 12) * 1.5}px monospace`;
      ctx.fillStyle = `rgba(245,164,91,${0.4 + 0.6 * fresh})`;
      ctx.fillText(`×${s.combo}`, W / 2, WALL + 52);
      ctx.textAlign = 'left';
    }
    ctx.font = 'bold 17px monospace';
    ctx.fillStyle = '#F5A45B';
    const bodyStr = lang === 'en' ? `${T.body} ${s.bodies}` : `${T.body}${s.bodies}具`;
    ctx.fillText(`${T.serial} #${s.playerSerial} · ${bodyStr} · ${T.kills} ${s.kills} · ${T.left} ${s.mobs.length + s.poolLeft}`, WALL + 10, WALL + 48);
    ctx.restore();
    // 经验条
    const xw = W - WALL * 2 - 20;
    const xr = Math.min(1, s.xp / xpNeed(s.level));
    ctx.fillStyle = 'rgba(232,131,58,0.15)';
    ctx.fillRect(WALL + 10, H - WALL - 14, xw, 6);
    ctx.fillStyle = '#E8833A';
    ctx.fillRect(WALL + 10, H - WALL - 14, xw * xr, 6);
    ctx.font = '13px monospace';
    ctx.fillStyle = 'rgba(232,131,58,0.7)';
    ctx.fillText(`Lv.${s.level}`, WALL + 10, H - WALL - 20);

    // 开局倒数
    if (now < s.freezeUntil) {
      const n = Math.ceil((s.freezeUntil - now) / 1000);
      ctx.textAlign = 'center';
      ctx.font = 'bold 96px monospace';
      ctx.fillStyle = `rgba(232,131,58,${0.5 + 0.5 * ((s.freezeUntil - now) % 1000) / 1000})`;
      ctx.fillText(String(n), W / 2, H / 2 + 30);
    }

    // 换体提示
    if (now < s.takeoverMsgUntil) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 30px serif';
      ctx.fillStyle = 'rgba(255,247,238,0.95)';
      ctx.fillText(T.takeover, W / 2, H / 2 - 60);
      ctx.font = '15px serif';
      ctx.fillStyle = 'rgba(232,131,58,0.9)';
      ctx.fillText(T.takeoverSub(s.prevSerial, s.playerSerial), W / 2, H / 2 - 32);
      ctx.font = 'italic 14px serif';
      ctx.fillStyle = 'rgba(255,247,238,0.75)';
      ctx.fillText(T.takeoverQuote, W / 2, H / 2 - 8);
    }
    // 鹿debuff：头疼——屏幕边缘泛红光晕+整体轻微模糊（模糊由canvas CSS filter实现）
    if (now < s.darkUntil) {
      const left = s.darkUntil - now;
      const k = Math.min(1, left / 800);
      const pulse = 0.8 + 0.2 * Math.sin(now / 130);
      const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.22, W / 2, H / 2, H * 0.72);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.7, `rgba(90,10,8,${0.28 * k * pulse})`);
      grad.addColorStop(1, `rgba(150,20,12,${0.6 * k * pulse})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      canvas.style.filter = `blur(${(1.8 * k).toFixed(2)}px)`;
    } else if (canvas.style.filter) {
      canvas.style.filter = '';
    }
    // 闪白
    if (now < s.flashUntil) {
      ctx.fillStyle = `rgba(255,255,255,${0.55 * ((s.flashUntil - now) / 350)})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore(); // 对应屏震save
  }, [lang]);

  // rAF
  useEffect(() => {
    let running = true;
    const loop = (t: number) => {
      if (!running) return;
      step(t);
      draw();
      S.current.animId = requestAnimationFrame(loop);
    };
    S.current.animId = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(S.current.animId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draw]);

  // 移动端进入游戏时请求浏览器全屏（须在用户手势内调用，隐藏地址栏减少误触/边缘手势）
  // 锁定横屏：多数内核要求先进全屏；不支持时回落到 CSS 旋转（shellStyle）
  const lockLandscape = () => {
    const orientation = window.screen?.orientation as (ScreenOrientation & { lock?: (o: string) => Promise<void> }) | undefined;
    try {
      orientation?.lock?.('landscape')?.catch(() => {});
    } catch { /* 不支持就算了 */ }
  };
  const requestAppFullscreen = () => {
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
    try {
      if (el.requestFullscreen) el.requestFullscreen().then(lockLandscape).catch(lockLandscape);
      else { el.webkitRequestFullscreen?.(); lockLandscape(); }
    } catch { /* 不支持就算了 */ }
  };
  useEffect(() => () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    try { (window.screen?.orientation as ScreenOrientation & { unlock?: () => void })?.unlock?.(); } catch { /* 忽略 */ }
  }, []);

  // ---------- 开局 ----------
  const startGame = (fac: Faction) => {
    if (isTouch) requestAppFullscreen();
    const s = S.current;
    const base = FACTION_BASE[fac];
    s.faction = fac;
    s.px = W / 2; s.py = H * 0.65;
    s.maxHp = base.hp; s.hp = base.hp;
    s.facing = -Math.PI / 2;
    s.aimAngle = -Math.PI / 2; s.aimSrc = '';
    s.playerSerial = 1 + Math.floor(Math.random() * POOL_TOTAL);
    s.prevSerial = s.playerSerial;
    s.serialNext = 1;
    s.wAuto = 1; s.wActive = 1;
    s.lastAuto = 0; s.lastActive = -99999;
    s.ammo = GUN_LEVELS[0].mag; s.lastReload = performance.now();
    s.passives = { mov: 0, vit: 0, cdr: 0, pick: 0 };
    s.xp = 0; s.level = 1;
    s.kills = 0; s.bodies = 1;
    s.lastDamagerId = -1;
    s.darkUntil = 0; s.selfSlowUntil = 0;
    s.mobs = []; s.corpses = []; s.bullets = []; s.enemyBullets = [];
    s.filamentFx = []; s.beamFx = []; s.slashFx = []; s.bloodFx = []; s.eatFx = []; s.dmgNums = [];
    s.hasteUntil = 0;
    s.poolLeft = POOL_TOTAL - 1 - INITIAL_CLONES;
    s.nextId = 1;
    const now0 = performance.now();
    // 开局倒数：世界静止，计时从倒数结束起算
    s.freezeUntil = now0 + START_COUNTDOWN_MS;
    s.startAt = now0 + START_COUNTDOWN_MS;
    s.lastWave = s.startAt;
    s.lastFrame = now0;
    s.slowmoUntil = 0; s.flashUntil = 0; s.takeoverMsgUntil = 0;
    s.eatingUntil = 0; s.eatStart = 0; s.eatCdUntil = 0;
    s.invulnUntil = 0; s.painFreeUntil = 0; s.firing = false;
    s.pills = []; s.lastPillSpawn = s.startAt;
    s.supplies = []; s.lastSupplySpawn = s.startAt;
    s.combo = 0; s.comboUntil = 0; s.maxCombo = 0;
    s.eaten = 0; s.pendingLevelups = 0; s.lastTakeoverAt = -99999;
    s.arena = { l: WALL, t: WALL, r: W - WALL, b: H - WALL };
    s.reaper = null;
    s.shakeUntil = 0; s.shakeAmp = 0; s.hitstopUntil = 0;
    countdownNumRef.current = -1;
    for (let i = 0; i < INITIAL_CLONES; i++) {
      const a = (i / INITIAL_CLONES) * Math.PI * 2;
      spawnClone(W / 2 + Math.cos(a) * 260, H / 2 + Math.sin(a) * 200, 0);
    }
    setEndInfo(null);
    phaseRef.current = 'playing';
    setPhase('playing');
  };

  // ---------- 输入 ----------
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = S.current.keys;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') { k.up = true; e.preventDefault(); }
      else if (e.code === 'ArrowDown' || e.code === 'KeyS') { k.down = true; e.preventDefault(); }
      else if (e.code === 'ArrowLeft' || e.code === 'KeyA') { k.left = true; e.preventDefault(); }
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') { k.right = true; e.preventDefault(); }
    };
    const up = (e: KeyboardEvent) => {
      const k = S.current.keys;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') k.up = false;
      else if (e.code === 'ArrowDown' || e.code === 'KeyS') k.down = false;
      else if (e.code === 'ArrowLeft' || e.code === 'KeyA') k.left = false;
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') k.right = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  // 竖屏旋转模式判定：画布被rotate(90deg)后，屏上包围盒宽<高
  const isRotatedView = () => {
    const c = canvasRef.current;
    if (!c) return false;
    const r = c.getBoundingClientRect();
    return r.width < r.height;
  };

  // 画布坐标换算（旋转模式下屏幕坐标要转回画布坐标系）
  const canvasCoords = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if (rect.width < rect.height) {
      return {
        x: ((clientY - rect.top) / rect.height) * W,
        y: ((rect.width - (clientX - rect.left)) / rect.width) * H,
      };
    }
    return {
      x: ((clientX - rect.left) / rect.width) * W,
      y: ((clientY - rect.top) / rect.height) * H,
    };
  };

  // 鼠标：按下开始连发（枪受射速/弹匣限制，雷电受冷却限制），移动更新准星，松开停
  const handleCanvasDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return; // 移动端用技能摇杆
    const s = S.current;
    const { x, y } = canvasCoords(e.clientX, e.clientY);
    s.aimX = x; s.aimY = y; s.aimSrc = 'mouse';
    s.firing = true;
    castActive(x - s.px, y - s.py);
  };
  const handleCanvasMove = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const { x, y } = canvasCoords(e.clientX, e.clientY);
    S.current.aimX = x; S.current.aimY = y; S.current.aimSrc = 'mouse';
  };
  useEffect(() => {
    const stop = () => { S.current.firing = false; };
    window.addEventListener('pointerup', stop);
    window.addEventListener('blur', stop);
    return () => {
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('blur', stop);
    };
  }, []);

  // 移动端：左摇杆移动
  const joyBaseRef = useRef<HTMLDivElement>(null);
  const [joyKnob, setJoyKnob] = useState({ x: 0, y: 0 });
  const handleJoy = (e: React.PointerEvent, end = false) => {
    const el = joyBaseRef.current;
    if (!el) return;
    if (end) {
      S.current.joy = { x: 0, y: 0, active: false };
      setJoyKnob({ x: 0, y: 0 });
      return;
    }
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = (e.clientX - cx) / (rect.width / 2);
    let dy = (e.clientY - cy) / (rect.height / 2);
    if (isRotatedView()) {
      // 旋转模式：屏幕方向转回游戏坐标系
      const rx = dy, ry = -dx;
      dx = rx; dy = ry;
    }
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 1) { dx /= len; dy /= len; }
    S.current.joy = { x: Math.abs(dx) > 0.15 ? dx : 0, y: Math.abs(dy) > 0.15 ? dy : 0, active: true };
    setJoyKnob({ x: dx * 48, y: dy * 48 });
  };

  // 移动端：右摇杆瞄准，松手释放主动技能
  const skillBaseRef = useRef<HTMLDivElement>(null);
  const [skillKnob, setSkillKnob] = useState({ x: 0, y: 0 });
  const skillDirRef = useRef({ x: 0, y: 0 });
  const handleSkillJoy = (e: React.PointerEvent, end = false) => {
    const el = skillBaseRef.current;
    if (!el) return;
    if (end) {
      // 推着即持续释放（step里处理），松手只是停
      skillDirRef.current = { x: 0, y: 0 };
      setSkillKnob({ x: 0, y: 0 });
      return;
    }
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = (e.clientX - cx) / (rect.width / 2);
    let dy = (e.clientY - cy) / (rect.height / 2);
    if (isRotatedView()) {
      const rx = dy, ry = -dx;
      dx = rx; dy = ry;
    }
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 1) { dx /= len; dy /= len; }
    skillDirRef.current = { x: dx, y: dy };
    S.current.aimSrc = 'joy';
    setSkillKnob({ x: dx * 48, y: dy * 48 });
  };

  // ---------- 渲染 ----------
  return (
    <div className="hatch-root fixed inset-0 bg-[#0A0806]/85 backdrop-blur-sm z-50 flex items-center justify-center p-1 md:p-4 overflow-hidden touch-none">
      <style>{`
        @media (pointer: coarse) {
          .hatch-root { padding: 0; }
        }
      `}</style>
      <div style={shellStyle} className="hatch-shell relative bg-[#12100D] border border-[#E8833A]/30 rounded-xl md:rounded-2xl shadow-2xl shadow-black/60 max-w-6xl w-full animate-float-in overflow-hidden">
        <div className="hatch-header flex items-center justify-between px-3 py-1.5 md:px-5 md:py-3 border-b border-[#E8833A]/20">
          <div className="flex items-baseline gap-3">
            <h2 className="text-[18px] text-[#E8833A] font-bold tracking-[0.25em] serif-text">{T.title}</h2>
            <span className="text-[12px] text-[#E8833A]/50 tracking-wider">{T.subtitle}</span>
          </div>
          <div className="flex items-center gap-3">
            {isTouch && (
              <button
                onClick={() => setForceRotate(v => !v)}
                className="text-[#E8833A]/60 hover:text-[#E8833A] transition-colors select-none"
                aria-label={lang === 'en' ? 'rotate screen' : '旋转屏幕'}
              >
                <RotateCw size={18} />
              </button>
            )}
            <button
              onClick={() => setShowRank(true)}
              className="text-[#E8833A]/60 hover:text-[#E8833A] transition-colors select-none"
              aria-label={lang === 'en' ? 'leaderboard' : '排行榜'}
            >
              <Trophy size={18} />
            </button>
            <button
              onClick={toggleMute}
              className="text-[#E8833A]/60 hover:text-[#E8833A] transition-colors select-none"
              aria-label={muted ? 'unmute' : 'mute'}
            >
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            {onToggleLang ? (
              <button
                onClick={onToggleLang}
                className="text-[11px] tracking-widest text-[#E8833A]/60 hover:text-[#E8833A] transition-colors"
                aria-label="switch language"
              >
                {lang === 'zh' ? 'EN' : '中'}
              </button>
            ) : (
              <button onClick={onClose} className="text-[#E8833A]/60 hover:text-[#E8833A] transition-colors" aria-label="close">
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        <div className="hatch-body relative">
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            className="block mx-auto cursor-crosshair touch-none"
            style={canvasStyle}
            onPointerDown={handleCanvasDown}
            onPointerMove={handleCanvasMove}
          />


          {/* 标题：选阵营 */}
          {phase === 'title' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-8 bg-[#0D0B09]/55">
              <div className="flex gap-6 flex-row px-6">
                <button
                  onClick={() => startGame('rabbit')}
                  className="w-64 p-5 rounded-xl border border-[#8C64C4]/70 bg-[#1E1630] hover:bg-[#281C40] hover:border-[#9B78D6] transition-all text-left group"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-4 h-4 rounded-full bg-[#9B78D6] group-hover:shadow-[0_0_10px_#9B78D6]" />
                    <span className="text-[18px] text-[#CDB6F0] font-bold serif-text">{T.rabbitName}</span>
                  </div>
                  <p className="text-[13px] text-[#CDB6F0]/90 leading-relaxed">{T.rabbitDesc}</p>
                </button>
                <button
                  onClick={() => startGame('reindeer')}
                  className="w-64 p-5 rounded-xl border border-[#3FBFA5]/70 bg-[#12241F] hover:bg-[#183029] hover:border-[#3FBFA5] transition-all text-left group"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-4 h-4 rounded-full bg-[#3FBFA5] group-hover:shadow-[0_0_10px_#3FBFA5]" />
                    <span className="text-[18px] text-[#8FDCCB] font-bold serif-text">{T.reindeerName}</span>
                  </div>
                  <p className="text-[13px] text-[#8FDCCB]/90 leading-relaxed">{T.reindeerDesc}</p>
                </button>
              </div>
              <p className="text-[14px] text-[#F5A45B]/90 tracking-wide">{T.hint}</p>
            </div>
          )}

          {/* 升级三选一 */}
          {phase === 'levelup' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-[#0D0B09]/80">
              <p className="text-[#E8833A] text-[1.65rem] font-bold serif-text tracking-[0.4em]">{T.levelup}</p>
              <div className="flex gap-4 flex-row px-6">
                {upgradeOptions.map((opt, i) => {
                  const cardCls = opt.rarity === 'anomalous'
                    ? 'border-[#F5D061] bg-[#221A0C] hover:bg-[#2E230F] shadow-[0_0_14px_rgba(245,208,97,0.35)]'
                    : opt.rarity === 'fine'
                      ? 'border-[#6FCBB8] bg-[#0F1A17] hover:bg-[#142420]'
                      : 'border-[#E8833A]/40 bg-[#1A140E] hover:bg-[#241A10] hover:border-[#E8833A]';
                  const titleCls = opt.rarity === 'anomalous' ? 'text-[#F5D061]' : opt.rarity === 'fine' ? 'text-[#6FCBB8]' : 'text-[#FFB877]';
                  return (
                    <button
                      key={i}
                      onClick={() => applyUpgrade(opt)}
                      className={`w-56 p-4 rounded-xl border transition-all text-left ${cardCls}`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <p className={`text-[18px] font-bold serif-text ${titleCls}`}>{opt.title}</p>
                        {opt.rarity !== 'normal' && (
                          <span className={`text-[11px] tracking-widest ${titleCls}`}>
                            {opt.rarity === 'anomalous' ? T.rarityAnom : T.rarityFine}
                          </span>
                        )}
                      </div>
                      <p className="text-[13px] text-[#E8833A]/70 leading-relaxed">{opt.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 结算 */}
          {phase === 'ended' && endInfo && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-[#0D0B09]/85">
              <p className={`text-[2.1rem] font-bold serif-text tracking-[0.2em] ${endInfo.win ? 'text-[#E8833A]' : 'text-[#8A4B3A]'}`}>
                {endInfo.win ? T.win : T.lose}
              </p>
              <p className="text-[15px] text-[#E8833A]/60 serif-text italic">{endInfo.win ? T.winSub : T.loseSub}</p>
              <div className="text-[#FFF7EE] font-mono text-[15px] space-y-1.5 text-center bg-[#1A140E] border border-[#E8833A]/25 rounded-xl px-8 py-5">
                <p>{T.statKills} {endInfo.kills}</p>
                <p>{T.statEaten} {endInfo.eaten}</p>
                <p>{T.statTime} {endInfo.daysUsed} {T.statTimeUnit}</p>
                <p>{T.statCombo} ×{endInfo.maxCombo}</p>
                <p>{T.statBodies} {endInfo.bodies}</p>
              </div>
              <p className="text-[12px] font-mono text-[#E8833A]/55 h-4">
                {rankState === 'sending' && T.rankSending}
                {rankState === 'sent' && T.rankSent}
                {rankState === 'failed' && T.rankFailed}
              </p>
              <div className="flex items-center gap-3">
              <button
                onClick={() => setShowRank(true)}
                className="px-6 py-2.5 rounded-full border border-[#E8833A]/50 text-[#E8833A] hover:bg-[#E8833A]/10 transition-colors"
              >
                {T.rankView}
              </button>
              <button
                onClick={() => { phaseRef.current = 'title'; setPhase('title'); }}
                className="px-8 py-2.5 rounded-full bg-[#E8833A] text-[#12100D] font-bold hover:bg-[#F5A45B] transition-colors"
              >
                {T.retry}
              </button>
              </div>
            </div>
          )}

          {showRank && <Leaderboard board={RANK_BOARD} lang={lang} onClose={() => setShowRank(false)} />}

          {/* 移动端：左移动摇杆 + 右技能摇杆（按触屏判定显示，不按宽度） */}
          {phase === 'playing' && isTouch && (
            <>
              <div
                ref={joyBaseRef}
                className="absolute bottom-8 left-8 w-44 h-44 rounded-full border border-[#E8833A]/30 bg-[#E8833A]/5 touch-none"
                onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); handleJoy(e); }}
                onPointerMove={(e) => { if (S.current.joy.active) handleJoy(e); }}
                onPointerUp={(e) => handleJoy(e, true)}
                onPointerCancel={(e) => handleJoy(e, true)}
              >
                <div
                  className="absolute w-[77px] h-[77px] rounded-full bg-[#E8833A]/40 border border-[#E8833A]/60"
                  style={{ left: `calc(50% - 38.5px + ${joyKnob.x}px)`, top: `calc(50% - 38.5px + ${joyKnob.y}px)` }}
                />
              </div>
              <div
                ref={skillBaseRef}
                className="absolute bottom-8 right-8 w-44 h-44 rounded-full border border-[#F5D061]/40 bg-[#F5D061]/5 touch-none"
                onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); handleSkillJoy(e); }}
                onPointerMove={(e) => { if (skillDirRef.current.x !== 0 || skillDirRef.current.y !== 0) handleSkillJoy(e); }}
                onPointerUp={(e) => handleSkillJoy(e, true)}
                onPointerCancel={(e) => handleSkillJoy(e, true)}
              >
                <div
                  className="absolute w-[77px] h-[77px] rounded-full bg-[#F5D061]/40 border border-[#F5D061]/60"
                  style={{ left: `calc(50% - 38.5px + ${skillKnob.x}px)`, top: `calc(50% - 38.5px + ${skillKnob.y}px)` }}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default HatchGame;
