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
      odDate,
      subjectName,
      className,
      status,
      rejectionReason,
      rejectedBy,
    } = await request.json();

    if (!to || !studentName || !odDate || !status) {
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

    const isApproved = status === 'approved';

    let htmlContent = '';

    if (isApproved) {
      htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); color: white; padding: 20px; border-radius: 4px; margin-bottom: 20px; text-align: center; }
          .header h2 { margin: 0; font-size: 28px; }
          .checkmark { font-size: 48px; margin-bottom: 10px; }
          .content { color: #333; line-height: 1.6; }
          .info-box { background-color: #f0f8f0; border-left: 4px solid #4CAF50; padding: 15px; margin: 15px 0; }
          .label { font-weight: bold; color: #4CAF50; }
          .footer { border-top: 1px solid #ddd; margin-top: 20px; padding-top: 15px; color: #999; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="checkmark">✓</div>
            <h2>OD Request Approved!</h2>
          </div>
          
          <div class="content">
            <p>Dear ${studentName},</p>
            
            <p>Good news! Your On Duty (OD) request has been <strong style="color: #4CAF50;">approved</strong> by both your teacher and administrator.</p>
            
            <div class="info-box">
              <p><span class="label">OD Date:</span> ${formatDate(odDate)}</p>
              ${className ? `<p><span class="label">Class:</span> ${className}</p>` : ''}
              ${subjectName ? `<p><span class="label">Subject:</span> ${subjectName}</p>` : ''}
              <p><span class="label">Status:</span> <strong>Approved ✓</strong></p>
            </div>
            
            <p>The approved On Duty has been marked in your attendance record. You can view your attendance status in the attendance reports section.</p>
            
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
    } else {
      htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #f44336 0%, #da190b 100%); color: white; padding: 20px; border-radius: 4px; margin-bottom: 20px; text-align: center; }
          .header h2 { margin: 0; font-size: 28px; }
          .icon { font-size: 48px; margin-bottom: 10px; }
          .content { color: #333; line-height: 1.6; }
          .info-box { background-color: #fef5f5; border-left: 4px solid #f44336; padding: 15px; margin: 15px 0; }
          .label { font-weight: bold; color: #f44336; }
          .reason-box { background-color: #fff3e0; border-left: 4px solid #ff9800; padding: 15px; margin: 15px 0; }
          .footer { border-top: 1px solid #ddd; margin-top: 20px; padding-top: 15px; color: #999; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="icon">✕</div>
            <h2>OD Request Not Approved</h2>
          </div>
          
          <div class="content">
            <p>Dear ${studentName},</p>
            
            <p>We regret to inform you that your On Duty (OD) request has been <strong style="color: #f44336;">rejected</strong>.</p>
            
            <div class="info-box">
              <p><span class="label">OD Date:</span> ${formatDate(odDate)}</p>
              ${className ? `<p><span class="label">Class:</span> ${className}</p>` : ''}
              ${subjectName ? `<p><span class="label">Subject:</span> ${subjectName}</p>` : ''}
              <p><span class="label">Status:</span> <strong>Rejected ✕</strong></p>
              ${rejectedBy ? `<p><span class="label">Rejected By:</span> ${rejectedBy === 'teacher' ? 'Your Teacher' : 'Administrator'}</p>` : ''}
            </div>
            
            ${rejectionReason ? `
            <div class="reason-box">
              <p><span class="label">Reason for Rejection:</span></p>
              <p>${rejectionReason}</p>
            </div>
            ` : ''}
            
            <p>If you have any questions regarding this decision, please contact your teacher or administrator.</p>
            
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
    }

    const mailOptions = {
      from: `Attendance System <${process.env.GMAIL_USER}>`,
      to,
      subject: `OD Request ${isApproved ? 'Approved' : 'Rejected'} - ${formatDate(odDate)}`,
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json(
      { success: true, message: 'Email sent successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error sending OD approval email:', error);
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}
