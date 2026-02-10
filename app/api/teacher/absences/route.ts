import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Mark teacher as absent for multiple days and create class transfers
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      teacherId,
      startDate,
      endDate,
      reason,
      transfers, // Array of { classId, subjectId, substituteTeacherId, dates }
    } = body

    if (!teacherId || !startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Create teacher absence record
    const { data: absence, error: absenceError } = await supabase
      .from('teacher_absences')
      .insert({
        teacher_id: teacherId,
        absence_start_date: startDate,
        absence_end_date: endDate,
        reason: reason || null,
        status: 'active',
      })
      .select()
      .single()

    if (absenceError) {
      console.error('Error creating absence:', absenceError)
      return NextResponse.json(
        { success: false, error: 'Failed to create absence record' },
        { status: 500 }
      )
    }

    // Create class transfer records for each transfer
    if (transfers && transfers.length > 0) {
      const transferRecords = transfers.flatMap((transfer: any) =>
        transfer.dates.map((date: string) => ({
          absence_id: absence.id,
          original_teacher_id: teacherId,
          substitute_teacher_id: transfer.substituteTeacherId,
          class_id: transfer.classId,
          subject_id: transfer.subjectId,
          transfer_date: date,
          created_by_teacher_id: teacherId,
        }))
      )

      const { error: transferError } = await supabase
        .from('class_transfers')
        .insert(transferRecords)

      if (transferError) {
        console.error('Error creating transfers:', transferError)
        return NextResponse.json(
          { success: false, error: 'Failed to create class transfers' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Absence recorded and classes transferred successfully',
      absenceId: absence.id,
    })
  } catch (error: any) {
    console.error('Error in POST:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// Get teacher absences and transfers
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const teacherId = searchParams.get('teacherId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    let query = supabase
      .from('teacher_absences')
      .select(`
        *,
        class_transfers (
          id,
          substitute_teacher_id,
          class_id,
          subject_id,
          transfer_date,
          users:substitute_teacher_id (name, email),
          classes (class_name, section),
          subjects (subject_name, subject_code)
        )
      `)

    if (teacherId) {
      query = query.eq('teacher_id', teacherId)
    }

    if (startDate) {
      query = query.gte('absence_start_date', startDate)
    }

    if (endDate) {
      query = query.lte('absence_end_date', endDate)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching absences:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch absences' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: data || [],
    })
  } catch (error: any) {
    console.error('Error in GET:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
