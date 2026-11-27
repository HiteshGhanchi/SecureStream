interface LandingPageProps {
  onSignIn: () => void
}

export default function LandingPage({ onSignIn }: LandingPageProps) {
  return (
    <div className="landing-shell">
      <nav className="landing-nav">
        <span className="brand">StreamFlow</span>
        <button type="button" className="link-button" onClick={onSignIn}>
          Sign In
        </button>
      </nav>
      <main className="landing-main">
        <section className="landing-hero">
          <h1 className="landing-heading">Scalable infrastructure for real-time video delivery.</h1>
          <p className="landing-copy">
            High-performance ingestion and global distribution built for professional engineering teams.
          </p>
          <button type="button" className="outline-button" onClick={onSignIn}>
            Sign In with SSO
          </button>
        </section>
        <section className="landing-features">
          <article>
            <h2>Deterministic Latency</h2>
            <p>Sub-second propagation delays across global edge nodes with automated failover and path optimization.</p>
          </article>
          <article>
            <h2>Immutable Logs</h2>
            <p>Every packet and state transition is indexed for forensic analysis and performance auditing.</p>
          </article>
          <article>
            <h2>Unified API</h2>
            <p>Manage ingestion, transcoding, and delivery through a single gRPC or REST interface.</p>
          </article>
        </section>
      </main>
      <footer className="landing-footer">
        <div className="footer-row">
          <span className="brand">StreamFlow</span>
          <span className="footer-meta">© 2024</span>
        </div>
        <span className="footer-meta">v2.4.0-stable</span>
      </footer>
    </div>
  )
}
