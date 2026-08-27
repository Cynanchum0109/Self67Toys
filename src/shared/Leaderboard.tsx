import React, { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { avatarUrl, decodeScore, getMyRank, getRankList, hasRankApi, MyRank, RankEntry, RankPeriod } from './toy';

interface LeaderboardProps {
  board: number;
  lang?: 'zh' | 'en';
  onClose: () => void;
}

const PERIODS: RankPeriod[] = ['day', 'week', 'month', 'all'];

// 只保留跑起来必需的功能性标签，没有额外文案
const TEXT = {
  zh: {
    title: '排行榜',
    day: '今日', week: '本周', month: '本月', all: '总榜',
    loading: '…',
    empty: '—',
    error: '—',
    unavailable: '—',
    mine: '我的排名',
    unranked: '—',
    kills: '杀', close: '关闭',
  },
  en: {
    title: 'Leaderboard',
    day: 'Day', week: 'Week', month: 'Month', all: 'All',
    loading: '…',
    empty: '—',
    error: '—',
    unavailable: '—',
    mine: 'My rank',
    unranked: '—',
    kills: 'kills', close: 'Close',
  },
};

const Leaderboard: React.FC<LeaderboardProps> = ({ board, lang = 'zh', onClose }) => {
  const T = TEXT[lang];
  const [period, setPeriod] = useState<RankPeriod>('all');
  const [entries, setEntries] = useState<RankEntry[]>([]);
  const [mine, setMine] = useState<MyRank | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'error' | 'unavailable'>('loading');

  const load = useCallback(async (p: RankPeriod) => {
    if (!hasRankApi()) { setStatus('unavailable'); return; }
    setStatus('loading');
    try {
      const [list, my] = await Promise.all([getRankList(board, p, 50), getMyRank(board, p)]);
      setEntries(list);
      setMine(my);
      setStatus('ok');
    } catch {
      setStatus('error');
    }
  }, [board]);

  useEffect(() => { load(period); }, [load, period]);

  const fmt = (score: number) => {
    const { kills, seconds } = decodeScore(score);
    return `${kills} ${T.kills} · ${seconds}s`;
  };

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#0D0B09]/92 px-4 py-6">
      <div className="w-full max-w-md rounded-2xl border border-[#E8833A]/25 bg-[#15110C] shadow-[0_20px_45px_-15px_rgba(0,0,0,0.8)] flex flex-col max-h-full">
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-[#E8833A]/15">
          <h2 className="serif-text text-[1.15rem] font-bold tracking-[0.14em] text-[#E8833A]">{T.title}</h2>
          <button onClick={onClose} aria-label={T.close} className="mt-0.5 shrink-0 text-[#E8833A]/60 hover:text-[#E8833A] transition-colors">
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex gap-1.5 px-5 py-3">
          {PERIODS.map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`flex-1 rounded-full px-2 py-1.5 text-[12px] transition-colors ${
                p === period ? 'bg-[#E8833A] text-[#12100D] font-bold' : 'bg-[#221A12] text-[#E8833A]/65 hover:text-[#E8833A]'
              }`}
            >
              {T[p]}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-2 min-h-[9rem]">
          {status === 'loading' && <p className="py-8 text-center text-[13px] text-[#E8833A]/50">{T.loading}</p>}
          {status === 'error' && <p className="py-8 text-center text-[13px] text-[#8A4B3A]">{T.error}</p>}
          {status === 'unavailable' && <p className="py-8 text-center text-[13px] text-[#E8833A]/50">{T.unavailable}</p>}
          {status === 'ok' && entries.length === 0 && <p className="py-8 text-center text-[13px] text-[#E8833A]/50">{T.empty}</p>}
          {status === 'ok' && entries.length > 0 && (
            <ol className="space-y-1">
              {entries.map((e, i) => {
                const url = avatarUrl(e.avatar || e.face);
                return (
                  <li key={`${e.rank}-${i}`} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 odd:bg-[#1C1610]">
                    <strong className={`w-6 shrink-0 text-center font-mono text-[13px] ${e.rank <= 3 ? 'text-[#E8833A]' : 'text-[#E8833A]/45'}`}>
                      {e.rank || i + 1}
                    </strong>
                    <span className="h-6 w-6 shrink-0 overflow-hidden rounded-full bg-[#2A2018]">
                      {url && <img src={url} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" onError={ev => { (ev.target as HTMLImageElement).style.display = 'none'; }} />}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] text-[#FFF7EE]/85">{e.nickname || e.name || '—'}</span>
                    <span className="shrink-0 font-mono text-[12px] text-[#E8833A]/80">{fmt(e.score)}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <div className="border-t border-[#E8833A]/15 px-5 py-3 text-[12px] font-mono text-[#E8833A]/70">
          {T.mine}：{mine?.ranked ? `#${mine.rank} · ${fmt(mine.score ?? 0)}` : T.unranked}
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
