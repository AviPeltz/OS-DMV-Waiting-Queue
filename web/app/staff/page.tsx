'use client'

import { useState, useEffect } from 'react'
import { fetchBranches, fetchBranchServices, callNextTicket, fetchQueueStatus, Branch, Service, QueueStatus, APIError } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, RefreshCw, Users, TrendingUp, Activity, AlertCircle, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

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
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    )
  }

  const totalWaiting = queueStatus?.queues.reduce((sum, q) => sum + q.waiting_count, 0) || 0
  const activeQueues = queueStatus?.queues.filter(q => q.currently_serving).length || 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container max-w-6xl mx-auto px-4 py-8">
        {/* Back Button */}
        <Link href="/" className="inline-flex items-center gap-2 text-blue-900 hover:text-blue-700 mb-6 font-semibold transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-black text-blue-900 mb-2">Staff Portal</h1>
              <p className="text-slate-600">Manage queues and call next ticket</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="pulse-dot"></span>
              <span className="text-sm font-semibold text-green-600">System Online</span>
            </div>
          </div>
        </div>

        {/* Branch Selection */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Select Branch</CardTitle>
            <CardDescription>Choose your DMV branch location</CardDescription>
          </CardHeader>
          <CardContent>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            >
              <option value="">-- Choose a branch --</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>

            <Card className="mt-4 bg-yellow-50 border-yellow-200">
              <CardContent className="p-4">
                <div className="flex gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-700 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    <strong>Note:</strong> This portal uses API key authentication. For production,
                    implement JWT/session-based authentication instead of the shared API key.
                  </div>
                </div>
              </CardContent>
            </Card>
          </CardContent>
        </Card>

        {/* Alerts */}
        {successMessage && (
          <Card className="mb-6 border-green-200 bg-green-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <p className="text-green-800 font-semibold">{successMessage}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {error && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <p className="text-red-800 font-semibold">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Queue Status */}
        {selectedBranch && queueStatus && (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500 font-semibold uppercase tracking-wide">Total Waiting</p>
                      <p className="text-3xl font-black text-blue-900 mt-1">{totalWaiting}</p>
                    </div>
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                      <Users className="w-6 h-6 text-blue-900" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500 font-semibold uppercase tracking-wide">Active Services</p>
                      <p className="text-3xl font-black text-green-600 mt-1">{activeQueues}</p>
                    </div>
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                      <Activity className="w-6 h-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-500 font-semibold uppercase tracking-wide">Service Types</p>
                      <p className="text-3xl font-black text-slate-900 mt-1">{queueStatus.queues.length}</p>
                    </div>
                    <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-slate-700" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Queue Management */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Queue Management</CardTitle>
                    <CardDescription>{queueStatus.branch_name}</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadQueueStatus(parseInt(selectedBranch))}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {queueStatus.queues.map((queue) => (
                    <Card key={queue.service_code} className="border-l-4 border-l-blue-900">
                      <CardContent className="p-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex-1">
                            <h3 className="font-bold text-lg text-slate-900 mb-1">
                              {queue.service_name}
                            </h3>
                            <p className="text-sm text-slate-500 font-mono">{queue.service_code}</p>
                          </div>

                          <div className="flex items-center gap-6">
                            <div className="text-center">
                              <Badge
                                className={
                                  queue.waiting_count > 0
                                    ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                                }
                              >
                                {queue.waiting_count} waiting
                              </Badge>
                            </div>

                            <div className="text-center min-w-[120px]">
                              {queue.currently_serving ? (
                                <div>
                                  <p className="text-xs text-slate-500 mb-1">Now Serving</p>
                                  <Badge className="bg-green-100 text-green-800 border-green-200 font-mono">
                                    {queue.currently_serving}
                                  </Badge>
                                </div>
                              ) : (
                                <p className="text-sm text-slate-400">None serving</p>
                              )}
                            </div>

                            <Button
                              onClick={() => handleCallNext(queue.service_code)}
                              disabled={loading || queue.waiting_count === 0}
                              className="min-w-[120px]"
                            >
                              {loading ? (
                                <>
                                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                  Calling...
                                </>
                              ) : (
                                'Call Next'
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {queueStatus.queues.every(q => q.waiting_count === 0) && (
                  <div className="text-center py-12">
                    <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500 font-semibold">No tickets waiting in any queue</p>
                    <p className="text-sm text-slate-400 mt-1">All caught up!</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Integration Info */}
            <Card className="mt-6 bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-blue-900">Future Integration Points</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-blue-800">
                  <li>• WebSocket integration for real-time updates to display monitors</li>
                  <li>• Bridge to Qmatic display URLs (e.g., https://mt-cadmvoas.us.qmatic.cloud/...)</li>
                  <li>• Staff authentication and role-based access control</li>
                  <li>• Audit logging for all ticket operations</li>
                  <li>• Multi-counter support with counter assignment</li>
                  <li>• Service pause/resume controls</li>
                </ul>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
