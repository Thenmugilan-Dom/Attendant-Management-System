import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function GET(request: NextRequest) {
  console.log('🧪 Testing direct email to iiicomputerscience3@gmail.com...')
  
  try {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      return NextResponse.json({
        success: false,
        error: 'Gmail credentials not configured'
      })
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
      greetingTimeout: 5000,
      socketTimeout: 10000,
    } as any)

    console.log('🔌 Verifying connection...')
    await transporter.verify()
    console.log('✅ Connection verified')

    const testTime = new Date().toLocaleString()
    
    console.log('📧 Sending to iiicomputerscience3@gmail.com...')
    const info = await transporter.sendMail({
      from: `"KPRCAS Test" <${process.env.GMAIL_USER}>`,
      to: 'iiicomputerscience3@gmail.com',
      replyTo: process.env.GMAIL_USER,
      subject: `✅ Test Email - ${new Date().toLocaleTimeString()}`,
      text: `This is a test email sent at ${testTime}\n\nFrom: ${process.env.GMAIL_USER}\nTo: iiicomputerscience3@gmail.com\n\nIf you receive this, email delivery is working!\n\nKPRCAS Attendance System`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #667eea; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .success { background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; margin: 20px 0; border-radius: 5px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>✅ Email Delivery Test</h2>
            <p>KPRCAS Attendance System</p>
          </div>
          <div class="content">
            <div class="success">
              <h3>🎉 Success!</h3>
              <p><strong>If you're reading this, email delivery is working perfectly!</strong></p>
            </div>
            <p><strong>Test Details:</strong></p>
            <ul>
              <li><strong>Sent at:</strong> ${testTime}</li>
              <li><strong>From:</strong> ${process.env.GMAIL_USER}</li>
              <li><strong>To:</strong> iiicomputerscience3@gmail.com</li>
            </ul>
            <p>This confirms that emails can be delivered from the attendance system to your email address.</p>
            <hr>
            <p><small>KPRCAS Attendance System - Automated Test Email</small></p>
          </div>
        </body>
        </html>
      `,
      headers: {
        'X-Priority': '1',
        'Importance': 'high'
      }
    })
    
    transporter.close()

    return NextResponse.json({
      success: true,
      message: 'Test email sent to iiicomputerscience3@gmail.com',
      details: {
        sender: process.env.GMAIL_USER,
        recipient: 'iiicomputerscience3@gmail.com',
        message_id: info.messageId,
        sent_at: testTime,
        check_spam: 'If email not in inbox, check SPAM folder!',
        check_tabs: 'Also check Promotions or Updates tabs in Gmail'
      }
    })

  } catch (error) {
    console.error('❌ Test email failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error
    }, { status: 500 })
  }
}
