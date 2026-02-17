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

    // Fetch session details with simpler query
    const { data: session, error: sessionError } = await supabase
      .from('attendance_sessions')
      .select('*')
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

    // Fetch class details
    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select('id, class_name, section, year, class_email')
      .eq('id', session.class_id)
      .single()

    if (classError) {
      console.error('Error fetching class:', classError)
    }

    // Fetch subject details
    const { data: subjectData, error: subjectError } = await supabase
      .from('subjects')
      .select('id, subject_code, subject_name')
      .eq('id', session.subject_id)
      .single()

    if (subjectError) {
      console.error('Error fetching subject:', subjectError)
    }

    // Fetch teacher details
    const { data: teacherData, error: teacherError } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('id', session.teacher_id)
      .single()

    if (teacherError || !teacherData) {
      console.error('Error fetching teacher:', teacherError)
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

    // Create transporter with optimized settings for immediate delivery
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // Use STARTTLS
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
      connectionTimeout: 15000,  // 15 seconds (reduced for faster failure detection)
      greetingTimeout: 10000,    // 10 seconds
      socketTimeout: 20000,      // 20 seconds
      pool: false,               // Disable pooling for immediate fresh connections
      maxConnections: 1,
      logger: false,              // Disable verbose logging for speed
      debug: false,
      // Force immediate delivery
      tls: {
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2'
      },
      // Aggressive retry for faster delivery
      maxMessages: 1,
    } as any)

    // Verify connection before sending for faster error detection
    try {
      console.log('🔌 Verifying SMTP connection to Gmail...')
      const verifyStart = Date.now()
      await transporter.verify()
      console.log(`✅ SMTP connection verified in ${Date.now() - verifyStart}ms`)
      console.log('✅ Gmail authentication successful')
    } catch (verifyError: any) {
      console.error('❌ SMTP verification failed:', verifyError)
      console.error('Error code:', verifyError?.code)
      console.error('Error response:', verifyError?.response || verifyError?.message)
      transporter.close()
      
      let errorMessage = 'Unable to connect to Gmail server'
      let suggestion = ''
      
      if (verifyError?.code === 'EAUTH' || verifyError?.response?.includes('535')) {
        errorMessage = 'Gmail authentication failed - Invalid credentials'
        suggestion = '🔑 Your Gmail App Password may be EXPIRED or INVALID. Generate a new one at: https://myaccount.google.com/apppasswords'
      } else if (verifyError?.code === 'ETIMEDOUT' || verifyError?.code === 'ECONNREFUSED') {
        errorMessage = 'Cannot reach Gmail servers - Network issue'
        suggestion = 'Check your internet connection or firewall settings'
      }
      
      return NextResponse.json(
        { 
          success: false,
          error: errorMessage,
          details: verifyError instanceof Error ? verifyError.message : 'Unknown error',
          error_code: verifyError?.code,
          suggestion: suggestion,
          gmail_user: process.env.GMAIL_USER
        },
        { status: 503 }
      )
    }

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
      
      // Retry logic: try up to 2 times (reduced from 3 for faster processing)
      let lastError: any = null
      let attempts = 0
      const maxAttempts = 2
      let attemptStart = 0
      
      while (attempts < maxAttempts) {
        try {
          attempts++
          attemptStart = Date.now()
          console.log(`📤 Email send attempt ${attempts}/${maxAttempts}...`)
          
          const info = await transporter.sendMail(mailOptions)
          const attemptDuration = Date.now() - attemptStart
          const totalDuration = Date.now() - sendStart
          
          console.log(`✅ Session email sent successfully in ${attemptDuration}ms (total: ${totalDuration}ms)`)
          console.log('📧 Email ID:', info.messageId)
          console.log('📨 To:', mailOptions.to)
          console.log('🔄 Attempts needed:', attempts)
          console.log('⚠️ DELIVERY NOTE: Gmail SMTP may delay delivery by 30-300 seconds. This is normal.')
          console.log('💡 TIP: Email was ACCEPTED by Gmail server (sent successfully)')
          console.log('📬 Check recipient\'s SPAM folder if not received within 5 minutes')
          if (classData?.class_email) {
            console.log('📧 Class email:', classData.class_email)
          }

          // Close transporter immediately after successful send
          transporter.close()
          console.log('🔒 SMTP connection closed')

          return NextResponse.json({
            success: true,
            message: 'Session email sent successfully (Gmail SMTP)',
            note: 'Email sent to Gmail server. Delivery may take 30 seconds to 5 minutes due to Gmail spam checks.',
            teacher_email: teacher.email,
            class_email: classData?.class_email || null,
            session_code: session.session_code,
            messageId: info.messageId,
            recipients_count: recipients.length,
            attempts: attempts,
            duration_ms: totalDuration,
            delivery_warning: 'Gmail SMTP delays are normal. Email will arrive shortly.',
            check_spam: 'If not received in 5 minutes, check SPAM folder'
          })
        } catch (attemptError) {
          lastError = attemptError
          const attemptDuration = Date.now() - attemptStart
          console.error(`❌ Attempt ${attempts} failed after ${attemptDuration}ms:`, attemptError instanceof Error ? attemptError.message : 'Unknown error')
          
          if (attempts < maxAttempts) {
            // Wait 1 second before retry (reduced from 2 seconds)
            console.log(`⏳ Waiting 1 second before retry...`)
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        }
      }
      
      // All attempts failed - close transporter
      transporter.close()
      console.log('🔒 SMTP connection closed (after failures)')
      
      // All attempts failed
      const totalDuration = Date.now() - sendStart
      console.error(`❌ All email send attempts failed (total time: ${totalDuration}ms)`)
      console.error('Last error:', {
        message: lastError instanceof Error ? lastError.message : 'Unknown error',
        code: lastError instanceof Error && 'code' in lastError ? (lastError as any).code : undefined
      })
      
      return NextResponse.json(
        { 
          success: false,
          error: `Failed to send email after ${maxAttempts} attempts`,
          details: lastError instanceof Error ? lastError.message : 'Unknown error',
          teacher_email: teacher.email,
          attempts: maxAttempts,
          duration_ms: totalDuration
        },
        { status: 500 }
      )
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
