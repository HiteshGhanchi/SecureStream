import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { ClientConfig, fetchClientConfig } from '../services/api';

const ConfigContext = createContext<ClientConfig | null>(null);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ClientConfig | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    fetchClientConfig()
      .then(setConfig)
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <div style={{ color: 'red' }}>Error loading config: {error}</div>;
  if (!config) return <div>Loading configuration...</div>;

  return (
    <ConfigContext.Provider value={config}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  const context = useContext(ConfigContext);
  if (!context) throw new Error('useConfig must be used within ConfigProvider');
  return context;
}