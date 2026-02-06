"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { DashboardNav } from "@/components/dashboard-nav"
import { StatsCard } from "@/components/ui/stats-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Users, GraduationCap, FileText, Settings, RefreshCw } from "lucide-react"
import { supabase } from "@/lib/supabase"

interface User {
  id: string
  email: string
  role: string
  name?: string
}

interface DashboardStats {
  totalStudents: number
  totalTeachers: number
}

interface ODRequest {
  id: string
  od_start_date: string
  od_end_date: string
  reason: string
  status: string
  teacher_approved: boolean
  admin_approved: boolean
  students?: { name: string; email: string }
  classes?: { class_name: string }
}

export default function AdminDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    totalTeachers: 0,
  })
  const [pendingODRequests, setPendingODRequests] = useState<ODRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)

  useEffect(() => {
    // Check authentication immediately
    const userData = sessionStorage.getItem("user")
    if (!userData) {
      router.replace("/login")
      return
    }

    const parsedUser = JSON.parse(userData)
    if (parsedUser.role !== "admin") {
      router.replace("/login")
      return
    }

    // User is authorized
    setIsAuthorized(true)
    setUser(parsedUser)
    fetchDashboardData(parsedUser.id)
  }, []) // Remove router dependency to prevent re-fetching

  // Live polling for OD requests every 30 seconds
  useEffect(() => {
    if (!user) return

    const interval = setInterval(() => {
      fetchPendingODRequests(user.id)
    }, 30000) // Update every 30 seconds

    return () => clearInterval(interval)
  }, [user])

  const fetchDashboardData = async (adminId: string) => {
    try {
      setLoading(true)

      // Use API route that bypasses RLS
      const response = await fetch(`/api/admin/dashboard?adminId=${adminId}`)
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const data = await response.json()

      if (data.success) {
        setStats({
          totalStudents: data.stats.totalStudents,
          totalTeachers: data.stats.totalTeachers,
        })

        console.log('📊 Dashboard Stats:', data.stats)
        console.log('📋 OD Requests:', data.odRequests)

        // Set pending OD requests if they exist
        if (data.odRequests && Array.isArray(data.odRequests)) {
          setPendingODRequests(data.odRequests)
        }
      } else {
        console.error('❌ Dashboard API error:', data.error)
      }
    } catch (error) {
      console.error('❌ Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchPendingODRequests = async (adminId: string) => {
    try {
      const { data } = await supabase
        .from('od_requests')
        .select(`
          id,
          od_start_date,
          od_end_date,
          reason,
          status,
          teacher_approved,
          admin_approved,
          students (name, email),
          classes (class_name)
        `)
        .eq('admin_id', adminId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(5)

      setPendingODRequests(data || [])
    } catch (error) {
      console.error('Error fetching OD requests:', error)
    }
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <DashboardNav userName={user.name} userEmail={user.email} userRole={user.role} />
      
      <main className="container mx-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-2 sm:px-0">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Admin Dashboard</h2>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              Manage your attendance system and view analytics
            </p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button 
              onClick={() => user && fetchDashboardData(user.id)} 
              disabled={loading}
              className="flex-1 sm:flex-none text-sm"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
          <StatsCard
            title="Total Students"
            value={stats.totalStudents}
            icon={GraduationCap}
            description="Registered students"
          />
          <StatsCard
            title="Total Teachers"
            value={stats.totalTeachers}
            icon={Users}
            description="Active teachers"
          />
        </div>

        {/* Pending OD Requests Section */}
        {pendingODRequests.length > 0 && (
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">📋 Pending OD Requests</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {pendingODRequests.length} {pendingODRequests.length === 1 ? 'request' : 'requests'} awaiting approval
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pendingODRequests.map((request) => {
                  const startDate = new Date(request.od_start_date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })
                  const endDate = new Date(request.od_end_date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })
                  
                  return (
                    <div key={request.id} className="flex justify-between items-start gap-2 p-3 bg-white rounded-lg border border-blue-100">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{request.students?.name}</p>
                        <p className="text-xs text-muted-foreground">{request.students?.email}</p>
                        <p className="text-xs text-muted-foreground mt-1">📅 {startDate} to {endDate}</p>
                        <p className="text-xs text-gray-600 mt-1">📚 {request.classes?.class_name}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push("/admin/od-approvals")}
                        className="text-xs whitespace-nowrap"
                      >
                        Review →
                      </Button>
                    </div>
                  )
                })}
              </div>
              <Button
                variant="outline"
                className="w-full mt-3 text-sm"
                onClick={() => router.push("/admin/od-approvals")}
              >
                View All OD Requests
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">System Management</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Manage classes, subjects, and teachers</CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => router.push("/admin/manage")} 
                className="w-full text-sm sm:text-base"
              >
                <Users className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Open Management Panel</span>
                <span className="sm:hidden">Management</span>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">Manage Users</CardTitle>
              <CardDescription className="text-xs sm:text-sm">View and manage teachers and students</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full justify-start text-sm sm:text-base"
                  onClick={() => router.push("/admin/teachers")}
                >
                  <Users className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">View All Teachers</span>
                  <span className="sm:hidden">Teachers</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start text-sm sm:text-base"
                  onClick={() => router.push("/admin/students")}
                >
                  <GraduationCap className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">View All Students</span>
                  <span className="sm:hidden">Students</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">OD Requests</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Review student on-duty requests</CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => router.push("/admin/od-approvals")} 
                className="w-full text-sm sm:text-base"
              >
                <FileText className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">View OD Requests</span>
                <span className="sm:hidden">OD Requests</span>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">Reports</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Generate and download attendance reports</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full justify-start text-sm sm:text-base"
                  onClick={() => router.push("/admin/reports")}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Attendance Reports</span>
                  <span className="sm:hidden">Reports</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start text-sm sm:text-base"
                  onClick={() => router.push("/admin/analytics")}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Analytics Dashboard</span>
                  <span className="sm:hidden">Analytics</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
