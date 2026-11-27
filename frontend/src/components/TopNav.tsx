import type { Page } from '../types'

interface TopNavProps {
  currentPage: Page
  onNavigate: (page: Page) => void
  onSignOut: () => void
}

const navItems: { id: Page; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'profile', label: 'Profile' },
  { id: 'watch', label: 'Watch' },
]

export default function TopNav({ currentPage, onNavigate, onSignOut }: TopNavProps) {
  return (
    <header className="shell-nav">
      <div className="shell-nav-left">
        <span className="brand">StreamFlow</span>
        <nav className="shell-links" aria-label="Primary navigation">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-link ${currentPage === item.id ? 'nav-link--active' : ''}`}
              onClick={() => onNavigate(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="shell-actions">
        <label className="search-label">
          <span className="sr-only">Search content</span>
          <input className="search-input" placeholder="Search content..." />
        </label>
        <button type="button" className="ghost-button" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </header>
  )
}
