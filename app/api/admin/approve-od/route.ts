import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export async function POST(request: NextRequest) {
  try {
    const {
      odRequestId,
      adminId,
      approved,
      approvalNotes,
    } = await request.json();

    if (!odRequestId || !adminId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get OD request details
    const { data: odRequest, error: fetchError } = await supabase
      .from('od_requests')
      .select(
        `
        id,
        student_id,
        teacher_approved,
        admin_id,
        od_start_date,
        od_end_date,
        reason,
        students (id, name, email),
        classes (id, class_name)
      `
      )
      .eq('id', odRequestId)
      .limit(1);

    if (fetchError || !odRequest || odRequest.length === 0) {
      return NextResponse.json(
        { error: 'OD request not found' },
        { status: 404 }
      );
    }

    const request_ = odRequest[0];
    const student = request_.students?.[0];
    const classData = request_.classes?.[0];

    // Verify admin is the one assigned to this request
    if (request_.admin_id !== adminId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Update OD request with admin approval
    const { error: updateError } = await supabase
      .from('od_requests')
      .update({
        admin_approved: approved,
        admin_approved_at: approved ? new Date().toISOString() : null,
        admin_approval_notes: approvalNotes || null,
      })
      .eq('id', odRequestId);

    if (updateError) {
      console.error('Error updating OD request:', updateError);
      return NextResponse.json(
        { error: 'Failed to update OD request' },
        { status: 500 }
      );
    }

    // Check if both teacher and admin have approved
    if (approved && request_.teacher_approved) {
      // Mark attendance as on_duty for all dates in the OD period
      await markODAttendance(
        request_.student_id,
        request_.od_start_date,
        request_.od_end_date
      );

      // Update OD request status to approved
      await supabase
        .from('od_requests')
        .update({ status: 'approved' })
        .eq('id', odRequestId);

      // Send email to student confirming approval
      if (student?.email) {
        try {
          await fetch(
            `${process.env.NEXT_PUBLIC_APP_URL || 'https://attendance-system-roan-one.vercel.app'}/api/email/send-od-approval-email`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                to: student.email,
                studentName: student.name,
                odStartDate: request_.od_start_date,
                odEndDate: request_.od_end_date,
                className: classData?.class_name,
                status: 'approved',
              }),
            }
          );
        } catch (emailError) {
          console.error('Error sending approval email:', emailError);
        }
      }
    } else if (!approved) {
      // If admin rejects, update status to rejected
      await supabase
        .from('od_requests')
        .update({ status: 'rejected' })
        .eq('id', odRequestId);

      // Send email to student about rejection
      if (student?.email) {
        try {
          await fetch(
            `${process.env.NEXT_PUBLIC_APP_URL || 'https://attendance-system-roan-one.vercel.app'}/api/email/send-od-approval-email`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                to: student.email,
                studentName: student.name,
                odStartDate: request_.od_start_date,
                odEndDate: request_.od_end_date,
                className: classData?.class_name,
                status: 'rejected',
                rejectionReason: approvalNotes || 'Request rejected',
                rejectedBy: 'admin',
              }),
            }
          );
        } catch (emailError) {
          console.error('Error sending rejection email:', emailError);
        }
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: `OD request ${approved ? 'approved' : 'rejected'} by admin`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in admin approve-od:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function markODAttendance(
  studentId: string,
  odStartDate: string,
  odEndDate: string
) {
  try {
    // Get all attendance sessions between the OD start and end dates
    const { data: sessions } = await supabase
      .from('attendance_sessions')
      .select('id, session_date')
      .gte('session_date', odStartDate)
      .lte('session_date', odEndDate)
      .limit(1000);

    if (sessions && sessions.length > 0) {
      // Create or update attendance records for all sessions as on_duty
      for (const session of sessions) {
        const { data: existing } = await supabase
          .from('attendance_records')
          .select('id')
          .eq('session_id', session.id)
          .eq('student_id', studentId)
          .limit(1);

        if (existing && existing.length > 0) {
          // Update existing record
          await supabase
            .from('attendance_records')
            .update({
              status: 'on_duty',
              marked_at: new Date().toISOString(),
              marked_by: 'admin_od_approval',
            })
            .eq('id', existing[0].id);
        } else {
          // Create new record
          await supabase.from('attendance_records').insert([
            {
              session_id: session.id,
              student_id: studentId,
              status: 'on_duty',
              marked_at: new Date().toISOString(),
              marked_by: 'admin_od_approval',
            },
          ]);
        }
      }
    }
  } catch (error) {
    console.error('Error marking OD attendance:', error);
  }
}
