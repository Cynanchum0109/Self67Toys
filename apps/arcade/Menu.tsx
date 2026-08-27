import React from 'react';

export type GameKey = 'rcop' | 'ufo' | 'dino';

interface MenuProps {
  lang: 'zh' | 'en';
  onToggleLang: () => void;
  onPick: (game: GameKey) => void;
}

// 名字沿用原站上的写法，没有另写文案
const TEXT = {
  zh: {
    quote: '那呼唤爱的样子如此美丽……',
    rcopName: 'R公司孵化场观测',
    ufoName: '同事是外星人？！',
    dinoName: '碰到就要结婚喔～',
  },
  en: {
    quote: 'The declaration of Love was so beautiful',
    rcopName: 'R Corp Hatchery Observation',
    ufoName: 'My Coworker Is an Alien?!',
    dinoName: 'Touch and you must marry~',
  },
};

const CARDS: Array<{
  key: GameKey;
  icon: React.ReactNode;
  accent: string;
  ring: string;
}> = [
  {
    key: 'rcop',
    accent: '#7A688F',
    ring: '#C6B8D8',
    icon: (
      <span className="relative flex h-10 w-10 items-center justify-center">
        <img src="./assets/icons/Rtoken1.png" alt="" className="h-full w-full object-contain transition-opacity duration-200 group-hover:opacity-0" />
        <img src="./assets/icons/Rtoken2.png" alt="" className="absolute inset-0 h-full w-full object-contain opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
      </span>
    ),
  },
  { key: 'ufo', accent: '#4FAE9C', ring: '#9BD9CC', icon: <span className="text-[2rem] leading-none">👽</span> },
  { key: 'dino', accent: '#6FCBB8', ring: '#CBE9E1', icon: <span className="text-[2rem] leading-none">💍</span> },
];

const Menu: React.FC<MenuProps> = ({ lang, onToggleLang, onPick }) => {
  const T = TEXT[lang];

  return (
    <div className="min-h-full w-full px-5 py-10 sm:py-14">
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-8 text-center">
        <div className="flex w-full justify-end gap-2 text-[11px] tracking-widest serif-text">
          <button
            onClick={onToggleLang}
            className={`transition-all ${lang === 'zh' ? 'font-bold text-[#4FAE9C] underline decoration-[#6FCBB8] underline-offset-4' : 'text-[#4FAE9C]/50 hover:text-[#4FAE9C]/80'}`}
          >
            中文
          </button>
          <span className="text-[#C6B8D8]">/</span>
          <button
            onClick={onToggleLang}
            className={`transition-all ${lang === 'en' ? 'font-bold text-[#7A688F] underline decoration-[#A99BC1] underline-offset-4' : 'text-[#7A688F]/50 hover:text-[#7A688F]/80'}`}
          >
            EN
          </button>
        </div>

        <header className="flex flex-col items-center gap-3 animate-float-in">
          <img
            src="./assets/icons/momo67.png"
            alt=""
            className="mx-auto h-11 w-11 object-contain animate-breathe sm:h-14 sm:w-14"
            style={{ imageRendering: 'pixelated' }}
          />
          <h1 className="serif-text text-4xl font-bold tracking-tight sm:text-5xl">
            <span className="text-[#6FCBB8]">Hong</span>
            <span className="text-[#7A688F]">Cliff</span>
          </h1>
          <div className="flex items-center justify-center gap-3" aria-hidden>
            <span className="h-px w-12 bg-gradient-to-r from-transparent to-[#C6B8D8]" />
            <span className="serif-text text-sm leading-none text-[#A99BC1]">❦</span>
            <span className="h-px w-12 bg-gradient-to-l from-transparent to-[#C6B8D8]" />
          </div>
          <p className="serif-text text-[11px] uppercase tracking-[0.35em] text-[#B3A5C9]">by BQCynanchum</p>
        </header>

        <div className="animate-float-in float-delay-1 max-w-md">
          <p className="serif-text text-[1.05rem] font-medium leading-[1.8] tracking-[0.05em] text-[#4FAE9C] sm:text-[1.2rem]">
            <span className="mr-1 text-[#9BD9CC]" aria-hidden>“</span>
            {T.quote}
            <span className="ml-1 text-[#9BD9CC]" aria-hidden>”</span>
          </p>
          <svg className="mx-auto mt-4 h-3 w-28 text-[#A99BC1]" viewBox="0 0 112 12" fill="none" aria-hidden>
            <path d="M2 6 C 20 1, 36 11, 56 6 S 92 1, 110 6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
            <circle cx="56" cy="6" r="1.5" fill="#6FCBB8" />
          </svg>
        </div>

        <div className="animate-float-in float-delay-2 grid w-full gap-3 sm:gap-4">
          {CARDS.map(card => (
            <button
              key={card.key}
              onClick={() => onPick(card.key)}
              className="group flex w-full items-center gap-4 rounded-3xl border border-[#EAE5F0] bg-[#FDFCFA] px-5 py-4 text-left shadow-[0_12px_28px_-18px_rgba(45,58,49,0.45)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[color:var(--ring)] hover:shadow-[0_18px_32px_-18px_rgba(45,58,49,0.5)] active:scale-[0.99]"
              style={{ ['--ring' as string]: card.ring }}
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#F4F1F8]">{card.icon}</span>
              <span className="serif-text min-w-0 flex-1 text-[15px] font-semibold text-[#1B1B1B]">
                {T[`${card.key}Name` as const]}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Menu;
