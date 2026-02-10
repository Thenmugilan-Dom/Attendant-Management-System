import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Get all teacher absences and transfers for admin logging
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const departmentFilter = searchParams.get('department')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    let query = supabase
      .from('teacher_absences')
      .select(`
        *,
        users:teacher_id (id, name, email, department),
        class_transfers (
          id,
          original_teacher_id,
          substitute_teacher_id,
          class_id,
          subject_id,
          transfer_date,
          notes,
          created_at,
          original_teacher:original_teacher_id (name, email),
          substitute_teacher:substitute_teacher_id (name, email),
          classes (class_name, section),
          subjects (subject_name, subject_code)
        )
      `)

    if (departmentFilter) {
      // Filter by teacher's department
      query = query.eq('users.department', departmentFilter)
    }

    if (startDate) {
      query = query.gte('absence_start_date', startDate)
    }

    if (endDate) {
      query = query.lte('absence_end_date', endDate)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching absence logs:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch absence logs' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      count: (data || []).length,
    })
  } catch (error: any) {
    console.error('Error in GET:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
