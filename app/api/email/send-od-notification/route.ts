import nodemailer from 'nodemailer';
import { NextRequest, NextResponse } from 'next/server';

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
});

export async function POST(request: NextRequest) {
  try {
    const {
      to,
      studentName,
      studentEmail,
      odDate,
      reason,
      recipientRole,
      recipientName,
    } = await request.json();

    if (!to || !studentName || !odDate || !reason || !recipientRole) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    };

    const recipientTitle = recipientRole === 'teacher' ? 'Teacher' : 'Administrator';

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 4px; margin-bottom: 20px; }
        .header h2 { margin: 0; font-size: 24px; }
        .content { color: #333; line-height: 1.6; }
        .info-box { background-color: #f9f9f9; border-left: 4px solid #667eea; padding: 15px; margin: 15px 0; }
        .label { font-weight: bold; color: #667eea; }
        .button-container { text-align: center; margin: 20px 0; }
        .button { display: inline-block; background-color: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; }
        .footer { border-top: 1px solid #ddd; margin-top: 20px; padding-top: 15px; color: #999; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>OD Request Notification</h2>
        </div>
        
        <div class="content">
          <p>Dear ${recipientName || 'User'},</p>
          
          <p>A new On Duty (OD) request has been submitted for your review.</p>
          
          <div class="info-box">
            <p><span class="label">Student Name:</span> ${studentName}</p>
            <p><span class="label">Student Email:</span> ${studentEmail}</p>
            <p><span class="label">OD Date:</span> ${formatDate(odDate)}</p>
            <p><span class="label">Reason:</span> ${reason}</p>
          </div>
          
          <p>Please review the request and provide your approval or feedback in the system.</p>
          
          <div class="button-container">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://attendance-system-roan-one.vercel.app'}/admin/students" class="button">
              View Requests
            </a>
          </div>
          
          <p>Thank you,<br>
          Attendance Management System</p>
        </div>
        
        <div class="footer">
          <p>This is an automated email. Please do not reply to this message.</p>
        </div>
      </div>
    </body>
    </html>
    `;

    const mailOptions = {
      from: `Attendance System <${process.env.GMAIL_USER}>`,
      to,
      subject: `OD Request Notification - ${studentName}`,
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json(
      { success: true, message: 'Notification sent successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error sending OD notification:', error);
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}
