import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { registerServiceWorker } from './push-manager'; // import registerServiceWorker

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

// Service Worker 등록
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    registerServiceWorker().then((registration) => {
      console.log('Service Worker registered:', registration);
    }).catch((error) => {
      console.log('Service Worker registration failed:', error);
    });
  });
}
