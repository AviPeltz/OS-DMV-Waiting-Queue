'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { fetchBranches, fetchBranchServices, joinQueue, Branch, Service } from '@/lib/api'

export default function JoinQueue() {
  const router = useRouter()
  const [branches, setBranches] = useState<Branch[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string>('')
  const [selectedService, setSelectedService] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [loadingData, setLoadingData] = useState(true)

  // Load branches on mount
  useEffect(() => {
    loadBranches()
  }, [])

  // Load services when branch is selected
  useEffect(() => {
    if (selectedBranch) {
      loadServices(parseInt(selectedBranch))
    } else {
      setServices([])
      setSelectedService('')
    }
  }, [selectedBranch])

  const loadBranches = async () => {
    try {
      const data = await fetchBranches()
      setBranches(data)
    } catch (err) {
      setError('Failed to load branches. Please try again.')
    } finally {
      setLoadingData(false)
    }
  }

  const loadServices = async (branchId: number) => {
    try {
      const data = await fetchBranchServices(branchId)
      setServices(data)
      setSelectedService('')
    } catch (err) {
      setError('Failed to load services. Please try again.')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedBranch || !selectedService) {
      setError('Please select both a branch and a service')
      return
    }

    setLoading(true)
    setError('')

    try {
      const ticket = await joinQueue(parseInt(selectedBranch), selectedService)
      // Redirect to ticket status page
      router.push(`/status?ticket=${ticket.ticket_number}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join queue')
    } finally {
      setLoading(false)
    }
  }

  if (loadingData) {
    return (
      <>
        <header className="header">
          <h1>Join Queue</h1>
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
        <h1>Join Queue</h1>
        <p>Select your DMV branch and service type to get in line</p>
      </header>

      <div className="container">
        <div className="card">
          <h2>Get Your Ticket</h2>

          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="branch">Select DMV Branch</label>
              <select
                id="branch"
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                required
              >
                <option value="">-- Choose a branch --</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name} - {branch.address}
                  </option>
                ))}
              </select>
            </div>

            {selectedBranch && (
              <div className="form-group">
                <label htmlFor="service">Select Service Type</label>
                <select
                  id="service"
                  value={selectedService}
                  onChange={(e) => setSelectedService(e.target.value)}
                  required
                >
                  <option value="">-- Choose a service --</option>
                  {services.map((service) => (
                    <option key={service.id} value={service.code}>
                      {service.name} (avg. {service.avg_service_time_minutes} min)
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="submit"
              className="button"
              disabled={loading || !selectedBranch || !selectedService}
            >
              {loading ? 'Joining Queue...' : 'Join Queue'}
            </button>
          </form>

          <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '4px' }}>
            <h4 style={{ marginBottom: '0.5rem', color: '#374151' }}>How it works:</h4>
            <ol style={{ marginLeft: '1.5rem', color: '#6b7280', lineHeight: '1.8' }}>
              <li>Select your DMV branch location</li>
              <li>Choose the service you need</li>
              <li>Receive your ticket number</li>
              <li>Check your position and estimated wait time</li>
              <li>You'll be notified when it's your turn</li>
            </ol>
          </div>
        </div>
      </div>
    </>
  )
}
