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

const RCOP_POWER_MAX = 999_999; // 战力×100 的上限

export const encodeRcop = (power: number, ending: string, team: 0 | 1): number => {
  const centi = Math.min(RCOP_POWER_MAX, Math.max(0, Math.round(power * 100)));
  const idx = Math.max(0, RCOP_ENDINGS.indexOf(ending as RcopEnding));
  return centi * 1000 + idx * 10 + team;
};

export const decodeRcop = (score: number): { power: number; ending: RcopEnding; team: 0 | 1 } => {
  const s = Math.max(0, Math.floor(score));
  const rest = s % 1000;
  return {
    power: Math.floor(s / 1000) / 100,
    ending: RCOP_ENDINGS[Math.floor(rest / 10)] ?? RCOP_ENDINGS[0],
    team: (rest % 10 === 1 ? 1 : 0) as 0 | 1,
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
// score = (存活秒数 + 击落加成20) × 10 + 击落标记
export const UFO_SHOOTDOWN_BONUS = 20;

export const encodeUfo = (seconds: number, shotDown: boolean): number => {
  const base = Math.max(0, Math.round(seconds)) + (shotDown ? UFO_SHOOTDOWN_BONUS : 0);
  return base * 10 + (shotDown ? 1 : 0);
};

export const decodeUfo = (score: number): { points: number; shotDown: boolean } => {
  const s = Math.max(0, Math.floor(score));
  return { points: Math.floor(s / 10), shotDown: s % 10 === 1 };
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
