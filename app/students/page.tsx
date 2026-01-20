"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Camera, CheckCircle, AlertCircle, QrCode, X } from "lucide-react"
import { Html5Qrcode } from "html5-qrcode"
import { ResponsiveWrapper } from "@/components/responsive-wrapper"
import { InteractiveCard } from "@/components/interactive-card"
import { useToast } from "@/components/toast"

export default function StudentAttendancePage() {
  const [step, setStep] = useState<"scan" | "code" | "email" | "otp" | "success">("scan")
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [sessionCode, setSessionCode] = useState("")
  const [sessionData, setSessionData] = useState<{
    sessionId: string;
    sessionCode?: string;
    expiresAt?: string;
    year?: number;
    date?: string;
    classInfo?: { class_name: string; section: string };
    subjectInfo?: { subject_name: string; subject_code: string };
    subject_name?: string;
    subject?: string;
    subject_code?: string;
    credits?: number;
    semester?: number;
    teacher_name?: string;
    teacher_department?: string;
    teacher_email?: string;
    class_name?: string;
    className?: string;
    section?: string;
    remainingSeconds?: number;
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [scanning, setScanning] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [sessionExpired, setSessionExpired] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState<number>(0)
  const [lastError, setLastError] = useState<string>("")
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null)
  const { showToast, ToastContainer } = useToast()

  // Track client-side mounting to prevent hydration errors
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Timer for session expiry countdown
  useEffect(() => {
    if (!sessionData || !sessionData.expiresAt) {
      console.log("❌ No session data or expiresAt found for timer:", { sessionData: !!sessionData, expiresAt: sessionData?.expiresAt })
      return
    }

    console.log("⏰ Starting timer with session data:", {
      sessionId: sessionData.sessionId,
      expiresAt: sessionData.expiresAt,
      remainingSeconds: sessionData.remainingSeconds
    })

    // Initialize with remaining seconds if available
    if (sessionData.remainingSeconds !== undefined) {
      setTimeRemaining(sessionData.remainingSeconds)
      console.log("⏱️ Initial timer set to:", sessionData.remainingSeconds, "seconds")
    }

    let hasShownExpiredToast = false // Flag to prevent repeated notifications

    const interval = setInterval(() => {
      const now = new Date().getTime()
      const expiresAt = new Date(sessionData.expiresAt!).getTime()
      const diff = Math.max(0, Math.floor((expiresAt - now) / 1000))
      
      setTimeRemaining(diff)
      console.log("⏱️ Timer update:", diff, "seconds remaining")

      // Mark as expired when time runs out (show toast only once)
      if (diff === 0 && !sessionExpired && !hasShownExpiredToast) {
        setSessionExpired(true)
        hasShownExpiredToast = true
        showToast("Session has expired!", "error")
        console.log("⏰ Session expired - attendance can no longer be marked")
      }
    }, 1000)

    return () => {
      clearInterval(interval)
      console.log("🔄 Timer cleanup completed")
    }
  }, [sessionData, sessionExpired])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanning()
    }
  }, [])

  // Initialize scanner when scanning state changes to true
  useEffect(() => {
    if (scanning && step === "scan") {
      initializeScanner()
    }
  }, [scanning, step])

  const initializeScanner = async () => {
    try {
      // Check if element exists
      const element = document.getElementById("qr-reader")
      if (!element) {
        console.error("Scanner element not found")
        setScanning(false)
        return
      }

      // Check if we're in a secure context (HTTPS or localhost)
      if (!window.isSecureContext && window.location.hostname !== 'localhost' && !window.location.hostname.startsWith('127.')) {
        setError("Camera requires HTTPS. Please use manual entry or open on Vercel deployment.")
        showToast("Camera requires HTTPS connection", "error")
        setScanning(false)
        return
      }

      // Initialize Html5Qrcode
      const html5QrCode = new Html5Qrcode("qr-reader")
      html5QrCodeRef.current = html5QrCode

      // Get cameras
      const cameras = await Html5Qrcode.getCameras()
      
      if (cameras.length === 0) {
        throw new Error("No camera found. Please check camera permissions or use manual entry.")
      }

      // Use back camera if available (last camera is usually back camera on mobile)
      const cameraId = cameras.length > 1 ? cameras[cameras.length - 1].id : cameras[0].id

      // Start scanning
      await html5QrCode.start(
        cameraId,
        {
          fps: 10, // Frames per second
          qrbox: { width: 250, height: 250 }, // Scanning box size
          aspectRatio: 1.0,
        },
        async (decodedText) => {
          // Success callback when QR code is scanned
          try {
            let sessionCode = ""
            
            // Handle both URL format (new) and JSON format (legacy)
            if (decodedText.startsWith("http")) {
              // QR code contains a URL like: https://domain.com/student/attendance?session=ABC123
              console.log("📱 QR Code scanned (URL format):", decodedText)
              const url = new URL(decodedText)
              sessionCode = url.searchParams.get('session') || ""
              console.log("🔍 Extracted session code:", sessionCode)
            } else {
              // QR code contains JSON (legacy format)
              const scannedData = JSON.parse(decodedText)
              console.log("📱 QR Code scanned (JSON format):", scannedData)
              sessionCode = scannedData.sessionCode || scannedData.session_code || ""
            }
            
            // Verify session if we have a session code
            if (sessionCode && sessionCode.length === 8) {
              console.log("🔄 Fetching complete session details for code:", sessionCode)
              
              if (sessionCode) {
                const response = await fetch(`/api/attendance/verify-session`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ sessionCode }),
                })

                const data = await response.json()

                if (response.ok) {
                  // Set complete session data with timer info
                  const completeSessionData = {
                    sessionId: data.session.id,
                    sessionCode: data.session.session_code,
                    className: data.session.class_name,
                    class_name: data.session.class_name,
                    section: data.session.section,
                    year: data.session.year,
                    subject: data.session.subject_name,
                    subject_name: data.session.subject_name,
                    subject_code: data.session.subject_code,
                    credits: data.session.credits,
                    semester: data.session.semester,
                    teacher_name: data.session.teacher_name,
                    teacher_email: data.session.teacher_email,
                    teacher_department: data.session.teacher_department,
                    date: data.session.session_date,
                    expiresAt: data.session.expires_at,
                    remainingSeconds: data.session.remaining_seconds,
                  }
                  
                  setSessionData(completeSessionData)
                  console.log("✅ Complete session data set:", completeSessionData)
                } else {
                  throw new Error(data.error || "Failed to fetch session details")
                }
              } else {
                // Fallback to scanned data if no sessionCode
                setSessionData(scannedData)
              }
            } else {
              // Use scanned data as-is
              setSessionData(scannedData)
            }
            
            showToast("QR Code scanned successfully!", "success")
            setStep("email")
            stopScanning()
          } catch (e) {
            console.error("Invalid QR code format or fetch error:", e)
            const errorMsg = "Invalid QR code or connection error"
            // Only show toast if it's a new error (prevent repeated toasts)
            if (errorMsg !== lastError) {
              showToast(errorMsg, "error")
              setLastError(errorMsg)
            }
          }
        },
        (errorMessage) => {
          // Error callback - just log, don't show to user (happens frequently)
          // console.log("QR scan error:", errorMessage)
        }
      )
    } catch (err) {
      console.error("Error starting camera:", err)
      let errorMsg = err instanceof Error ? err.message : "Failed to access camera"
      
      // Provide helpful error messages
      if (errorMsg.includes("secure context")) {
        errorMsg = "Camera requires HTTPS. Use localhost or manual entry below."
      } else if (errorMsg.includes("Permission")) {
        errorMsg = "Camera permission denied. Check browser settings or use manual entry."
      }
      
      setError(errorMsg)
      // Only show toast if it's a new error (prevent repeated toasts)
      if (errorMsg !== lastError) {
        showToast(errorMsg, "error")
        setLastError(errorMsg)
      }
      setScanning(false)
    }
  }

  const isValidEmail = (email: string): boolean => {
    const emailLower = email.toLowerCase()
    return emailLower.endsWith("@kprcas.ac.in") || emailLower.endsWith("@gmail.com")
  }

  const startScanning = () => {
    // Check HTTPS before attempting to start camera
    if (!window.isSecureContext && window.location.hostname !== 'localhost' && !window.location.hostname.startsWith('127.')) {
      showToast("Camera requires HTTPS. Please use 'Enter Session Code Manually' button.", "error")
      return
    }
    
    setError("")
    setScanning(true)
    // The actual scanner initialization happens in useEffect
  }

  const stopScanning = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop()
        html5QrCodeRef.current.clear()
      } catch (err) {
        console.error("Error stopping scanner:", err)
      }
      html5QrCodeRef.current = null
    }
    setScanning(false)
  }

  const handleManualEntry = () => {
    setStep("code")
    setMessage("Enter the session code provided by your teacher")
    showToast("Using manual entry mode", "info")
  }

  const handleVerifySessionCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setMessage("")

    if (!sessionCode) {
      setError("Please enter session code")
      return
    }

    if (sessionCode.length < 3) {
      setError("Session code must be at least 3 characters")
      return
    }

    setLoading(true)

    try {
      // Verify session code exists and is active
      const response = await fetch(`/api/attendance/verify-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sessionCode: sessionCode.toUpperCase() }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Invalid session code")
      }

      // Set session data from API response
      setSessionData({
        sessionId: data.session.id,
        sessionCode: data.session.session_code,
        className: data.session.class_name,
        class_name: data.session.class_name,
        section: data.session.section,
        year: data.session.year,
        subject: data.session.subject_name,
        subject_name: data.session.subject_name,
        subject_code: data.session.subject_code,
        credits: data.session.credits,
        semester: data.session.semester,
        teacher_name: data.session.teacher_name,
        teacher_email: data.session.teacher_email,
        teacher_department: data.session.teacher_department,
        date: data.session.session_date,
        expiresAt: data.session.expires_at,
        remainingSeconds: data.session.remaining_seconds,
      })
      
      // Initialize timer
      setTimeRemaining(data.session.remaining_seconds || 0)
      setSessionExpired(false)
      
      showToast("Session code verified!", "success")
      setMessage("Session verified successfully!")
      setStep("email")
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to verify session code"
      setError(errorMsg)
      // Only show toast if it's a new error (prevent repeated toasts)
      if (errorMsg !== lastError) {
        showToast(errorMsg, "error")
        setLastError(errorMsg)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setMessage("")

    if (!email) {
      setError("Please enter your email")
      return
    }

    if (!isValidEmail(email)) {
      setError("Only @kprcas.ac.in and @gmail.com emails are allowed")
      return
    }

    if (!sessionData) {
      setError("No session data found. Please scan QR code first.")
      return
    }

    setLoading(true)

    try {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          email,
          sessionId: sessionData.sessionId,
          sessionCode: sessionData.sessionCode
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        // Check if this is a class mismatch error (always show this important error)
        if (response.status === 403 && data.blocked) {
          setError(data.error)
          showToast(data.error, "error")
          setLastError(data.error) // Update last error to prevent future repetition
          setLoading(false)
          return // Don't proceed to OTP step
        }
        throw new Error(data.error || "Failed to send OTP")
      }

      // Store OTP data in localStorage for verification
      const otpData = {
        otp: data.otp,
        email: email.toLowerCase(),
        expiresAt: Date.now() + 2 * 60 * 1000, // 2 minutes from now
      }
      localStorage.setItem("attendance_otp", JSON.stringify(otpData))
      console.log("💾 OTP stored in localStorage:", otpData)

      showToast("OTP sent to your email!", "success")
      setMessage("OTP sent to your email!")
      setStep("otp")

      // For testing
      if (data.otp) {
        console.log("📧 OTP for testing:", data.otp)
        console.log("📧 OTP sent to email:", email)
        console.log("⚠️ IMPORTANT: Use this EXACT email when verifying:", email)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to send OTP"
      setError(errorMsg)
      // Only show toast if it's a new error (prevent repeated toasts)
      if (errorMsg !== lastError) {
        showToast(errorMsg, "error")
        setLastError(errorMsg)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyAndMarkAttendance = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setMessage("")

    if (!otp) {
      setError("Please enter the OTP")
      return
    }

    if (otp.length !== 6) {
      setError("OTP must be 6 digits")
      return
    }

    if (!sessionData) {
      setError("Session data missing")
      return
    }

    // Check if session has expired
    if (sessionExpired || timeRemaining <= 0) {
      const errorMsg = "Session has expired. Please ask your teacher to start a new session."
      setError(errorMsg)
      // Only show toast if it's a new error (prevent repeated toasts)
      if (errorMsg !== lastError) {
        showToast("Session expired - cannot mark attendance", "error")
        setLastError(errorMsg)
      }
      return
    }

    setLoading(true)

    try {
      // Verify OTP from localStorage
      console.log("🔐 Verifying OTP from localStorage...")
      console.log("🔐 Email:", email)
      console.log("🔐 Entered OTP:", otp)
      
      const storedData = localStorage.getItem("attendance_otp")
      
      if (!storedData) {
        console.error("❌ No OTP found in localStorage")
        throw new Error("OTP not found. Please request a new OTP.")
      }

      const otpData = JSON.parse(storedData)
      console.log("� Retrieved from localStorage:", otpData)

      // Check if OTP expired
      if (Date.now() > otpData.expiresAt) {
        console.error("❌ OTP expired")
        localStorage.removeItem("attendance_otp")
        throw new Error("OTP has expired. Please request a new OTP.")
      }

      // Check if email matches
      if (otpData.email !== email.toLowerCase()) {
        console.error("❌ Email mismatch")
        console.error("   Stored email:", otpData.email)
        console.error("   Current email:", email.toLowerCase())
        throw new Error("Email mismatch. Please use the same email.")
      }

      // Verify OTP with server instead of localStorage
      const otpVerifyResponse = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.toLowerCase(),
          otp: otp
        }),
      })

      const otpVerifyData = await otpVerifyResponse.json()

      if (!otpVerifyResponse.ok) {
        throw new Error(otpVerifyData.error || "OTP verification failed")
      }

      console.log("✅ OTP verified successfully!")
      
      // Remove OTP from localStorage after successful verification
      localStorage.removeItem("attendance_otp")
      console.log("🗑️ OTP removed from localStorage")

      // Now mark attendance using email (backend will create/find user)
      console.log("📝 Marking attendance...")
      const attendanceResponse = await fetch("/api/attendance/mark", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.toLowerCase(),
          sessionId: sessionData.sessionId,
          sessionCode: sessionData.sessionCode,
        }),
      })

      const attendanceData = await attendanceResponse.json()

      if (!attendanceResponse.ok) {
        throw new Error(attendanceData.error || "Failed to mark attendance")
      }

      console.log("✅ Attendance marked successfully!")
      showToast("Attendance marked successfully! 🎉", "success")
      setMessage("Attendance marked successfully!")
      setStep("success")
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to mark attendance"
      setError(errorMsg)
      // Only show toast if it's a new error (prevent repeated toasts)
      if (errorMsg !== lastError) {
        showToast(errorMsg, "error")
        setLastError(errorMsg)
      }
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleReset = () => {
    setStep("scan")
    setEmail("")
    setOtp("")
    setSessionData(null)
    setError("")
    setMessage("")
    setSessionExpired(false)
    setTimeRemaining(0)
    setLastError("")
  }

  return (
    <ResponsiveWrapper>
      <ToastContainer />
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center p-4 safe-area-insets">
        <div className="w-full max-w-md space-y-4">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="inline-block p-3 rounded-full bg-primary/10 mb-2">
              <QrCode className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-responsive-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Student Attendance
            </h1>
            <p className="text-muted-foreground">Mark your attendance by scanning QR code</p>
          </div>

          {/* Main Card */}
          <InteractiveCard
            title={
              step === "scan" ? "Scan QR Code" :
              step === "code" ? "Enter Session Code" :
              step === "email" ? "Enter Your Email" :
              step === "otp" ? "Verify OTP" :
              "Success!"
            }
            description={
              step === "scan" ? "Scan the QR code displayed by your teacher" :
              step === "code" ? "Enter the session code provided by your teacher" :
              step === "email" ? "Enter your email to receive OTP" :
              step === "otp" ? "Enter the OTP sent to your email" :
              "Your attendance has been marked"
            }
            icon={
              step === "scan" ? <QrCode className="h-6 w-6 text-primary" /> :
              step === "code" ? <QrCode className="h-6 w-6 text-primary" /> :
              step === "success" ? <CheckCircle className="h-6 w-6 text-green-500" /> :
              undefined
            }
          >
            <div className="p-6">
            {step === "scan" && (
              <div className="space-y-4">
                {/* HTTPS Warning for non-secure contexts */}
                {isMounted && !window.isSecureContext && 
                 window.location.hostname !== 'localhost' && 
                 !window.location.hostname.startsWith('127.') && (
                  <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-amber-900 mb-1">
                          Camera Not Available
                        </p>
                        <p className="text-sm text-amber-800 mb-2">
                          QR scanner requires HTTPS. Please use <strong>&quot;Enter Session Code Manually&quot;</strong> button below.
                        </p>
                        <p className="text-xs text-amber-700">
                          Your teacher will provide the session code.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {!scanning ? (
                  <>
                    <div className="flex items-center justify-center h-64 border-2 border-dashed rounded-lg">
                      <div className="text-center">
                        <QrCode className="mx-auto h-12 w-12 mb-4 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground mb-4">
                          Click below to start scanning
                        </p>
                      </div>
                    </div>
                    <Button 
                      className="w-full touch-target ripple" 
                      onClick={startScanning}
                      disabled={isMounted && !window.isSecureContext && window.location.hostname !== 'localhost' && !window.location.hostname.startsWith('127.')}
                    >
                      <Camera className="mr-2 h-4 w-4" />
                      Start Camera
                    </Button>
                    <Button
                      className="w-full touch-target"
                      variant="outline"
                      onClick={handleManualEntry}
                    >
                      Enter Session Code Manually
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="relative rounded-lg overflow-hidden bg-black">
                      {/* Html5Qrcode scanner will render here */}
                      <div id="qr-reader" className="w-full"></div>
                    </div>
                    <Button
                      className="w-full touch-target ripple"
                      variant="destructive"
                      onClick={stopScanning}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Stop Scanning
                    </Button>
                  </>
                )}

                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <p className="text-sm text-red-500">{error}</p>
                  </div>
                )}
              </div>
            )}

            {step === "code" && (
              <form onSubmit={handleVerifySessionCode}>
                <FieldGroup>
                  <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-blue-900">
                          Ask Your Teacher
                        </p>
                        <p className="text-sm text-blue-700">
                          Your teacher will provide a session code (e.g., ABC123). Enter it below.
                        </p>
                      </div>
                    </div>
                  </div>

                  <Field>
                    <FieldLabel htmlFor="sessionCode">Session Code</FieldLabel>
                    <Input
                      id="sessionCode"
                      type="text"
                      placeholder="ABC123"
                      value={sessionCode}
                      onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                      required
                      disabled={loading}
                      className="text-center text-2xl tracking-widest font-bold uppercase"
                      maxLength={10}
                    />
                    <FieldDescription>
                      Enter the session code displayed by your teacher
                    </FieldDescription>
                  </Field>

                  {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
                      <AlertCircle className="h-4 w-4 text-red-500" />
                      <p className="text-sm text-red-500">{error}</p>
                    </div>
                  )}

                  {message && (
                    <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <p className="text-sm text-green-500">{message}</p>
                    </div>
                  )}

                  <Field>
                    <Button type="submit" disabled={loading} className="w-full touch-target ripple">
                      {loading ? "Verifying..." : "Verify Session Code"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full touch-target mt-2"
                      onClick={() => {
                        setStep("scan")
                        setSessionCode("")
                        setError("")
                        setMessage("")
                      }}
                    >
                      Back to Scanner
                    </Button>
                  </Field>
                </FieldGroup>
              </form>
            )}

            {step === "email" && (
              <form onSubmit={handleSendOTP}>
                <FieldGroup>
                  {/* Session Information Display */}
                  {sessionData && (
                    <div className="mb-6 space-y-4">
                      {/* Session Details Card */}
                      <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg shadow-sm">
                        <h3 className="text-lg font-bold text-blue-900 mb-3 flex items-center gap-2">
                          <CheckCircle className="h-5 w-5 text-green-500" />
                          Session Verified
                        </h3>
                        
                        <div className="space-y-3">
                          {/* Subject */}
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-24 text-sm font-medium text-gray-600">
                              Subject:
                            </div>
                            <div className="flex-1">
                              <p className="text-base font-bold text-gray-900">
                                {sessionData.subject_name || sessionData.subject}
                              </p>
                              {sessionData.subject_code && (
                                <p className="text-xs text-gray-500">
                                  Code: {sessionData.subject_code}
                                  {sessionData.credits && ` • ${sessionData.credits} Credits`}
                                  {sessionData.semester && ` • Semester ${sessionData.semester}`}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Teacher */}
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-24 text-sm font-medium text-gray-600">
                              Teacher:
                            </div>
                            <div className="flex-1">
                              <p className="text-base font-bold text-gray-900">
                                {sessionData.teacher_name || 'Teacher'}
                              </p>
                              {sessionData.teacher_department && (
                                <p className="text-xs text-gray-500">
                                  {sessionData.teacher_department}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Class */}
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-24 text-sm font-medium text-gray-600">
                              Class:
                            </div>
                            <div className="flex-1">
                              <p className="text-base font-bold text-gray-900">
                                {sessionData.class_name || sessionData.className}
                                {sessionData.section && ` ${sessionData.section}`}
                              </p>
                              {sessionData.year && (
                                <p className="text-xs text-gray-500">
                                  Year {sessionData.year}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Session Code */}
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-24 text-sm font-medium text-gray-600">
                              Session:
                            </div>
                            <div className="flex-1">
                              <p className="text-base font-mono font-bold text-gray-900">
                                {sessionData.sessionCode}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Session Timer */}
                      <div className={`p-3 rounded-md border ${
                        sessionExpired 
                          ? 'bg-red-50 border-red-200' 
                          : timeRemaining <= 60 
                          ? 'bg-yellow-50 border-yellow-200' 
                          : 'bg-green-50 border-green-200'
                      }`}>
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">⏱️ Time Remaining:</p>
                          <p className={`text-xl font-bold ${
                            sessionExpired 
                              ? 'text-red-600' 
                              : timeRemaining <= 60 
                              ? 'text-yellow-600' 
                              : 'text-green-600'
                          }`}>
                            {sessionExpired ? "EXPIRED" : formatTime(timeRemaining)}
                          </p>
                        </div>
                        {timeRemaining <= 60 && !sessionExpired && (
                          <p className="text-xs text-yellow-700 mt-1">
                            ⚠️ Hurry! Session expiring soon!
                          </p>
                        )}
                        {sessionExpired && (
                          <p className="text-xs text-red-700 mt-1">
                            ❌ Session expired. Ask teacher for new session.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Session Timer - Old Version (Remove this) */}
                  {sessionData && false && (
                    <div className={`mb-4 p-3 rounded-md border ${
                      sessionExpired 
                        ? 'bg-red-50 border-red-200' 
                        : timeRemaining <= 60 
                        ? 'bg-yellow-50 border-yellow-200' 
                        : 'bg-green-50 border-green-200'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium">⏱️ Time Remaining:</p>
                        <p className={`text-lg font-bold ${
                          sessionExpired 
                            ? 'text-red-600' 
                            : timeRemaining <= 60 
                            ? 'text-yellow-600' 
                            : 'text-green-600'
                        }`}>
                          {sessionExpired ? "EXPIRED" : formatTime(timeRemaining)}
                        </p>
                      </div>
                      {timeRemaining <= 60 && !sessionExpired && (
                        <p className="text-xs text-yellow-700 font-medium">
                          ⚠️ Hurry! Session expiring soon!
                        </p>
                      )}
                      {sessionExpired && (
                        <p className="text-xs text-red-700 font-medium">
                          ❌ Session expired. Ask teacher for new session.
                        </p>
                      )}
                    </div>
                  )}

                  {sessionData && (
                    <div className="mb-4 p-3 bg-muted rounded-md space-y-1">
                      <p className="text-sm font-medium">Session Details:</p>
                      <p className="text-sm text-muted-foreground">
                        Class: {sessionData.className}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Subject: {sessionData.subject}
                      </p>
                    </div>
                  )}

                  <Field>
                    <FieldLabel htmlFor="email">Email</FieldLabel>
                    <Input
                      id="email"
                      type="email"
                      placeholder="student@kprcas.ac.in"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={loading}
                    />
                    <FieldDescription>
                      Only @kprcas.ac.in and @gmail.com emails are allowed
                    </FieldDescription>
                  </Field>

                  {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
                      <AlertCircle className="h-4 w-4 text-red-500" />
                      <p className="text-sm text-red-500">{error}</p>
                    </div>
                  )}

                  {message && (
                    <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <p className="text-sm text-green-500">{message}</p>
                    </div>
                  )}

                  <Field>
                    <Button 
                      type="submit" 
                      disabled={loading || sessionExpired} 
                      className="w-full touch-target ripple"
                    >
                      {loading ? "Sending..." : sessionExpired ? "Session Expired" : "Send OTP"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full touch-target mt-2"
                      onClick={handleReset}
                    >
                      Back to Scanner
                    </Button>
                  </Field>
                </FieldGroup>
              </form>
            )}

            {step === "otp" && (
              <form onSubmit={handleVerifyAndMarkAttendance}>
                <FieldGroup>
                  {/* Session Timer */}
                  {sessionData && (
                    <div className={`mb-4 p-3 rounded-md border ${
                      sessionExpired 
                        ? 'bg-red-50 border-red-200' 
                        : timeRemaining <= 60 
                        ? 'bg-yellow-50 border-yellow-200' 
                        : 'bg-green-50 border-green-200'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium">⏱️ Time Remaining:</p>
                        <p className={`text-lg font-bold ${
                          sessionExpired 
                            ? 'text-red-600' 
                            : timeRemaining <= 60 
                            ? 'text-yellow-600' 
                            : 'text-green-600'
                        }`}>
                          {sessionExpired ? "EXPIRED" : formatTime(timeRemaining)}
                        </p>
                      </div>
                      {timeRemaining <= 60 && !sessionExpired && (
                        <p className="text-xs text-yellow-700 font-medium">
                          ⚠️ Hurry! Session expiring soon!
                        </p>
                      )}
                      {sessionExpired && (
                        <p className="text-xs text-red-700 font-medium">
                          ❌ Session expired. Ask teacher for new session.
                        </p>
                      )}
                    </div>
                  )}

                  <Field>
                    <FieldLabel htmlFor="otp">OTP</FieldLabel>
                    <Input
                      id="otp"
                      type="text"
                      placeholder="Enter 6-digit OTP"
                      value={otp}
                      onChange={(e) =>
                        setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      required
                      disabled={loading}
                      maxLength={6}
                      className="text-center text-2xl tracking-widest"
                    />
                    <FieldDescription>
                      Check your email for the OTP code
                    </FieldDescription>
                  </Field>

                  {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
                      <AlertCircle className="h-4 w-4 text-red-500" />
                      <p className="text-sm text-red-500">{error}</p>
                    </div>
                  )}

                  {message && (
                    <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <p className="text-sm text-green-500">{message}</p>
                    </div>
                  )}

                  <Field>
                    <Button 
                      type="submit" 
                      disabled={loading || sessionExpired} 
                      className="w-full touch-target ripple"
                    >
                      {loading ? "Verifying..." : sessionExpired ? "Session Expired" : "Verify & Mark Attendance"}
                    </Button>
                  </Field>
                </FieldGroup>
              </form>
            )}

            {step === "success" && (
              <div className="space-y-4">
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="rounded-full bg-green-100 p-3 mb-4">
                    <CheckCircle className="h-12 w-12 text-green-500" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Attendance Marked!</h3>
                  <p className="text-center text-muted-foreground mb-4">
                    Your attendance has been successfully recorded for{" "}
                    {sessionData?.subject} class.
                  </p>
                  {sessionData && (
                    <div className="w-full p-4 bg-muted rounded-md space-y-1">
                      <p className="text-sm">
                        <span className="font-medium">Class:</span> {sessionData.className}
                      </p>
                      <p className="text-sm">
                        <span className="font-medium">Subject:</span> {sessionData.subject}
                      </p>
                      <p className="text-sm">
                        <span className="font-medium">Date:</span>{" "}
                        {sessionData.date ? new Date(sessionData.date).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                  )}
                </div>
                <Button className="w-full touch-target" onClick={handleReset}>
                  Mark Another Attendance
                </Button>
              </div>
            )}
            </div>
          </InteractiveCard>

          {/* Footer with Navigation */}
          <div className="space-y-3">
            <p className="text-center text-sm text-muted-foreground">
              Having trouble? Contact your teacher for assistance.
            </p>
            <Button 
              onClick={() => {
                // Check if user is logged in
                const user = localStorage.getItem('user');
                if (!user) {
                  window.location.href = '/login';
                } else {
                  window.location.href = '/student/od-request';
                }
              }}
              variant="outline"
              className="w-full touch-target text-xs sm:text-sm"
            >
              📝 Apply for On Duty (OD)
            </Button>
          </div>
        </div>
      </div>
    </ResponsiveWrapper>
  )
}
