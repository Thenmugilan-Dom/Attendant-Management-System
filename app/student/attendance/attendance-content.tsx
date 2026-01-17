"use client"

import { useState, useEffect, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { QrCode, Mail, KeyRound, CheckCircle, Loader2, ZoomIn, ZoomOut, X } from "lucide-react"

interface AttendanceContentProps {
  initialSessionCode?: string
}

export function AttendanceContent({ initialSessionCode = "" }: AttendanceContentProps) {
  const searchParams = useSearchParams()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [step, setStep] = useState<"scan" | "email" | "otp" | "success">("scan")
  const [sessionCode, setSessionCode] = useState(initialSessionCode)
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [sessionId, setSessionId] = useState("")
  const [loading, setLoading] = useState(false)
  const [attendanceDetails, setAttendanceDetails] = useState<any>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [streamRef, setStreamRef] = useState<MediaStream | null>(null)

  // Check for session code in URL parameters (from QR code scan)
  useEffect(() => {
    const sessionFromUrl = searchParams.get('session')
    if (sessionFromUrl && sessionFromUrl.length === 8) {
      setSessionCode(sessionFromUrl)
      setStep("email")
      console.log("📲 Session code from QR scan:", sessionFromUrl)
    }

    // Cleanup camera on unmount
    return () => {
      if (streamRef) {
        streamRef.getTracks().forEach(track => track.stop())
      }
    }
  }, [searchParams, streamRef])

  // Start camera for QR scanning
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      })
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setStreamRef(stream)
        setCameraActive(true)
      }
    } catch (err: any) {
      console.error("Camera error:", err)
    }
  }

  // Stop camera
  const stopCamera = () => {
    if (streamRef) {
      streamRef.getTracks().forEach(track => track.stop())
      setStreamRef(null)
      setCameraActive(false)
      setZoom(1)
    }
  }

  // Handle zoom in
  const handleZoomIn = async () => {
    const newZoom = Math.min(zoom + 0.5, 4)
    setZoom(newZoom)
    
    if (streamRef) {
      const videoTrack = streamRef.getVideoTracks()[0]
      try {
        // Try hardware zoom first
        await videoTrack.applyConstraints({ advanced: [{ zoom: newZoom }] })
        console.log("Hardware zoom applied:", newZoom)
      } catch (err) {
        // Fallback to CSS zoom if hardware zoom not supported
        console.log("Hardware zoom not supported, using CSS zoom")
      }
    }
  }

  // Handle zoom out
  const handleZoomOut = async () => {
    const newZoom = Math.max(zoom - 0.5, 1)
    setZoom(newZoom)
    
    if (streamRef) {
      const videoTrack = streamRef.getVideoTracks()[0]
      try {
        // Try hardware zoom first
        await videoTrack.applyConstraints({ advanced: [{ zoom: newZoom }] })
        console.log("Hardware zoom applied:", newZoom)
      } catch (err) {
        // Fallback to CSS zoom if hardware zoom not supported
        console.log("Hardware zoom not supported, using CSS zoom")
      }
    }
  }

  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (sessionCode.trim().length === 8) {
      setStep("email")
    }
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch("/api/student/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          session_code: sessionCode
        })
      })

      const data = await response.json()

      if (data.success) {
        setSessionId(data.session_id)
        setStep("otp")
      }
    } catch (err: any) {
      console.error("Error:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch("/api/student/mark-attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          otp
        })
      })

      const data = await response.json()

      if (data.success) {
        setAttendanceDetails(data)
        setStep("success")
      }
    } catch (err: any) {
      console.error("Error:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setStep("scan")
    setSessionCode("")
    setEmail("")
    setOtp("")
  }

  return (
    <>
      {step === "scan" && (
        <Card className="w-full max-w-2xl overflow-visible">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Scan QR Code
            </CardTitle>
            <CardDescription>
              Scan the QR code displayed by your teacher or enter the session code manually
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-visible">
            {!cameraActive ? (
              <form onSubmit={handleScanSubmit} className="space-y-4">
                <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
                  <QrCode className="mx-auto h-16 w-16 text-gray-400 mb-3" />
                  <p className="text-gray-500 mb-4">Click below to start scanning</p>
                </div>

                <Button
                  type="button"
                  onClick={startCamera}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  📷 Start Camera
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="bg-white px-2 text-gray-500">Or</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="session-code">Enter Session Code Manually</Label>
                  <Input
                    id="session-code"
                    placeholder="Enter 8-character code"
                    value={sessionCode}
                    onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                    maxLength={8}
                    className="text-center text-lg font-mono tracking-widest"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={sessionCode.length !== 8}
                >
                  Continue
                </Button>
              </form>
            ) : (
              <div className="space-y-4 w-full">
                {/* Camera Container */}
                <div className="relative bg-black rounded-lg w-full" style={{ height: '384px' }}>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover rounded-lg"
                    style={{
                      transform: `scale(${zoom})`
                    }}
                  />
                  
                  {/* Scanning overlay */}
                  <div className="absolute inset-0 flex items-center justify-center rounded-lg pointer-events-none">
                    <div className="w-64 h-64 border-2 border-yellow-400 rounded-lg opacity-75"></div>
                  </div>

                  {/* Zoom level indicator */}
                  <div className="absolute top-4 right-4 bg-black/70 text-white px-3 py-1 rounded-full text-sm font-semibold pointer-events-none z-20">
                    Zoom: {zoom.toFixed(1)}x
                  </div>
                </div>

                {/* Stop Scanning Button */}
                <Button
                  onClick={stopCamera}
                  variant="destructive"
                  className="w-full gap-2 text-base py-6"
                >
                  <X className="h-5 w-5" />
                  Stop Scanning
                </Button>

                {/* Zoom Buttons - Below Stop button */}
                <div className="flex gap-4 justify-center py-4 bg-white rounded-lg" style={{ 
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: '16px',
                  gap: '16px',
                  borderRadius: '8px',
                  backgroundColor: '#f9fafb'
                }}>
                  <button
                    onClick={handleZoomOut}
                    disabled={zoom <= 1}
                    style={{
                      backgroundColor: zoom <= 1 ? '#9ca3af' : '#2563eb',
                      color: 'white',
                      width: '80px',
                      height: '80px',
                      borderRadius: '50%',
                      border: 'none',
                      cursor: zoom <= 1 ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '32px',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                      transition: 'all 0.2s'
                    }}
                    title="Zoom Out"
                  >
                    <ZoomOut className="h-10 w-10" />
                  </button>
                  
                  <button
                    onClick={handleZoomIn}
                    disabled={zoom >= 4}
                    style={{
                      backgroundColor: zoom >= 4 ? '#9ca3af' : '#16a34a',
                      color: 'white',
                      width: '80px',
                      height: '80px',
                      borderRadius: '50%',
                      border: 'none',
                      cursor: zoom >= 4 ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '32px',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                      transition: 'all 0.2s'
                    }}
                    title="Zoom In"
                  >
                    <ZoomIn className="h-10 w-10" />
                  </button>
                </div>

                {/* Continue Button */}
                <Button
                  onClick={() => {
                    if (sessionCode.length === 8) {
                      stopCamera()
                      setStep("email")
                    }
                  }}
                  disabled={sessionCode.length !== 8}
                  className="w-full gap-2 text-base py-6"
                >
                  Continue with Code
                </Button>

                <div className="space-y-2">
                  <Label htmlFor="session-code-manual">Or Enter Session Code Manually</Label>
                  <Input
                    id="session-code-manual"
                    placeholder="Enter 8-character code"
                    value={sessionCode}
                    onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                    maxLength={8}
                    className="text-center text-lg font-mono tracking-widest"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === "email" && (
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Enter Email
            </CardTitle>
            <CardDescription>
              We'll send an OTP to verify your identity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={handleReset}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={!email || loading}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send OTP
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {step === "otp" && (
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Verify OTP
            </CardTitle>
            <CardDescription>
              Enter the OTP sent to {email}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleOtpSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp">One-Time Password</Label>
                <Input
                  id="otp"
                  type="text"
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  maxLength={6}
                  className="text-center text-2xl font-bold tracking-widest"
                  required
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={handleReset}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={otp.length < 6 || loading}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Verify
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {step === "success" && (
        <Card className="w-full max-w-md border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle className="h-5 w-5" />
              Success!
            </CardTitle>
            <CardDescription className="text-green-600">
              Your attendance has been recorded
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {attendanceDetails && (
              <div className="space-y-3 rounded-lg bg-white p-4">
                <div>
                  <p className="text-sm text-gray-600">Class</p>
                  <p className="font-semibold">
                    {attendanceDetails.class_name} {attendanceDetails.section}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Subject</p>
                  <p className="font-semibold">
                    {attendanceDetails.subject_code} - {attendanceDetails.subject_name}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Marked At</p>
                  <p className="font-semibold">
                    {new Date(attendanceDetails.marked_at).toLocaleString()}
                  </p>
                </div>
              </div>
            )}

            <Button
              onClick={handleReset}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              Mark Attendance Again
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  )
}
