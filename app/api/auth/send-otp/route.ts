import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import nodemailer from 'nodemailer'
import { otpStorage } from '@/lib/otp-storage'

// Generate a 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// Validate email domain
function isValidEmail(email: string): boolean {
  const emailLower = email.toLowerCase()
  return emailLower.endsWith('@kprcas.ac.in') || emailLower.endsWith('@gmail.com')
}

export async function POST(request: NextRequest) {
  try {
    console.log('📧 OTP Request received')
    const { email, sessionId, sessionCode } = await request.json()
    console.log('📧 Email:', email)
    console.log('📧 Session ID:', sessionId)
    console.log('📧 Session Code:', sessionCode)

    // Validate email
    if (!email || typeof email !== 'string') {
      console.error('❌ Email validation failed: Email is required')
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Validate session info
    if (!sessionId || !sessionCode) {
      console.error('❌ Session validation failed: Session info required')
      return NextResponse.json(
        { error: 'Session information is required' },
        { status: 400 }
      )
    }

    // Check if email domain is allowed
    if (!isValidEmail(email)) {
      console.error('❌ Email validation failed: Invalid domain')
      return NextResponse.json(
        { error: 'Only @kprcas.ac.in and @gmail.com emails are allowed' },
        { status: 400 }
      )
    }

    // Verify session exists and get its class
    console.log('🔍 Verifying session and fetching class info...')
    const { data: session, error: sessionError } = await supabase
      .from('attendance_sessions')
      .select('id, class_id, session_code, status, classes!inner(id, class_name, section, year)')
      .eq('id', sessionId)
      .eq('session_code', sessionCode)
      .eq('status', 'active')
      .single()

    if (sessionError || !session) {
      console.error('❌ Session not found or inactive:', sessionError?.message)
      return NextResponse.json(
        { error: 'Invalid or inactive session' },
        { status: 400 }
      )
    }

    console.log(`✅ Session found: ${session.session_code} for class ${(session.classes as any)?.class_name} ${(session.classes as any)?.section}`)

    // Check if student exists and belongs to the session's class
    console.log('🔍 Checking if student belongs to the session class...')
    const emailLower = email.toLowerCase()
    
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, student_id, name, email, class_id, classes!inner(id, class_name, section, year)')
      .eq('email', emailLower)
      .maybeSingle()

    if (studentError || !student) {
      console.log('⚠️ Student not found in students table - will be created during attendance marking')
      console.log('✅ Allowing OTP to be sent for new student registration')
      
      // New students are allowed - they'll be auto-registered when marking attendance
      // The attendance marking API will handle creating the student record
    } else {
      // Student exists - verify their class matches the session's class
      console.log(`✅ Student found: ${student.name} (${student.email})`)
      
      // Only check class if student has a class assigned
      if (student.class_id) {
        if (student.class_id !== session.class_id) {
          const studentClass = student.classes ? `${(student.classes as any).class_name} ${(student.classes as any).section}` : 'Unknown'
          const sessionClass = session.classes ? `${(session.classes as any).class_name} ${(session.classes as any).section}` : 'Unknown'
          
          console.log(`❌ Class mismatch: Student belongs to ${studentClass}, but session is for ${sessionClass}`)
          
          return NextResponse.json(
            { 
              error: `You cannot mark attendance for this session. This session is for ${sessionClass}, but you belong to ${studentClass}.`,
              student_class: studentClass,
              session_class: sessionClass,
              blocked: true
            },
            { status: 403 } // 403 Forbidden
          )
        }
        
        console.log(`✅ Class verification passed: Student ${student.name} belongs to ${(student.classes as any)?.class_name} ${(student.classes as any)?.section}`)
      } else {
        console.log('⚠️ Student has no class assigned yet - allowing OTP for class assignment')
      }
    }

    // Generate OTP
    const otpCode = generateOTP()
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000) // 2 minutes from now
    console.log('🔢 Generated OTP:', otpCode)

    // ALWAYS store in memory first (for reliability)
    console.log('💾 Storing OTP in memory...')
    otpStorage.set(email.toLowerCase(), otpCode, expiresAt)
    console.log('✅ OTP stored in memory successfully')
    console.log('📝 Memory storage size:', otpStorage.size())
    otpStorage.listAll() // Debug: show all stored OTPs

    // Also try to store in database (optional, for persistence)
    console.log('💾 Attempting to store OTP in database (backup)...')
    let dbStorageSuccess = false
    
    try {
      const { data: otpData, error: otpError } = await supabase
        .from('otps')
        .insert({
          email: email.toLowerCase(),
          otp_code: otpCode,
          expires_at: expiresAt.toISOString(),
          is_used: false,
        })
        .select()
        .single()

      if (otpError) {
        console.error('⚠️ Database storage failed (not critical):', otpError.message)
        console.log('✅ Memory storage is working, continuing...')
      } else {
        console.log('✅ OTP also stored in database (bonus!)')
        dbStorageSuccess = true
      }
    } catch (dbError) {
      console.error('⚠️ Database exception (not critical):', dbError instanceof Error ? dbError.message : 'Unknown')
      console.log('✅ Memory storage is working, continuing...')
    }

    // Send OTP via email using Nodemailer
    let emailSent = false
    let emailError = null

    try {
      // Configure Gmail SMTP transporter
      if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
        const transporter = nodemailer.createTransport({
          host: 'smtp.gmail.com',
          port: 587,
          secure: false,
          auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD,
          },
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          socketTimeout: 15000,
        })

        // Email HTML template
        const htmlTemplate = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
      .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
      .otp-box { background: white; border: 2px dashed #667eea; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
      .otp-code { font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #667eea; }
      .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
      .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; margin: 20px 0; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>🏫 KPRCAS Attendance</h1>
        <p>Your One-Time Password</p>
      </div>
      <div class="content">
        <p>Hello,</p>
        <p>Your OTP for KPRCAS Attendance System is:</p>
        
        <div class="otp-box">
          <div class="otp-code">${otpCode}</div>
        </div>
        
        <div class="warning">
          ⚠️ <strong>Important:</strong> This OTP will expire in <strong>2 minutes</strong>. Do not share this code with anyone.
        </div>
        
        <p>If you didn't request this code, please ignore this email.</p>
        
        <p>Best regards,<br>KPRCAS Attendance Team</p>
      </div>
      <div class="footer">
        <p>This is an automated email. Please do not reply.</p>
        <p>&copy; ${new Date().getFullYear()} KPRCAS. All rights reserved.</p>
      </div>
    </div>
  </body>
</html>`

        // Send email
        const mailOptions = {
          from: `"KPRCAS Attendance" <${process.env.GMAIL_USER}>`,
          to: email.toLowerCase(),
          subject: 'Your KPRCAS Attendance OTP',
          html: htmlTemplate,
        }

        await transporter.sendMail(mailOptions)
        emailSent = true
        console.log('✅ Email sent successfully via Gmail SMTP to:', email.toLowerCase())
      } else {
        console.warn('⚠️ Gmail credentials not configured. Email will not be sent.')
        console.warn('⚠️ Please set GMAIL_USER and GMAIL_APP_PASSWORD in .env.local')
      }
    } catch (error) {
      console.error('❌ Error sending email:', error)
      emailError = error instanceof Error ? error.message : 'Unknown error'
    }

    // Return response
    if (emailSent) {
      console.log('✅ Returning success response with email sent')
      return NextResponse.json({
        success: true,
        message: 'OTP sent to your email',
        // Include OTP in development mode
        ...(process.env.NODE_ENV === 'development' && { otp: otpCode }),
      })
    } else {
      // For development, return OTP even if email fails
      console.log('📧 OTP (for testing):', otpCode)
      console.log('⚠️ Email not sent, returning OTP in response for testing')
      return NextResponse.json({
        success: true,
        message: 'OTP generated (check console for testing)',
        otp: otpCode, // Always show in response for testing
        note: 'Email not configured. Using OTP from response.',
      })
    }
  } catch (error) {
    console.error('❌❌❌ CRITICAL ERROR in send-otp:', error)
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
