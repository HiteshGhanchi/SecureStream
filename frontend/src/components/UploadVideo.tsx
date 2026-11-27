import { useState } from 'react';
import Keycloak from 'keycloak-js';

interface UploadProps {
  keycloak: Keycloak;
  onUploadSuccess: () => void;
}

export default function UploadVideo({ keycloak, onUploadSuccess }: UploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setStatus('Requesting upload URL from backend...');

    try {
      // 1. Get the presigned URL
      const initRes = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/upload/init`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${keycloak.token}`
        },
        body: JSON.stringify({ fileName: file.name, contentType: file.type || 'video/mp4' })
      });
      
      if (!initRes.ok) throw new Error('Failed to init upload');
      const { videoId, fileKey, uploadUrl } = await initRes.json();

      // 2. Upload directly to MinIO (Bypassing Node.js memory)
      setStatus('Uploading directly to storage...');
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'video/mp4' },
        body: file
      });
      
      if (!uploadRes.ok) throw new Error('Failed to upload to storage');

      // 3. Confirm with Backend
      setStatus('Finalizing upload...');
      await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/upload/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${keycloak.token}`
        },
        body: JSON.stringify({ videoId, fileKey })
      });

      setStatus('Upload Complete!');
      setFile(null);
      onUploadSuccess(); // Refresh the dashboard
    } catch (error: any) {
      setStatus(`Error: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="upload-container" style={{ padding: '20px', border: '1px solid #ccc', marginBottom: '20px' }}>
      <h3>Upload a New Video</h3>
      <input 
        type="file" 
        accept="video/*" 
        onChange={(e) => setFile(e.target.files?.[0] || null)} 
        disabled={isUploading}
      />
      <button onClick={handleUpload} disabled={!file || isUploading}>
        {isUploading ? 'Uploading...' : 'Submit Video'}
      </button>
      <p>{status}</p>
    </div>
  );
}