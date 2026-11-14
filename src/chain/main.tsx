// Knowledge Chain（知識のつながりをたどる探索ゲーム）の入口。3Dのアプリとは独立して動く試作品。
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ChainApp } from './App';
import './chain.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ChainApp />
  </StrictMode>,
);
