import Link from 'next/link'

export default function Home() {
  return (
    <>
      <header className="header">
        <h1>DMV Queue System</h1>
        <p>Open-source queue management for California DMV</p>
      </header>

      <div className="container">
        <div className="card">
          <h2>Welcome</h2>
          <p style={{ marginBottom: '1.5rem', color: '#6b7280' }}>
            This is an open-source replacement for the DMV's queue management system.
            Choose an option below to get started.
          </p>

          <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
            <Link href="/join" style={{ textDecoration: 'none' }}>
              <div className="card" style={{ cursor: 'pointer', transition: 'transform 0.2s', border: '2px solid #e5e7eb' }}>
                <h3 style={{ color: '#1e3a8a', marginBottom: '0.5rem' }}>Join Queue</h3>
                <p style={{ color: '#6b7280' }}>Get in line for DMV services</p>
              </div>
            </Link>

            <Link href="/status" style={{ textDecoration: 'none' }}>
              <div className="card" style={{ cursor: 'pointer', transition: 'transform 0.2s', border: '2px solid #e5e7eb' }}>
                <h3 style={{ color: '#1e3a8a', marginBottom: '0.5rem' }}>Check Status</h3>
                <p style={{ color: '#6b7280' }}>View your ticket status and wait time</p>
              </div>
            </Link>

            <Link href="/staff" style={{ textDecoration: 'none' }}>
              <div className="card" style={{ cursor: 'pointer', transition: 'transform 0.2s', border: '2px solid #e5e7eb' }}>
                <h3 style={{ color: '#1e3a8a', marginBottom: '0.5rem' }}>Staff Portal</h3>
                <p style={{ color: '#6b7280' }}>Call next ticket (staff only)</p>
              </div>
            </Link>
          </div>
        </div>

        <div className="card" style={{ marginTop: '2rem' }}>
          <h3 style={{ color: '#1e3a8a', marginBottom: '1rem' }}>About This System</h3>
          <p style={{ color: '#6b7280', lineHeight: '1.6' }}>
            This is a v0 minimum viable version of an open-source DMV queue management system,
            designed as a replacement for proprietary solutions like Qmatic. The system allows
            visitors to join virtual queues, check their position and estimated wait time, and
            enables staff to call the next ticket.
          </p>
          <p style={{ color: '#6b7280', marginTop: '1rem', lineHeight: '1.6' }}>
            <strong>Future features:</strong> Real-time WebSocket updates, display monitor integration,
            mobile app support, and compatibility bridges to existing vendor systems.
          </p>
        </div>
      </div>
    </>
  )
}
