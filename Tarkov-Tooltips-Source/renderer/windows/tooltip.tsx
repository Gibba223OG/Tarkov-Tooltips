import { createRoot } from 'react-dom/client';
import { Tooltip } from '../pages/Tooltip';
import '../styles/index.css';
import React from 'react';

const root = createRoot(
  (document.getElementById("root") as Element)
)

root.render(<Tooltip />);