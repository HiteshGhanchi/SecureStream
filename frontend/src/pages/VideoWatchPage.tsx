import VideoPlayer from '../components/VideoPlayer'
import type { DemoVideo } from '../types'

interface VideoWatchPageProps {
  video: DemoVideo
  onBack: () => void
}

export default function VideoWatchPage({ video, onBack }: VideoWatchPageProps) {
  return (
    <div className="page-shell page-shell--video">
      <button type="button" className="text-button" onClick={onBack}>
        ← Back to dashboard
      </button>
      <div className="video-player-shell">
        <VideoPlayer src="https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8" />
      </div>
      <div className="video-details">
        <h1 className="page-heading">{video.title}</h1>
        <div className="detail-row">
          <span>{video.uploaded}</span>
          <span>•</span>
          <span>{video.duration}</span>
        </div>
        <p className="detail-copy">{video.description}</p>
      </div>
      <div className="more-grid">
        <div className="more-card">
          <div className="more-thumb" />
          <p className="more-title">Understanding Container Orchestration Basics</p>
        </div>
        <div className="more-card">
          <div className="more-thumb" />
          <p className="more-title">Global CDN Distribution Strategies</p>
        </div>
        <div className="more-card">
          <div className="more-thumb" />
          <p className="more-title">Zero-Trust Security Models in Cloud Ops</p>
        </div>
      </div>
    </div>
  )
}
