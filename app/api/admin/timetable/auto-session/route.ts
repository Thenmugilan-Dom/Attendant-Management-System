import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// This API creates attendance sessions based on class_timetable for the current day order
// Can be triggered:
// 1. Automatically via cron job at the start of each day
// 2. Manually by admin from the timetable page
// 3. Manually by teacher to create their assigned sessions

function generateSessionCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = 'AUTO-'
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

// GET - Check what sessions would be created for today
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const department = searchParams.get('department') || 'General'
    const classId = searchParams.get('classId')

    // Get current day order
    const { data: dayOrderResult } = await supabase.rpc('get_current_day_order', { 
      p_department: department 
    })

    if (!dayOrderResult || dayOrderResult.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Could not determine day order' 
      }, { status: 400 })
    }

    const { day_order: currentDayOrder, is_holiday: isHoliday, holiday_name: holidayName } = dayOrderResult[0]

    // Check if Sunday
    const today = new Date()
    const isSunday = today.getDay() === 0

    if (isHoliday || isSunday) {
      return NextResponse.json({
        success: true,
        isHoliday: true,
        holidayName: isSunday ? 'Sunday' : holidayName,
        message: 'No sessions to create - holiday',
        sessions: []
      })
    }

    // Get timetable entries for current day order
    let query = supabase
      .from('class_timetable')
      .select(`
        id,
        class_id,
        day_order,
        period_number,
        subject_id,
        teacher_id,
        start_time,
        end_time,
        is_break,
        classes (id, class_name, section),
        subjects (id, subject_name, subject_code),
        users (id, name, email)
      `)
      .eq('day_order', currentDayOrder)
      .eq('department', department)
      .eq('is_break', false)
      .not('subject_id', 'is', null)
      .not('teacher_id', 'is', null)
      .order('period_number')

    if (classId) {
      query = query.eq('class_id', classId)
    }

    const { data: timetableEntries, error } = await query

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    // Check which sessions already exist for today
    const todayStr = today.toISOString().split('T')[0]
    const { data: existingSessions } = await supabase
      .from('scheduled_sessions')
      .select('timetable_id')
      .eq('scheduled_date', todayStr)

    const existingTimetableIds = new Set(existingSessions?.map(s => s.timetable_id) || [])

    // Mark entries that need sessions created
    const pendingSessions = timetableEntries?.map(entry => ({
      ...entry,
      already_created: existingTimetableIds.has(entry.id),
      scheduled_date: todayStr
    })) || []

    return NextResponse.json({
      success: true,
      currentDayOrder,
      date: todayStr,
      isHoliday: false,
      totalEntries: timetableEntries?.length || 0,
      pendingCount: pendingSessions.filter(s => !s.already_created).length,
      alreadyCreatedCount: pendingSessions.filter(s => s.already_created).length,
      sessions: pendingSessions
    })
  } catch (error) {
    console.error('Auto-session GET error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create sessions for today based on timetable
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { department = 'General', classId, createAll = false, periodNumbers = [] } = body

    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]

    // Get current day order
    const { data: dayOrderResult } = await supabase.rpc('get_current_day_order', { 
      p_department: department 
    })

    if (!dayOrderResult || dayOrderResult.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Could not determine day order' 
      }, { status: 400 })
    }

    const { day_order: currentDayOrder, is_holiday: isHoliday } = dayOrderResult[0]

    // Check if Sunday
    const isSunday = now.getDay() === 0

    if (isHoliday || isSunday) {
      return NextResponse.json({
        success: false,
        error: 'Cannot create sessions on a holiday'
      }, { status: 400 })
    }

    // Get timetable entries for current day order
    let query = supabase
      .from('class_timetable')
      .select(`
        id,
        class_id,
        day_order,
        period_number,
        subject_id,
        teacher_id,
        start_time,
        end_time,
        is_break,
        department
      `)
      .eq('day_order', currentDayOrder)
      .eq('department', department)
      .eq('is_break', false)
      .not('subject_id', 'is', null)
      .not('teacher_id', 'is', null)

    if (classId) {
      query = query.eq('class_id', classId)
    }

    if (!createAll && periodNumbers.length > 0) {
      query = query.in('period_number', periodNumbers)
    }

    const { data: timetableEntries, error: fetchError } = await query

    if (fetchError) {
      return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 })
    }

    if (!timetableEntries || timetableEntries.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No timetable entries found to create sessions',
        created: 0
      })
    }

    // Filter out entries that already have sessions for today
    const { data: existingSessions } = await supabase
      .from('scheduled_sessions')
      .select('timetable_id')
      .eq('scheduled_date', todayStr)

    const existingTimetableIds = new Set(existingSessions?.map(s => s.timetable_id) || [])
    const entriesToCreate = timetableEntries.filter(e => !existingTimetableIds.has(e.id))

    if (entriesToCreate.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All sessions already created for today',
        created: 0,
        alreadyExisted: timetableEntries.length
      })
    }

    const createdSessions = []
    const errors = []

    for (const entry of entriesToCreate) {
      try {
        const sessionCode = generateSessionCode()
        
        // Calculate expiry time (end of the period)
        const expiresAt = new Date(`${todayStr}T${entry.end_time}`)

        // Create attendance session
        const { data: session, error: sessionError } = await supabase
          .from('attendance_sessions')
          .insert({
            teacher_id: entry.teacher_id,
            class_id: entry.class_id,
            subject_id: entry.subject_id,
            session_code: sessionCode,
            session_date: todayStr,
            session_time: entry.start_time,
            expires_at: expiresAt.toISOString(),
            status: 'active'
          })
          .select(`
            id,
            session_code,
            session_date,
            session_time,
            expires_at,
            classes (id, class_name, section),
            subjects (id, subject_name, subject_code),
            users (id, name, email)
          `)
          .single()

        if (sessionError) {
          errors.push({
            timetable_id: entry.id,
            period: entry.period_number,
            error: sessionError.message
          })
          continue
        }

        // Track in scheduled_sessions
        const { error: trackError } = await supabase
          .from('scheduled_sessions')
          .insert({
            timetable_id: entry.id,
            session_id: session.id,
            scheduled_date: todayStr,
            day_order: currentDayOrder,
            auto_created: true,
            status: 'active'
          })

        if (trackError) {
          console.error('Error tracking scheduled session:', trackError)
        }

        createdSessions.push({
          session_id: session.id,
          session_code: sessionCode,
          period: entry.period_number,
          time: `${entry.start_time} - ${entry.end_time}`,
          class: session.classes,
          subject: session.subjects,
          teacher: session.users
        })
      } catch (error) {
        errors.push({
          timetable_id: entry.id,
          period: entry.period_number,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Created ${createdSessions.length} session(s)`,
      currentDayOrder,
      date: todayStr,
      created: createdSessions.length,
      sessions: createdSessions,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error) {
    console.error('Auto-session POST error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
