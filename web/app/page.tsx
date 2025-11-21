import Link from 'next/link'
import { Users, Clock, Monitor, ChevronRight, Info } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="container max-w-2xl mx-auto px-4 py-12">
        {/* Logo and Header */}
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-blue-900 text-white rounded-full flex items-center justify-center text-3xl font-black border-4 border-yellow-400 shadow-lg mx-auto">
            CA
          </div>
          <h1 className="mt-6 text-4xl font-black text-blue-900 tracking-tight">
            DMV OpenQueue
          </h1>
          <p className="text-slate-600 mt-2 text-lg">
            California Department of Motor Vehicles
          </p>
          <div className="mt-3 flex items-center justify-center gap-2 text-green-600 text-sm font-semibold">
            <span className="pulse-dot"></span>
            System Online
          </div>
        </div>

        {/* Main Action Cards */}
        <div className="space-y-4 mb-8">
          <Link href="/join" className="block group">
            <Card className="border-l-4 border-l-blue-900 hover:shadow-lg transition-all hover:-translate-y-1 cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                      <Users className="w-6 h-6 text-blue-900" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-blue-900 mb-1">
                        Get in Line
                      </h3>
                      <p className="text-sm text-slate-600">
                        Join the virtual queue for DMV services
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-6 h-6 text-blue-900 group-hover:translate-x-1 transition-transform" />
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/status" className="block group">
            <Card className="border-l-4 border-l-slate-600 hover:shadow-lg transition-all hover:-translate-y-1 cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
                      <Clock className="w-6 h-6 text-slate-700" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-blue-900 mb-1">
                        Check Status
                      </h3>
                      <p className="text-sm text-slate-600">
                        View your ticket and estimated wait time
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-6 h-6 text-slate-600 group-hover:translate-x-1 transition-transform" />
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/staff" className="block group">
            <Card className="border-l-4 border-l-slate-400 bg-slate-50 hover:shadow-lg transition-all hover:-translate-y-1 cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-200 rounded-xl flex items-center justify-center">
                      <Monitor className="w-6 h-6 text-slate-700" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-blue-900 mb-1">
                        Staff Portal
                      </h3>
                      <p className="text-sm text-slate-600">
                        Call next ticket and manage queues
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:translate-x-1 transition-transform" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Info Card */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-6">
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                  <Info className="w-5 h-5 text-white" />
                </div>
              </div>
              <div>
                <h4 className="text-blue-900 font-bold mb-2">
                  About OpenQueue
                </h4>
                <p className="text-sm text-blue-800 leading-relaxed">
                  Open-source replacement for proprietary DMV queue systems. Join virtual queues,
                  track your position in real-time, and receive notifications when it&apos;s your turn.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center py-8 text-slate-400 text-sm">
          <p>v0.3.0 • Open Source Project</p>
        </div>
      </div>
    </div>
  )
}
