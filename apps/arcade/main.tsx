import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import Menu, { GameKey } from './Menu';
import Simulation from '@/games/RCop/Simulation';
import UFOGame from '@/games/ufo/UFOGame';
import DinoGame from '@/games/dino/Game';
import '@/shared/base.css';

const LANG_KEY = 'toy-arcade-lang';

const App: React.FC = () => {
  const [lang, setLang] = useState<'zh' | 'en'>(() => {
    try {
      return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'zh';
    } catch {
      return 'zh';
    }
  });
  const [game, setGame] = useState<GameKey | null>(null);

  const toggleLang = () => {
    setLang(prev => {
      const next = prev === 'zh' ? 'en' : 'zh';
      try { localStorage.setItem(LANG_KEY, next); } catch { /* 隐私模式下忽略 */ }
      return next;
    });
  };

  const close = () => setGame(null);

  return (
    <>
      <Menu lang={lang} onToggleLang={toggleLang} onPick={setGame} />
      {game === 'rcop' && <Simulation onClose={close} lang={lang} />}
      {game === 'ufo' && <UFOGame onClose={close} lang={lang} />}
      {game === 'dino' && <DinoGame onClose={close} lang={lang} />}
    </>
  );
};

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Could not find root element to mount to');
ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
