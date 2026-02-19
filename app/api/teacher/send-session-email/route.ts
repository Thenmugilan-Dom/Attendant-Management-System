import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import nodemailer from 'nodemailer'
import QRCode from 'qrcode'

export async function POST(request: NextRequest) {
  const apiStart = Date.now()
  console.log('📬 Email API request started at:', new Date().toISOString())
  
  try {
    // Check Gmail credentials first
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      console.error('❌ Gmail credentials not configured')
      console.error('GMAIL_USER:', process.env.GMAIL_USER ? 'Set' : 'Not set')
      console.error('GMAIL_APP_PASSWORD:', process.env.GMAIL_APP_PASSWORD ? 'Set' : 'Not set')
      return NextResponse.json(
        { 
          success: false,
          error: 'Email service not configured - missing Gmail credentials. Please contact administrator.',
          suggestion: 'Gmail App Password may be expired. Generate new one at: https://myaccount.google.com/apppasswords'
        },
        { status: 503 } // Service Unavailable
      )
    }
    
    console.log('✅ Gmail credentials found')
    console.log('📧 Gmail User:', process.env.GMAIL_USER)
    console.log('🔑 App Password:', process.env.GMAIL_APP_PASSWORD ? `${process.env.GMAIL_APP_PASSWORD.substring(0, 4)}****` : 'Not set')

    const { sessionId, teacherEmail } = await request.json()

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    console.log('📧 Fetching session:', sessionId)

    // Fetch session details with all related data in ONE query (much faster)
    const { data: session, error: sessionError } = await supabase
      .from('attendance_sessions')
      .select(`
        *,
        users:teacher_id(id, name, email),
        classes:class_id(id, class_name, section, year, class_email),
        subjects:subject_id(id, subject_code, subject_name)
      `)
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      console.error('Error fetching session:', sessionError)
      return NextResponse.json(
        { error: 'Session not found', details: sessionError?.message },
        { status: 404 }
      )
    }

    console.log('✅ Session found:', session.id)

    // Extract related data from the joined query
    const classData = session.classes as any
    const subjectData = session.subjects as any
    const teacherData = session.users as any

    if (!teacherData) {
      console.error('Error: Teacher not found in session data')
      return NextResponse.json(
        { error: 'Teacher not found' },
        { status: 404 }
      )
    }

    const teacher = teacherData

    if (!teacher?.email) {
      return NextResponse.json(
        { error: 'Teacher email not found' },
        { status: 400 }
      )
    }

    console.log('📧 Preparing to send email to:', teacher.email)
    console.log('🎯 Using Gmail account:', process.env.GMAIL_USER)
    console.log('📝 Session Code:', session.session_code)
    console.log('📚 Class:', classData?.class_name)
    console.log('📖 Subject:', subjectData?.subject_code)

    // Generate QR code as buffer for attachment
    let qrCodeBuffer: Buffer
    try {
      // Create a proper URL that includes the session code
      // When scanned, it will open the student attendance page with the session code pre-filled
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://attendance-system-roan-one.vercel.app'
      const qrContent = `${baseUrl}/student/attendance?session=${encodeURIComponent(session.session_code)}`
      
      console.log('📲 QR Code content:', qrContent)
      
      qrCodeBuffer = await QRCode.toBuffer(qrContent, {
        width: 400,
        margin: 3,
        errorCorrectionLevel: 'H',
        type: 'png',
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })
    } catch (qrError) {
      console.error('Error generating QR code:', qrError)
      return NextResponse.json(
        { error: 'Failed to generate QR code' },
        { status: 500 }
      )
    }

    console.log('📧 Preparing to send email to:', teacher.email)
    console.log('🎯 Using Gmail account:', process.env.GMAIL_USER)

    // Create transporter with optimized settings for FAST immediate delivery
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // Use STARTTLS
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
      connectionTimeout: 10000,  // 10 seconds (reduced for faster failure detection)
      greetingTimeout: 5000,     // 5 seconds
      socketTimeout: 15000,      // 15 seconds
      pool: false,               // Disable pooling for immediate fresh connections
      maxConnections: 1,
      logger: false,             // Disable verbose logging for speed
      debug: false,
      // Force immediate delivery
      tls: {
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2'
      },
      // Send immediately without queueing
      maxMessages: 1,
      // Disable connection reuse for fresh connection each time
      disableFileAccess: true,
      disableUrlAccess: true
    } as any)

    // SKIP verify() - it adds 2-3 seconds of latency and sendMail will fail anyway if creds are wrong
    console.log('🚀 Skipping SMTP verify for faster delivery - sending directly...')

    // Email HTML template (simplified to avoid spam filters)
    const htmlTemplate = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
      .header { background: #667eea; color: white; padding: 20px; text-align: center; }
      .content { padding: 20px; background: #f9f9f9; }
      .session-info { background: white; border: 2px solid #667eea; padding: 15px; margin: 15px 0; }
      .qr-section { text-align: center; margin: 20px 0; padding: 20px; background: white; }
      .important { background: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 15px 0; }
      .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
    </style>
  </head>
  <body>
    <div class="header">
      <h2>🎓 Attendance Session Active</h2>
      <p>KPRCAS - ${new Date().toLocaleDateString()}</p>
    </div>
    <div class="content">
      <p>Hello <strong>${teacher.name}</strong>,</p>
      <p>Your attendance session is now active and ready for students.</p>
      
      <div class="session-info">
        <h3>📚 Session Details</h3>
        <p><strong>Class:</strong> ${classData?.class_name || 'N/A'} ${classData?.section || ''}</p>
        <p><strong>Subject:</strong> ${subjectData?.subject_code || 'N/A'} - ${subjectData?.subject_name || 'N/A'}</p>
        <p><strong>Started:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Expires:</strong> ${new Date(session.expires_at).toLocaleString()}</p>
      </div>
      
      <div class="qr-section">
        <h3>📱 QR Code for Students</h3>
        <p>Students can scan this code to mark attendance:</p>
        <img src="cid:qrcode" alt="Attendance QR Code" style="max-width: 300px; border: 2px solid #667eea; padding: 10px;">
      </div>
      
      <div class="important">
        <strong>⏰ Important:</strong> This session is valid for a limited time. Students must scan before it expires.
      </div>
      
      <p><strong>How students mark attendance:</strong></p>
      <ol>
        <li>Scan the QR code above</li>
        <li>Verify identity with OTP sent to their email</li>
        <li>Attendance is recorded automatically</li>
      </ol>
      
      <p>Best regards,<br><strong>KPRCAS Attendance System</strong></p>
    </div>
    <div class="footer">
      <p>This is an automated notification from KPRCAS Attendance System.</p>
      <p>&copy; ${new Date().getFullYear()} KPRCAS College. All rights reserved.</p>
    </div>
  </body>
</html>`

    // Prepare email recipients - teacher and class email
    const recipients = [teacher.email]
    if (classData?.class_email) {
      recipients.push(classData.class_email)
      console.log('📧 Will send to class email:', classData.class_email)
    }
    const emailTo = recipients.join(', ')

    // Send email with QR code attachment
    const mailOptions = {
      from: `"KPRCAS Attendance" <${process.env.GMAIL_USER}>`,
      to: emailTo,
      replyTo: process.env.GMAIL_USER,
      subject: `✅ Attendance Session - ${classData?.class_name || 'Class'} ${subjectData?.subject_code || 'Subject'} - ${new Date().toLocaleTimeString()}`,
      text: `KPRCAS Attendance Session Active\n\nHello ${teacher.name},\n\nYour attendance session is now active.\n\nClass: ${classData?.class_name || 'N/A'} ${classData?.section || ''}\nSubject: ${subjectData?.subject_code || 'N/A'} - ${subjectData?.subject_name || 'N/A'}\nStarted: ${new Date().toLocaleString()}\nExpires: ${new Date(session.expires_at).toLocaleString()}\n\nStudents can scan the QR code attached to mark attendance.\n\nBest regards,\nKPRCAS Attendance System`,
      html: htmlTemplate,
      headers: {
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
        'Importance': 'high',
        'X-Mailer': 'KPRCAS Attendance System',
        'X-Entity-Ref-ID': `SESSION-${session.id}`,
        'List-Unsubscribe': `<mailto:${process.env.GMAIL_USER}?subject=unsubscribe>`,
        'Message-ID': `<${session.session_code}-${Date.now()}@kprcas.edu>`,
        'Auto-Submitted': 'auto-generated'
      },
      attachments: [
        {
          filename: 'attendance-qr.png',
          content: qrCodeBuffer,
          cid: 'qrcode',
          contentType: 'image/png'
        }
      ]
    }

    try {
      const sendStart = Date.now()
      console.log('🚀 Sending email with options:', {
        from: mailOptions.from,
        to: mailOptions.to,
        subject: mailOptions.subject,
        recipients: emailTo.split(',').map(e => e.trim())
      })
      console.log('📧 Email will be sent to:', emailTo)
      console.log('📨 Primary recipient (teacher):', teacher.email)
      if (classData?.class_email) {
        console.log('📨 Secondary recipient (class):', classData.class_email)
      }
      
      // Single attempt for fastest delivery (retries add significant latency)
      try {
        console.log('📤 Sending email directly (no retry for speed)...')
        
        const info = await transporter.sendMail(mailOptions)
        const totalDuration = Date.now() - sendStart
        
        console.log(`✅ Session email sent successfully in ${totalDuration}ms`)
        console.log('📧 Email ID:', info.messageId)
        console.log('📨 To:', mailOptions.to)
        if (classData?.class_email) {
          console.log('📧 Class email:', classData.class_email)
        }

        // Close transporter immediately after successful send
        transporter.close()

        const apiDuration = Date.now() - apiStart
        return NextResponse.json({
          success: true,
          message: 'Session email sent successfully (Gmail SMTP)',
          teacher_email: teacher.email,
          class_email: classData?.class_email || null,
          session_code: session.session_code,
          messageId: info.messageId,
          recipients_count: recipients.length,
          duration_ms: totalDuration,
          api_total_ms: apiDuration
        })
      } catch (sendError: any) {
        // Close transporter on failure
        transporter.close()
        
        const totalDuration = Date.now() - sendStart
        console.error(`❌ Email send failed after ${totalDuration}ms:`, sendError?.message || 'Unknown error')
        
        let errorMessage = 'Failed to send email'
        let suggestion = ''
        
        if (sendError?.code === 'EAUTH' || sendError?.response?.includes('535')) {
          errorMessage = 'Gmail authentication failed - Invalid credentials'
          suggestion = '🔑 Your Gmail App Password may be EXPIRED. Generate new one at: https://myaccount.google.com/apppasswords'
        } else if (sendError?.code === 'ETIMEDOUT' || sendError?.code === 'ECONNREFUSED') {
          errorMessage = 'Cannot reach Gmail servers - Network issue'
          suggestion = 'Check your internet connection'
        }
        
        return NextResponse.json(
          { 
            success: false,
            error: errorMessage,
            details: sendError instanceof Error ? sendError.message : 'Unknown error',
            suggestion: suggestion || undefined,
            teacher_email: teacher.email,
            duration_ms: totalDuration
          },
          { status: 500 }
        )
      }
    } catch (emailError) {
      // Close transporter on unexpected error
      transporter.close()
      console.log('🔒 SMTP connection closed (unexpected error)')
      
      console.error('❌ Unexpected error sending email:', emailError)
      console.error('Error details:', {
        message: emailError instanceof Error ? emailError.message : 'Unknown error',
        code: emailError instanceof Error && 'code' in emailError ? (emailError as any).code : undefined
      })
      
      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to send email',
          details: emailError instanceof Error ? emailError.message : 'Unknown error',
          teacher_email: teacher.email
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('❌ Error sending session email:', error)
    return NextResponse.json(
      { error: 'Failed to send session email', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
