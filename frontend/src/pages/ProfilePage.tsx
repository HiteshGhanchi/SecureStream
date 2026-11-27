import type { KeycloakInstance } from 'keycloak-js'

interface ProfilePageProps {
  keycloak: KeycloakInstance
}

const stats = [
  { label: 'Videos', value: '124' },
  { label: 'Views', value: '42.8k' },
  { label: 'Storage Used', value: '84%' },
]

export default function ProfilePage({ keycloak }: ProfilePageProps) {
  return (
    <div className="page-shell">
      <section className="profile-header">
        <div className="profile-avatar" aria-hidden="true" />
        <div>
          <h1 className="page-heading">{keycloak.tokenParsed?.name ?? 'StreamFlow user'}</h1>
          <p className="text-secondary">{keycloak.tokenParsed?.email ?? 'no-email@streamflow.io'}</p>
        </div>
      </section>
      <section className="stats-grid">
        {stats.map((item) => (
          <div key={item.label} className="stat-card">
            <p className="stat-value">{item.value}</p>
            <p className="stat-label">{item.label}</p>
          </div>
        ))}
      </section>
      <section className="settings-row">
        <a className="text-link" href="#" onClick={(event) => event.preventDefault()}>
          Account Settings
        </a>
      </section>
    </div>
  )
}
