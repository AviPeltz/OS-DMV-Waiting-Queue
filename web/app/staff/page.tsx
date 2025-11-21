'use client'

import { useState, useEffect } from 'react'
import { fetchBranches, fetchBranchServices, callNextTicket, fetchQueueStatus, Branch, Service, QueueStatus, APIError } from '@/lib/api'

export default function StaffPortal() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string>('')
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [successMessage, setSuccessMessage] = useState<string>('')
  const [loadingData, setLoadingData] = useState(true)

  // Load branches on mount
  useEffect(() => {
    loadBranches()
  }, [])

  // Load services and queue status when branch is selected
  useEffect(() => {
    if (selectedBranch) {
      loadServices(parseInt(selectedBranch))
      loadQueueStatus(parseInt(selectedBranch))
    } else {
      setServices([])
      setQueueStatus(null)
    }
  }, [selectedBranch])

  const loadBranches = async () => {
    try {
      const data = await fetchBranches()
      setBranches(data)
    } catch (err) {
      setError('Failed to load branches')
    } finally {
      setLoadingData(false)
    }
  }

  const loadServices = async (branchId: number) => {
    try {
      const data = await fetchBranchServices(branchId)
      setServices(data)
    } catch (err) {
      setError('Failed to load services')
    }
  }

  const loadQueueStatus = async (branchId: number) => {
    try {
      const data = await fetchQueueStatus(branchId)
      setQueueStatus(data)
    } catch (err) {
      setError('Failed to load queue status')
    }
  }

  const handleCallNext = async (serviceCode: string) => {
    if (!selectedBranch) return

    setLoading(true)
    setError('')
    setSuccessMessage('')

    try {
      const result = await callNextTicket(parseInt(selectedBranch), serviceCode)
      setSuccessMessage(`Called ticket: ${result.ticket_number}`)

      // Refresh queue status
      await loadQueueStatus(parseInt(selectedBranch))
    } catch (err) {
      if (err instanceof APIError) {
        if (err.status === 401) {
          setError('Authentication failed. Invalid or missing API key.')
        } else {
          setError(err.detail)
        }
      } else {
        setError(err instanceof Error ? err.message : 'Failed to call next ticket')
      }
    } finally {
      setLoading(false)
    }
  }

  if (loadingData) {
    return (
      <>
        <header className="header">
          <h1>Staff Portal</h1>
        </header>
        <div className="container">
          <div className="spinner"></div>
        </div>
      </>
    )
  }

  return (
    <>
      <header className="header">
        <h1>Staff Portal</h1>
        <p>Call next ticket and manage queues</p>
      </header>

      <div className="container">
        <div className="card">
          <h2>Select Branch</h2>

          <div className="form-group">
            <label htmlFor="branch">DMV Branch</label>
            <select
              id="branch"
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
            >
              <option value="">-- Choose a branch --</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>

          <div className="alert alert-info">
            <strong>Note:</strong> This portal uses API key authentication for staff operations.
            For production use, implement JWT/session-based authentication instead of the shared API key.
          </div>
        </div>

        {selectedBranch && queueStatus && (
          <>
            {successMessage && (
              <div className="alert alert-success">
                {successMessage}
              </div>
            )}

            {error && (
              <div className="alert alert-error">
                {error}
              </div>
            )}

            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2>Queue Status - {queueStatus.branch_name}</h2>
                <button
                  onClick={() => loadQueueStatus(parseInt(selectedBranch))}
                  className="button button-secondary"
                  style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                >
                  Refresh
                </button>
              </div>

              <table className="queue-table">
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Waiting</th>
                    <th>Currently Serving</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {queueStatus.queues.map((queue) => (
                    <tr key={queue.service_code}>
                      <td>
                        <strong>{queue.service_name}</strong>
                        <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                          {queue.service_code}
                        </div>
                      </td>
                      <td>
                        <span style={{
                          padding: '0.25rem 0.75rem',
                          borderRadius: '12px',
                          backgroundColor: queue.waiting_count > 0 ? '#fef3c7' : '#f3f4f6',
                          color: queue.waiting_count > 0 ? '#92400e' : '#6b7280',
                          fontWeight: '500'
                        }}>
                          {queue.waiting_count} waiting
                        </span>
                      </td>
                      <td>
                        {queue.currently_serving ? (
                          <span style={{
                            padding: '0.25rem 0.75rem',
                            borderRadius: '12px',
                            backgroundColor: '#d1fae5',
                            color: '#065f46',
                            fontWeight: '500'
                          }}>
                            {queue.currently_serving}
                          </span>
                        ) : (
                          <span style={{ color: '#9ca3af' }}>None</span>
                        )}
                      </td>
                      <td>
                        <button
                          onClick={() => handleCallNext(queue.service_code)}
                          disabled={loading || queue.waiting_count === 0}
                          className="button"
                          style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                        >
                          {loading ? 'Calling...' : 'Call Next'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {queueStatus.queues.every(q => q.waiting_count === 0) && (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                  No tickets waiting in any queue
                </div>
              )}
            </div>

            <div className="card">
              <h3 style={{ marginBottom: '1rem', color: '#1e3a8a' }}>Quick Stats</h3>
              <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                <div style={{ padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '4px' }}>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Total Waiting</div>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e3a8a' }}>
                    {queueStatus.queues.reduce((sum, q) => sum + q.waiting_count, 0)}
                  </div>
                </div>
                <div style={{ padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '4px' }}>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Active Services</div>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e3a8a' }}>
                    {queueStatus.queues.filter(q => q.currently_serving).length}
                  </div>
                </div>
                <div style={{ padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '4px' }}>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Available Queues</div>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e3a8a' }}>
                    {queueStatus.queues.length}
                  </div>
                </div>
              </div>
            </div>

            <div className="card" style={{ backgroundColor: '#fffbeb', border: '1px solid #fcd34d' }}>
              <h4 style={{ color: '#92400e', marginBottom: '0.5rem' }}>Future Integration Points</h4>
              <ul style={{ marginLeft: '1.5rem', color: '#78350f', lineHeight: '1.8' }}>
                <li>WebSocket integration for real-time updates to display monitors</li>
                <li>Bridge to Qmatic display URLs (e.g., https://mt-cadmvoas.us.qmatic.cloud/...)</li>
                <li>Staff authentication and role-based access control</li>
                <li>Audit logging for all ticket operations</li>
                <li>Multi-counter support with counter assignment</li>
                <li>Service pause/resume controls</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </>
  )
}
