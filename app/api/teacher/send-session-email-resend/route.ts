import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { Resend } from 'resend'
import QRCode from 'qrcode'

export async function POST(request: NextRequest) {
  const apiStart = Date.now()
  console.log('📬 Email API (Resend) request started at:', new Date().toISOString())
  
  try {
    // Check Resend API key
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Resend API key not configured',
          suggestion: 'Get free API key from https://resend.com/signup'
        },
        { status: 503 }
      )
    }

    const resend = new Resend(process.env.RESEND_API_KEY)
    const { sessionId, teacherEmail } = await request.json()

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    console.log('📧 Fetching session:', sessionId)

    // Fetch session details
    const { data: session, error: sessionError } = await supabase
      .from('attendance_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      console.error('Error fetching session:', sessionError)
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // Fetch class, subject, and teacher details
    const { data: classData } = await supabase
      .from('classes')
      .select('*')
      .eq('id', session.class_id)
      .single()

    const { data: subjectData } = await supabase
      .from('subjects')
      .select('*')
      .eq('id', session.subject_id)
      .single()

    const { data: teacherData } = await supabase
      .from('users')
      .select('*')
      .eq('id', session.teacher_id)
      .single()

    if (!teacherData?.email) {
      return NextResponse.json(
        { error: 'Teacher email not found' },
        { status: 400 }
      )
    }

    // Generate QR code
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const qrContent = `${baseUrl}/student/attendance?session=${encodeURIComponent(session.session_code)}`
    
    const qrCodeBase64 = await QRCode.toDataURL(qrContent, {
      width: 400,
      margin: 3,
      errorCorrectionLevel: 'H',
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    })

    // Prepare recipients
    const recipients = [teacherData.email]
    if (classData?.class_email) {
      recipients.push(classData.class_email)
    }

    // Send email using Resend
    console.log('🚀 Sending via Resend to:', recipients.join(', '))
    const sendStart = Date.now()

    try {
      const { data, error } = await resend.emails.send({
        from: `KPRCAS Attendance <onboarding@resend.dev>`, // Use your verified domain later
        to: recipients,
        subject: `✅ Attendance Session - ${classData?.class_name || 'Class'} ${subjectData?.subject_code || 'Subject'}`,
        html: `
          <!DOCTYPE html>
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
            </style>
          </head>
          <body>
            <div class="header">
              <h2>🎓 Attendance Session Active</h2>
              <p>KPRCAS - ${new Date().toLocaleDateString()}</p>
            </div>
            <div class="content">
              <p>Hello <strong>${teacherData.name}</strong>,</p>
              <p>Your attendance session is now active.</p>
              
              <div class="session-info">
                <h3>📚 Session Details</h3>
                <p><strong>Class:</strong> ${classData?.class_name || 'N/A'} ${classData?.section || ''}</p>
                <p><strong>Subject:</strong> ${subjectData?.subject_code || 'N/A'} - ${subjectData?.subject_name || 'N/A'}</p>
                <p><strong>Expires:</strong> ${new Date(session.expires_at).toLocaleString()}</p>
              </div>
              
              <div class="qr-section">
                <h3>📱 QR Code for Students</h3>
                <img src="${qrCodeBase64}" alt="QR Code" style="max-width: 300px; border: 2px solid #667eea; padding: 10px;">
              </div>
              
              <div class="important">
                <strong>⏰ Important:</strong> Students must scan before the session expires.
              </div>
              
              <p>Best regards,<br><strong>KPRCAS Attendance System</strong></p>
            </div>
          </body>
          </html>
        `
      })

      const sendDuration = Date.now() - sendStart
      const totalDuration = Date.now() - apiStart

      if (error) {
        console.error('❌ Resend error:', error)
        return NextResponse.json({
          success: false,
          error: 'Failed to send email via Resend',
          details: error
        }, { status: 500 })
      }

      console.log(`✅ Email sent via Resend in ${sendDuration}ms (total: ${totalDuration}ms)`)
      console.log('📧 Email ID:', data?.id)

      return NextResponse.json({
        success: true,
        message: 'Email sent via Resend (instant delivery)',
        provider: 'Resend',
        teacher_email: teacherData.email,
        class_email: classData?.class_email || null,
        session_code: session.session_code,
        messageId: data?.id,
        recipients_count: recipients.length,
        duration_ms: sendDuration,
        total_time_ms: totalDuration
      })

    } catch (resendError) {
      console.error('❌ Resend send error:', resendError)
      return NextResponse.json({
        success: false,
        error: 'Resend delivery failed',
        details: resendError instanceof Error ? resendError.message : 'Unknown error'
      }, { status: 500 })
    }

  } catch (error) {
    console.error('❌ Error in Resend email route:', error)
    return NextResponse.json(
      { error: 'Failed to send email', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
