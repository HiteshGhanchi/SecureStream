import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ConfigProvider } from './contexts/ConfigContext.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider>
      <App />
    </ConfigProvider>
  </StrictMode>,
);

initializeApp().catch((error) => {
  console.error('Failed to initialize app:', error)
  // Show error message
  const root = document.getElementById('root')
  if (root) {
    root.innerHTML = `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        background: #0D0D0D;
        color: #EDEDED;
        font-family: system-ui, sans-serif;
      ">
        <div style="text-align: center; max-width: 500px;">
          <h1>Unable to load application</h1>
          <p>${error.message || 'An error occurred while initializing the application.'}</p>
          <p style="color: #888888; font-size: 0.9rem;">Please check your connection and try refreshing the page.</p>
        </div>
      </div>
    `
  }
})  