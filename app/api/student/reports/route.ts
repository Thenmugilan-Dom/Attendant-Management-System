import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

// GET - Generate attendance report for a student
export async function GET(request: NextRequest) {
  try {
    const studentId = request.nextUrl.searchParams.get('studentId')
    const startDate = request.nextUrl.searchParams.get('startDate')
    const endDate = request.nextUrl.searchParams.get('endDate')
    const subjectId = request.nextUrl.searchParams.get('subjectId')
    const format = request.nextUrl.searchParams.get('format') || 'json' // json, csv

    if (!studentId) {
      return NextResponse.json(
        { error: 'studentId is required' },
        { status: 400 }
      )
    }

    // Get student info
    const { data: student, error: studentError } = await supabaseAdmin
      .from('students')
      .select(`
        *,
        classes (id, class_name, section, year)
      `)
      .eq('id', studentId)
      .single()

    if (studentError || !student) {
      return NextResponse.json(
        { error: 'Student not found' },
        { status: 404 }
      )
    }

    // Build attendance query
    let query = supabaseAdmin
      .from('attendance_records')
      .select(`
        id,
        status,
        created_at,
        marked_at,
        attendance_sessions (
          id,
          session_date,
          period,
          subject_id,
          subjects (id, subject_name, subject_code),
          classes (id, class_name, section)
        )
      `)
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })

    // Apply date filters
    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    if (endDate) {
      query = query.lte('created_at', endDate + 'T23:59:59')
    }

    const { data: records, error: recordsError } = await query

    if (recordsError) {
      console.error('Error fetching records:', recordsError)
      return NextResponse.json(
        { error: recordsError.message },
        { status: 500 }
      )
    }

    // Filter by subject if specified
    let filteredRecords = records || []
    if (subjectId) {
      filteredRecords = filteredRecords.filter(
        (r: any) => r.attendance_sessions?.subject_id === subjectId
      )
    }

    // Calculate statistics
    const totalSessions = filteredRecords.length
    const presentCount = filteredRecords.filter((r: any) => r.status === 'present').length
    const absentCount = filteredRecords.filter((r: any) => r.status === 'absent').length
    const onDutyCount = filteredRecords.filter((r: any) => r.status === 'on_duty').length
    const attendancePercentage = totalSessions > 0 
      ? Math.round(((presentCount + onDutyCount) / totalSessions) * 100) 
      : 0

    // Calculate subject-wise breakdown
    const subjectBreakdown: Record<string, any> = {}
    filteredRecords.forEach((record: any) => {
      const subjectName = record.attendance_sessions?.subjects?.subject_name || 'Unknown'
      const subjectCode = record.attendance_sessions?.subjects?.subject_code || ''
      const key = subjectCode || subjectName

      if (!subjectBreakdown[key]) {
        subjectBreakdown[key] = {
          subject_name: subjectName,
          subject_code: subjectCode,
          total: 0,
          present: 0,
          absent: 0,
          on_duty: 0,
        }
      }

      subjectBreakdown[key].total++
      if (record.status === 'present') subjectBreakdown[key].present++
      else if (record.status === 'absent') subjectBreakdown[key].absent++
      else if (record.status === 'on_duty') subjectBreakdown[key].on_duty++
    })

    // Calculate percentage for each subject
    Object.keys(subjectBreakdown).forEach(key => {
      const subject = subjectBreakdown[key]
      subject.percentage = subject.total > 0
        ? Math.round(((subject.present + subject.on_duty) / subject.total) * 100)
        : 0
    })

    // Calculate monthly breakdown
    const monthlyBreakdown: Record<string, any> = {}
    filteredRecords.forEach((record: any) => {
      const month = new Date(record.created_at).toISOString().substring(0, 7)
      
      if (!monthlyBreakdown[month]) {
        monthlyBreakdown[month] = {
          month,
          total: 0,
          present: 0,
          absent: 0,
          on_duty: 0,
        }
      }

      monthlyBreakdown[month].total++
      if (record.status === 'present') monthlyBreakdown[month].present++
      else if (record.status === 'absent') monthlyBreakdown[month].absent++
      else if (record.status === 'on_duty') monthlyBreakdown[month].on_duty++
    })

    // Calculate percentage for each month
    Object.keys(monthlyBreakdown).forEach(key => {
      const month = monthlyBreakdown[key]
      month.percentage = month.total > 0
        ? Math.round(((month.present + month.on_duty) / month.total) * 100)
        : 0
    })

    // Calculate daily breakdown
    const dailyBreakdown: Record<string, any> = {}
    filteredRecords.forEach((record: any) => {
      const date = record.created_at.split('T')[0]
      
      if (!dailyBreakdown[date]) {
        dailyBreakdown[date] = {
          date,
          sessions: [],
          present: 0,
          absent: 0,
          on_duty: 0,
        }
      }

      dailyBreakdown[date].sessions.push({
        subject: record.attendance_sessions?.subjects?.subject_name || 'Unknown',
        status: record.status,
        time: record.created_at,
      })

      if (record.status === 'present') dailyBreakdown[date].present++
      else if (record.status === 'absent') dailyBreakdown[date].absent++
      else if (record.status === 'on_duty') dailyBreakdown[date].on_duty++
    })

    const reportData = {
      student: {
        id: student.id,
        name: student.name,
        email: student.email,
        class: student.classes,
      },
      period: {
        startDate: startDate || 'All time',
        endDate: endDate || 'All time',
      },
      summary: {
        totalSessions,
        presentCount,
        absentCount,
        onDutyCount,
        attendancePercentage,
      },
      subjectBreakdown: Object.values(subjectBreakdown),
      monthlyBreakdown: Object.values(monthlyBreakdown).sort((a: any, b: any) => b.month.localeCompare(a.month)),
      dailyBreakdown: Object.values(dailyBreakdown).sort((a: any, b: any) => b.date.localeCompare(a.date)),
      records: filteredRecords.map((r: any) => ({
        date: r.created_at,
        subject: r.attendance_sessions?.subjects?.subject_name || 'Unknown',
        subject_code: r.attendance_sessions?.subjects?.subject_code || '',
        class: r.attendance_sessions?.classes?.class_name || 'Unknown',
        status: r.status,
      })),
      generatedAt: new Date().toISOString(),
    }

    // Return CSV format if requested
    if (format === 'csv') {
      const csvRows = [
        ['Date', 'Subject', 'Subject Code', 'Class', 'Status'],
        ...reportData.records.map(r => [
          new Date(r.date).toLocaleDateString(),
          r.subject,
          r.subject_code,
          r.class,
          r.status,
        ])
      ]
      
      const csvContent = csvRows.map(row => row.join(',')).join('\n')
      
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="attendance_report_${student.name.replace(/\s+/g, '_')}.csv"`,
        },
      })
    }

    return NextResponse.json({
      success: true,
      report: reportData,
    })
  } catch (error) {
    console.error('Reports GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
