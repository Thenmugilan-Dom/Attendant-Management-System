"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { DashboardNav } from "@/components/dashboard-nav"
import { StatsCard } from "@/components/ui/stats-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Users, GraduationCap, Calendar, TrendingUp, RefreshCw } from "lucide-react"
import { supabase } from "@/lib/supabase"

interface User {
  id: string
  email: string
  role: string
  name?: string
}

interface AttendanceStats {
  totalStudents: number
  totalTeachers: number
  todayAttendance: number
  attendanceRate: number
}

export default function AdminDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [stats, setStats] = useState<AttendanceStats>({
    totalStudents: 0,
    totalTeachers: 0,
    todayAttendance: 0,
    attendanceRate: 0,
  })
  const [recentAttendance, setRecentAttendance] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)

  useEffect(() => {
    // Check authentication immediately
    const userData = localStorage.getItem("user")
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
    fetchDashboardData()
  }, [router])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)

      // Fetch total students
      const { count: studentCount } = await supabase
        .from("users")
        .select("*", { count: "exact", head: true })
        .eq("user_type", "student")

      // Fetch total teachers
      const { count: teacherCount } = await supabase
        .from("users")
        .select("*", { count: "exact", head: true })
        .eq("user_type", "teacher")

      // Fetch today's attendance
      const today = new Date().toISOString().split("T")[0]
      const { data: todayAttendanceData, count: todayCount } = await supabase
        .from("attendance_records")
        .select("*, students(name, email)", { count: "exact" })
        .eq("date", today)
        .eq("status", "present")
        .order("created_at", { ascending: false })
        .limit(10)

      const attendanceRate = studentCount ? ((todayCount || 0) / studentCount) * 100 : 0

      setStats({
        totalStudents: studentCount || 0,
        totalTeachers: teacherCount || 0,
        todayAttendance: todayCount || 0,
        attendanceRate: Math.round(attendanceRate),
      })

      setRecentAttendance(todayAttendanceData || [])
    } catch (error) {
      console.error("Error fetching dashboard data:", error)
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <DashboardNav userName={user.name} userEmail={user.email} userRole={user.role} />
      
      <main className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Admin Dashboard</h2>
            <p className="text-muted-foreground">
              Manage your attendance system and view analytics
            </p>
          </div>
          <Button onClick={fetchDashboardData} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
          <StatsCard
            title="Today's Attendance"
            value={stats.todayAttendance}
            icon={Calendar}
            description="Present students today"
          />
          <StatsCard
            title="Attendance Rate"
            value={`${stats.attendanceRate}%`}
            icon={TrendingUp}
            description="Today's attendance rate"
          />
        </div>

        {/* Recent Attendance Table */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Attendance</CardTitle>
            <CardDescription>
              Latest attendance records from today
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : recentAttendance.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No attendance records for today
              </div>
            ) : (
              <div className="rounded-md border">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-3 text-left text-sm font-medium">Student</th>
                      <th className="p-3 text-left text-sm font-medium">Email</th>
                      <th className="p-3 text-left text-sm font-medium">Subject</th>
                      <th className="p-3 text-left text-sm font-medium">Time</th>
                      <th className="p-3 text-left text-sm font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentAttendance.map((record) => (
                      <tr key={record.id} className="border-b">
                        <td className="p-3 text-sm">
                          {record.users?.name || "N/A"}
                        </td>
                        <td className="p-3 text-sm text-muted-foreground">
                          {record.users?.email || "N/A"}
                        </td>
                        <td className="p-3 text-sm">{record.subject}</td>
                        <td className="p-3 text-sm">
                          {new Date(record.created_at).toLocaleTimeString()}
                        </td>
                        <td className="p-3 text-sm">
                          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                            Present
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>System Management</CardTitle>
              <CardDescription>Manage classes, subjects, and teachers</CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => router.push("/admin/manage")} 
                className="w-full"
              >
                <Users className="mr-2 h-4 w-4" />
                Open Management Panel
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Manage Users</CardTitle>
              <CardDescription>View and manage teachers and students</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => {
                    router.push("/admin/manage")
                    // Set the active tab to teachers after navigation
                    setTimeout(() => {
                      const teachersTab = document.querySelector('[data-tab="teachers"]') as HTMLElement
                      if (teachersTab) teachersTab.click()
                    }, 100)
                  }}
                >
                  <Users className="mr-2 h-4 w-4" />
                  View All Teachers
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => {
                    alert("Student management feature coming soon!")
                  }}
                >
                  <GraduationCap className="mr-2 h-4 w-4" />
                  View All Students
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reports</CardTitle>
              <CardDescription>Generate and download attendance reports</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => {
                    alert("Daily Report feature coming soon!")
                  }}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  Daily Report
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => {
                    alert("Monthly Report feature coming soon!")
                  }}
                >
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Monthly Report
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )

  // Show loading screen while checking authorization
  if (!isAuthorized) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verifying access...</p>
        </div>
      </div>
    )
  }
}
