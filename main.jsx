import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';    // ← this line is mandatory!
import App from './App';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
