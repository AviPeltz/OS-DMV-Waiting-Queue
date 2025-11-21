'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { fetchTicketStatus, TicketStatus } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, RefreshCw, Users, Clock, CheckCircle2, AlertCircle, Copy, Check } from 'lucide-react'
import Link from 'next/link'

function TicketStatusContent() {
  const searchParams = useSearchParams()
  const ticketFromUrl = searchParams.get('ticket')

  const [ticketNumber, setTicketNumber] = useState(ticketFromUrl || '')
  const [ticketStatus, setTicketStatus] = useState<TicketStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [copied, setCopied] = useState(false)

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

  const copyToClipboard = async () => {
    if (!ticketStatus) return

    try {
      await navigator.clipboard.writeText(ticketStatus.ticket_number)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

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
          <h1 className="text-3xl font-black text-blue-900 mb-2">Check Ticket Status</h1>
          <p className="text-slate-600">View your position and estimated wait time</p>
        </div>

        {/* Search Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Enter Ticket Number</CardTitle>
            <CardDescription>Check the status of your ticket in the queue</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <input
                  type="text"
                  id="ticketNumber"
                  value={ticketNumber}
                  onChange={(e) => setTicketNumber(e.target.value)}
                  placeholder="e.g., A0042"
                  className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-lg font-mono"
                  required
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                <Button type="submit" disabled={loading} className="flex-shrink-0">
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    'Check Status'
                  )}
                </Button>

                <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300"
                  />
                  <span>Auto-refresh every 10s</span>
                </label>
              </div>

              {error && (
                <Card className="border-red-200 bg-red-50">
                  <CardContent className="p-4">
                    <p className="text-red-800 font-semibold">{error}</p>
                  </CardContent>
                </Card>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Ticket Status Display */}
        {ticketStatus && (
          <>
            {ticketStatus.status === 'waiting' && (
              <Card className="mb-6 border-yellow-200 bg-gradient-to-br from-white to-yellow-50">
                <CardContent className="p-8 text-center">
                  <div className="mb-4">
                    {autoRefresh && (
                      <div className="flex items-center justify-center gap-2 text-green-600 text-sm font-semibold mb-4">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Live Updating
                      </div>
                    )}
                    <p className="text-slate-500 uppercase text-xs font-bold tracking-wide mb-2">Your Ticket Number</p>
                    <button
                      onClick={copyToClipboard}
                      className="group relative text-4xl sm:text-5xl md:text-6xl font-black text-blue-900 tracking-tighter mb-3 break-all hover:text-blue-700 transition-colors cursor-pointer"
                    >
                      {ticketStatus.ticket_number}
                      <div className="absolute -right-2 -top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {copied ? (
                          <Check className="w-6 h-6 text-green-600" />
                        ) : (
                          <Copy className="w-5 h-5 text-blue-600" />
                        )}
                      </div>
                    </button>
                    {copied && (
                      <p className="text-green-600 text-sm font-semibold mb-2 animate-fade-in">Copied to clipboard!</p>
                    )}
                    <div>
                      <Badge className="bg-blue-100 text-blue-800 border-blue-200">{ticketStatus.service_name}</Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-3xl font-black text-blue-900">{ticketStatus.current_position}</div>
                        <div className="text-xs text-slate-500 uppercase mt-1">People Ahead</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-3xl font-black text-blue-900">~{ticketStatus.estimated_wait_minutes}</div>
                        <div className="text-xs text-slate-500 uppercase mt-1">Min Wait</div>
                      </CardContent>
                    </Card>
                  </div>

                  <p className="text-slate-600 text-sm">
                    Please stay near the waiting area. You&apos;ll be notified when your turn is near.
                  </p>
                </CardContent>
              </Card>
            )}

            {ticketStatus.status === 'called' && (
              <Card className="mb-6 border-green-500 bg-green-50 animate-pulse">
                <CardContent className="p-8 text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <h2 className="text-2xl font-black text-green-800 mb-2">It&apos;s Your Turn!</h2>
                  <p className="text-green-700 mb-4">Please proceed to the service counter</p>
                  <button
                    onClick={copyToClipboard}
                    className="group relative text-3xl sm:text-4xl md:text-5xl font-black text-green-900 break-all hover:text-green-700 transition-colors cursor-pointer"
                  >
                    {ticketStatus.ticket_number}
                    <div className="absolute -right-2 -top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {copied ? (
                        <Check className="w-6 h-6 text-green-600" />
                      ) : (
                        <Copy className="w-5 h-5 text-green-700" />
                      )}
                    </div>
                  </button>
                  {copied && (
                    <p className="text-green-600 text-sm font-semibold mt-2 animate-fade-in">Copied to clipboard!</p>
                  )}
                </CardContent>
              </Card>
            )}

            {ticketStatus.status === 'completed' && (
              <Card className="mb-6 border-slate-300 bg-slate-50">
                <CardContent className="p-8 text-center">
                  <CheckCircle2 className="w-20 h-20 text-slate-300 mx-auto mb-4" />
                  <h2 className="text-xl font-bold text-slate-400 mb-2">Service Completed</h2>
                  <p className="text-slate-400">Thank you for visiting the CA DMV.</p>
                  <Link href="/">
                    <Button variant="outline" className="mt-6">Back to Start</Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {/* Ticket Details */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">Ticket Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-slate-500 mb-1">Branch</div>
                    <div className="font-semibold text-slate-900">{ticketStatus.branch_name}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 mb-1">Service</div>
                    <div className="font-semibold text-slate-900">{ticketStatus.service_name}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 mb-1">Created</div>
                    <div className="font-semibold text-slate-900">
                      {new Date(ticketStatus.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                  {ticketStatus.called_at && (
                    <div>
                      <div className="text-slate-500 mb-1">Called</div>
                      <div className="font-semibold text-slate-900">
                        {new Date(ticketStatus.called_at).toLocaleTimeString()}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {!ticketStatus && !error && (
          <Card className="bg-slate-50">
            <CardContent className="p-12 text-center">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 mb-2">Enter your ticket number above to check your status</p>
              <p className="text-sm text-slate-500">
                You received your ticket number when you joined the queue
              </p>
            </CardContent>
          </Card>
        )}

        {/* Info Card */}
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-900">Status Guide</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-blue-800">
              <li><strong>Waiting in Queue:</strong> You&apos;re in line. Check your position and estimated wait time above.</li>
              <li><strong>Your Turn:</strong> Please proceed to the service counter immediately.</li>
              <li><strong>Service Completed:</strong> Your service has been completed. Thank you!</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function TicketStatusPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    }>
      <TicketStatusContent />
    </Suspense>
  )
}
