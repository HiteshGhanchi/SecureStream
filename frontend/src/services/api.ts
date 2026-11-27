// Define the interface matching the backend's ClientConfig[cite: 10]
export interface ClientConfig {
  apiBaseUrl: string;
  keycloak: {
    url: string;
    realm: string;
    clientId: string;
  };
}

// Fetch the dynamic configuration from the backend[cite: 10]
export const fetchClientConfig = async (): Promise<ClientConfig> => {
  const response = await fetch('/api/config');
  if (!response.ok) {
    throw new Error('Failed to fetch frontend configuration');
  }
  
  // The backend wraps the configuration object in a "data" property[cite: 10]
  const json = await response.json();
  return json.data;
};