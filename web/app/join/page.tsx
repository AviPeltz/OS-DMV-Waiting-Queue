'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { fetchBranches, fetchBranchServices, joinQueue, Branch, Service } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, CheckCircle2, MapPin, Clock } from 'lucide-react'
import Link from 'next/link'

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
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    )
  }

  const selectedBranchData = branches.find(b => b.id.toString() === selectedBranch)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container max-w-2xl mx-auto px-4 py-8">
        {/* Back Button */}
        <Link href="/" className="inline-flex items-center gap-2 text-blue-900 hover:text-blue-700 mb-6 font-semibold transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-black text-blue-900 mb-2">Join the Queue</h1>
          <p className="text-slate-600">Select your DMV branch and service to get in line</p>
        </div>

        {/* Error Alert */}
        {error && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="p-4">
              <p className="text-red-800 font-semibold">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Main Form Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Get Your Ticket</CardTitle>
            <CardDescription>Follow the steps below to join the virtual queue</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Branch Selection */}
              <div className="space-y-3">
                <label htmlFor="branch" className="block text-sm font-bold text-slate-700">
                  1. Select DMV Branch
                </label>
                <select
                  id="branch"
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  required
                >
                  <option value="">-- Choose a branch --</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name} - {branch.city}
                    </option>
                  ))}
                </select>
                {selectedBranchData && (
                  <div className="flex items-start gap-2 text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">
                    <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{selectedBranchData.address}, {selectedBranchData.city}, {selectedBranchData.state} {selectedBranchData.zip}</span>
                  </div>
                )}
              </div>

              {/* Service Selection */}
              {selectedBranch && (
                <div className="space-y-3">
                  <label className="block text-sm font-bold text-slate-700">
                    2. Select Service Type
                  </label>
                  <div className="grid gap-3">
                    {services.map((service) => (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => setSelectedService(service.code)}
                        className={`p-4 text-left rounded-xl border-2 transition-all ${
                          selectedService === service.code
                            ? 'border-blue-900 bg-blue-50 shadow-md'
                            : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="font-bold text-slate-900 mb-1">{service.name}</div>
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <Clock className="w-4 h-4" />
                              <span>Average wait: {service.avg_service_time_minutes} min</span>
                            </div>
                          </div>
                          {selectedService === service.code && (
                            <CheckCircle2 className="w-6 h-6 text-blue-900 flex-shrink-0" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={loading || !selectedBranch || !selectedService}
                className="w-full h-12 text-base font-bold"
                size="lg"
              >
                {loading ? 'Joining Queue...' : 'Get My Ticket'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* How it Works */}
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-900">How it Works</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2 text-sm text-blue-800">
              <li className="flex gap-3">
                <Badge variant="secondary" className="flex-shrink-0">1</Badge>
                <span>Select your DMV branch location</span>
              </li>
              <li className="flex gap-3">
                <Badge variant="secondary" className="flex-shrink-0">2</Badge>
                <span>Choose the service you need</span>
              </li>
              <li className="flex gap-3">
                <Badge variant="secondary" className="flex-shrink-0">3</Badge>
                <span>Receive your unique ticket number</span>
              </li>
              <li className="flex gap-3">
                <Badge variant="secondary" className="flex-shrink-0">4</Badge>
                <span>Monitor your position and estimated wait time</span>
              </li>
              <li className="flex gap-3">
                <Badge variant="secondary" className="flex-shrink-0">5</Badge>
                <span>You&apos;ll be notified when it&apos;s your turn</span>
              </li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
