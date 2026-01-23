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
import { Calendar, Users, CheckCircle, QrCode, GraduationCap } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { generateComprehensivePDF, generateComprehensiveCSV } from "@/lib/reportGenerator"

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

  // Comprehensive reports states
  const [showReportsDialog, setShowReportsDialog] = useState(false)
  const [reportClassId, setReportClassId] = useState("")
  const [reportSubjectId, setReportSubjectId] = useState("")
  const [reportStartDate, setReportStartDate] = useState("")
  const [reportEndDate, setReportEndDate] = useState("")
  const [reportData, setReportData] = useState<any>(null)
  const [loadingReport, setLoadingReport] = useState(false)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [error, setError] = useState("")
  
  // Live attendance tracking
  const [liveAttendance, setLiveAttendance] = useState<{
    present: number
    totalStudents: number
    lastUpdated: string
  } | null>(null)

  // Scheduled sessions for today
  const [scheduledSessions, setScheduledSessions] = useState<any[]>([])
  const [loadingScheduled, setLoadingScheduled] = useState(false)
  const [processedSessions, setProcessedSessions] = useState<Set<string>>(new Set())

  // OD approvals
  const [pendingODRequests, setPendingODRequests] = useState<any[]>([])
  const [loadingODRequests, setLoadingODRequests] = useState(false)
  const [odRequestsForClass, setOdRequestsForClass] = useState<any[]>([])
  const [odSelectedClassId, setOdSelectedClassId] = useState("")
  const [showODRequestsView, setShowODRequestsView] = useState(false)

  // Session timer
  const [timeRemaining, setTimeRemaining] = useState<number>(0)
  const [sessionExpired, setSessionExpired] = useState(false)

  // Fetch pending OD requests for this teacher
  const fetchPendingODRequests = async (teacherId: string) => {
    try {
      setLoadingODRequests(true)
      const { data, error } = await supabase
        .from('od_requests')
        .select(`
          id,
          od_start_date,
          od_end_date,
          reason,
          status,
          teacher_approved,
          admin_approved,
          students (id, name, email),
          classes (id, class_name)
        `)
        .eq('teacher_id', teacherId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(20)

      if (!error && data) {
        setPendingODRequests(data)
      }
    } catch (error) {
      console.error('Error fetching OD requests:', error)
    } finally {
      setLoadingODRequests(false)
    }
  }

  // Fetch all OD requests for a specific class (pending, approved, rejected)
  const fetchODRequestsByClass = async (teacherId: string, classId: string) => {
    try {
      setLoadingODRequests(true)
      const { data, error } = await supabase
        .from('od_requests')
        .select(`
          id,
          od_start_date,
          od_end_date,
          reason,
          status,
          teacher_approved,
          admin_approved,
          students (id, name, email),
          classes (id, class_name)
        `)
        .eq('teacher_id', teacherId)
        .eq('class_id', classId)
        .order('created_at', { ascending: false })

      if (!error && data) {
        setOdRequestsForClass(data)
      }
    } catch (error) {
      console.error('Error fetching OD requests for class:', error)
    } finally {
      setLoadingODRequests(false)
    }
  }

  const approveODRequest = async (requestId: string, approved: boolean, notes: string = '') => {
    try {
      const response = await fetch('/api/teacher/approve-od', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          odRequestId: requestId,
          teacherId: user?.id,
          approved,
          approvalNotes: notes,
        }),
      })

      const data = await response.json()
      if (response.ok) {
        // Refresh OD requests
        await fetchPendingODRequests(user?.id!)
      } else {
        console.error('Error response:', data)
      }
    } catch (error) {
      console.error('Error approving OD request:', error)
    }
  }

  // Fetch live attendance for active session
  const fetchLiveAttendance = async (sessionId: string) => {
    try {
      // Get total students in the class
      const session = activeSession
      if (!session) return

      const { count: studentCount, error: studentsError } = await supabase
        .from("students")
        .select("id", { count: "exact", head: true })
        .eq("class_id", session.class_id)

      // Get present count for this session
      const { count: presentCount, error: attendanceError } = await supabase
        .from("attendance_records")
        .select("id", { count: "exact", head: true })
        .eq("session_id", sessionId)
        .eq("status", "present")

      if (!studentsError && !attendanceError) {
        setLiveAttendance({
          present: presentCount || 0,
          totalStudents: studentCount || 0,
          lastUpdated: new Date().toLocaleTimeString(),
        })
      }
    } catch (error) {
      console.error("Error fetching live attendance:", error)
    }
  }

  // Timer for session expiry countdown
  useEffect(() => {
    if (!activeSession || !activeSession.expires_at) {
      setTimeRemaining(0)
      setSessionExpired(false)
      return
    }

    const expiresAt = new Date(activeSession.expires_at).getTime()
    
    // Initialize timer
    const calculateTimeRemaining = () => {
      const now = new Date().getTime()
      return Math.max(0, Math.floor((expiresAt - now) / 1000))
    }

    // Set initial time immediately
    const initialTime = calculateTimeRemaining()
    setTimeRemaining(initialTime)
    
    // Check if already expired
    if (initialTime === 0) {
      setSessionExpired(true)
      return
    }
    
    setSessionExpired(false)

    // Update every second
    const interval = setInterval(() => {
      const remaining = calculateTimeRemaining()
      setTimeRemaining(remaining)
      
      if (remaining === 0) {
        setSessionExpired(true)
        clearInterval(interval)
      }
    }, 1000)

    return () => {
      clearInterval(interval)
    }
  }, [activeSession?.id, activeSession?.expires_at])

  // Auto-refresh live attendance when session is active
  useEffect(() => {
    if (!activeSession || activeSession.status !== 'active') {
      setLiveAttendance(null)
      return
    }

    // Fetch immediately
    fetchLiveAttendance(activeSession.id)

    // Set up interval to refresh every 3 seconds
    const interval = setInterval(() => {
      fetchLiveAttendance(activeSession.id)
    }, 3000)

    // Cleanup on unmount or when session changes
    return () => clearInterval(interval)
  }, [activeSession])

  // Auto-start scheduled sessions when their time arrives
  useEffect(() => {
    if (!user || !scheduledSessions || scheduledSessions.length === 0) {
      return
    }

    const checkAndAutoStart = async () => {
      const now = new Date()
      const currentHours = String(now.getHours()).padStart(2, '0')
      const currentMinutes = String(now.getMinutes()).padStart(2, '0')
      const currentTime = `${currentHours}:${currentMinutes}`

      // Check for auto-stop first (sessions that should end)
      if (activeSession) {
        const matchingSchedule = scheduledSessions.find(
          s => s.class_id === activeSession.class_id && s.subject_id === activeSession.subject_id
        )

        if (matchingSchedule && matchingSchedule.end_time) {
          const [endHours, endMinutes] = matchingSchedule.end_time.split(':')
          const endDate = new Date()
          endDate.setHours(parseInt(endHours), parseInt(endMinutes), 0)

          const timeDiff = Math.abs(now.getTime() - endDate.getTime()) / 60000 // difference in minutes

          // Only stop if we're past the end time and haven't already stopped this session
          const stopKey = `stop_${activeSession.id}_${endHours}:${endMinutes}`
          if (now.getTime() >= endDate.getTime() && timeDiff <= 1 && !processedSessions.has(stopKey)) {
            console.log(`🛑 Auto-stopping session: ${matchingSchedule.class_name} at ${endHours}:${endMinutes}`)

            try {
              const { error } = await supabase
                .from("attendance_sessions")
                .update({ status: "completed" })
                .eq("id", activeSession.id)

              if (!error) {
                console.log("✅ Session auto-stopped successfully")
                setActiveSession(null)
                setLiveAttendance(null)
                // Mark this stop as processed
                setProcessedSessions(prev => new Set(prev).add(stopKey))
              }
            } catch (error) {
              console.error("❌ Error auto-stopping session:", error)
            }
          }
        }
      }

      // Check for auto-start (sessions that should begin)
      for (const session of scheduledSessions) {
        // Check if current time matches session start time (within 2-minute window)
        const [schedHours, schedMinutes] = session.start_time.split(':')
        const schedTime = `${schedHours}:${schedMinutes}`

        // Parse times for comparison
        const schedDate = new Date()
        schedDate.setHours(parseInt(schedHours), parseInt(schedMinutes), 0)

        const timeDiff = Math.abs(now.getTime() - schedDate.getTime()) / 60000 // difference in minutes

        // Only start if within 2 minutes of start time, no active session, and haven't already started this session today
        const startKey = `start_${session.class_id}_${session.subject_id}_${schedHours}:${schedMinutes}`
        
        if (timeDiff <= 2 && !activeSession && !processedSessions.has(startKey)) {
          console.log(`🚀 Auto-starting session: ${session.class_name} at ${schedTime}`)

          try {
            // Check if session already exists for this assignment
            const { data: existingSession, error: checkError } = await supabase
              .from("attendance_sessions")
              .select("id")
              .eq("teacher_id", user.id)
              .eq("class_id", session.class_id)
              .eq("subject_id", session.subject_id)
              .eq("status", "active")
              .limit(1)

            if (checkError) {
              console.log("ℹ️ Check for existing session returned:", checkError.message)
            }

            if (existingSession && existingSession.length > 0) {
              console.log("✅ Session already exists for this class")
              // Mark as processed even if it already existed
              setProcessedSessions(prev => new Set(prev).add(startKey))
              return
            }

            // Auto-start the session
            const sessionCode = generateSessionCode()
            const today = new Date().toISOString().split("T")[0]
            const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutes from now

            const { data: newSession, error } = await supabase
              .from("attendance_sessions")
              .insert({
                teacher_id: user.id,
                class_id: session.class_id,
                subject_id: session.subject_id,
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
              console.error("❌ Error auto-starting session:", error)
              return
            }

            console.log("✅ Session auto-started:", newSession)
            setActiveSession(newSession)
            
            // Mark this start as processed so it doesn't start again
            setProcessedSessions(prev => new Set(prev).add(startKey))

            // Send QR code email
            try {
              const emailResponse = await fetch("/api/teacher/send-session-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                  sessionId: newSession.id,
                  teacherEmail: user.email 
                }),
              })

              const emailResult = await emailResponse.json()
              if (emailResult.success) {
                console.log("✅ QR code email sent for auto-started session")
              }
            } catch (emailError) {
              console.error("⚠️ Error sending email for auto-started session:", emailError)
            }
          } catch (error) {
            console.error("❌ Error in auto-start logic:", error)
          }
        }
      }
    }

    // Check every 10 seconds for scheduled sessions to start/stop
    const interval = setInterval(checkAndAutoStart, 10000)

    return () => clearInterval(interval)
  }, [scheduledSessions, user, activeSession, processedSessions])

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
  }, []) // Remove router dependency to prevent re-fetching

  // Live polling for OD requests every 30 seconds
  useEffect(() => {
    if (!user) return

    const interval = setInterval(() => {
      fetchPendingODRequests(user.id)
    }, 30000) // Update every 30 seconds

    return () => clearInterval(interval)
  }, [user])

  const fetchTeacherData = async (teacherId: string) => {
    try {
      // Fetch teacher's assigned classes and subjects
      const { data: assignmentsData, error: assignError } = await supabase
        .from("teacher_subjects")
        .select(`
          id,
          class_id,
          subject_id,
          day_of_week,
          start_time,
          end_time,
          auto_session_enabled,
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
          day_of_week: assignment.day_of_week,
          start_time: assignment.start_time,
          end_time: assignment.end_time,
          auto_session_enabled: assignment.auto_session_enabled,
        }))
        setAssignments(formattedAssignments)
        console.log("✅ Loaded assignments:", formattedAssignments)

        // Fetch scheduled sessions for today
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long' })
        const scheduledForToday = formattedAssignments.filter(
          (a) => a.day_of_week === today && a.auto_session_enabled
        )
        setScheduledSessions(scheduledForToday)
        console.log("📅 Scheduled sessions for today:", scheduledForToday)
      } else {
        // No assignments found
        console.log("ℹ️ No assignments found for teacher:", teacherId)
        console.log("📌 Please ask admin to assign you to classes and subjects")
        setAssignments([])
        setScheduledSessions([])
      }

      // Check for active session
      const { data: activeSessionDataArray, error: activeSessionError } = await supabase
        .from("attendance_sessions")
        .select(`
          *,
          classes (class_name, section),
          subjects (subject_name, subject_code)
        `)
        .eq("teacher_id", teacherId)
        .eq("status", "active")
        .limit(1)

      if (!activeSessionError && activeSessionDataArray && activeSessionDataArray.length > 0) {
        setActiveSession(activeSessionDataArray[0])
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

      // Fetch pending OD requests
      await fetchPendingODRequests(teacherId)
    } catch (error) {
      console.error("Error fetching teacher data:", error)
    }
  }



  const generateSessionCode = () => {
    return Math.random().toString(36).substring(2, 10).toUpperCase()
  }

  const handleStartSession = async () => {
    if (!selectedClassId || !selectedSubjectId || !user) {
      return
    }

    // Get selected assignment details
    const selectedAssignment = assignments.find(
      a => a.class_id === selectedClassId && a.subject_id === selectedSubjectId
    )

    if (!selectedAssignment) {
      return
    }

    setLoading(true)
    try {
      const sessionCode = generateSessionCode()
      const today = new Date().toISOString().split("T")[0]
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutes from now

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

      // Send QR code email to teacher
      try {
        console.log("📧 Sending QR code email to teacher...")
        const emailResponse = await fetch("/api/teacher/send-session-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            sessionId: session.id,
            teacherEmail: user.email 
          }),
        })

        const emailResult = await emailResponse.json()
        console.log("📨 Email API Response:", emailResult)
        
        if (emailResult.success) {
          console.log("✅ QR code email sent successfully")
          alert(`✅ Session started!\n\nQR code has been sent to:\n${user.email}\n\nMessage ID: ${emailResult.messageId || 'Processing'}`)
        } else {
          console.warn("⚠️ Email send failed:", emailResult)
        }
      } catch (emailError) {
        console.error("❌ Error sending email:", emailError)
      }
    } catch (error) {
      console.error("❌ Error starting session:", error)
      console.error("Error type:", typeof error)
      console.error("Error stringified:", JSON.stringify(error, null, 2))
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
    } catch (error) {
      console.error("❌ Caught error ending session:", error)
    } finally {
      setLoading(false)
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
        console.log('No sessions found for the selected filters.')
      }
    } catch (error) {
      console.error('Error generating report:', error)
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
    }
  }

  const handleDownloadComprehensiveCSV = () => {
    if (!reportData || !user) return
    
    try {
      generateComprehensiveCSV(reportData, user.name || 'Teacher')
    } catch (error) {
      console.error('Error generating comprehensive CSV:', error)
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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
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

      <main className="container mx-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="px-2 sm:px-0">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Teacher Dashboard</h2>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Manage your classes and track student attendance
          </p>
        </div>

        {/* Pending OD Requests Alert */}
        {pendingODRequests.length > 0 && (
          <Card className="border-amber-200 bg-amber-50">
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">📋 Pending OD Requests</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {pendingODRequests.length} {pendingODRequests.length === 1 ? 'request' : 'requests'} waiting for your approval
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pendingODRequests.slice(0, 3).map((request) => {
                  const startDate = new Date(request.od_start_date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })
                  const endDate = new Date(request.od_end_date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })
                  
                  return (
                    <div key={request.id} className="flex justify-between items-start gap-2 p-3 bg-white rounded-lg border border-amber-100">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{request.students?.name}</p>
                        <p className="text-xs text-muted-foreground">{request.students?.email}</p>
                        <p className="text-xs text-muted-foreground mt-1">📅 {startDate} to {endDate}</p>
                      </div>
                      <span className="px-2 py-1 text-xs bg-amber-100 text-amber-800 rounded-full whitespace-nowrap">
                        ⏳ Pending
                      </span>
                    </div>
                  )
                })}
              </div>
              {pendingODRequests.length > 3 && (
                <p className="text-xs text-muted-foreground mt-3">
                  +{pendingODRequests.length - 3} more requests
                </p>
              )}
              <Button
                variant="outline"
                className="w-full mt-3 text-sm"
                onClick={() => {
                  const odSection = document.querySelector('[data-od-section]')
                  if (odSection) {
                    odSection.scrollIntoView({ behavior: 'smooth' })
                  }
                }}
              >
                View All OD Requests
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Assignments Overview */}
        {assignments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5" />
                Your Assigned Classes & Subjects
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Classes and subjects assigned to you by admin
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {assignments.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="p-3 sm:p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="font-medium text-xs sm:text-sm text-primary">
                      {assignment.class_name} {assignment.section}
                    </div>
                    <div className="text-xs sm:text-sm text-muted-foreground mt-1">
                      {assignment.subject_code} - {assignment.subject_name}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
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
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          {/* Session Control */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">Attendance Session</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {activeSession
                  ? "Session is active - Show QR code to students"
                  : "Start a new attendance session"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!activeSession ? (
                <>
                  {assignments.length === 0 ? (
                    <div className="text-center py-6 sm:py-8 text-muted-foreground">
                      <p className="text-base sm:text-lg font-medium">No Assignments Found</p>
                      <p className="text-xs sm:text-sm mt-2 px-4">
                        Contact admin to assign classes and subjects to you.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Scheduled Sessions for Today */}
                      {scheduledSessions.length > 0 && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                          <div className="flex items-start gap-2">
                            <span className="text-lg">📅</span>
                            <div className="flex-1">
                              <h3 className="font-semibold text-sm text-blue-900">Scheduled Sessions Today</h3>
                              <p className="text-xs text-blue-700 mt-1">These will auto-start at the scheduled time</p>
                            </div>
                          </div>
                          <div className="space-y-2">
                            {scheduledSessions.map((session) => {
                              const startTime = session.start_time
                              const [hours, minutes] = startTime.split(':')
                              const hour = parseInt(hours)
                              const ampm = hour >= 12 ? 'PM' : 'AM'
                              const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
                              const timeDisplay = `${displayHour}:${minutes} ${ampm}`

                              return (
                                <div key={session.id} className="bg-white p-3 rounded-md border border-blue-100">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex-1">
                                      <p className="font-medium text-sm">
                                        {session.class_name} {session.section}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {session.subject_code} - {session.subject_name}
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <p className="font-semibold text-sm text-blue-600">{timeDisplay}</p>
                                      <p className="text-[10px] text-muted-foreground">Starts automatically</p>
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="class" className="text-sm sm:text-base">Select Class</Label>
                        <select
                          id="class"
                          className="w-full px-3 py-2 text-sm sm:text-base border rounded-md"
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
                        <Label htmlFor="subject" className="text-sm sm:text-base">Select Subject</Label>
                        <select
                          id="subject"
                          className="w-full px-3 py-2 text-sm sm:text-base border rounded-md"
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
                        className="w-full text-sm sm:text-base"
                        onClick={handleStartSession}
                        disabled={loading || !selectedClassId || !selectedSubjectId}
                      >
                        <QrCode className="mr-2 h-4 w-4" />
                        <span className="hidden sm:inline">
                          {selectedClassId && selectedSubjectId ? "Generate QR Code & Start Session" : "Select Class & Subject First"}
                        </span>
                        <span className="sm:hidden">
                          {selectedClassId && selectedSubjectId ? "Start Session" : "Select Class & Subject"}
                        </span>
                      </Button>
                    </>
                  )}
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <div className="text-xs sm:text-sm font-medium">
                      Class: {activeSession.classes ? `${activeSession.classes.class_name} ${activeSession.classes.section}` : 'N/A'}
                    </div>
                    <div className="text-xs sm:text-sm font-medium">
                      Subject: {activeSession.subjects?.subject_name || 'N/A'}
                    </div>
                    <div className="text-xs sm:text-sm text-muted-foreground">
                      Session Code: {activeSession.session_code}
                    </div>
                  </div>

                  {/* Session Timer - ALWAYS SHOW */}
                  <div className={`mt-4 p-4 rounded-lg border-2 font-semibold ${
                    sessionExpired 
                      ? 'bg-red-100 border-red-500 text-red-800' 
                      : timeRemaining <= 60 
                      ? 'bg-yellow-100 border-yellow-500 text-yellow-800' 
                      : 'bg-green-100 border-green-500 text-green-800'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-base">⏱️ Session Time Remaining</span>
                      <span className="text-2xl tabular-nums font-mono">
                        {sessionExpired ? "EXPIRED ❌" : `${formatTime(timeRemaining)}`}
                      </span>
                    </div>
                    {timeRemaining > 0 && timeRemaining <= 60 && !sessionExpired && (
                      <div className="text-sm mt-2 pt-2 border-t-2 border-yellow-400">
                        ⚠️ Hurry! Session expiring in {timeRemaining} seconds
                      </div>
                    )}
                    {sessionExpired && (
                      <div className="text-sm mt-2 pt-2 border-t-2 border-red-400">
                        Please end this session and start a new one
                      </div>
                    )}
                  </div>
                    
                  {/* Live Attendance Counter */}
                  {liveAttendance && (
                      <div className="mt-4 p-3 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">🔴 Live Attendance</p>
                            <div className="flex items-baseline gap-2">
                              <span className="text-2xl font-bold text-green-600">
                                {liveAttendance.present}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                / {liveAttendance.totalStudents} students
                              </span>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              Updated: {liveAttendance.lastUpdated}
                            </p>
                          </div>
                          <div className="flex flex-col items-center">
                            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                              <CheckCircle className="h-6 w-6 text-green-600" />
                            </div>
                            <p className="text-[10px] text-green-600 font-medium mt-1">
                              {liveAttendance.totalStudents > 0 
                                ? `${Math.round((liveAttendance.present / liveAttendance.totalStudents) * 100)}%`
                                : '0%'
                              }
                            </p>
                          </div>
                        </div>
                      </div>
                  )}

                  <Button
                    className="w-full text-sm sm:text-base"
                    variant="destructive"
                    onClick={handleEndSession}
                    disabled={loading}
                  >
                    End Session
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* QR Code Display */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">QR Code</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Students scan this code to mark attendance
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activeSession ? (
                <div className="flex flex-col items-center space-y-4">
                  <div className="bg-white p-3 sm:p-4 rounded-lg w-full max-w-[280px] sm:max-w-none mx-auto">
                    <div className="w-full aspect-square max-w-[256px] mx-auto">
                      <QRCode 
                        value={qrData} 
                        size={256}
                        style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                      />
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm text-center text-muted-foreground px-4">
                    Ask students to scan this QR code with their mobile devices
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-center h-48 sm:h-64 text-muted-foreground">
                  <div className="text-center px-4">
                    <QrCode className="mx-auto h-10 w-10 sm:h-12 sm:w-12 mb-2 opacity-50" />
                    <p className="text-xs sm:text-sm">Start a session to generate QR code</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>



        {/* OD Approvals Section */}
        {pendingODRequests.length > 0 && (
          <Card data-od-section>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">OD Approval Requests</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Review and approve On Duty requests from students
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pendingODRequests.map((request) => {
                  const startDate = new Date(request.od_start_date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })
                  const endDate = new Date(request.od_end_date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })
                  const daysDuration = Math.ceil(
                    (new Date(request.od_end_date).getTime() - new Date(request.od_start_date).getTime()) / 
                    (1000 * 60 * 60 * 24)
                  ) + 1
                  
                  return (
                  <div key={request.id} className="border border-yellow-200 bg-yellow-50 rounded-lg p-4">
                    <div className="flex justify-between items-start gap-4 mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-sm sm:text-base">{request.students?.name}</h3>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                          {request.students?.email}
                        </p>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                          📅 {startDate} to {endDate} ({daysDuration} {daysDuration === 1 ? 'day' : 'days'})
                        </p>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                          📍 {request.classes?.class_name}
                        </p>
                      </div>
                      <span className="px-2 py-1 text-xs bg-yellow-200 text-yellow-800 rounded-full">
                        ⏳ Pending
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-700 mb-3 bg-white p-2 rounded">
                      <strong>Reason:</strong> {request.reason}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => approveODRequest(request.id, true)}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs sm:text-sm"
                      >
                        ✓ Approve
                      </Button>
                      <Button
                        onClick={() => approveODRequest(request.id, false)}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm"
                      >
                        ✕ Reject
                      </Button>
                    </div>
                  </div>
                )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* OD Requests Management Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">📋 OD Requests Management</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              View and manage all OD requests by class - Pending, Approved, and Rejected
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Class Selector for OD Requests */}
              <div className="space-y-2">
                <Label htmlFor="od-class" className="text-sm sm:text-base">Select Class</Label>
                <select
                  id="od-class"
                  value={odSelectedClassId}
                  onChange={(e) => {
                    setOdSelectedClassId(e.target.value)
                    if (e.target.value && user) {
                      fetchODRequestsByClass(user.id, e.target.value)
                    }
                  }}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm sm:text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">-- Select a Class --</option>
                  {assignments.map((assignment) => (
                    <option key={assignment.class_id} value={assignment.class_id}>
                      {assignment.class_name} {assignment.section}
                    </option>
                  ))}
                </select>
              </div>

              {/* OD Requests Display by Status */}
              {odSelectedClassId && (
                <div className="space-y-6">
                  {/* Pending Requests */}
                  {odRequestsForClass.filter(r => r.status === 'pending').length > 0 && (
                    <div className="border-l-4 border-yellow-400 pl-4">
                      <h3 className="font-semibold text-lg text-yellow-700 mb-3">
                        ⏳ Pending Requests ({odRequestsForClass.filter(r => r.status === 'pending').length})
                      </h3>
                      <div className="space-y-3">
                        {odRequestsForClass.filter(r => r.status === 'pending').map((request) => {
                          const startDate = new Date(request.od_start_date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })
                          const endDate = new Date(request.od_end_date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })
                          
                          return (
                            <div key={request.id} className="border border-yellow-200 bg-yellow-50 rounded-lg p-3">
                              <div className="flex justify-between items-start gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-sm">{request.students?.name}</p>
                                  <p className="text-xs text-muted-foreground">{request.students?.email}</p>
                                  <p className="text-xs text-muted-foreground mt-1">📅 {startDate} to {endDate}</p>
                                  <p className="text-xs text-gray-700 mt-1"><strong>Reason:</strong> {request.reason}</p>
                                </div>
                              </div>
                              <div className="flex gap-2 mt-3">
                                <Button
                                  onClick={() => approveODRequest(request.id, true)}
                                  className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs"
                                >
                                  ✓ Approve
                                </Button>
                                <Button
                                  onClick={() => approveODRequest(request.id, false)}
                                  className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs"
                                >
                                  ✕ Reject
                                </Button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Approved Requests */}
                  {odRequestsForClass.filter(r => r.status === 'approved').length > 0 && (
                    <div className="border-l-4 border-green-400 pl-4">
                      <h3 className="font-semibold text-lg text-green-700 mb-3">
                        ✓ Approved ({odRequestsForClass.filter(r => r.status === 'approved').length})
                      </h3>
                      <div className="space-y-3">
                        {odRequestsForClass.filter(r => r.status === 'approved').map((request) => {
                          const startDate = new Date(request.od_start_date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })
                          const endDate = new Date(request.od_end_date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })
                          
                          return (
                            <div key={request.id} className="border border-green-200 bg-green-50 rounded-lg p-3">
                              <p className="font-semibold text-sm">{request.students?.name}</p>
                              <p className="text-xs text-muted-foreground">{request.students?.email}</p>
                              <p className="text-xs text-muted-foreground mt-1">📅 {startDate} to {endDate}</p>
                              <p className="text-xs text-gray-700 mt-1"><strong>Reason:</strong> {request.reason}</p>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Rejected Requests */}
                  {odRequestsForClass.filter(r => r.status === 'rejected').length > 0 && (
                    <div className="border-l-4 border-red-400 pl-4">
                      <h3 className="font-semibold text-lg text-red-700 mb-3">
                        ✕ Rejected ({odRequestsForClass.filter(r => r.status === 'rejected').length})
                      </h3>
                      <div className="space-y-3">
                        {odRequestsForClass.filter(r => r.status === 'rejected').map((request) => {
                          const startDate = new Date(request.od_start_date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })
                          const endDate = new Date(request.od_end_date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })
                          
                          return (
                            <div key={request.id} className="border border-red-200 bg-red-50 rounded-lg p-3">
                              <p className="font-semibold text-sm">{request.students?.name}</p>
                              <p className="text-xs text-muted-foreground">{request.students?.email}</p>
                              <p className="text-xs text-muted-foreground mt-1">📅 {startDate} to {endDate}</p>
                              <p className="text-xs text-gray-700 mt-1"><strong>Reason:</strong> {request.reason}</p>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* No requests message */}
                  {odRequestsForClass.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">No OD requests for this class yet.</p>
                    </div>
                  )}
                </div>
              )}

              {!odSelectedClassId && (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Select a class to view OD requests</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* View Students Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">View Students</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Select a class to view all students or see individual student details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Class Selector */}
              <div className="space-y-2">
                <Label htmlFor="view-class" className="text-sm sm:text-base">Select Class</Label>
                <select
                  id="view-class"
                  value={viewStudentsClassId}
                  onChange={(e) => handleViewStudentsClassChange(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm sm:text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                <div className="text-center py-4 text-muted-foreground text-sm">
                  Loading students...
                </div>
              )}

              {/* No Class Selected */}
              {!viewStudentsClassId && !loadingStudents && (
                <div className="text-center py-6 sm:py-8 text-muted-foreground text-xs sm:text-sm">
                  Select a class to view students
                </div>
              )}

              {/* No Students Found */}
              {viewStudentsClassId && !loadingStudents && students.length === 0 && (
                <div className="text-center py-6 sm:py-8 text-muted-foreground text-xs sm:text-sm">
                  No students found in this class
                </div>
              )}

              {/* Students List */}
              {viewStudentsClassId && !loadingStudents && students.length > 0 && (
                <>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
                    <div className="text-xs sm:text-sm font-medium">
                      Total Students: {students.length}
                    </div>
                    {selectedStudent && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedStudent(null)}
                        className="text-xs sm:text-sm"
                      >
                        Back to List
                      </Button>
                    )}
                  </div>

                  {!selectedStudent ? (
                    // Full Student List - Mobile responsive table
                    <div className="rounded-md border overflow-x-auto">
                      <table className="w-full min-w-[500px]">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="p-2 sm:p-3 text-left text-xs sm:text-sm font-medium">Roll No</th>
                            <th className="p-2 sm:p-3 text-left text-xs sm:text-sm font-medium">Name</th>
                            <th className="p-2 sm:p-3 text-left text-xs sm:text-sm font-medium hidden sm:table-cell">Email</th>
                            <th className="p-2 sm:p-3 text-left text-xs sm:text-sm font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {students.map((student) => (
                            <tr key={student.id} className="border-b hover:bg-muted/50">
                              <td className="p-2 sm:p-3 text-xs sm:text-sm font-medium">{student.roll_number}</td>
                              <td className="p-2 sm:p-3 text-xs sm:text-sm">{student.name}</td>
                              <td className="p-2 sm:p-3 text-xs sm:text-sm text-muted-foreground hidden sm:table-cell">
                                {student.email}
                              </td>
                              <td className="p-2 sm:p-3 text-xs sm:text-sm">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedStudent(student)}
                                  className="text-xs h-8"
                                >
                                  View
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
                        <CardTitle className="text-base sm:text-lg">Student Details</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <Label className="text-xs sm:text-sm text-muted-foreground">Roll Number</Label>
                              <div className="text-base sm:text-lg font-semibold">
                                {selectedStudent.roll_number}
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs sm:text-sm text-muted-foreground">Name</Label>
                              <div className="text-base sm:text-lg font-semibold">
                                {selectedStudent.name}
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs sm:text-sm text-muted-foreground">Email</Label>
                              <div className="text-xs sm:text-sm break-all">
                                {selectedStudent.email}
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs sm:text-sm text-muted-foreground">Phone</Label>
                              <div className="text-xs sm:text-sm">
                                {selectedStudent.phone || "Not provided"}
                              </div>
                            </div>
                            {selectedStudent.department && (
                              <div>
                                <Label className="text-xs sm:text-sm text-muted-foreground">Department</Label>
                                <div className="text-xs sm:text-sm">
                                  {selectedStudent.department}
                                </div>
                              </div>
                            )}
                            {selectedStudent.year && (
                              <div>
                                <Label className="text-xs sm:text-sm text-muted-foreground">Year</Label>
                                <div className="text-xs sm:text-sm">
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
            <CardTitle className="text-lg sm:text-xl">📊 Generate Comprehensive Reports</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Generate attendance reports for your classes with filters
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Class Filter */}
                <div className="space-y-2">
                  <Label htmlFor="report-class" className="text-xs sm:text-sm">Filter by Class (Optional)</Label>
                  <select
                    id="report-class"
                    value={reportClassId}
                    onChange={(e) => {
                      setReportClassId(e.target.value)
                      setReportSubjectId("") // Reset subject when class changes
                    }}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-xs sm:text-sm"
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
                  <Label htmlFor="report-subject" className="text-xs sm:text-sm">Filter by Subject (Optional)</Label>
                  <select
                    id="report-subject"
                    value={reportSubjectId}
                    onChange={(e) => setReportSubjectId(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-xs sm:text-sm"
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
                  <Label htmlFor="report-start" className="text-xs sm:text-sm">Start Date (Optional)</Label>
                  <Input
                    id="report-start"
                    type="date"
                    value={reportStartDate}
                    onChange={(e) => setReportStartDate(e.target.value)}
                    className="text-xs sm:text-sm"
                  />
                </div>

                {/* End Date Filter */}
                <div className="space-y-2">
                  <Label htmlFor="report-end" className="text-xs sm:text-sm">End Date (Optional)</Label>
                  <Input
                    id="report-end"
                    type="date"
                    value={reportEndDate}
                    onChange={(e) => setReportEndDate(e.target.value)}
                    className="text-xs sm:text-sm"
                  />
                </div>
              </div>

              {/* Generate Button */}
              <Button
                onClick={handleGenerateReport}
                disabled={loadingReport}
                className="w-full text-sm sm:text-base"
              >
                {loadingReport ? 'Generating...' : '🔍 Generate Report'}
              </Button>

              {/* Report Results */}
              {reportData && (
                <div className="mt-6 space-y-4 border-t pt-4">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3">
                    <Card className="bg-blue-50">
                      <CardContent className="p-3 sm:p-4 text-center">
                        <p className="text-xl sm:text-2xl font-bold text-blue-600">{reportData.summary.total_sessions}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">Total Sessions</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-purple-50">
                      <CardContent className="p-3 sm:p-4 text-center">
                        <p className="text-xl sm:text-2xl font-bold text-purple-600">{reportData.summary.total_students}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">Total Students</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-green-50">
                      <CardContent className="p-3 sm:p-4 text-center">
                        <p className="text-xl sm:text-2xl font-bold text-green-600">{reportData.summary.total_present}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">Total Present</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-red-50">
                      <CardContent className="p-3 sm:p-4 text-center">
                        <p className="text-xl sm:text-2xl font-bold text-red-600">{reportData.summary.total_absent}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">Total Absent</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-indigo-50 col-span-2 sm:col-span-1">
                      <CardContent className="p-3 sm:p-4 text-center">
                        <p className="text-xl sm:text-2xl font-bold text-indigo-600">{reportData.summary.average_attendance}%</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">Avg Attendance</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Download Buttons */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      onClick={handleDownloadComprehensivePDF}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-xs sm:text-sm"
                    >
                      📄 <span className="hidden sm:inline ml-1">Download PDF Report</span><span className="sm:hidden ml-1">PDF Report</span>
                    </Button>
                    <Button
                      onClick={handleDownloadComprehensiveCSV}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-xs sm:text-sm"
                    >
                      📊 <span className="hidden sm:inline ml-1">Download CSV Report</span><span className="sm:hidden ml-1">CSV Report</span>
                    </Button>
                  </div>

                  {/* Session List */}
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-muted px-3 sm:px-4 py-2">
                      <p className="font-semibold text-xs sm:text-sm">Sessions Included ({reportData.sessions.length})</p>
                    </div>
                    <div className="max-h-64 overflow-y-auto overflow-x-auto">
                      <table className="w-full min-w-[600px]">
                        <thead className="bg-muted/50 sticky top-0">
                          <tr>
                            <th className="p-2 text-left text-[10px] sm:text-xs">#</th>
                            <th className="p-2 text-left text-[10px] sm:text-xs">Date</th>
                            <th className="p-2 text-left text-[10px] sm:text-xs">Code</th>
                            <th className="p-2 text-left text-[10px] sm:text-xs">Class</th>
                            <th className="p-2 text-left text-[10px] sm:text-xs">Subject</th>
                            <th className="p-2 text-center text-[10px] sm:text-xs">Present</th>
                            <th className="p-2 text-center text-[10px] sm:text-xs">Attendance %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.sessions.map((session: any, index: number) => (
                            <tr key={session.session_id} className="border-t hover:bg-muted/30">
                              <td className="p-2 text-[10px] sm:text-xs">{index + 1}</td>
                              <td className="p-2 text-[10px] sm:text-xs whitespace-nowrap">{new Date(session.session_date).toLocaleDateString()}</td>
                              <td className="p-2 text-[10px] sm:text-xs font-mono">{session.session_code}</td>
                              <td className="p-2 text-[10px] sm:text-xs">{session.class.class_name} {session.class.section}</td>
                              <td className="p-2 text-[10px] sm:text-xs">{session.subject.subject_name}</td>
                              <td className="p-2 text-center text-[10px] sm:text-xs">{session.statistics.present}/{session.statistics.total_students}</td>
                              <td className="p-2 text-center text-[10px] sm:text-xs">
                                <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full ${
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
    </div>
  )
}
