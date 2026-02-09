import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import nodemailer from 'nodemailer'

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json()

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    // Fetch session details with teacher, class, and subject info
    const { data: session, error: sessionError } = await supabase
      .from('attendance_sessions')
      .select(`
        id,
        session_code,
        status,
        expires_at,
        teacher_id,
        class_id,
        subject_id,
        users!teacher_id(id, name, email),
        classes!class_id(id, class_name, section, year),
        subjects!subject_id(id, subject_code, subject_name)
      `)
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      console.error('Error fetching session:', sessionError)
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    const teacher = session.users as any
    const classData = session.classes as any
    const subject = session.subjects as any

    if (!teacher?.email) {
      return NextResponse.json(
        { error: 'Teacher email not found' },
        { status: 400 }
      )
    }

    // Send email using Nodemailer
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      console.warn('⚠️ Gmail credentials not configured')
      return NextResponse.json(
        { 
          success: false,
          error: 'Email service not configured'
        },
        { status: 500 }
      )
    }

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

    const expiryTime = new Date(session.expires_at).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    })

    // Alert email HTML template
    const htmlTemplate = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { 
        background: linear-gradient(135deg, #28a745 0%, #20c997 100%); 
        color: white; 
        padding: 30px; 
        text-align: center; 
        border-radius: 10px 10px 0 0; 
      }
      .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
      .alert-box { 
        background: #fff3cd; 
        border-left: 4px solid #ffc107; 
        padding: 20px; 
        margin: 20px 0; 
        border-radius: 4px; 
      }
      .session-info { 
        background: white; 
        border: 2px solid #28a745; 
        padding: 20px; 
        margin: 20px 0; 
        border-radius: 8px; 
      }
      .info-row { 
        display: flex; 
        justify-content: space-between; 
        padding: 8px 0; 
        border-bottom: 1px solid #eee; 
      }
      .info-label { font-weight: bold; color: #666; }
      .info-value { color: #333; }
      .session-code { 
        font-size: 24px; 
        font-weight: bold; 
        letter-spacing: 3px; 
        color: #28a745; 
        text-align: center;
        padding: 15px;
        background: #f0f9f4;
        border-radius: 8px;
        margin: 10px 0;
      }
      .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
      .urgent-badge {
        background: #dc3545;
        color: white;
        padding: 8px 20px;
        border-radius: 25px;
        display: inline-block;
        font-size: 14px;
        font-weight: bold;
        margin-bottom: 15px;
        animation: pulse 2s infinite;
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }
      .action-button {
        display: inline-block;
        background: #28a745;
        color: white;
        padding: 12px 30px;
        text-decoration: none;
        border-radius: 5px;
        font-weight: bold;
        margin: 10px 0;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>🔔 Class Session Started!</h1>
        <p>Your attendance session is now ACTIVE</p>
      </div>
      <div class="content">
        <div class="urgent-badge">⏰ SESSION LIVE NOW</div>
        
        <h2>Hello ${teacher.name},</h2>
        
        <div class="alert-box">
          <strong>🚨 URGENT NOTIFICATION</strong><br>
          Your scheduled class session has started and students can now mark their attendance!
        </div>
        
        <div class="session-info">
          <h3 style="color: #28a745; margin-top: 0;">Active Session Details</h3>
          
          <div class="info-row">
            <span class="info-label">📚 Class:</span>
            <span class="info-value"><strong>${classData.class_name} ${classData.section || ''}</strong></span>
          </div>
          
          <div class="info-row">
            <span class="info-label">📖 Subject:</span>
            <span class="info-value"><strong>${subject.subject_code} - ${subject.subject_name}</strong></span>
          </div>
          
          <div class="info-row">
            <span class="info-label">⏰ Session Expires:</span>
            <span class="info-value"><strong style="color: #dc3545;">${expiryTime}</strong></span>
          </div>
        </div>
        
        <div style="background: #e7f3ff; padding: 15px; border-left: 4px solid #007bff; margin: 20px 0;">
          <strong>📱 What Students Need to Do:</strong>
          <ol style="margin: 10px 0; padding-left: 20px;">
            <li>Scan the QR code (from your previous email)</li>
            <li>Verify with OTP sent to their email</li>
          </ol>
        </div>
        
        <div style="background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0;">
          <strong>⚠️ Important Reminders:</strong>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li>Session is valid for <strong>5 minutes only</strong></li>
            <li>Show the QR code from your previous email</li>
            <li>Students must mark attendance before ${expiryTime}</li>
          </ul>
        </div>
        
        <div style="text-align: center; margin: 25px 0;">
          <p style="color: #666; margin-bottom: 10px;">Check your previous email for the QR code</p>
        </div>
        
        <p>Thank you,<br><strong>KPRCAS Attendance System</strong></p>
      </div>
      <div class="footer">
        <p>This is an automated notification. Please do not reply.</p>
        <p>&copy; ${new Date().getFullYear()} KPRCAS. All rights reserved.</p>
      </div>
    </div>
  </body>
</html>`

    // Send email
    const mailOptions = {
      from: `"KPRCAS Attendance System" <${process.env.GMAIL_USER}>`,
      to: teacher.email,
      subject: `🔔 URGENT: Class Started - ${classData.class_name} ${subject.subject_code}`,
      html: htmlTemplate,
    }

    await transporter.sendMail(mailOptions)
    console.log('✅ Session started alert sent successfully to:', teacher.email)

    return NextResponse.json({
      success: true,
      message: 'Session started alert sent successfully',
      teacher_email: teacher.email,
      session_code: session.session_code
    })
  } catch (error) {
    console.error('❌ Error sending session started alert:', error)
    return NextResponse.json(
      { error: 'Failed to send alert', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
