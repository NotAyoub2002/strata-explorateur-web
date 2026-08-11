// Dépendances principales
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Styles et composants internes
import './index.css';
import App from './App.jsx';

// Initialisation et point d'entrée de l'application
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);