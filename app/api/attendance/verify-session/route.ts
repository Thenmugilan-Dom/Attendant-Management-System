import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { sessionCode } = await request.json()

    // Validate input
    if (!sessionCode) {
      return NextResponse.json(
        { error: 'Session code is required' },
        { status: 400 }
      )
    }

    // Find active session with this code and fetch related data
    const { data: session, error: sessionError } = await supabase
      .from('attendance_sessions')
      .select(`
        *,
        classes (
          id,
          class_name,
          section,
          year,
          latitude,
          longitude,
          location_radius
        ),
        subjects (
          id,
          subject_name,
          subject_code,
          credits,
          semester
        ),
        users!attendance_sessions_teacher_id_fkey (
          id,
          name,
          email,
          department
        )
      `)
      .eq('session_code', sessionCode.toUpperCase())
      .eq('status', 'active')
      .single()

    if (sessionError || !session) {
      console.error('Session not found:', sessionError)
      return NextResponse.json(
        { error: 'Invalid or inactive session code. Please check with your teacher.' },
        { status: 404 }
      )
    }

    // Check if session has expired
    const now = new Date()
    const expiresAt = new Date(session.expires_at)
    
    if (now > expiresAt) {
      console.log(`⏰ Session ${session.id} has expired`)
      
      // Auto-update status to expired
      await supabase
        .from('attendance_sessions')
        .update({ status: 'expired' })
        .eq('id', session.id)
      
      return NextResponse.json(
        { error: 'This session has expired. Please ask your teacher to start a new session.' },
        { status: 410 } // 410 Gone - resource no longer available
      )
    }

    // Calculate remaining time
    const remainingSeconds = Math.floor((expiresAt.getTime() - now.getTime()) / 1000)
    console.log(`⏱️ Session ${session.id} has ${remainingSeconds} seconds remaining`)

    // Extract teacher, class, and subject details
    const teacher = session.users as any
    const classInfo = session.classes as any
    const subjectInfo = session.subjects as any

    // Check if location restriction is properly set (explicit null checks to handle 0 coordinates)
    const hasLocationRestriction = classInfo?.latitude !== null && 
                                    classInfo?.latitude !== undefined && 
                                    classInfo?.longitude !== null && 
                                    classInfo?.longitude !== undefined

    console.log('📍 Session location data:', {
      sessionId: session.id,
      hasClassInfo: !!classInfo,
      latitude: classInfo?.latitude,
      longitude: classInfo?.longitude,
      location_radius: classInfo?.location_radius,
      hasLocationRestriction
    })

    // Return session details with complete information
    return NextResponse.json({
      success: true,
      message: 'Session code verified',
      session: {
        id: session.id,
        session_code: session.session_code,
        session_date: session.session_date,
        teacher_id: session.teacher_id,
        teacher_name: teacher?.name || 'Unknown Teacher',
        teacher_email: teacher?.email || '',
        teacher_department: teacher?.department || '',
        class_id: session.class_id,
        class_name: classInfo?.class_name || 'Unknown Class',
        section: classInfo?.section || '',
        year: classInfo?.year || '',
        subject_id: session.subject_id,
        subject_name: subjectInfo?.subject_name || 'Unknown Subject',
        subject_code: subjectInfo?.subject_code || '',
        credits: subjectInfo?.credits || '',
        semester: subjectInfo?.semester || '',
        expires_at: session.expires_at,
        remaining_seconds: remainingSeconds,
        // Geolocation data for location-restricted attendance
        location_required: hasLocationRestriction,
        class_latitude: classInfo?.latitude ?? null,
        class_longitude: classInfo?.longitude ?? null,
        location_radius: classInfo?.location_radius ?? 100,
      },
    })
  } catch (error) {
    console.error('Error verifying session code:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
