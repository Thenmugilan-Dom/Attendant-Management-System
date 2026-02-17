"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

import { GraduationCap, LogOut, CheckCircle, Clock, AlertCircle, QrCode as QrCodeIcon, Download } from "lucide-react"
import QRCode from "react-qr-code"

interface ClassSession {
  classId: string
  className: string
  section: string
  year: number
  department: string
  username: string
  loginTime: string
}

interface ActiveSession {
  id: string
  session_code: string
  session_date: string
  session_time: string
  expires_at: string
  status: string
  subjects?: {
    subject_code: string
    subject_name: string
  }
}

export default function ClassAttendancePage() {
  const router = useRouter()
  const [classSession, setClassSession] = useState<ClassSession | null>(null)
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([])
  const [selectedSession, setSelectedSession] = useState<ActiveSession | null>(null)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<"select" | "qr">("select")
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
      fetchActiveSessions(parsed.classId)
    } catch (error) {
      console.error('Error parsing class session:', error)
      router.push('/class-login')
    }
  }, [router])

  const fetchActiveSessions = async (classId: string) => {
    try {
      const response = await fetch(`/api/attendance/active-sessions?classId=${classId}`)
      const data = await response.json()
      
      if (data.success && data.sessions) {
        setActiveSessions(data.sessions)
      }
    } catch (error) {
      console.error('Error fetching sessions:', error)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('classSession')
    router.push('/class-login')
  }

  const handleSelectSession = (session: ActiveSession) => {
    setSelectedSession(session)
    setStep("qr")
    setAlert(null)
  }

  const handleBackToSessions = () => {
    setSelectedSession(null)
    setStep("select")
    setAlert(null)
  }

  const downloadQRCode = () => {
    if (!selectedSession) return
    
    const svg = document.getElementById("qr-code-svg")
    if (!svg) return

    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    const img = new Image()

    canvas.width = 400
    canvas.height = 400

    img.onload = () => {
      ctx?.drawImage(img, 0, 0)
      const pngFile = canvas.toDataURL("image/png")
      const downloadLink = document.createElement("a")
      downloadLink.download = `attendance-qr-${selectedSession.session_code}.png`
      downloadLink.href = pngFile
      downloadLink.click()
    }

    img.src = "data:image/svg+xml;base64," + btoa(svgData)
  }

  if (!classSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

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
                  Staff QR Display Portal
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={handleLogout} size="sm">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Alert */}
        {alert && (
          <div
            className={`flex items-center gap-2 p-4 rounded-md border mb-6 ${
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

        {/* Step 1: Select Session */}
        {step === "select" && (
          <Card>
            <CardHeader>
              <CardTitle>Active Attendance Sessions</CardTitle>
              <CardDescription>
                Select a session to view QR code and mark attendance
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activeSessions.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">
                    No active sessions right now
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Wait for your teacher to start an attendance session
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => {
                      if (classSession) {
                        fetchActiveSessions(classSession.classId)
                      }
                    }}
                  >
                    Refresh
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeSessions.map((session) => (
                    <Card
                      key={session.id}
                      className="border-2 hover:border-indigo-300 cursor-pointer transition-colors"
                      onClick={() => handleSelectSession(session)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold flex items-center gap-2">
                              <QrCodeIcon className="h-5 w-5 text-indigo-600" />
                              {session.subjects?.subject_code} - {session.subjects?.subject_name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Started: {new Date(session.session_time).toLocaleTimeString()}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Expires: {new Date(session.expires_at).toLocaleTimeString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 text-green-600">
                            <div className="h-2 w-2 rounded-full bg-green-600 animate-pulse"></div>
                            <span className="text-sm font-medium">Active</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 2: QR Code Display */}
        {step === "qr" && selectedSession && (
          <Card className="border-2 border-indigo-500">
            <CardHeader className="bg-indigo-50">
              <CardTitle className="flex items-center gap-2">
                <QrCodeIcon className="h-6 w-6 text-indigo-600" />
                Attendance QR Code - Display on Projector
              </CardTitle>
              <CardDescription>
                {selectedSession.subjects?.subject_code} - {selectedSession.subjects?.subject_name}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-6">
                {/* Session Info */}
                <div className="bg-muted p-4 rounded-md space-y-1">
                  <p className="text-sm">
                    <strong>Class:</strong> {classSession.className} {classSession.section}
                  </p>
                  <p className="text-sm">
                    <strong>Session Code:</strong>{' '}
                    <code className="bg-white px-2 py-1 rounded font-mono">
                      {selectedSession.session_code}
                    </code>
                  </p>
                  <p className="text-sm">
                    <strong>Expires:</strong>{' '}
                    {new Date(selectedSession.expires_at).toLocaleString()}
                  </p>
                </div>

                {/* QR Code - Large Display */}
                <div className="flex flex-col items-center justify-center p-8 bg-white rounded-md border-2 border-indigo-200">
                  <QRCode
                    id="qr-code-svg"
                    value={selectedSession.session_code}
                    size={300}
                    level="H"
                    className="rounded-lg"
                  />
                  <p className="mt-4 text-center text-lg font-semibold text-indigo-900">
                    📱 Scan with Phone Camera
                  </p>
                  <p className="mt-2 text-center text-sm text-muted-foreground">
                    Students: Open your phone camera and scan this code
                  </p>
                </div>

                {/* Action Buttons (Staff Controls) */}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={downloadQRCode}
                    size="sm"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download QR
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleBackToSessions}
                    size="sm"
                  >
                    Back to Sessions
                  </Button>
                </div>

                {/* Instructions for Students */}
                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-2">📋 Instructions for Students:</p>
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                    <ol className="text-sm text-blue-900 space-y-2 ml-4 list-decimal">
                      <li>Open your phone camera or QR scanner app</li>
                      <li>Point camera at the QR code on screen</li>
                      <li>Tap the notification/link that appears</li>
                      <li>Follow instructions to mark attendance</li>
                    </ol>
                  </div>
                  <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-md p-3">
                    <p className="text-xs text-yellow-800">
                      ⚠️ <strong>Staff Only:</strong> This page is for projector display. Keep it visible for students to scan.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}


      </div>
    </div>
  )
}
