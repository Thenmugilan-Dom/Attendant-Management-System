import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import nodemailer from "nodemailer"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Generate 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// POST: Generate and send OTP to student's email
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, session_code } = body

    if (!email || !session_code) {
      return NextResponse.json(
        { error: "Email and session code are required" },
        { status: 400 }
      )
    }

    // Verify student exists
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("*, classes (class_name, section)")
      .eq("email", email)
      .single()

    if (studentError || !student) {
      return NextResponse.json(
        { error: "Student not found with this email" },
        { status: 404 }
      )
    }

    // Verify session exists and is active
    const { data: session, error: sessionError } = await supabase
      .from("attendance_sessions")
      .select(`
        *,
        classes (id, class_name, section, year),
        subjects (subject_name, subject_code)
      `)
      .eq("session_code", session_code)
      .eq("status", "active")
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: "Invalid or expired session code" },
        { status: 404 }
      )
    }

    // Check if session is expired
    const now = new Date()
    const expiryTime = new Date(session.expires_at)
    if (now > expiryTime) {
      // Auto-expire the session
      await supabase
        .from("attendance_sessions")
        .update({ status: "expired" })
        .eq("id", session.id)

      return NextResponse.json(
        { error: "This session has expired" },
        { status: 400 }
      )
    }

    // Verify student belongs to this class
    if (student.class_id !== session.class_id) {
      return NextResponse.json(
        { error: "You are not enrolled in this class" },
        { status: 403 }
      )
    }

    // Check if student already marked attendance for this session
    const { data: existingRecord } = await supabase
      .from("attendance_records")
      .select("*")
      .eq("session_id", session.id)
      .eq("student_id", student.id)
      .single()

    if (existingRecord) {
      return NextResponse.json(
        { error: "You have already marked attendance for this session" },
        { status: 400 }
      )
    }

    // Generate OTP
    const otp = generateOTP()
    const otpExpiresAt = new Date()
    otpExpiresAt.setMinutes(otpExpiresAt.getMinutes() + 10) // OTP valid for 10 minutes

    // Delete any existing OTPs for this email and session
    await supabase
      .from("attendance_otps")
      .delete()
      .eq("email", email)
      .eq("session_id", session.id)

    // Store OTP in database
    const { error: otpError } = await supabase
      .from("attendance_otps")
      .insert({
        email,
        otp,
        session_id: session.id,
        expires_at: otpExpiresAt.toISOString(),
        verified: false
      })

    if (otpError) {
      console.error("Error storing OTP:", otpError)
      return NextResponse.json(
        { error: "Failed to generate OTP" },
        { status: 500 }
      )
    }

    // Send OTP via email
    try {
      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: process.env.GMAIL_USER || process.env.EMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASSWORD,
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      })

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Attendance Verification OTP",
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
              }
              .container {
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              }
              .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 20px;
                text-align: center;
                border-radius: 10px 10px 0 0;
              }
              .content {
                background: #f9f9f9;
                padding: 30px;
                border-radius: 0 0 10px 10px;
              }
              .otp-box {
                background: white;
                border: 2px dashed #667eea;
                padding: 20px;
                text-align: center;
                margin: 20px 0;
                border-radius: 8px;
              }
              .otp {
                font-size: 32px;
                font-weight: bold;
                color: #667eea;
                letter-spacing: 8px;
              }
              .info {
                background: #e3f2fd;
                padding: 15px;
                border-left: 4px solid #2196f3;
                margin: 20px 0;
                border-radius: 4px;
              }
              .footer {
                text-align: center;
                margin-top: 20px;
                color: #666;
                font-size: 12px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Attendance Verification</h1>
              </div>
              <div class="content">
                <h2>Hello ${student.name}!</h2>
                <p>Your OTP for marking attendance is:</p>
                
                <div class="otp-box">
                  <div class="otp">${otp}</div>
                </div>
                
                <div class="info">
                  <strong>Session Details:</strong><br>
                  <strong>Class:</strong> ${session.classes.class_name} ${session.classes.section}<br>
                  <strong>Subject:</strong> ${session.subjects.subject_name}<br>
                  <strong>Valid Until:</strong> ${otpExpiresAt.toLocaleString()}
                </div>
                
                <p><strong>Important:</strong></p>
                <ul>
                  <li>This OTP is valid for 10 minutes</li>
                  <li>Do not share this OTP with anyone</li>
                  <li>Enter this OTP on the attendance page to mark your presence</li>
                </ul>
                
                <p>If you did not request this OTP, please ignore this email.</p>
              </div>
              <div class="footer">
                <p>This is an automated email. Please do not reply.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      }

      await transporter.sendMail(mailOptions)

      return NextResponse.json({
        success: true,
        message: "OTP sent to your email successfully",
        session_id: session.id,
        expires_at: otpExpiresAt.toISOString()
      })
    } catch (emailError) {
      console.error("Error sending email:", emailError)
      return NextResponse.json(
        { error: "Failed to send OTP email. Please try again." },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error("Error generating OTP:", error)
    return NextResponse.json(
      { error: "Failed to generate OTP" },
      { status: 500 }
    )
  }
}

// PUT: Verify OTP
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, otp, session_id } = body

    if (!email || !otp || !session_id) {
      return NextResponse.json(
        { error: "Email, OTP, and session_id are required" },
        { status: 400 }
      )
    }

    // Fetch OTP record
    const { data: otpRecord, error: otpError } = await supabase
      .from("attendance_otps")
      .select("*")
      .eq("email", email)
      .eq("session_id", session_id)
      .eq("verified", false)
      .single()

    if (otpError || !otpRecord) {
      return NextResponse.json(
        { error: "Invalid or expired OTP" },
        { status: 400 }
      )
    }

    // Check if OTP is expired
    const now = new Date()
    const expiryTime = new Date(otpRecord.expires_at)
    if (now > expiryTime) {
      return NextResponse.json(
        { error: "OTP has expired. Please request a new one." },
        { status: 400 }
      )
    }

    // Verify OTP
    if (otpRecord.otp !== otp) {
      return NextResponse.json(
        { error: "Invalid OTP. Please check and try again." },
        { status: 400 }
      )
    }

    // Mark OTP as verified
    const { error: updateError } = await supabase
      .from("attendance_otps")
      .update({ verified: true })
      .eq("id", otpRecord.id)

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to verify OTP" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "OTP verified successfully"
    })
  } catch (error: any) {
    console.error("Error verifying OTP:", error)
    return NextResponse.json(
      { error: "Failed to verify OTP" },
      { status: 500 }
    )
  }
}
