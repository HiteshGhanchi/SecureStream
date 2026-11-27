import { useMemo, useState } from 'react'
import type { DemoVideo, VideoStatus } from '../types'
import UploadVideo from '../components/UploadVideo'
import type { KeycloakInstance } from 'keycloak-js'

const filters: { id: VideoStatus | 'All videos'; label: string }[] = [
  { id: 'All videos', label: 'All videos' },
  { id: 'Ready', label: 'Ready' },
  { id: 'Processing', label: 'Processing' },
  { id: 'Failed', label: 'Failed' },
]

interface DashboardPageProps {
  videos: DemoVideo[]
  onWatchVideo: (video: DemoVideo) => void
  keycloak: KeycloakInstance
}

export default function DashboardPage({ videos, onWatchVideo, keycloak }: DashboardPageProps) {
  const [activeFilter, setActiveFilter] = useState<'All videos' | VideoStatus>('All videos')

  const filteredVideos = useMemo(() => {
    if (activeFilter === 'All videos') return videos
    return videos.filter((video) => video.status === activeFilter)
  }, [activeFilter, videos])

  return (
    <div className="page-shell">
      <section className="hero-row">
        <div className="upload-panel">
          <UploadVideo keycloak={keycloak} />
        </div>
      </section>
      <section className="filter-row">
        {filters.map((filter) => (
          <button
            key={filter.id}
            type="button"
            className={`filter-pill ${activeFilter === filter.id ? 'filter-pill--active' : ''}`}
            onClick={() => setActiveFilter(filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </section>
      <section className="table-shell">
        {filteredVideos.length === 0 ? (
          <div className="empty-state">
            <p>No videos uploaded yet.</p>
            <button type="button" className="outline-button" onClick={() => void 0}>
              Upload a video
            </button>
          </div>
        ) : (
          <table className="video-table">
            <thead>
              <tr>
                <th>Thumbnail</th>
                <th>Title</th>
                <th>Status</th>
                <th>Duration</th>
                <th>Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {filteredVideos.map((video) => (
                <tr key={video.id} className="video-row" onClick={() => onWatchVideo(video)}>
                  <td>
                    <div className="thumb-shell">
                      <img className="thumb-image" src={video.thumbnail} alt={video.title} />
                    </div>
                  </td>
                  <td>
                    <div className="video-title">{video.title}</div>
                    <div className="video-subtitle">{video.size}</div>
                  </td>
                  <td>
                    <div className={`status-pill status-pill--${video.status.toLowerCase()}`}>
                      <span className="status-dot" />
                      {video.status}
                    </div>
                  </td>
                  <td>
                    <span className="video-meta">{video.duration}</span>
                  </td>
                  <td>
                    <span className="video-meta">{video.uploaded}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
