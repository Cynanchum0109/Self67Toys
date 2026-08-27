import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import HatchGame from '@/games/hatch/HatchGame';
import '@/shared/base.css';

const LANG_KEY = 'toy-hatchery-lang';

const App: React.FC = () => {
  const [lang, setLang] = useState<'zh' | 'en'>(() => {
    try {
      return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'zh';
    } catch {
      return 'zh';
    }
  });

  const toggleLang = () => {
    setLang(prev => {
      const next = prev === 'zh' ? 'en' : 'zh';
      try { localStorage.setItem(LANG_KEY, next); } catch { /* 隐私模式下忽略 */ }
      return next;
    });
  };

  // 独立发布，没有上级页面可返回：关闭按钮由中英切换取代
  return <HatchGame onClose={() => {}} lang={lang} onToggleLang={toggleLang} />;
};

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Could not find root element to mount to');
ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
