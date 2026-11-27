export type Page = 'landing' | 'dashboard' | 'watch' | 'profile'

export type VideoStatus = 'Ready' | 'Processing' | 'Failed'

export interface DemoVideo {
  id: string
  title: string
  thumbnail: string
  description: string
  size: string
  status: VideoStatus
  duration: string
  uploaded: string
}
