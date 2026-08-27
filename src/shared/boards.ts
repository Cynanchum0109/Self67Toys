// 各游戏的榜单编号与分数编码。
// Toy 的榜单只接受一个整数，附加信息（阵营、结局、是否击落飞碟）压进这个整数里。

import { LeaderboardTheme } from './Leaderboard';

// ---------- 榜单编号 ----------
export const BOARD_RCOP = 1;
export const BOARD_UFO = 2;
export const BOARD_DINO = 3;

// ---------- R公司孵化场观测：结束时的战力 ----------
// score = 战力×100（封顶 999999）×1000 + 结局序号×10 + 队伍
// 战力是高位，所以排序就是按战力；同战力时结局/队伍只作稳定排序用。
export const RCOP_ENDINGS = [
  'escape',
  'survive',
  'rabbit_kills_reindeer',
  'reindeer_kills_rabbit',
  'rabbit_survives',
  'reindeer_survives',
] as const;
export type RcopEnding = (typeof RCOP_ENDINGS)[number];

// SDK 限制 score ∈ [-2^24, 2^24-1]，所以把队伍与结局压进低 4 位，剩下的全给战力。
// score = 战力×100 × 16 + (结局序号×2 + 队伍)
const RCOP_COMBO_SPAN = 16; // 6 个结局 × 2 个队伍 = 12，占 4 位
const RCOP_POWER_MAX = Math.floor((2 ** 24 - 1) / RCOP_COMBO_SPAN); // 战力×100 的上限

export const encodeRcop = (power: number, ending: string, team: 0 | 1): number => {
  const centi = Math.min(RCOP_POWER_MAX, Math.max(0, Math.round(power * 100)));
  const idx = Math.max(0, RCOP_ENDINGS.indexOf(ending as RcopEnding));
  return centi * RCOP_COMBO_SPAN + idx * 2 + team;
};

export const decodeRcop = (score: number): { power: number; ending: RcopEnding; team: 0 | 1 } => {
  const s = Math.max(0, Math.floor(score));
  const combo = s % RCOP_COMBO_SPAN;
  return {
    power: Math.floor(s / RCOP_COMBO_SPAN) / 100,
    ending: RCOP_ENDINGS[Math.floor(combo / 2)] ?? RCOP_ENDINGS[0],
    team: (combo % 2) as 0 | 1,
  };
};

// 队伍配色沿用场上的点：驯鹿青、兔子紫
export const RCOP_TEAM = {
  0: { color: '#2FA38C', zh: '驯鹿', en: 'Reindeer' },
  1: { color: '#7C55B0', zh: '兔子', en: 'Rabbit' },
} as const;

// 榜单里用的结局短标签（正文那几段长文案不适合塞进一行）
export const RCOP_ENDING_LABEL: Record<RcopEnding, { zh: string; en: string }> = {
  escape: { zh: '逃脱', en: 'Escape' },
  survive: { zh: '存活', en: 'Survive' },
  rabbit_kills_reindeer: { zh: '兔子击杀驯鹿', en: 'Rabbit slays Reindeer' },
  reindeer_kills_rabbit: { zh: '驯鹿击杀兔子', en: 'Reindeer slays Rabbit' },
  rabbit_survives: { zh: '兔子独活', en: 'Rabbit survives' },
  reindeer_survives: { zh: '驯鹿独活', en: 'Reindeer survives' },
};

// ---------- 同事是外星人？！：存活时间，击落飞碟 +20 ----------
// score = (存活秒数 + 击落加成) × 10 + 结局码
// 结局码 0 只出现在早期记录里（当时只记了「有没有击落」），显示时不标结局。
export const UFO_SHOOTDOWN_BONUS = 20;

export type UfoEnding = 'unknown' | 'won' | 'alien' | 'human';
const UFO_ENDING_CODE: Record<Exclude<UfoEnding, 'unknown'>, number> = { won: 1, alien: 2, human: 3 };
const UFO_CODE_ENDING: Record<number, UfoEnding> = { 0: 'unknown', 1: 'won', 2: 'alien', 3: 'human' };

export const UFO_ENDING_LABEL: Record<Exclude<UfoEnding, 'unknown'>, { zh: string; en: string }> = {
  won: { zh: '抓走了外星人', en: 'Caught the alien' },
  alien: { zh: '被外星人抓走了', en: 'Abducted by the alien' },
  human: { zh: '被人类抓走了', en: 'Caught by the humans' },
};

export const encodeUfo = (seconds: number, ending: Exclude<UfoEnding, 'unknown'>): number => {
  const base = Math.max(0, Math.round(seconds)) + (ending === 'won' ? UFO_SHOOTDOWN_BONUS : 0);
  return base * 10 + UFO_ENDING_CODE[ending];
};

export const decodeUfo = (score: number): { points: number; ending: UfoEnding } => {
  const s = Math.max(0, Math.floor(score));
  return { points: Math.floor(s / 10), ending: UFO_CODE_ENDING[s % 10] ?? 'unknown' };
};

// ---------- 碰到就要结婚喔～：坚持的秒数 ----------
export const encodeDino = (score: number): number => Math.max(0, Math.floor(score));
export const decodeDino = (score: number): number => Math.max(0, Math.floor(score));

// ---------- 皮肤 ----------

// 观测：米白卡片 + 焦橙，跟模拟窗口一致
export const RCOP_THEME: LeaderboardTheme = {
  overlay: 'absolute inset-0 z-30 flex items-center justify-center bg-[#1A1512]/70 px-4 py-6',
  panel: 'flex max-h-full w-full max-w-md flex-col rounded-[2rem] border border-[#F6D8B5] bg-white shadow-[0_25px_50px_-12px_rgba(26,21,18,0.3)]',
  headerBorder: 'border-b border-[#F6D8B5]/70',
  title: 'serif-text text-[1.15rem] font-bold text-[#C96A24]',
  closeBtn: 'mt-0.5 shrink-0 text-[#C96A24]/60 transition-colors hover:text-[#C96A24]',
  tabActive: 'flex-1 rounded-full bg-[#C96A24] px-2 py-1.5 text-[12px] font-bold text-white',
  tabIdle: 'flex-1 rounded-full bg-[#FBEEDF] px-2 py-1.5 text-[12px] text-[#C96A24]/70 transition-colors hover:text-[#C96A24]',
  rowOdd: 'rounded-lg odd:bg-[#FDF6EE]',
  rankTop: 'text-[#C96A24]',
  rankNormal: 'text-[#C9A98A]',
  avatarBg: 'rounded-full bg-[#FBEEDF]',
  name: 'text-[#5C4B3C]',
  muted: 'text-[#C9A98A]',
  footerBorder: 'border-t border-[#F6D8B5]/70',
  footer: 'text-[#C96A24]/80',
  scoreClass: 'shrink-0 text-right',
};

// 外星人：像素夜色，锐角、等宽字
export const UFO_THEME: LeaderboardTheme = {
  overlay: 'absolute inset-0 z-30 flex items-center justify-center bg-[#0B0616]/90 px-4 py-6',
  panel: 'flex max-h-full w-full max-w-md flex-col border-2 border-[#8B5FBF] bg-[#1B0F33] shadow-[0_0_0_4px_rgba(11,6,22,0.6)]',
  headerBorder: 'border-b-2 border-[#8B5FBF]/60',
  title: 'font-mono text-[1.05rem] font-bold tracking-[0.14em] text-[#F2B6FB]',
  closeBtn: 'mt-0.5 shrink-0 text-[#F2B6FB]/60 transition-colors hover:text-[#F2B6FB]',
  tabActive: 'flex-1 bg-[#6BD4C0] px-2 py-1.5 font-mono text-[12px] font-bold text-[#1B0F33]',
  tabIdle: 'flex-1 bg-[#2A1A4D] px-2 py-1.5 font-mono text-[12px] text-[#B9A3E0] transition-colors hover:text-[#F2B6FB]',
  rowOdd: 'odd:bg-[#241442]',
  rankTop: 'text-[#6BD4C0]',
  rankNormal: 'text-[#8B5FBF]',
  avatarBg: 'bg-[#2A1A4D]',
  name: 'font-mono text-[#D9CBF5]',
  muted: 'text-[#8B5FBF]',
  footerBorder: 'border-t-2 border-[#8B5FBF]/60',
  footer: 'text-[#B9A3E0]',
  scoreClass: 'shrink-0 text-right font-mono',
};

// 结婚：奶油纸面 + 薄荷淡紫，跟恐龙跳窗口一致
export const DINO_THEME: LeaderboardTheme = {
  overlay: 'absolute inset-0 z-30 flex items-center justify-center bg-[#2D2438]/45 px-4 py-6 backdrop-blur-sm',
  panel: 'flex max-h-full w-full max-w-md flex-col rounded-[2rem] border border-[#EAE5F0] bg-[#FDFCFA] shadow-[0_25px_50px_-12px_rgba(45,58,49,0.2)]',
  headerBorder: 'border-b border-[#EAE5F0]',
  title: 'serif-text text-[1.15rem] font-bold text-[#7B5B89]',
  closeBtn: 'mt-0.5 shrink-0 text-[#7B5B89]/60 transition-colors hover:text-[#7B5B89]',
  tabActive: 'flex-1 rounded-full bg-[#7B5B89] px-2 py-1.5 text-[12px] font-bold text-white',
  tabIdle: 'flex-1 rounded-full bg-[#F0EDF5] px-2 py-1.5 text-[12px] text-[#7B5B89]/70 transition-colors hover:text-[#7B5B89]',
  rowOdd: 'rounded-lg odd:bg-[#F8F6FA]',
  rankTop: 'text-[#6FCBB8]',
  rankNormal: 'text-[#C6B8D8]',
  avatarBg: 'rounded-full bg-[#E8F9F6]',
  name: 'text-[#5A5064]',
  muted: 'text-[#C6B8D8]',
  footerBorder: 'border-t border-[#EAE5F0]',
  footer: 'text-[#7B5B89]/80',
  scoreClass: 'shrink-0 text-right',
};

// ---------- 孵化场：击杀数为主，用时 / 被击杀次数作同分排序 ----------
// 榜上有三类数据，靠分数区间区分，早期记录必须继续读对：
//
//   ① 触犯禁忌（活到第七天被清算者带走）：整段抬到 16,000,000 以上，
//      恒高于任何普通成绩 —— 达成即榜首，禁忌之间再比击杀数。
//      score = 16000000 + 击杀数×4800 + (255-存活秒)×32 + (15-被击杀次数)×2 + 阵营
//
//   ② 现在的普通成绩：score = 击杀数×100000 + 余数，余数落在 20000..79999
//      余数 = 20000 + (255-存活秒)×128 + (15-被击杀次数)×8 + 阵营
//
//   ③ 早期记录：score = 击杀数×100000 + 余数，余数 ≥ 80000（= 99999 - 用时厘秒）
//      当时没记被击杀次数与阵营。
//
// 普通成绩上限 159×100000+99999 = 15,999,999，正好卡在禁忌段之下；
// 禁忌段上限 16000000+159×4800+2431 = 16,765,631，仍在 SDK 的 2^24 内。
const HATCH_KILL_SPAN = 100_000;
const HATCH_LEGACY_FLOOR = 80_000; // 余数到这个值以上算早期记录
const HATCH_NEW_FLOOR = 20_000; // 普通成绩余数的起点
const HATCH_TABOO_FLOOR = 16_000_000; // 禁忌段起点
const HATCH_TABOO_SPAN = 4_800; // 禁忌段里每一个击杀数占的宽度
const HATCH_SEC_MAX = 255;
const HATCH_DEATH_MAX = 15;
const HATCH_KILL_MAX = 159; // 克隆池上限，普通成绩不得越过禁忌段

export interface HatchEntry {
  kills: number;
  seconds: number;
  /** 早期记录没有下面这几项 */
  deaths: number | null;
  team: 0 | 1 | null;
  /** 活到第七天、最后被清算者带走 */
  reaped: boolean;
}

export const encodeHatch = (
  kills: number,
  elapsedMs: number,
  deaths: number,
  faction: 'rabbit' | 'reindeer',
  reaped: boolean,
): number => {
  const k = Math.min(HATCH_KILL_MAX, Math.max(0, Math.floor(kills)));
  const sec = Math.min(HATCH_SEC_MAX, Math.max(0, Math.round(elapsedMs / 1000)));
  const d = Math.min(HATCH_DEATH_MAX, Math.max(0, Math.floor(deaths)));
  const side = faction === 'rabbit' ? 1 : 0;

  if (reaped) {
    return (
      HATCH_TABOO_FLOOR +
      k * HATCH_TABOO_SPAN +
      (HATCH_SEC_MAX - sec) * 32 +
      (HATCH_DEATH_MAX - d) * 2 +
      side
    );
  }

  const rest =
    HATCH_NEW_FLOOR + (HATCH_SEC_MAX - sec) * 128 + (HATCH_DEATH_MAX - d) * 8 + side;
  return k * HATCH_KILL_SPAN + rest;
};

export const decodeHatch = (score: number): HatchEntry => {
  const s = Math.max(0, Math.floor(score));

  // ① 禁忌段
  if (s >= HATCH_TABOO_FLOOR) {
    const t = s - HATCH_TABOO_FLOOR;
    const r = t % HATCH_TABOO_SPAN;
    const low = r % 32;
    return {
      kills: Math.floor(t / HATCH_TABOO_SPAN),
      seconds: HATCH_SEC_MAX - Math.floor(r / 32),
      deaths: HATCH_DEATH_MAX - Math.floor(low / 2),
      team: ((low & 1) as 0 | 1),
      reaped: true,
    };
  }

  const kills = Math.floor(s / HATCH_KILL_SPAN);
  const rest = s % HATCH_KILL_SPAN;

  // ③ 早期记录：余数直接是 99999 - 用时厘秒
  if (rest >= HATCH_LEGACY_FLOOR) {
    return {
      kills,
      seconds: Math.round((HATCH_KILL_SPAN - 1 - rest) / 10) / 10,
      deaths: null,
      team: null,
      reaped: false,
    };
  }

  // 更早一版短命的编码落在这段，读不回来，只保留击杀数
  if (rest < HATCH_NEW_FLOOR) {
    return { kills, seconds: 0, deaths: null, team: null, reaped: false };
  }

  // ② 现在的普通成绩
  const t = rest - HATCH_NEW_FLOOR;
  const low = t % 128;
  return {
    kills,
    seconds: HATCH_SEC_MAX - Math.floor(t / 128),
    deaths: HATCH_DEATH_MAX - Math.floor(low / 8),
    team: ((low & 1) as 0 | 1),
    reaped: false,
  };
};

// ---------- 孵化场（独立作品，自己一个榜）----------
export const BOARD_HATCH = 1;

// 孵化场：暗底焦橙，跟游戏窗口一致
export const HATCH_THEME: LeaderboardTheme = {
  overlay: 'absolute inset-0 z-30 flex items-center justify-center bg-[#0D0B09]/92 px-4 py-6',
  panel: 'flex max-h-full w-full max-w-md flex-col rounded-2xl border border-[#E8833A]/25 bg-[#15110C] shadow-[0_20px_45px_-15px_rgba(0,0,0,0.8)]',
  headerBorder: 'border-b border-[#E8833A]/15',
  title: 'serif-text text-[1.15rem] font-bold tracking-[0.14em] text-[#E8833A]',
  closeBtn: 'mt-0.5 shrink-0 text-[#E8833A]/60 transition-colors hover:text-[#E8833A]',
  tabActive: 'flex-1 rounded-full bg-[#E8833A] px-2 py-1.5 text-[12px] font-bold text-[#12100D]',
  tabIdle: 'flex-1 rounded-full bg-[#221A12] px-2 py-1.5 text-[12px] text-[#E8833A]/65 transition-colors hover:text-[#E8833A]',
  rowOdd: 'rounded-lg odd:bg-[#1C1610]',
  rankTop: 'text-[#E8833A]',
  rankNormal: 'text-[#E8833A]/45',
  avatarBg: 'rounded-full bg-[#2A2018]',
  name: 'text-[#FFF7EE]/85',
  muted: 'text-[#E8833A]/50',
  footerBorder: 'border-t border-[#E8833A]/15',
  footer: 'text-[#E8833A]/70',
  scoreClass: 'shrink-0 text-right font-mono text-[12px] text-[#E8833A]/80',
};
