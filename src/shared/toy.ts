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

// ---------- 分数上下界 ----------
// Toy 榜单只接受单个整数，SDK 限制 score ∈ [-2^24, 2^24-1]。
// 各游戏怎么把自己的成绩压进这一个整数，见 shared/boards.ts。
export const SCORE_MIN = -(2 ** 24);
export const SCORE_MAX = 2 ** 24 - 1;

// ---------- API ----------
export async function submitScore(board: number, score: number): Promise<boolean> {
  const t = api();
  if (!t?.submitScore) return false;
  // 越界或非整数会被 SDK 直接判 invalid_param，这里统一夹紧
  const safe = Math.min(SCORE_MAX, Math.max(SCORE_MIN, Math.round(score)));
  try {
    await withTimeout(Promise.resolve(t.submitScore({ board, score: safe })));
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

// ---------- 容器朝向 ----------
// Toy 容器自己支持锁定朝向，比 screen.orientation.lock 可靠（后者多数内核要求先进全屏）。
export type Orientation = 'portrait' | 'landscape' | 'auto';

export async function setOrientation(orientation: Orientation): Promise<boolean> {
  const t = api() as (ToyApi & { setContainerMode?: (o: { orientation?: Orientation; immersive?: boolean }) => Promise<void> }) | null;
  if (!t?.setContainerMode) return false;
  try {
    await withTimeout(Promise.resolve(t.setContainerMode({ orientation })));
    return true;
  } catch {
    return false;
  }
}
