'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { fetchTicketStatus, TicketStatus } from '@/lib/api'

export default function TicketStatusPage() {
  const searchParams = useSearchParams()
  const ticketFromUrl = searchParams.get('ticket')

  const [ticketNumber, setTicketNumber] = useState(ticketFromUrl || '')
  const [ticketStatus, setTicketStatus] = useState<TicketStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [autoRefresh, setAutoRefresh] = useState(true)

  // Auto-refresh every 10 seconds if enabled
  useEffect(() => {
    if (ticketFromUrl) {
      checkStatus(ticketFromUrl)
    }
  }, [ticketFromUrl])

  useEffect(() => {
    if (!autoRefresh || !ticketNumber) return

    const interval = setInterval(() => {
      if (ticketStatus && ticketStatus.status === 'waiting') {
        checkStatus(ticketNumber)
      }
    }, 10000) // Refresh every 10 seconds

    return () => clearInterval(interval)
  }, [autoRefresh, ticketNumber, ticketStatus])

  const checkStatus = async (ticket: string) => {
    if (!ticket.trim()) {
      setError('Please enter a ticket number')
      return
    }

    setLoading(true)
    setError('')

    try {
      const status = await fetchTicketStatus(ticket.trim())
      setTicketStatus(status)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ticket not found')
      setTicketStatus(null)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    checkStatus(ticketNumber)
  }

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'waiting':
        return 'status-waiting'
      case 'called':
        return 'status-called'
      case 'completed':
        return 'status-completed'
      default:
        return ''
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'waiting':
        return 'Waiting in Queue'
      case 'called':
        return 'Your Turn - Please Proceed'
      case 'completed':
        return 'Service Completed'
      default:
        return status
    }
  }

  return (
    <>
      <header className="header">
        <h1>Check Ticket Status</h1>
        <p>View your position in queue and estimated wait time</p>
      </header>

      <div className="container">
        <div className="card">
          <h2>Enter Ticket Number</h2>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="ticketNumber">Ticket Number</label>
              <input
                type="text"
                id="ticketNumber"
                value={ticketNumber}
                onChange={(e) => setTicketNumber(e.target.value)}
                placeholder="e.g., SF1732123456A42"
                required
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <button type="submit" className="button" disabled={loading}>
                {loading ? 'Checking...' : 'Check Status'}
              </button>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                />
                <span style={{ color: '#6b7280' }}>Auto-refresh (every 10s)</span>
              </label>
            </div>
          </form>

          {error && (
            <div className="alert alert-error" style={{ marginTop: '1rem' }}>
              {error}
            </div>
          )}
        </div>

        {ticketStatus && (
          <div className="card ticket-display">
            <h2>Your Ticket</h2>
            <div className="ticket-number">{ticketStatus.ticket_number}</div>

            <div className={`status-badge ${getStatusClass(ticketStatus.status)}`}>
              {getStatusText(ticketStatus.status)}
            </div>

            <div style={{ marginTop: '2rem', textAlign: 'left' }}>
              <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>Branch</div>
                  <div style={{ fontSize: '1.125rem', fontWeight: '500' }}>{ticketStatus.branch_name}</div>
                </div>

                <div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>Service</div>
                  <div style={{ fontSize: '1.125rem', fontWeight: '500' }}>{ticketStatus.service_name}</div>
                </div>

                {ticketStatus.status === 'waiting' && (
                  <>
                    <div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>Position in Queue</div>
                      <div style={{ fontSize: '1.125rem', fontWeight: '500' }}>{ticketStatus.current_position}</div>
                    </div>

                    <div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>Estimated Wait</div>
                      <div style={{ fontSize: '1.125rem', fontWeight: '500' }}>{ticketStatus.estimated_wait_minutes} minutes</div>
                    </div>
                  </>
                )}

                {ticketStatus.status === 'called' && (
                  <div className="alert alert-success" style={{ gridColumn: '1 / -1' }}>
                    <strong>It's your turn!</strong> Please proceed to the service counter.
                  </div>
                )}
              </div>

              <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '4px' }}>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                  Created: {new Date(ticketStatus.created_at).toLocaleString()}
                </div>
                {ticketStatus.called_at && (
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                    Called: {new Date(ticketStatus.called_at).toLocaleString()}
                  </div>
                )}
              </div>
            </div>

            {autoRefresh && ticketStatus.status === 'waiting' && (
              <div className="alert alert-info" style={{ marginTop: '2rem' }}>
                Auto-refreshing every 10 seconds. You'll see updates automatically.
              </div>
            )}
          </div>
        )}

        {!ticketStatus && !error && (
          <div className="card">
            <div style={{ textAlign: 'center', color: '#6b7280', padding: '2rem' }}>
              <p>Enter your ticket number above to check your status</p>
              <p style={{ marginTop: '1rem', fontSize: '0.875rem' }}>
                You received your ticket number when you joined the queue
              </p>
            </div>
          </div>
        )}

        <div className="card" style={{ marginTop: '2rem' }}>
          <h4 style={{ marginBottom: '0.5rem', color: '#374151' }}>What do the statuses mean?</h4>
          <ul style={{ marginLeft: '1.5rem', color: '#6b7280', lineHeight: '1.8' }}>
            <li><strong>Waiting in Queue:</strong> You're in line. Check your position and estimated wait time above.</li>
            <li><strong>Your Turn:</strong> Please proceed to the service counter immediately.</li>
            <li><strong>Service Completed:</strong> Your service has been completed. Thank you!</li>
          </ul>
          <p style={{ marginTop: '1rem', color: '#6b7280', fontSize: '0.875rem' }}>
            Note: This page will auto-refresh every 10 seconds while you're waiting to keep your status up to date.
          </p>
        </div>
      </div>
    </>
  )
}
