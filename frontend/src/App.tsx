import { useEffect, useState } from 'react';
import Keycloak from 'keycloak-js';
import { useConfig } from './contexts/ConfigContext';
import UploadVideo from './components/UploadVideo';

export default function App() {
  const config = useConfig();
  const [keycloak, setKeycloak] = useState<Keycloak | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [videos, setVideos] = useState<any[]>([]);

  useEffect(() => {
    // Initialize Keycloak with dynamic config fetched from the backend[cite: 10]
    const kc = new Keycloak({
      url: config.keycloak.url,
      realm: config.keycloak.realm,
      clientId: config.keycloak.clientId,
    });

    kc.init({ onLoad: 'login-required', checkLoginIframe: false }).then((auth) => {
      setKeycloak(kc);
      setAuthenticated(auth);
    });
  }, [config]);

  const fetchVideos = async () => {
    if (!keycloak) return;
    try {
      const res = await fetch(`${config.apiBaseUrl}/api/videos`, {
        headers: {
          'Authorization': `Bearer ${keycloak.token}`,
          'x-user-id': keycloak.tokenParsed?.sub || '',
        }
      });
      if (res.ok) {
        const data = await res.json();
        setVideos(data);
      }
    } catch (error) {
      console.error('Error fetching videos', error);
    }
  };

  useEffect(() => {
    if (authenticated) {
      fetchVideos();
    }
  }, [authenticated]);

  if (!keycloak || !authenticated) {
    return <div>Authenticating with StreamFlow...</div>;
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ccc', paddingBottom: '10px' }}>
        <h1>StreamFlow Dashboard</h1>
        <button onClick={() => keycloak.logout()}>Sign Out</button>
      </header>

      <main style={{ marginTop: '20px' }}>
        <UploadVideo keycloak={keycloak} onUploadSuccess={fetchVideos} />

        <section>
          <h2>Your Uploaded Videos</h2>
          {videos.length === 0 ? (
            <p>No videos uploaded yet.</p>
          ) : (
            <ul>
              {videos.map((video) => (
                <li key={video.id} style={{ marginBottom: '10px' }}>
                  <strong>{video.title}</strong> - Status: <em>{video.status}</em>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}