import React, { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { avatarUrl, getMyRank, getRankList, hasRankApi, MyRank, RankEntry, RankPeriod } from './toy';

/** 每个游戏用自己的美术风格渲染排行榜，靠这组 class 片段换肤 */
export interface LeaderboardTheme {
  overlay: string;
  panel: string;
  headerBorder: string;
  title: string;
  closeBtn: string;
  tabActive: string;
  tabIdle: string;
  rowOdd: string;
  rankTop: string;
  rankNormal: string;
  avatarBg: string;
  name: string;
  muted: string;
  footerBorder: string;
  footer: string;
  /** 榜单条目的分数区域由各游戏自己渲染（阵营颜色、结局、图标等） */
  scoreClass: string;
}

interface LeaderboardProps {
  board: number;
  lang?: 'zh' | 'en';
  title: string;
  theme: LeaderboardTheme;
  /** 把编码后的整数分数渲染成这一榜自己的样子 */
  renderScore: (score: number, lang: 'zh' | 'en') => React.ReactNode;
  /** 需要突出某些成绩时，按分数追加行样式 */
  rowClass?: (score: number) => string;
  onClose: () => void;
}

const PERIODS: RankPeriod[] = ['day', 'week', 'month', 'all'];

const TEXT = {
  zh: { day: '今日', week: '本周', month: '本月', all: '总榜', loading: '…', dash: '—', mine: '我的排名', close: '关闭' },
  en: { day: 'Day', week: 'Week', month: 'Month', all: 'All', loading: '…', dash: '—', mine: 'My rank', close: 'Close' },
};

const Leaderboard: React.FC<LeaderboardProps> = ({ board, lang = 'zh', title, theme, renderScore, rowClass, onClose }) => {
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

  const placeholder = status === 'loading' ? T.loading : T.dash;

  return (
    <div className={theme.overlay}>
      <div className={theme.panel}>
        <div className={`flex items-start justify-between gap-3 px-5 pt-4 pb-3 ${theme.headerBorder}`}>
          <h2 className={theme.title}>{title}</h2>
          <button onClick={onClose} aria-label={T.close} className={theme.closeBtn}>
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex gap-1.5 px-5 py-3">
          {PERIODS.map(p => (
            <button key={p} onClick={() => setPeriod(p)} className={p === period ? theme.tabActive : theme.tabIdle}>
              {T[p]}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-2 min-h-[9rem]">
          {status !== 'ok' && <p className={`py-8 text-center text-[13px] ${theme.muted}`}>{placeholder}</p>}
          {status === 'ok' && entries.length === 0 && <p className={`py-8 text-center text-[13px] ${theme.muted}`}>{T.dash}</p>}
          {status === 'ok' && entries.length > 0 && (
            <ol className="space-y-1">
              {entries.map((e, i) => {
                const url = avatarUrl(e.avatar || e.face);
                return (
                  <li
                    key={`${e.rank}-${i}`}
                    className={`flex items-center gap-2.5 px-2 py-1.5 ${theme.rowOdd} ${rowClass?.(e.score) ?? ''}`}
                  >
                    <strong className={`w-6 shrink-0 text-center font-mono text-[13px] ${e.rank <= 3 ? theme.rankTop : theme.rankNormal}`}>
                      {e.rank || i + 1}
                    </strong>
                    <span className={`h-6 w-6 shrink-0 overflow-hidden ${theme.avatarBg}`}>
                      {url && (
                        <img
                          src={url}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                          onError={ev => { (ev.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      )}
                    </span>
                    <span className={`min-w-0 flex-1 truncate text-[13px] ${theme.name}`}>{e.nickname || e.name || T.dash}</span>
                    <span className={theme.scoreClass}>{renderScore(e.score, lang)}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <div className={`flex items-center gap-1.5 px-5 py-3 text-[12px] font-mono ${theme.footerBorder} ${theme.footer}`}>
          <span>{T.mine}</span>
          {mine?.ranked ? (
            <>
              <span>#{mine.rank}</span>
              <span>·</span>
              {renderScore(mine.score ?? 0, lang)}
            </>
          ) : (
            <span>{T.dash}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
