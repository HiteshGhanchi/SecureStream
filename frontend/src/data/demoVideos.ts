import type { DemoVideo } from '../types'

export const demoVideos: DemoVideo[] = [
  {
    id: '1',
    title: 'Infrastructure_Overview_v2.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=880&q=80',
    description: 'A technical review of scalable edge infrastructure and high-throughput video ingestion.',
    size: '1.2 GB • 4K H.264',
    status: 'Ready',
    duration: '12:45',
    uploaded: '2 hours ago',
  },
  {
    id: '2',
    title: 'Analytics_Q3_Final.mov',
    thumbnail: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=880&q=80',
    description: 'Recorded engineering analytics review with system performance insights.',
    size: '450 MB • 1080p ProRes',
    status: 'Processing',
    duration: '05:12',
    uploaded: '5 hours ago',
  },
  {
    id: '3',
    title: 'Cybersecurity_Training_01.avi',
    thumbnail: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=880&q=80',
    description: 'Security training focused on vulnerability analysis and secure media pipelines.',
    size: '2.8 GB • 4K RAW',
    status: 'Ready',
    duration: '45:20',
    uploaded: 'Yesterday',
  },
  {
    id: '4',
    title: 'Marketing_Hero_Draft.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=880&q=80',
    description: 'Failed upload asset that needs review before rerendering.',
    size: 'Unknown size • Error in codec',
    status: 'Failed',
    duration: '--:--',
    uploaded: '2 days ago',
  },
]
