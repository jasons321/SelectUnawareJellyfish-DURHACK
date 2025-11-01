import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import App from './App.tsx';
import SelectActionCard from './card.tsx';
import SelectPage from './select.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SelectPage />} />
        <Route path="/select-action" element={<SelectActionCard />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
