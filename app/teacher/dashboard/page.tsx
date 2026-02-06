"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { QRCodeSVG } from "qrcode.react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { generatePDF, generateCSV } from "@/lib/reportGenerator"
import {
  LogOut,
  QrCode,
  Clock,
  Users,
  BookOpen,
  RefreshCw,
  FileText,
  Download,
  CheckCircle,
  XCircle,
  Loader2
} from "lucide-react"

interface Teacher {
  id: string
  name: string
  email: string
}

interface Class {
  id: string
  class_name: string
  section: string
  year: number
}

interface Subject {
  id: string
  assignment_id: string
  subject_name: string
  subject_code: string
  credits: number
  semester: number
}

interface Assignment {
  class: Class
  subjects: Subject[]
}

interface AttendanceSession {
  id: string
  session_code: string
  created_at: string
  expires_at: string
  status: string
  classes: Class
  subjects: Subject
  present_count: number
}

export default function TeacherDashboard() {
  const router = useRouter()
  const [teacher, setTeacher] = useState<Teacher | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [activeSessions, setActiveSessions] = useState<AttendanceSession[]>([])
  const [loading, setLoading] = useState(true)
  const [showQRDialog, setShowQRDialog] = useState(false)
  const [selectedSession, setSelectedSession] = useState<AttendanceSession | null>(null)
  const [generatingQR, setGeneratingQR] = useState(false)
  const [selectedClass, setSelectedClass] = useState<string>("")
  const [selectedSubject, setSelectedSubject] = useState<string>("")
  const [sessionDuration, setSessionDuration] = useState<number>(5) // Default 5 minutes
  const [timeRemaining, setTimeRemaining] = useState<{ [key: string]: number }>({})
  const [allSessions, setAllSessions] = useState<AttendanceSession[]>([])
  const [showSessionsDialog, setShowSessionsDialog] = useState(false)
  const [showAttendanceDialog, setShowAttendanceDialog] = useState(false)
  const [selectedSessionDetails, setSelectedSessionDetails] = useState<any>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [isAuthorized, setIsAuthorized] = useState(false)

  useEffect(() => {
    // Check authentication immediately
    const teacherData = sessionStorage.getItem("user")
    if (!teacherData) {
      router.replace("/login")
      return
    }

    const user = JSON.parse(teacherData)
    if (user.role !== "teacher") {
      router.replace("/login")
      return
    }

    // User is authorized
    setIsAuthorized(true)
    setTeacher(user)
    fetchAssignments(user.id)
    fetchActiveSessions(user.id)
    fetchAllSessions(user.id)
  }, []) // Remove router dependency

  // Timer for counting down session expiry with auto-expire after 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date().getTime()
      const newTimeRemaining: { [key: string]: number } = {}

      activeSessions.forEach((session) => {
        const expiryTime = new Date(session.expires_at).getTime()
        const diff = Math.max(0, Math.floor((expiryTime - now) / 1000))
        newTimeRemaining[session.id] = diff

        // Auto-expire if time is up
        if (diff === 0 && session.status === "active") {
          console.log(`⏰ Auto-expiring session ${session.id} after 5 minutes`)
          expireSession(session.id)
        }

        // Warning at 1 minute remaining
        if (diff === 60 && session.status === "active") {
          console.log(`⚠️ Session ${session.id} will expire in 1 minute`)
        }
      })

      setTimeRemaining(newTimeRemaining)
    }, 1000)

    return () => clearInterval(interval)
  }, [activeSessions])

  const fetchAssignments = async (teacherId: string) => {
    try {
      console.log("Fetching assignments for teacher:", teacherId)
      const response = await fetch(`/api/teacher/assignments?teacher_id=${teacherId}`)
      const data = await response.json()

      console.log("Assignments response:", data)

      if (data.success) {
        setAssignments(data.assignments)
        console.log("Assignments set:", data.assignments)
      } else {
        console.error("Failed to fetch assignments:", data.error)
      }
    } catch (error) {
      console.error("Error fetching assignments:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchActiveSessions = async (teacherId: string) => {
    try {
      const response = await fetch(`/api/teacher/attendance?teacher_id=${teacherId}&status=active`)
      const data = await response.json()

      if (data.success) {
        setActiveSessions(data.sessions)
      }
    } catch (error) {
      console.error("Error fetching sessions:", error)
    }
  }

  const fetchAllSessions = async (teacherId: string) => {
    try {
      const response = await fetch(`/api/teacher/attendance?teacher_id=${teacherId}`)
      const data = await response.json()

      if (data.success) {
        setAllSessions(data.sessions)
      }
    } catch (error) {
      console.error("Error fetching all sessions:", error)
    }
  }

  const viewSessionDetails = async (sessionId: string) => {
    setLoadingDetails(true)
    setShowAttendanceDialog(true)
    try {
      const response = await fetch(`/api/teacher/attendance?session_id=${sessionId}`)
      const data = await response.json()

      if (data.success) {
        // Fetch attendance records for this session
        const recordsResponse = await fetch(`/api/teacher/attendance/records?session_id=${sessionId}`)
        const recordsData = await recordsResponse.json()
        
        setSelectedSessionDetails({
          ...data.session,
          records: recordsData.records || []
        })
      }
    } catch (error) {
      console.error("Error fetching session details:", error)
    } finally {
      setLoadingDetails(false)
    }
  }

  const deleteSession = async (sessionId: string) => {
    if (!confirm("Are you sure you want to delete this session? All attendance records will be deleted.")) {
      return
    }

    try {
      const response = await fetch(`/api/teacher/attendance?id=${sessionId}`, {
        method: "DELETE"
      })

      const data = await response.json()

      if (data.success) {
        if (teacher) {
          await fetchAllSessions(teacher.id)
          await fetchActiveSessions(teacher.id)
        }
      }
    } catch (error) {
      console.error("Error deleting session:", error)
    }
  }

  const generateQRCode = async () => {
    if (!teacher || !selectedClass || !selectedSubject) {
      return
    }

    setGeneratingQR(true)
    try {
      // Use selected session duration (3-5 minutes) for auto-expiry
      const response = await fetch("/api/teacher/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacher_id: teacher.id,
          class_id: selectedClass,
          subject_id: selectedSubject,
          duration_minutes: sessionDuration  // Auto-expire after selected duration
        })
      })

      const data = await response.json()

      if (data.success) {
        setSelectedSession(data.session)
        setShowQRDialog(true)
        await fetchActiveSessions(teacher.id)
      } else {
        alert(data.error || "Failed to generate QR code")
      }
    } catch (error) {
      console.error("Error generating QR:", error)
    } finally {
      setGeneratingQR(false)
    }
  }

  const expireSession = async (sessionId: string) => {
    try {
      await fetch("/api/teacher/attendance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          status: "expired"
        })
      })

      if (teacher) {
        await fetchActiveSessions(teacher.id)
      }
    } catch (error) {
      console.error("Error expiring session:", error)
    }
  }

  const completeSession = async (sessionId: string) => {
    try {
      const response = await fetch("/api/teacher/attendance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          status: "completed"
        })
      })

      const data = await response.json()

      if (data.success) {
        if (teacher) {
          await fetchActiveSessions(teacher.id)
        }
      }
    } catch (error) {
      console.error("Error completing session:", error)
    }
  }

  const handleViewAttendance = async (sessionId: string) => {
    try {
      setLoadingDetails(true)
      const response = await fetch(`/api/attendance/records?sessionId=${sessionId}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch attendance records')
      }
      
      const data = await response.json()
      setSelectedSessionDetails(data)
      setShowAttendanceDialog(true)
    } catch (error) {
      console.error('Error fetching attendance:', error)
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
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const handleLogout = () => {
    sessionStorage.removeItem("user")
    sessionStorage.removeItem("token")
    router.push("/login")
  }

  const getQRData = (session: AttendanceSession) => {
    return JSON.stringify({
      session_code: session.session_code,
      session_id: session.id,
      class_id: session.classes.id,
      subject_id: session.subjects.id,
      teacher_id: teacher?.id,
      expires_at: session.expires_at
    })
  }

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="border-b bg-background">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode className="h-6 w-6" />
            <div>
              <h1 className="text-xl font-bold">Teacher Dashboard</h1>
              <p className="text-sm text-muted-foreground">{teacher?.name}</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Classes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <span className="text-2xl font-bold">{assignments.length}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Subjects</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-muted-foreground" />
                <span className="text-2xl font-bold">
                  {assignments.reduce((sum, a) => sum + a.subjects.length, 0)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <span className="text-2xl font-bold">{activeSessions.length}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* My Assigned Classes & Subjects - Featured Section */}
        <Card className="mb-6 border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-background">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  My Assigned Classes & Subjects
                </CardTitle>
                <CardDescription className="mt-1">
                  All classes and subjects assigned to you by the admin
                </CardDescription>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-primary">{assignments.length}</p>
                <p className="text-xs text-muted-foreground">Classes</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {assignments.length === 0 ? (
              <div className="text-center py-12 space-y-4">
                <Users className="h-12 w-12 mx-auto text-muted-foreground/50" />
                <div>
                  <p className="text-lg font-medium text-muted-foreground">No Assignments Yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Please contact the admin to assign classes and subjects to you.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {assignments.map((assignment, index) => (
                  <div
                    key={assignment.class.id}
                    className="relative border-2 border-primary/10 rounded-lg p-4 bg-background hover:shadow-lg transition-shadow"
                  >
                    {/* Class Header */}
                    <div className="mb-3 pb-3 border-b">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-bold text-lg text-primary">
                            {assignment.class.class_name} {assignment.class.section}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-1">
                            {assignment.class.year ? `Year ${assignment.class.year}` : 'N/A'}
                          </p>
                        </div>
                        <div className="bg-primary/10 text-primary rounded-full h-8 w-8 flex items-center justify-center text-xs font-bold">
                          {index + 1}
                        </div>
                      </div>
                    </div>

                    {/* Subjects List */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        Subjects ({assignment.subjects.length})
                      </p>
                      {assignment.subjects.map((subject) => (
                        <div
                          key={subject.id}
                          className="group flex items-center justify-between bg-muted/50 hover:bg-muted px-3 py-2 rounded-md transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {subject.subject_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Code: {subject.subject_code}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1 ml-2">
                            {subject.credits && (
                              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                {subject.credits} Credits
                              </span>
                            )}
                            {subject.semester && (
                              <span className="text-xs text-muted-foreground">
                                Sem {subject.semester}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Quick Action Button */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full mt-3"
                      onClick={() => {
                        setSelectedClass(assignment.class.id)
                        setSelectedSubject("")
                        // Scroll to QR generation section
                        document.getElementById('qr-section')?.scrollIntoView({ behavior: 'smooth' })
                      }}
                    >
                      <QrCode className="h-3 w-3 mr-2" />
                      Generate QR for this class
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Generate QR Code */}
          <Card id="qr-section">
            <CardHeader>
              <CardTitle>Generate Attendance QR Code</CardTitle>
              <CardDescription>
                Create a QR code for students to mark their attendance
              </CardDescription>
              <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>
                    <strong>Auto-Expiry Enabled:</strong> Sessions will automatically end after the selected duration
                  </span>
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="class">Select Class</Label>
                <select
                  id="class"
                  value={selectedClass}
                  onChange={(e) => {
                    setSelectedClass(e.target.value)
                    setSelectedSubject("")
                  }}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">Choose a class</option>
                  {assignments.map((assignment) => (
                    <option key={assignment.class.id} value={assignment.class.id}>
                      {assignment.class.class_name} {assignment.class.section} (Year {assignment.class.year})
                    </option>
                  ))}
                </select>
              </div>

              {selectedClass && (
                <>
                  <div>
                    <Label htmlFor="subject">Select Subject</Label>
                    <select
                      id="subject"
                      value={selectedSubject}
                      onChange={(e) => setSelectedSubject(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <option value="">Choose a subject</option>
                      {assignments
                        .find((a) => a.class.id === selectedClass)
                        ?.subjects.map((subject) => (
                          <option key={subject.id} value={subject.id}>
                            {subject.subject_name} ({subject.subject_code})
                          </option>
                        ))}
                    </select>
                  </div>
                  
                  <div>
                    <Label htmlFor="duration">Session Duration</Label>
                    <select
                      id="duration"
                      value={sessionDuration}
                      onChange={(e) => setSessionDuration(Number(e.target.value))}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <option value="3">3 minutes (Quick)</option>
                      <option value="4">4 minutes</option>
                      <option value="5">5 minutes (Recommended)</option>
                    </select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Session will automatically expire after this duration
                    </p>
                  </div>
                </>
              )}

              <Button
                onClick={generateQRCode}
                disabled={!selectedClass || !selectedSubject || generatingQR}
                className="w-full"
              >
                {generatingQR ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <QrCode className="h-4 w-4 mr-2" />
                    Generate QR Code
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Active Sessions */}
          <Card>
            <CardHeader>
              <CardTitle>Active Sessions</CardTitle>
              <CardDescription>Currently running attendance sessions</CardDescription>
            </CardHeader>
            <CardContent>
              {activeSessions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No active sessions. Generate a QR code to start.
                </p>
              ) : (
                <div className="space-y-3">
                  {activeSessions.map((session) => (
                    <div
                      key={session.id}
                      className="border rounded-lg p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">
                            {session.classes.class_name} {session.classes.section}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {session.subjects.subject_name}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-medium ${
                            timeRemaining[session.id] > 120 
                              ? "text-green-600" 
                              : timeRemaining[session.id] > 60 
                              ? "text-yellow-600" 
                              : "text-red-600"
                          }`}>
                            {timeRemaining[session.id] > 0
                              ? formatTime(timeRemaining[session.id])
                              : "Expired"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {session.present_count} present
                          </p>
                          {timeRemaining[session.id] > 0 && timeRemaining[session.id] <= 60 && (
                            <p className="text-xs text-red-600 font-medium mt-1">
                              ⚠️ Expiring soon!
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedSession(session)
                            setShowQRDialog(true)
                          }}
                        >
                          <QrCode className="h-3 w-3 mr-1" />
                          View QR
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewAttendance(session.id)}
                        >
                          <Users className="h-3 w-3 mr-1" />
                          View Attendance
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => completeSession(session.id)}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Complete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* All Sessions Management */}
        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>All Sessions</CardTitle>
                <CardDescription>Manage all your attendance sessions</CardDescription>
              </div>
              <Button variant="outline" onClick={() => setShowSessionsDialog(true)}>
                <FileText className="h-4 w-4 mr-2" />
                View All Sessions
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-3 text-left">Date</th>
                    <th className="p-3 text-left">Class</th>
                    <th className="p-3 text-left">Subject</th>
                    <th className="p-3 text-left">Session Code</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Present</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allSessions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        No sessions found. Generate a QR code to create your first session.
                      </td>
                    </tr>
                  ) : (
                    allSessions.slice(0, 5).map((session) => (
                      <tr key={session.id} className="border-t hover:bg-muted/50">
                        <td className="p-3">
                          {new Date(session.created_at).toLocaleDateString()}
                          <br />
                          <span className="text-xs text-muted-foreground">
                            {new Date(session.created_at).toLocaleTimeString()}
                          </span>
                        </td>
                        <td className="p-3">
                          {session.classes.class_name} {session.classes.section}
                        </td>
                        <td className="p-3">{session.subjects.subject_name}</td>
                        <td className="p-3">
                          <code className="bg-muted px-2 py-1 rounded text-xs font-mono">
                            {session.session_code}
                          </code>
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`px-2 py-1 rounded-full text-xs ${
                              session.status === "active"
                                ? "bg-green-100 text-green-800"
                                : session.status === "completed"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {session.status}
                          </span>
                        </td>
                        <td className="p-3 text-center font-medium">
                          {session.present_count}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => viewSessionDetails(session.id)}
                              title="View Details"
                            >
                              👁️
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleViewAttendance(session.id)}
                              title="View Attendance"
                            >
                              <Users className="h-4 w-4 text-blue-600" />
                            </Button>
                            {session.status === "active" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setSelectedSession(session)
                                    setShowQRDialog(true)
                                  }}
                                  title="View QR"
                                >
                                  <QrCode className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => completeSession(session.id)}
                                  title="Complete"
                                >
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                </Button>
                              </>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteSession(session.id)}
                              title="Delete"
                            >
                              <XCircle className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {allSessions.length > 5 && (
              <div className="mt-4 text-center">
                <Button variant="outline" onClick={() => setShowSessionsDialog(true)}>
                  View All {allSessions.length} Sessions
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* QR Code Dialog */}
      <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Attendance QR Code</DialogTitle>
            <DialogDescription>
              Students can scan this QR code to mark attendance
            </DialogDescription>
          </DialogHeader>

          {selectedSession && (
            <div className="space-y-4">
              {/* Session Details */}
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Class</Label>
                  <p className="font-medium">
                    {selectedSession.classes.class_name} {selectedSession.classes.section}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Subject</Label>
                  <p className="font-medium">{selectedSession.subjects.subject_name}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Session Code</Label>
                  <p className="font-mono font-bold text-lg">{selectedSession.session_code}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Time Remaining</Label>
                  <p className="font-medium text-green-600">
                    {timeRemaining[selectedSession.id] > 0
                      ? formatTime(timeRemaining[selectedSession.id])
                      : "Expired"}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Students Present</Label>
                  <p className="font-medium">{selectedSession.present_count}</p>
                </div>
              </div>

              {/* QR Code */}
              <div className="flex justify-center bg-white p-6 rounded-lg border-2 border-muted">
                <QRCodeSVG
                  value={getQRData(selectedSession)}
                  size={256}
                  level="H"
                  includeMargin={true}
                />
              </div>

              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 p-3 rounded-md">
                <p className="text-sm text-blue-900 font-medium mb-1">Instructions:</p>
                <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
                  <li>Students should scan this QR code with their phone</li>
                  <li>They will enter their email and receive an OTP</li>
                  <li>After verifying OTP, attendance will be marked</li>
                  <li>This session expires in {Math.ceil((timeRemaining[selectedSession.id] || 0) / 60)} minutes</li>
                </ol>
              </div>

              <Button
                onClick={() => setShowQRDialog(false)}
                className="w-full"
              >
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* All Sessions Dialog */}
      <Dialog open={showSessionsDialog} onOpenChange={setShowSessionsDialog}>
        <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>All Attendance Sessions</DialogTitle>
            <DialogDescription>
              Complete history of all your attendance sessions
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="p-3 text-left">Date & Time</th>
                  <th className="p-3 text-left">Class</th>
                  <th className="p-3 text-left">Subject</th>
                  <th className="p-3 text-left">Code</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Present</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allSessions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      No sessions found
                    </td>
                  </tr>
                ) : (
                  allSessions.map((session) => (
                    <tr key={session.id} className="border-t hover:bg-muted/50">
                      <td className="p-3">
                        <div>{new Date(session.created_at).toLocaleDateString()}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(session.created_at).toLocaleTimeString()}
                        </div>
                      </td>
                      <td className="p-3">
                        {session.classes.class_name} {session.classes.section}
                      </td>
                      <td className="p-3">{session.subjects.subject_name}</td>
                      <td className="p-3">
                        <code className="bg-muted px-2 py-1 rounded text-xs font-mono">
                          {session.session_code}
                        </code>
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${
                            session.status === "active"
                              ? "bg-green-100 text-green-800"
                              : session.status === "completed"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {session.status}
                        </span>
                      </td>
                      <td className="p-3 text-center font-medium">
                        {session.present_count}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              viewSessionDetails(session.id)
                              setShowSessionsDialog(false)
                            }}
                            title="View Details"
                          >
                            👁️
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteSession(session.id)}
                            title="Delete"
                          >
                            <XCircle className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Attendance Details Dialog */}
      <Dialog open={showAttendanceDialog} onOpenChange={setShowAttendanceDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Session Attendance Details</DialogTitle>
            <DialogDescription>
              Complete attendance record for this session
            </DialogDescription>
          </DialogHeader>

          {loadingDetails ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : selectedSessionDetails ? (
            <div className="space-y-6">
              {/* Session Info */}
              <div className="bg-muted p-4 rounded-lg grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Date</Label>
                  <p className="font-medium">
                    {new Date(selectedSessionDetails.created_at).toLocaleString()}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Class</Label>
                  <p className="font-medium">
                    {selectedSessionDetails.classes.class_name}{" "}
                    {selectedSessionDetails.classes.section}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Subject</Label>
                  <p className="font-medium">
                    {selectedSessionDetails.subjects.subject_name}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Session Code</Label>
                  <p className="font-mono font-bold">
                    {selectedSessionDetails.session_code}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <p>
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        selectedSessionDetails.status === "active"
                          ? "bg-green-100 text-green-800"
                          : selectedSessionDetails.status === "completed"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {selectedSessionDetails.status}
                    </span>
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Total Present</Label>
                  <p className="font-bold text-lg text-green-600">
                    {selectedSessionDetails.present_count}
                  </p>
                </div>
              </div>

              {/* Attendance Records */}
              <div>
                <h3 className="font-semibold mb-3">Attendance Records</h3>
                {selectedSessionDetails.records &&
                selectedSessionDetails.records.length > 0 ? (
                  <div className="rounded-lg border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="p-3 text-left">Student ID</th>
                          <th className="p-3 text-left">Name</th>
                          <th className="p-3 text-left">Email</th>
                          <th className="p-3 text-center">Status</th>
                          <th className="p-3 text-center">Marked At</th>
                          <th className="p-3 text-center">OTP Verified</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSessionDetails.records.map((record: any, idx: number) => (
                          <tr key={idx} className="border-t hover:bg-muted/50">
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
                              {new Date(record.marked_at).toLocaleTimeString()}
                            </td>
                            <td className="p-3 text-center">
                              {record.otp_verified ? (
                                <CheckCircle className="h-4 w-4 text-green-600 inline" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-600 inline" />
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground border rounded-lg">
                    No students have marked attendance yet
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No details available
            </div>
          )}
        </DialogContent>
      </Dialog>

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
                    <p className="font-medium">{selectedSessionDetails.session?.subjects?.subject_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Teacher</p>
                    <p className="font-medium">{selectedSessionDetails.session?.users?.name}</p>
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
                              {new Date(record.marked_at).toLocaleTimeString()}
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
