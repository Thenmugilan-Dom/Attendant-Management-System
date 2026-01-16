import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { startDate, endDate, classId, subjectId, departmentId } = await request.json()

    // Validate dates
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      )
    }

    const dateStart = new Date(startDate)
    const dateEnd = new Date(endDate)

    console.log('📊 Generating admin report for date range:', { startDate, endDate, classId, subjectId })

    // Build query for sessions
    let query = supabase
      .from('attendance_sessions')
      .select(`
        *,
        classes (id, class_name, section, year),
        subjects (id, subject_name, subject_code, credits, semester),
        users (id, name, email, department)
      `)
      .gte('session_date', dateStart.toISOString().split('T')[0])
      .lte('session_date', dateEnd.toISOString().split('T')[0])
      .in('status', ['completed', 'expired'])

    // Apply optional filters
    if (classId) {
      query = query.eq('class_id', classId)
    }
    if (subjectId) {
      query = query.eq('subject_id', subjectId)
    }

    query = query.order('session_date', { ascending: false })

    const { data: sessions, error: sessionsError } = await query

    if (sessionsError) {
      console.error('❌ Error fetching sessions:', sessionsError)
      return NextResponse.json(
        { error: 'Failed to fetch sessions' },
        { status: 500 }
      )
    }

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No attendance sessions found for the selected date range',
        sessions: [],
        summary: {
          total_sessions: 0,
          total_students: 0,
          total_present: 0,
          total_absent: 0,
          average_attendance: '0.00'
        },
        dateRange: { startDate, endDate }
      })
    }

    console.log(`✅ Found ${sessions.length} sessions`)

    // For each session, get all students from the class and their attendance
    const detailedSessions = await Promise.all(
      sessions.map(async (session) => {
        // Fetch all students from the class
        const { data: allStudents, error: studentsError } = await supabase
          .from('students')
          .select('id, student_id, name, email, class_id, phone, address')
          .eq('class_id', session.class_id)
          .order('student_id', { ascending: true })

        if (studentsError) {
          console.error('❌ Error fetching students:', studentsError)
          return null
        }

        // Fetch attendance records for this session
        const { data: attendanceRecords } = await supabase
          .from('attendance_records')
          .select('*')
          .eq('session_id', session.id)

        // Create attendance map
        const attendanceMap = new Map()
        attendanceRecords?.forEach(record => {
          attendanceMap.set(record.student_id, record)
        })

        // Merge students with attendance
        const records = allStudents.map(student => {
          const attendance = attendanceMap.get(student.id)
          return {
            student_id: student.id,
            student_info: {
              id: student.id,
              student_id: student.student_id,
              name: student.name,
              email: student.email,
              phone: student.phone,
              address: student.address,
              class_id: student.class_id
            },
            status: attendance?.status || 'absent',
            marked_at: attendance?.marked_at || null,
            otp_verified: attendance?.otp_verified || false
          }
        })

        const totalStudents = records.length
        const presentCount = records.filter(r => r.status === 'present').length
        const absentCount = records.filter(r => r.status === 'absent').length
        const percentage = totalStudents > 0 
          ? ((presentCount / totalStudents) * 100).toFixed(2)
          : '0.00'

        return {
          session_id: session.id,
          session_code: session.session_code,
          session_date: session.session_date,
          session_time: session.session_time,
          teacher: {
            id: session.teacher_id,
            name: session.users?.name || 'Unknown',
            email: session.users?.email || 'N/A',
            department: session.users?.department || 'N/A'
          },
          class: session.classes,
          subject: session.subjects,
          status: session.status,
          statistics: {
            total_students: totalStudents,
            present: presentCount,
            absent: absentCount,
            attendance_percentage: percentage
          },
          records
        }
      })
    )

    // Filter out null results
    const validSessions = detailedSessions.filter(s => s !== null)

    // Calculate overall summary
    const summary = {
      total_sessions: validSessions.length,
      total_students: validSessions.reduce((sum, s) => sum + s.statistics.total_students, 0),
      total_present: validSessions.reduce((sum, s) => sum + s.statistics.present, 0),
      total_absent: validSessions.reduce((sum, s) => sum + s.statistics.absent, 0),
      average_attendance: validSessions.length > 0 
        ? (
            (validSessions.reduce((sum, s) => sum + s.statistics.present, 0) /
            validSessions.reduce((sum, s) => sum + s.statistics.total_students, 0)) * 100
          ).toFixed(2)
        : '0.00'
    }

    // Group by student for comprehensive student-wise report
    const studentWiseData: any = {}
    validSessions.forEach(session => {
      session.records.forEach(record => {
        const studentId = record.student_info.id
        
        if (!studentWiseData[studentId]) {
          studentWiseData[studentId] = {
            ...record.student_info,
            total_sessions: 0,
            present_count: 0,
            absent_count: 0,
            attendance_percentage: 0
          }
        }
        
        studentWiseData[studentId].total_sessions++
        if (record.status === 'present') {
          studentWiseData[studentId].present_count++
        } else {
          studentWiseData[studentId].absent_count++
        }
      })
    })

    // Calculate student-wise attendance percentage
    Object.values(studentWiseData).forEach((student: any) => {
      student.attendance_percentage = student.total_sessions > 0
        ? ((student.present_count / student.total_sessions) * 100).toFixed(2)
        : '0.00'
    })

    return NextResponse.json({
      success: true,
      dateRange: { startDate, endDate },
      summary,
      sessions: validSessions,
      student_wise: Object.values(studentWiseData),
      total_unique_students: Object.keys(studentWiseData).length
    })
  } catch (error: any) {
    console.error('❌ Error generating admin report:', error)
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    )
  }
}
