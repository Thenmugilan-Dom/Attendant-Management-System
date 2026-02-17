"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import QRCode from "react-qr-code"
import { GraduationCap, QrCode as QrCodeIcon, LogOut, CheckCircle, Clock, AlertCircle } from "lucide-react"

interface ClassSession {
  classId: string
  className: string
  section: string
  year: number
  department: string
  classEmail: string
  username: string
  subjects: Array<{
    id: string
    subject_code: string
    subject_name: string
    credits: number
    semester: number
  }>
  loginTime: string
}

interface ActiveSession {
  id: string
  session_code: string
  subject_name: string
  subject_code: string
  expires_at: string
  status: string
}

export default function ClassDashboard() {
  const router = useRouter()
  const [classSession, setClassSession] = useState<ClassSession | null>(null)
  const [selectedSubject, setSelectedSubject] = useState("")
  const [loading, setLoading] = useState(false)
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null)
  const [alert, setAlert] = useState<{ type: 'success' | 'error', message: string } | null>(null)

  useEffect(() => {
    // Check if class is logged in
    const sessionData = localStorage.getItem('classSession')
    if (!sessionData) {
      router.push('/class-login')
      return
    }

    try {
      const parsed = JSON.parse(sessionData)
      setClassSession(parsed)
      
      // Auto-select first subject if available
      if (parsed.subjects && parsed.subjects.length > 0) {
        setSelectedSubject(parsed.subjects[0].id)
      }
    } catch (error) {
      console.error('Error parsing class session:', error)
      router.push('/class-login')
    }
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem('classSession')
    router.push('/class-login')
  }

  const handleStartSession = async () => {
    if (!selectedSubject || !classSession) {
      setAlert({ type: 'error', message: 'Please select a subject' })
      return
    }

    setLoading(true)
    setAlert(null)

    try {
      // Create attendance session
      const response = await fetch('/api/attendance/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId: classSession.classId,
          subjectId: selectedSubject,
          isClassLogin: true // Flag to indicate this is from class login
        })
      })

      const data = await response.json()

      if (!response.ok) {
        setAlert({ type: 'error', message: data.error || 'Failed to start session' })
        setLoading(false)
        return
      }

      // Set active session
      setActiveSession({
        id: data.session.id,
        session_code: data.session.session_code,
        subject_name: data.subject?.subject_name || 'Unknown',
        subject_code: data.subject?.subject_code || 'N/A',
        expires_at: data.session.expires_at,
        status: data.session.status
      })

      // Send email notification
      if (classSession.classEmail) {
        await fetch('/api/teacher/send-session-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: data.session.id,
            teacherEmail: classSession.classEmail,
            isClassLogin: true
          })
        })
      }

      setAlert({
        type: 'success',
        message: 'Session started! Display QR code to students NOW.'
      })

      // Scroll to QR code
      setTimeout(() => {
        document.getElementById('qr-section')?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    } catch (error) {
      setAlert({
        type: 'error',
        message: error instanceof Error ? error.message : 'An error occurred'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEndSession = async () => {
    if (!activeSession) return

    setLoading(true)
    try {
      const response = await fetch('/api/attendance/session', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: activeSession.id,
          status: 'completed'
        })
      })

      if (response.ok) {
        setActiveSession(null)
        setAlert({ type: 'success', message: 'Session ended successfully' })
      }
    } catch (error) {
      console.error('Error ending session:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!classSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  const selectedSubjectData = classSession.subjects.find(s => s.id === selectedSubject)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-indigo-600 flex items-center justify-center">
                <GraduationCap className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">
                  {classSession.className} {classSession.section}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {classSession.department} • Year {classSession.year}
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Alert */}
        {alert && (
          <div
            className={`flex items-center gap-2 p-4 rounded-md border ${
              alert.type === 'success'
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            }`}
          >
            {alert.type === 'success' ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-500" />
            )}
            <p
              className={`text-sm ${
                alert.type === 'success' ? 'text-green-700' : 'text-red-700'
              }`}
            >
              {alert.message}
            </p>
          </div>
        )}

        {/* Session Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Start Attendance Session</CardTitle>
            <CardDescription>
              Select a subject and generate QR code for students
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Subject</label>
              <Select
                value={selectedSubject}
                onValueChange={setSelectedSubject}
                disabled={!!activeSession || loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a subject..." />
                </SelectTrigger>
                <SelectContent>
                  {classSession.subjects.map((subject) => (
                    <SelectItem key={subject.id} value={subject.id}>
                      {subject.subject_code} - {subject.subject_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!activeSession ? (
              <Button
                onClick={handleStartSession}
                disabled={loading || !selectedSubject}
                className="w-full"
                size="lg"
              >
                <QrCodeIcon className="mr-2 h-5 w-5" />
                {loading ? 'Starting Session...' : 'Start Session & Generate QR'}
              </Button>
            ) : (
              <Button
                onClick={handleEndSession}
                disabled={loading}
                variant="destructive"
                className="w-full"
                size="lg"
              >
                <Clock className="mr-2 h-5 w-5" />
                End Session
              </Button>
            )}
          </CardContent>
        </Card>

        {/* QR Code Display */}
        {activeSession && (
          <Card id="qr-section" className="border-2 border-indigo-500">
            <CardHeader className="bg-indigo-50">
              <CardTitle className="flex items-center gap-2">
                <QrCodeIcon className="h-6 w-6" />
                Active Session QR Code
              </CardTitle>
              <CardDescription>
                Display this QR code to students on projector/screen
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {/* Session Info */}
                <div className="bg-muted p-4 rounded-md space-y-1">
                  <p className="text-sm">
                    <strong>Subject:</strong> {activeSession.subject_code} -{' '}
                    {activeSession.subject_name}
                  </p>
                  <p className="text-sm">
                    <strong>Session Code:</strong>{' '}
                    <code className="bg-white px-2 py-1 rounded">
                      {activeSession.session_code}
                    </code>
                  </p>
                  <p className="text-sm">
                    <strong>Expires:</strong>{' '}
                    {new Date(activeSession.expires_at).toLocaleTimeString()}
                  </p>
                </div>

                {/* QR Code - Large display */}
                <div className="flex flex-col items-center justify-center p-8 bg-white rounded-md">
                  <QRCode
                    value={activeSession.session_code}
                    size={400}
                    level="H"
                    className="border-4 border-indigo-600 rounded-lg p-4"
                  />
                  <p className="mt-4 text-lg font-semibold text-center">
                    Students: Scan this code to mark attendance
                  </p>
                </div>

                {/* Instructions */}
                <div className="border-t pt-4 space-y-2">
                  <p className="text-sm font-medium">📱 Student Instructions:</p>
                  <ol className="text-sm text-muted-foreground space-y-1 ml-4 list-decimal">
                    <li>Scan QR code with phone camera or QR scanner app</li>
                    <li>Enter student email when prompted</li>
                    <li>Verify OTP sent to email</li>
                    <li>Attendance marked automatically</li>
                  </ol>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
