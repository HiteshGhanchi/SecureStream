import { useEffect, useRef } from 'react';
import Hls from 'hls.js';

interface VideoPlayerProps {
  hlsUrl: string;
}

export default function VideoPlayer({ hlsUrl }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hls: Hls;

    if (Hls.isSupported()) {
      hls = new Hls();
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
    } 
    // Safari natively supports HLS
    else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = hlsUrl;
    }

    return () => {
      if (hls) hls.destroy();
    };
  }, [hlsUrl]);

  return (
    <div style={{ width: '100%', maxWidth: '800px', margin: '0 auto' }}>
      <video 
        ref={videoRef} 
        controls 
        style={{ width: '100%', backgroundColor: '#000' }} 
      />
    </div>
  );
}