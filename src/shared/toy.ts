// Toy 平台 SDK 封装
// SDK 由 index.html 里的 <script src="https://s1.hdslb.com/bfs/seed/toy/app/sdk/toy-sdk.js"> 注入到 window.toy，
// 在本地开发 / 非 Toy 环境下不存在，所有调用都要能安全降级。

export type RankPeriod = 'day' | 'week' | 'month' | 'all';

export interface RankEntry {
  rank: number;
  score: number;
  nickname?: string;
  name?: string;
  avatar?: string;
  face?: string;
}

export interface MyRank {
  ranked: boolean;
  rank?: number;
  score?: number;
}

interface ToyApi {
  submitScore?: (opts: { board: number; score: number }) => Promise<unknown>;
  getRankList?: (opts: { board: number; period: RankPeriod; limit?: number }) => Promise<RankEntry[]>;
  getMyRank?: (opts: { board: number; period: RankPeriod }) => Promise<MyRank>;
  getCloudStorage?: (opts: { key: string }) => Promise<unknown>;
  setCloudStorage?: (opts: { key: string; value: string }) => Promise<unknown>;
}

declare global {
  interface Window { toy?: ToyApi }
}

const api = (): ToyApi | null => (typeof window !== 'undefined' && window.toy) || null;

// SDK 在非 Toy 环境（本地预览、外链直开）里可能永远不回调，统一加超时
const READ_TIMEOUT_MS = 6000;

function withTimeout<T>(task: Promise<T>, ms = READ_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('toy sdk timeout')), ms);
    task.then(
      v => { clearTimeout(timer); resolve(v); },
      e => { clearTimeout(timer); reject(e); }
    );
  });
}

export const hasRankApi = () => {
  const t = api();
  return !!(t && typeof t.submitScore === 'function' && typeof t.getRankList === 'function');
};

// ---------- 分数编码 ----------
// Toy 榜单只接受单个整数，这里把「击杀数 + 用时」压成一个数：
//   score = kills * TIME_SPAN + (TIME_SPAN - 1 - 用时厘秒)
// 击杀多的一定更大；击杀相同时，用时短的余数更大 → 排在前面。
const TIME_SPAN = 100_000; // 余数上限，对应 999.99 秒，足够覆盖 3 分钟一局

export const encodeScore = (kills: number, elapsedMs: number): number => {
  const k = Math.max(0, Math.floor(kills));
  const cs = Math.min(TIME_SPAN - 1, Math.max(0, Math.round(elapsedMs / 10)));
  return k * TIME_SPAN + (TIME_SPAN - 1 - cs);
};

export const decodeScore = (score: number): { kills: number; seconds: number } => {
  const s = Math.max(0, Math.floor(score));
  const kills = Math.floor(s / TIME_SPAN);
  const cs = TIME_SPAN - 1 - (s % TIME_SPAN);
  return { kills, seconds: Math.round(cs / 10) / 10 };
};

// ---------- API ----------
export async function submitScore(board: number, score: number): Promise<boolean> {
  const t = api();
  if (!t?.submitScore) return false;
  try {
    await withTimeout(Promise.resolve(t.submitScore({ board, score })));
    return true;
  } catch {
    return false;
  }
}

export async function getRankList(board: number, period: RankPeriod, limit = 50): Promise<RankEntry[]> {
  const t = api();
  if (!t?.getRankList) throw new Error('rank api unavailable');
  const list = await withTimeout(Promise.resolve(t.getRankList({ board, period, limit })));
  return Array.isArray(list) ? list : [];
}

export async function getMyRank(board: number, period: RankPeriod): Promise<MyRank | null> {
  const t = api();
  if (!t?.getMyRank) return null;
  try {
    return await withTimeout(Promise.resolve(t.getMyRank({ board, period })));
  } catch {
    return null;
  }
}

// B站头像域名在 Toy 沙箱里需要 no-referrer，统一走 https
export const avatarUrl = (raw?: string): string => {
  if (!raw) return '';
  if (raw.startsWith('//')) return 'https:' + raw;
  if (raw.startsWith('http://')) return 'https://' + raw.slice(7);
  return raw.startsWith('https://') ? raw : '';
};
