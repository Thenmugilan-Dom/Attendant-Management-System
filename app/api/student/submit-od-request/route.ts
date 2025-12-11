import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export async function POST(request: NextRequest) {
  try {
    const {
      student_id,
      class_id,
      teacher_id,
      admin_id,
      od_start_date,
      od_end_date,
      reason,
    } = await request.json();

    // Validate required fields
    if (
      !student_id ||
      !class_id ||
      !teacher_id ||
      !admin_id ||
      !od_start_date ||
      !od_end_date ||
      !reason
    ) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate date range
    const startDate = new Date(od_start_date);
    const endDate = new Date(od_end_date);
    if (startDate > endDate) {
      return NextResponse.json(
        { error: 'End date must be after or equal to start date' },
        { status: 400 }
      );
    }

    // Check if student exists
    const { data: studentData, error: studentError } = await supabase
      .from('students')
      .select('id, name, email, class_id')
      .eq('id', student_id)
      .limit(1);

    if (studentError || !studentData || studentData.length === 0) {
      return NextResponse.json(
        { error: 'Student not found' },
        { status: 404 }
      );
    }

    const student = studentData[0];

    // Check if OD request already exists for overlapping dates
    const { data: existingRequest } = await supabase
      .from('od_requests')
      .select('id')
      .eq('student_id', student_id)
      .gte('od_end_date', od_start_date)
      .lte('od_start_date', od_end_date)
      .eq('status', 'pending')
      .limit(1);

    if (existingRequest && existingRequest.length > 0) {
      return NextResponse.json(
        { error: 'You already have a pending OD request that overlaps with this date range' },
        { status: 400 }
      );
    }

    // Create OD request
    const { data: odRequest, error: odError } = await supabase
      .from('od_requests')
      .insert([
        {
          student_id: student_id,
          class_id: class_id,
          teacher_id: teacher_id,
          admin_id: admin_id,
          od_start_date: od_start_date,
          od_end_date: od_end_date,
          reason: reason,
          status: 'pending',
          teacher_approved: false,
          admin_approved: false,
        },
      ])
      .select('id')
      .limit(1);

    if (odError || !odRequest || odRequest.length === 0) {
      console.error('Error creating OD request:', odError);
      return NextResponse.json(
        { error: 'Failed to create OD request' },
        { status: 500 }
      );
    }

    const requestId = odRequest[0].id;

    // Get teacher details for notification
    const { data: teacherData } = await supabase
      .from('users')
      .select('email, name')
      .eq('id', teacher_id)
      .limit(1);

    // Get admin details for notification
    const { data: adminData } = await supabase
      .from('users')
      .select('email, name')
      .eq('id', admin_id)
      .limit(1);

    const teacher = teacherData?.[0];
    const admin = adminData?.[0];

    // Send notification emails
    try {
      // Notify teacher
      if (teacher?.email) {
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://attendance-system-roan-one.vercel.app'}/api/email/send-od-notification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: teacher.email,
            studentName: student.name,
            studentEmail: student.email,
            odStartDate: od_start_date,
            odEndDate: od_end_date,
            reason: reason,
            recipientRole: 'teacher',
            recipientName: teacher.name,
          }),
        });
      }

      // Notify admin
      if (admin?.email) {
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://attendance-system-roan-one.vercel.app'}/api/email/send-od-notification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: admin.email,
            studentName: student.name,
            studentEmail: student.email,
            odStartDate: od_start_date,
            odEndDate: od_end_date,
            reason: reason,
            recipientRole: 'admin',
            recipientName: admin.name,
          }),
        });
      }
    } catch (emailError) {
      console.error('Error sending notification emails:', emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json(
      {
        success: true,
        message: 'OD request submitted successfully',
        requestId,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in submit-od-request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
