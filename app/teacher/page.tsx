"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { DashboardNav } from "@/components/dashboard-nav"
import { StatsCard } from "@/components/ui/stats-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import QRCode from "react-qr-code"
import { Calendar, Users, CheckCircle, RefreshCw, QrCode, GraduationCap } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { generatePDF, generateCSV, generateComprehensivePDF, generateComprehensiveCSV } from "@/lib/reportGenerator"

interface User {
  id: string
  email: string
  role: string
  name?: string
}

interface AttendanceSession {
  id: string
  teacher_id: string
  class_id: string
  subject_id: string
  session_code: string
  session_date: string
  session_time: string
  expires_at: string
  status: 'active' | 'expired' | 'completed'
  created_at: string
  classes?: {
    class_name: string
    section: string
  }
  subjects?: {
    subject_name: string
    subject_code: string
  }
}

interface Assignment {
  id: string
  class_id: string
  subject_id: string
  class_name: string
  section: string
  subject_name: string
  subject_code: string
}

interface Student {
  id: string
  user_id: string
  class_id: string
  roll_number: string
  name: string
  email: string
  phone?: string
  department?: string
  year?: string
}

export default function TeacherDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [selectedClassId, setSelectedClassId] = useState("")
  const [selectedSubjectId, setSelectedSubjectId] = useState("")
  const [todayAttendance, setTodayAttendance] = useState<any[]>([])
  const [stats, setStats] = useState({
    todayPresent: 0,
    totalSessions: 0,
    averageAttendance: 0,
  })
  
  // View Students feature states
  const [viewStudentsClassId, setViewStudentsClassId] = useState("")
  const [students, setStudents] = useState<Student[]>([])
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  
  // Attendance reports states
  const [showAttendanceDialog, setShowAttendanceDialog] = useState(false)
  const [selectedSessionDetails, setSelectedSessionDetails] = useState<any>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)

  // Comprehensive reports states
  const [showReportsDialog, setShowReportsDialog] = useState(false)
  const [reportClassId, setReportClassId] = useState("")
  const [reportSubjectId, setReportSubjectId] = useState("")
  const [reportStartDate, setReportStartDate] = useState("")
  const [reportEndDate, setReportEndDate] = useState("")
  const [reportData, setReportData] = useState<any>(null)
  const [loadingReport, setLoadingReport] = useState(false)
  const [isAuthorized, setIsAuthorized] = useState(false)

  useEffect(() => {
    // Check authentication immediately
    const userData = localStorage.getItem("user")
    if (!userData) {
      router.replace("/login")
      return
    }

    const parsedUser = JSON.parse(userData)
    if (parsedUser.role !== "teacher") {
      router.replace("/login")
      return
    }

    // User is authorized
    setIsAuthorized(true)

    setUser(parsedUser)
    fetchTeacherData(parsedUser.id)
  }, [router])

  const fetchTeacherData = async (teacherId: string) => {
    try {
      // Fetch teacher's assigned classes and subjects
      const { data: assignmentsData, error: assignError } = await supabase
        .from("teacher_subjects")
        .select(`
          id,
          class_id,
          subject_id,
          classes (
            id,
            class_name,
            section
          ),
          subjects (
            id,
            subject_name,
            subject_code
          )
        `)
        .eq("teacher_id", teacherId)

      if (assignError) {
        console.error("❌ Error fetching assignments:", assignError)
        setError("Failed to load your assignments. Please contact admin.")
      } else if (assignmentsData && assignmentsData.length > 0) {
        // Transform the data
        const formattedAssignments = assignmentsData.map((assignment: any) => ({
          id: assignment.id,
          class_id: assignment.class_id,
          subject_id: assignment.subject_id,
          class_name: assignment.classes?.class_name || '',
          section: assignment.classes?.section || '',
          subject_name: assignment.subjects?.subject_name || '',
          subject_code: assignment.subjects?.subject_code || '',
        }))
        setAssignments(formattedAssignments)
        console.log("✅ Loaded assignments:", formattedAssignments)
      } else {
        // No assignments found
        console.log("ℹ️ No assignments found for teacher:", teacherId)
        console.log("📌 Please ask admin to assign you to classes and subjects")
        setAssignments([])
      }

      // Check for active session
      const { data: activeSessionData } = await supabase
        .from("attendance_sessions")
        .select(`
          *,
          classes (class_name, section),
          subjects (subject_name, subject_code)
        `)
        .eq("teacher_id", teacherId)
        .eq("status", "active")
        .single()

      if (activeSessionData) {
        setActiveSession(activeSessionData)
        fetchSessionAttendance(activeSessionData.id)
      }

      // Fetch today's stats
      const today = new Date().toISOString().split("T")[0]
      
      // Get today's attendance count by joining with sessions
      const { data: todayRecords } = await supabase
        .from("attendance_records")
        .select(`
          id,
          status,
          attendance_sessions!inner (
            teacher_id,
            session_date
          )
        `)
        .eq("attendance_sessions.teacher_id", teacherId)
        .eq("attendance_sessions.session_date", today)
        .eq("status", "present")

      const { count: totalSessions } = await supabase
        .from("attendance_sessions")
        .select("*", { count: "exact", head: true })
        .eq("teacher_id", teacherId)

      setStats({
        todayPresent: todayRecords?.length || 0,
        totalSessions: totalSessions || 0,
        averageAttendance: 0,
      })
    } catch (error) {
      console.error("Error fetching teacher data:", error)
    }
  }

  const fetchSessionAttendance = async (sessionId: string) => {
    try {
      const { data } = await supabase
        .from("attendance_records")
        .select("*, students(name, email)")
        .eq("session_id", sessionId)
        .eq("status", "present")
        .order("created_at", { ascending: false })

      setTodayAttendance(data || [])
    } catch (error) {
      console.error("Error fetching session attendance:", error)
    }
  }

  const generateSessionCode = () => {
    return Math.random().toString(36).substring(2, 10).toUpperCase()
  }

  const handleStartSession = async () => {
    if (!selectedClassId || !selectedSubjectId || !user) {
      alert("Please select both class and subject")
      return
    }

    // Get selected assignment details
    const selectedAssignment = assignments.find(
      a => a.class_id === selectedClassId && a.subject_id === selectedSubjectId
    )

    if (!selectedAssignment) {
      alert("Invalid class-subject combination")
      return
    }

    setLoading(true)
    try {
      const sessionCode = generateSessionCode()
      const today = new Date().toISOString().split("T")[0]
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutes from now

      console.log("🔄 Creating session with:", {
        teacher_id: user.id,
        class_id: selectedClassId,
        subject_id: selectedSubjectId,
        session_code: sessionCode,
        session_date: today,
        expires_at: expiresAt,
        status: 'active'
      })

      const { data: session, error } = await supabase
        .from("attendance_sessions")
        .insert({
          teacher_id: user.id,
          class_id: selectedClassId,
          subject_id: selectedSubjectId,
          session_code: sessionCode,
          session_date: today,
          expires_at: expiresAt,
          status: 'active',
        })
        .select(`
          *,
          classes (class_name, section),
          subjects (subject_name, subject_code)
        `)
        .single()

      if (error) {
        console.error("❌ Supabase error starting session:", error)
        console.error("Error details:", JSON.stringify(error, null, 2))
        throw error
      }

      console.log("✅ Session created successfully:", session)
      setActiveSession(session)
      setTodayAttendance([])
    } catch (error) {
      console.error("❌ Error starting session:", error)
      console.error("Error type:", typeof error)
      console.error("Error stringified:", JSON.stringify(error, null, 2))
      alert(`Failed to start session: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleEndSession = async () => {
    if (!activeSession) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from("attendance_sessions")
        .update({ status: 'completed' })
        .eq("id", activeSession.id)

      if (error) {
        console.error("❌ Error ending session:", error)
        throw error
      }

      console.log("✅ Session ended successfully")
      setActiveSession(null)
      setSelectedClassId("")
      setSelectedSubjectId("")
      setTodayAttendance([])
    } catch (error) {
      console.error("❌ Caught error ending session:", error)
      alert(`Failed to end session: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleViewAttendance = async () => {
    if (!activeSession) return
    
    try {
      setLoadingDetails(true)
      const response = await fetch(`/api/attendance/records?sessionId=${activeSession.id}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch attendance records')
      }
      
      const data = await response.json()
      setSelectedSessionDetails(data)
      setShowAttendanceDialog(true)
    } catch (error) {
      console.error('Error fetching attendance:', error)
      alert('Failed to fetch attendance records. Please try again.')
    } finally {
      setLoadingDetails(false)
    }
  }

  const handleDownloadPDF = () => {
    if (!selectedSessionDetails) return
    
    try {
      generatePDF(
        selectedSessionDetails.session,
        selectedSessionDetails.records,
        selectedSessionDetails.statistics
      )
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Failed to generate PDF. Please try again.')
    }
  }

  const handleDownloadCSV = () => {
    if (!selectedSessionDetails) return
    
    try {
      generateCSV(
        selectedSessionDetails.session,
        selectedSessionDetails.records,
        selectedSessionDetails.statistics
      )
    } catch (error) {
      console.error('Error generating CSV:', error)
      alert('Failed to generate CSV. Please try again.')
    }
  }

  const handleGenerateReport = async () => {
    if (!user) return

    setLoadingReport(true)
    try {
      const response = await fetch('/api/attendance/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherId: user.id,
          classId: reportClassId || undefined,
          subjectId: reportSubjectId || undefined,
          startDate: reportStartDate || undefined,
          endDate: reportEndDate || undefined
        })
      })

      if (!response.ok) {
        throw new Error('Failed to generate report')
      }

      const data = await response.json()
      setReportData(data)
      
      if (data.sessions.length === 0) {
        alert('No sessions found for the selected filters.')
      }
    } catch (error) {
      console.error('Error generating report:', error)
      alert('Failed to generate report. Please try again.')
    } finally {
      setLoadingReport(false)
    }
  }

  const handleDownloadComprehensivePDF = () => {
    if (!reportData || !user) return
    
    try {
      generateComprehensivePDF(reportData, user.name || 'Teacher')
    } catch (error) {
      console.error('Error generating comprehensive PDF:', error)
      alert('Failed to generate PDF. Please try again.')
    }
  }

  const handleDownloadComprehensiveCSV = () => {
    if (!reportData || !user) return
    
    try {
      generateComprehensiveCSV(reportData, user.name || 'Teacher')
    } catch (error) {
      console.error('Error generating comprehensive CSV:', error)
      alert('Failed to generate CSV. Please try again.')
    }
  }

  const refreshAttendance = () => {
    if (activeSession) {
      fetchSessionAttendance(activeSession.id)
      setStats((prev) => ({ ...prev, todayPresent: todayAttendance.length }))
    }
  }

  const fetchStudentsByClass = async (classId: string) => {
    if (!classId) {
      setStudents([])
      return
    }

    setLoadingStudents(true)
    try {
      const { data, error } = await supabase
        .from("students")
        .select(`
          id,
          student_id,
          name,
          email,
          phone,
          address,
          parent_phone,
          parent_name,
          class_id,
          status
        `)
        .eq("class_id", classId)
        .order("student_id", { ascending: true })

      if (error) {
        console.error("❌ Supabase error fetching students:", error)
        console.error("Error details:", JSON.stringify(error, null, 2))
        console.error("Error code:", error.code)
        console.error("Error message:", error.message)
        alert(`Failed to fetch students: ${error.message || 'Unknown error'}`)
      } else if (data) {
        console.log("✅ Raw student data from Supabase:", data)
        // Transform the data - using actual database columns
        const formattedStudents = data.map((student: any) => ({
          id: student.id,
          user_id: student.id, // Using student ID as user_id for compatibility
          class_id: student.class_id,
          roll_number: student.student_id, // Using student_id as roll_number
          name: student.name,
          email: student.email,
          phone: student.phone || "",
          department: "", // Not in current schema
          year: "", // Not in current schema
        }))
        setStudents(formattedStudents)
        console.log("✅ Formatted students:", formattedStudents)
      }
    } catch (error) {
      console.error("❌ Caught error fetching students:", error)
      console.error("Error type:", typeof error)
      console.error("Error stringified:", JSON.stringify(error, null, 2))
    } finally {
      setLoadingStudents(false)
    }
  }

  const handleViewStudentsClassChange = (classId: string) => {
    setViewStudentsClassId(classId)
    setSelectedStudent(null)
    if (classId) {
      fetchStudentsByClass(classId)
    } else {
      setStudents([])
    }
  }

  if (!user) {
    return null
  }

  const qrData = activeSession
    ? JSON.stringify({
        sessionId: activeSession.id,
        sessionCode: activeSession.session_code,
        teacherId: user.id,
        className: activeSession.classes ? `${activeSession.classes.class_name} ${activeSession.classes.section}` : '',
        subject: activeSession.subjects?.subject_name || '',
        date: activeSession.session_date,
      })
    : ""

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

  return (
    <div className="min-h-screen bg-muted/40">
      <DashboardNav userName={user.name} userEmail={user.email} userRole={user.role} />

      <main className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Teacher Dashboard</h2>
          <p className="text-muted-foreground">
            Manage your classes and track student attendance
          </p>
        </div>

        {/* Assignments Overview */}
        {assignments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5" />
                Your Assigned Classes & Subjects
              </CardTitle>
              <CardDescription>
                Classes and subjects assigned to you by admin
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {assignments.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="font-medium text-sm text-primary">
                      {assignment.class_name} {assignment.section}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {assignment.subject_code} - {assignment.subject_name}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-3">
          <StatsCard
            title="Today's Present"
            value={stats.todayPresent}
            icon={CheckCircle}
            description="Students marked present"
          />
          <StatsCard
            title="Total Sessions"
            value={stats.totalSessions}
            icon={Calendar}
            description="All time sessions"
          />
          <StatsCard
            title="Average Attendance"
            value={`${stats.averageAttendance}%`}
            icon={Users}
            description="Overall attendance rate"
          />
        </div>

        {/* Main Content */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Session Control */}
          <Card>
            <CardHeader>
              <CardTitle>Attendance Session</CardTitle>
              <CardDescription>
                {activeSession
                  ? "Session is active - Show QR code to students"
                  : "Start a new attendance session"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!activeSession ? (
                <>
                  {assignments.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="text-lg font-medium">No Assignments Found</p>
                      <p className="text-sm mt-2">
                        Contact admin to assign classes and subjects to you.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="class">Select Class</Label>
                        <select
                          id="class"
                          className="w-full px-3 py-2 border rounded-md"
                          value={selectedClassId}
                          onChange={(e) => setSelectedClassId(e.target.value)}
                        >
                          <option value="">-- Choose a class --</option>
                          {/* Get unique classes */}
                          {Array.from(new Set(assignments.map(a => a.class_id))).map(classId => {
                            const assignment = assignments.find(a => a.class_id === classId)
                            return (
                              <option key={classId} value={classId}>
                                {assignment?.class_name} {assignment?.section}
                              </option>
                            )
                          })}
                        </select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="subject">Select Subject</Label>
                        <select
                          id="subject"
                          className="w-full px-3 py-2 border rounded-md"
                          value={selectedSubjectId}
                          onChange={(e) => setSelectedSubjectId(e.target.value)}
                          disabled={!selectedClassId}
                        >
                          <option value="">-- Choose a subject --</option>
                          {/* Show only subjects for selected class */}
                          {selectedClassId && assignments
                            .filter(a => a.class_id === selectedClassId)
                            .map(assignment => (
                              <option key={assignment.subject_id} value={assignment.subject_id}>
                                {assignment.subject_code} - {assignment.subject_name}
                              </option>
                            ))
                          }
                        </select>
                      </div>

                      <Button
                        className="w-full"
                        onClick={handleStartSession}
                        disabled={loading || !selectedClassId || !selectedSubjectId}
                      >
                        <QrCode className="mr-2 h-4 w-4" />
                        {selectedClassId && selectedSubjectId ? "Generate QR Code & Start Session" : "Select Class & Subject First"}
                      </Button>
                    </>
                  )}
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <div className="text-sm font-medium">
                      Class: {activeSession.classes ? `${activeSession.classes.class_name} ${activeSession.classes.section}` : 'N/A'}
                    </div>
                    <div className="text-sm font-medium">
                      Subject: {activeSession.subjects?.subject_name || 'N/A'}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Session Code: {activeSession.session_code}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      variant="outline"
                      onClick={handleViewAttendance}
                      disabled={loading || loadingDetails}
                    >
                      <Users className="mr-2 h-4 w-4" />
                      {loadingDetails ? 'Loading...' : 'View Attendance'}
                    </Button>
                    <Button
                      className="flex-1"
                      variant="destructive"
                      onClick={handleEndSession}
                      disabled={loading}
                    >
                      End Session
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* QR Code Display */}
          <Card>
            <CardHeader>
              <CardTitle>QR Code</CardTitle>
              <CardDescription>
                Students scan this code to mark attendance
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activeSession ? (
                <div className="flex flex-col items-center space-y-4">
                  <div className="bg-white p-4 rounded-lg">
                    <QRCode value={qrData} size={256} />
                  </div>
                  <p className="text-sm text-center text-muted-foreground">
                    Ask students to scan this QR code with their mobile devices
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  <div className="text-center">
                    <QrCode className="mx-auto h-12 w-12 mb-2 opacity-50" />
                    <p>Start a session to generate QR code</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Attendance List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Current Session Attendance</CardTitle>
                <CardDescription>
                  {activeSession
                    ? `${todayAttendance.length} students marked present`
                    : "No active session"}
                </CardDescription>
              </div>
              {activeSession && (
                <Button variant="outline" size="sm" onClick={refreshAttendance}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!activeSession ? (
              <div className="text-center py-8 text-muted-foreground">
                Start a session to see attendance
              </div>
            ) : todayAttendance.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No students have marked attendance yet
              </div>
            ) : (
              <div className="rounded-md border">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-3 text-left text-sm font-medium">#</th>
                      <th className="p-3 text-left text-sm font-medium">Student Name</th>
                      <th className="p-3 text-left text-sm font-medium">Email</th>
                      <th className="p-3 text-left text-sm font-medium">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todayAttendance.map((record, index) => (
                      <tr key={record.id} className="border-b">
                        <td className="p-3 text-sm">{index + 1}</td>
                        <td className="p-3 text-sm">
                          {record.users?.name || "N/A"}
                        </td>
                        <td className="p-3 text-sm text-muted-foreground">
                          {record.users?.email || "N/A"}
                        </td>
                        <td className="p-3 text-sm">
                          {new Date(record.created_at).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* View Students Section */}
        <Card>
          <CardHeader>
            <CardTitle>View Students</CardTitle>
            <CardDescription>
              Select a class to view all students or see individual student details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Class Selector */}
              <div className="space-y-2">
                <Label htmlFor="view-class">Select Class</Label>
                <select
                  id="view-class"
                  value={viewStudentsClassId}
                  onChange={(e) => handleViewStudentsClassChange(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">-- Choose a class --</option>
                  {Array.from(
                    new Set(assignments.map((a) => a.class_id))
                  ).map((classId) => {
                    const assignment = assignments.find((a) => a.class_id === classId)
                    return (
                      <option key={classId} value={classId}>
                        {assignment?.class_name} {assignment?.section}
                      </option>
                    )
                  })}
                </select>
              </div>

              {/* Loading State */}
              {loadingStudents && (
                <div className="text-center py-4 text-muted-foreground">
                  Loading students...
                </div>
              )}

              {/* No Class Selected */}
              {!viewStudentsClassId && !loadingStudents && (
                <div className="text-center py-8 text-muted-foreground">
                  Select a class to view students
                </div>
              )}

              {/* No Students Found */}
              {viewStudentsClassId && !loadingStudents && students.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No students found in this class
                </div>
              )}

              {/* Students List */}
              {viewStudentsClassId && !loadingStudents && students.length > 0 && (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-sm font-medium">
                      Total Students: {students.length}
                    </div>
                    {selectedStudent && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedStudent(null)}
                      >
                        Back to List
                      </Button>
                    )}
                  </div>

                  {!selectedStudent ? (
                    // Full Student List
                    <div className="rounded-md border">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="p-3 text-left text-sm font-medium">Roll No</th>
                            <th className="p-3 text-left text-sm font-medium">Name</th>
                            <th className="p-3 text-left text-sm font-medium">Email</th>
                            <th className="p-3 text-left text-sm font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {students.map((student) => (
                            <tr key={student.id} className="border-b hover:bg-muted/50">
                              <td className="p-3 text-sm font-medium">{student.roll_number}</td>
                              <td className="p-3 text-sm">{student.name}</td>
                              <td className="p-3 text-sm text-muted-foreground">
                                {student.email}
                              </td>
                              <td className="p-3 text-sm">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedStudent(student)}
                                >
                                  View Details
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    // Individual Student Details
                    <Card className="border-2">
                      <CardHeader>
                        <CardTitle className="text-lg">Student Details</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-muted-foreground">Roll Number</Label>
                              <div className="text-lg font-semibold">
                                {selectedStudent.roll_number}
                              </div>
                            </div>
                            <div>
                              <Label className="text-muted-foreground">Name</Label>
                              <div className="text-lg font-semibold">
                                {selectedStudent.name}
                              </div>
                            </div>
                            <div>
                              <Label className="text-muted-foreground">Email</Label>
                              <div className="text-sm">
                                {selectedStudent.email}
                              </div>
                            </div>
                            <div>
                              <Label className="text-muted-foreground">Phone</Label>
                              <div className="text-sm">
                                {selectedStudent.phone || "Not provided"}
                              </div>
                            </div>
                            {selectedStudent.department && (
                              <div>
                                <Label className="text-muted-foreground">Department</Label>
                                <div className="text-sm">
                                  {selectedStudent.department}
                                </div>
                              </div>
                            )}
                            {selectedStudent.year && (
                              <div>
                                <Label className="text-muted-foreground">Year</Label>
                                <div className="text-sm">
                                  {selectedStudent.year}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Generate Reports Section */}
        <Card>
          <CardHeader>
            <CardTitle>📊 Generate Comprehensive Reports</CardTitle>
            <CardDescription>
              Generate attendance reports for your classes with filters
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Class Filter */}
                <div className="space-y-2">
                  <Label htmlFor="report-class">Filter by Class (Optional)</Label>
                  <select
                    id="report-class"
                    value={reportClassId}
                    onChange={(e) => {
                      setReportClassId(e.target.value)
                      setReportSubjectId("") // Reset subject when class changes
                    }}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">All Classes</option>
                    {Array.from(new Set(assignments.map((a) => a.class_id))).map((classId) => {
                      const assignment = assignments.find((a) => a.class_id === classId)
                      return (
                        <option key={classId} value={classId}>
                          {assignment?.class_name} {assignment?.section}
                        </option>
                      )
                    })}
                  </select>
                </div>

                {/* Subject Filter */}
                <div className="space-y-2">
                  <Label htmlFor="report-subject">Filter by Subject (Optional)</Label>
                  <select
                    id="report-subject"
                    value={reportSubjectId}
                    onChange={(e) => setReportSubjectId(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    disabled={!reportClassId}
                  >
                    <option value="">All Subjects</option>
                    {reportClassId &&
                      assignments
                        .filter((a) => a.class_id === reportClassId)
                        .map((assignment) => (
                          <option key={assignment.subject_id} value={assignment.subject_id}>
                            {assignment.subject_name} ({assignment.subject_code})
                          </option>
                        ))}
                  </select>
                </div>

                {/* Start Date Filter */}
                <div className="space-y-2">
                  <Label htmlFor="report-start">Start Date (Optional)</Label>
                  <Input
                    id="report-start"
                    type="date"
                    value={reportStartDate}
                    onChange={(e) => setReportStartDate(e.target.value)}
                  />
                </div>

                {/* End Date Filter */}
                <div className="space-y-2">
                  <Label htmlFor="report-end">End Date (Optional)</Label>
                  <Input
                    id="report-end"
                    type="date"
                    value={reportEndDate}
                    onChange={(e) => setReportEndDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Generate Button */}
              <Button
                onClick={handleGenerateReport}
                disabled={loadingReport}
                className="w-full"
              >
                {loadingReport ? 'Generating...' : '🔍 Generate Report'}
              </Button>

              {/* Report Results */}
              {reportData && (
                <div className="mt-6 space-y-4 border-t pt-4">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <Card className="bg-blue-50">
                      <CardContent className="p-4 text-center">
                        <p className="text-2xl font-bold text-blue-600">{reportData.summary.total_sessions}</p>
                        <p className="text-xs text-muted-foreground">Total Sessions</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-purple-50">
                      <CardContent className="p-4 text-center">
                        <p className="text-2xl font-bold text-purple-600">{reportData.summary.total_students}</p>
                        <p className="text-xs text-muted-foreground">Total Students</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-green-50">
                      <CardContent className="p-4 text-center">
                        <p className="text-2xl font-bold text-green-600">{reportData.summary.total_present}</p>
                        <p className="text-xs text-muted-foreground">Total Present</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-red-50">
                      <CardContent className="p-4 text-center">
                        <p className="text-2xl font-bold text-red-600">{reportData.summary.total_absent}</p>
                        <p className="text-xs text-muted-foreground">Total Absent</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-indigo-50">
                      <CardContent className="p-4 text-center">
                        <p className="text-2xl font-bold text-indigo-600">{reportData.summary.average_attendance}%</p>
                        <p className="text-xs text-muted-foreground">Avg Attendance</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Download Buttons */}
                  <div className="flex gap-3">
                    <Button
                      onClick={handleDownloadComprehensivePDF}
                      className="flex-1 bg-red-600 hover:bg-red-700"
                    >
                      📄 Download PDF Report
                    </Button>
                    <Button
                      onClick={handleDownloadComprehensiveCSV}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      📊 Download CSV Report
                    </Button>
                  </div>

                  {/* Session List */}
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-muted px-4 py-2">
                      <p className="font-semibold">Sessions Included ({reportData.sessions.length})</p>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full">
                        <thead className="bg-muted/50 sticky top-0">
                          <tr>
                            <th className="p-2 text-left text-xs">#</th>
                            <th className="p-2 text-left text-xs">Date</th>
                            <th className="p-2 text-left text-xs">Code</th>
                            <th className="p-2 text-left text-xs">Class</th>
                            <th className="p-2 text-left text-xs">Subject</th>
                            <th className="p-2 text-center text-xs">Present</th>
                            <th className="p-2 text-center text-xs">Attendance %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.sessions.map((session: any, index: number) => (
                            <tr key={session.session_id} className="border-t hover:bg-muted/30">
                              <td className="p-2 text-xs">{index + 1}</td>
                              <td className="p-2 text-xs">{new Date(session.session_date).toLocaleDateString()}</td>
                              <td className="p-2 text-xs font-mono">{session.session_code}</td>
                              <td className="p-2 text-xs">{session.class.class_name} {session.class.section}</td>
                              <td className="p-2 text-xs">{session.subject.subject_name}</td>
                              <td className="p-2 text-center text-xs">{session.statistics.present}/{session.statistics.total_students}</td>
                              <td className="p-2 text-center text-xs">
                                <span className={`px-2 py-1 rounded-full ${
                                  parseFloat(session.statistics.attendance_percentage) >= 75 
                                    ? 'bg-green-100 text-green-800' 
                                    : parseFloat(session.statistics.attendance_percentage) >= 50
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {session.statistics.attendance_percentage}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Attendance Records Dialog */}
      <Dialog open={showAttendanceDialog} onOpenChange={setShowAttendanceDialog}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Attendance Records</DialogTitle>
            <DialogDescription>
              View and export attendance records for this session
            </DialogDescription>
          </DialogHeader>
          
          {loadingDetails ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-sm text-muted-foreground mt-2">Loading attendance records...</p>
            </div>
          ) : selectedSessionDetails ? (
            <div className="space-y-6">
              {/* Session Info Card */}
              <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Session Code</p>
                    <p className="font-mono font-bold text-lg">{selectedSessionDetails.session?.session_code}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Subject</p>
                    <p className="font-medium">{selectedSessionDetails.session?.subject?.subject_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Class</p>
                    <p className="font-medium">{selectedSessionDetails.session?.class?.class_name} {selectedSessionDetails.session?.class?.section}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Date</p>
                    <p className="font-medium">{new Date(selectedSessionDetails.session?.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              {/* Statistics Card */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold">{selectedSessionDetails.statistics?.total_records}</p>
                    <p className="text-xs text-muted-foreground">Total Students</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-green-600">{selectedSessionDetails.statistics?.total_present}</p>
                    <p className="text-xs text-muted-foreground">Present</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-red-600">{selectedSessionDetails.statistics?.total_absent}</p>
                    <p className="text-xs text-muted-foreground">Absent</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-blue-600">{selectedSessionDetails.statistics?.attendance_percentage}%</p>
                    <p className="text-xs text-muted-foreground">Attendance</p>
                  </CardContent>
                </Card>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end">
                <Button
                  onClick={handleDownloadPDF}
                  className="bg-red-600 hover:bg-red-700"
                >
                  📄 Download PDF
                </Button>
                <Button
                  onClick={handleDownloadCSV}
                  className="bg-green-600 hover:bg-green-700"
                >
                  📊 Download CSV
                </Button>
              </div>

              {/* Attendance Records Table */}
              {selectedSessionDetails.records && selectedSessionDetails.records.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-muted">
                        <tr>
                          <th className="p-3 text-left text-xs font-medium">#</th>
                          <th className="p-3 text-left text-xs font-medium">Student ID</th>
                          <th className="p-3 text-left text-xs font-medium">Name</th>
                          <th className="p-3 text-left text-xs font-medium">Email</th>
                          <th className="p-3 text-center text-xs font-medium">Status</th>
                          <th className="p-3 text-center text-xs font-medium">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSessionDetails.records.map((record: any, idx: number) => (
                          <tr key={idx} className="border-t hover:bg-muted/50">
                            <td className="p-3 text-sm">{idx + 1}</td>
                            <td className="p-3 font-mono text-xs">
                              {record.students?.student_id}
                            </td>
                            <td className="p-3">{record.students?.name}</td>
                            <td className="p-3 text-xs text-muted-foreground">
                              {record.students?.email}
                            </td>
                            <td className="p-3 text-center">
                              <span
                                className={`px-2 py-1 rounded-full text-xs ${
                                  record.status === "present"
                                    ? "bg-green-100 text-green-800"
                                    : record.status === "absent"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-yellow-100 text-yellow-800"
                                }`}
                              >
                                {record.status}
                              </span>
                            </td>
                            <td className="p-3 text-center text-xs">
                              {record.marked_at ? new Date(record.marked_at).toLocaleTimeString() : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground border rounded-lg">
                  No students have marked attendance yet
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Failed to load attendance records. Please try again.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
