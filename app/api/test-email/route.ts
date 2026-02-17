import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function GET(request: NextRequest) {
  console.log('🧪 Testing email configuration...')
  
  try {
    // Check credentials
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      return NextResponse.json({
        success: false,
        error: 'Gmail credentials not configured',
        gmail_user: process.env.GMAIL_USER ? 'Set' : 'Not set',
        gmail_password: process.env.GMAIL_APP_PASSWORD ? 'Set (hidden)' : 'Not set'
      })
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
      connectionTimeout: 10000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
    } as any)

    // Test connection
    console.log('🔌 Verifying SMTP connection...')
    const verifyStart = Date.now()
    try {
      await transporter.verify()
      const verifyTime = Date.now() - verifyStart
      console.log(`✅ SMTP verified in ${verifyTime}ms`)
    } catch (verifyError: any) {
      const verifyTime = Date.now() - verifyStart
      console.error(`❌ SMTP verification failed after ${verifyTime}ms`)
      console.error('Error:', verifyError)
      
      let diagnosis = 'Unknown error'
      if (verifyError?.code === 'EAUTH' || verifyError?.response?.includes('535')) {
        diagnosis = '🔑 INVALID CREDENTIALS - Your Gmail App Password is EXPIRED or WRONG'
      } else if (verifyError?.code === 'ETIMEDOUT') {
        diagnosis = '⏱️ CONNECTION TIMEOUT - Cannot reach Gmail servers'
      } else if (verifyError?.code === 'ECONNREFUSED') {
        diagnosis = '🚫 CONNECTION REFUSED - Firewall or network issue'
      }
      
      transporter.close()
      return NextResponse.json({
        success: false,
        error: verifyError instanceof Error ? verifyError.message : 'Unknown error',
        error_code: verifyError?.code,
        diagnosis: diagnosis,
        fix: diagnosis.includes('EXPIRED') 
          ? 'Generate new App Password at: https://myaccount.google.com/apppasswords'
          : 'Check your network/firewall settings',
        gmail_user: process.env.GMAIL_USER,
        verify_time_ms: verifyTime
      }, { status: 503 })
    }

    const verifyTime = Date.now() - verifyStart

    // Send test email
    console.log('📧 Sending test email...')
    const sendStart = Date.now()
    const info = await transporter.sendMail({
      from: `"KPRCAS Test" <${process.env.GMAIL_USER}>`,
      to: process.env.GMAIL_USER, // Send to yourself
      subject: `🧪 Email Test - ${new Date().toLocaleTimeString()}`,
      html: `
        <h2>✅ Email System Working!</h2>
        <p>This test email was sent at: <strong>${new Date().toLocaleString()}</strong></p>
        <p>If you received this, your email configuration is correct.</p>
        <hr>
        <p><small>Sent from KPRCAS Attendance System</small></p>
      `
    })
    const sendTime = Date.now() - sendStart
    
    transporter.close()

    return NextResponse.json({
      success: true,
      message: 'Test email sent successfully!',
      details: {
        gmail_user: process.env.GMAIL_USER,
        message_id: info.messageId,
        verify_time_ms: verifyTime,
        send_time_ms: sendTime,
        total_time_ms: verifyTime + sendTime,
        recipient: process.env.GMAIL_USER
      }
    })

  } catch (error) {
    console.error('❌ Email test failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      error_details: error
    }, { status: 500 })
  }
}
