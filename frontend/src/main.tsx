import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import ResultsPage from './results.tsx';
import SelectPage from './select.tsx';
import ImageReviewPage from './imagereview.tsx';
import img1 from './images/test1.jpg';
import img2 from './images/test2.webp';
import img3 from './images/test3.jpg';

// Example test data
const sampleImages = [
  {
    name: "test1.jpg",
    src: img1,
    description: "A peaceful forest scene with mist and morning sunlight.",
    tags: ["nature", "forest", "morning", "misty"],
  },
  {
    name: "test2.webp",
    src: img2,
    description: "Golden sand beach with blue waves and seagulls.",
    tags: ["beach", "sunny", "ocean", "relaxation"],
  },
  {
    name: "test3.jpg",
    src: img3,
    description: "Modern city skyline glowing at night.",
    tags: ["city", "night", "lights", "urban"],
  },
];


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SelectPage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/review" element={<ImageReviewPage images={sampleImages} />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
