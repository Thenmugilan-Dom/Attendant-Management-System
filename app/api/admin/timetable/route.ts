import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET - Fetch timetable, period config, or classes list
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const action = searchParams.get('action') || 'timetable'
    const department = searchParams.get('department') || 'General'
    const classId = searchParams.get('classId')
    const dayOrder = searchParams.get('dayOrder')

    // Get period configuration
    if (action === 'periods') {
      const { data, error } = await supabase
        .from('period_config')
        .select('*')
        .eq('department', department)
        .order('period_number')

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, periods: data })
    }

    // Get timetable for a specific class
    if (action === 'timetable' && classId) {
      let query = supabase
        .from('class_timetable')
        .select(`
          *,
          subjects (id, subject_name, subject_code),
          users (id, name, email),
          classes (id, class_name, section)
        `)
        .eq('class_id', classId)
        .order('day_order')
        .order('period_number')

      if (dayOrder) {
        query = query.eq('day_order', parseInt(dayOrder))
      }

      const { data, error } = await query

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, timetable: data })
    }

    // Get all timetables for department (overview)
    if (action === 'overview') {
      const { data, error } = await supabase
        .from('class_timetable')
        .select(`
          class_id,
          classes (id, class_name, section),
          day_order
        `)
        .eq('department', department)

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
      }

      // Group by class
      const overview = data?.reduce((acc: Record<string, any>, item: any) => {
        const classKey = item.class_id
        if (!acc[classKey]) {
          acc[classKey] = {
            class_id: item.class_id,
            class_name: item.classes?.class_name,
            section: item.classes?.section,
            day_orders_configured: new Set()
          }
        }
        acc[classKey].day_orders_configured.add(item.day_order)
        return acc
      }, {})

      // Convert Sets to arrays
      const overviewArray = Object.values(overview || {}).map((item: any) => ({
        ...item,
        day_orders_configured: Array.from(item.day_orders_configured).sort()
      }))

      return NextResponse.json({ success: true, overview: overviewArray })
    }

    // Get classes that need timetable setup
    if (action === 'classes') {
      // First try to get classes with matching department
      let { data, error } = await supabase
        .from('classes')
        .select('id, class_name, section, year, department')
        .eq('department', department)
        .order('class_name')

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
      }

      // If no classes found with department filter, try without filter
      // This handles cases where department column doesn't exist or is null
      if (!data || data.length === 0) {
        const { data: allClasses, error: allError } = await supabase
          .from('classes')
          .select('id, class_name, section, year, department')
          .order('class_name')

        if (!allError && allClasses) {
          data = allClasses
        }
      }

      return NextResponse.json({ success: true, classes: data || [] })
    }

    // Get teachers with their subjects (for assignment dropdown)
    if (action === 'teachers') {
      const { data, error } = await supabase
        .from('teacher_subjects')
        .select(`
          teacher_id,
          subject_id,
          class_id,
          users (id, name, email),
          subjects (id, subject_name, subject_code),
          classes (id, class_name, section)
        `)
        .eq('classes.department', department)

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, assignments: data })
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Timetable GET error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create or update timetable entries
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, department = 'General' } = body

    // Save single timetable entry
    if (action === 'save_entry') {
      const { classId, dayOrder, periodNumber, subjectId, teacherId, startTime, endTime, isBreak, breakName } = body

      const entryData = {
        class_id: classId,
        day_order: dayOrder,
        period_number: periodNumber,
        subject_id: isBreak ? null : subjectId,
        teacher_id: isBreak ? null : teacherId,
        start_time: startTime,
        end_time: endTime,
        is_break: isBreak || false,
        break_name: isBreak ? breakName : null,
        department,
        updated_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('class_timetable')
        .upsert(entryData, {
          onConflict: 'class_id,day_order,period_number'
        })
        .select()

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, entry: data?.[0] })
    }

    // Save entire day timetable (bulk)
    if (action === 'save_day') {
      const { classId, dayOrder, entries } = body

      if (!Array.isArray(entries) || entries.length === 0) {
        return NextResponse.json({ success: false, error: 'No entries provided' }, { status: 400 })
      }

      // Delete existing entries for this class + day
      await supabase
        .from('class_timetable')
        .delete()
        .eq('class_id', classId)
        .eq('day_order', dayOrder)

      // Insert new entries
      const insertData = entries.map((entry: any) => ({
        class_id: classId,
        day_order: dayOrder,
        period_number: entry.periodNumber,
        subject_id: entry.isBreak ? null : entry.subjectId,
        teacher_id: entry.isBreak ? null : entry.teacherId,
        start_time: entry.startTime,
        end_time: entry.endTime,
        is_break: entry.isBreak || false,
        break_name: entry.isBreak ? entry.breakName : null,
        department
      }))

      const { data, error } = await supabase
        .from('class_timetable')
        .insert(insertData)
        .select()

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, entries: data })
    }

    // Copy timetable from one day to another
    if (action === 'copy_day') {
      const { classId, sourceDayOrder, targetDayOrder } = body

      // Get source entries
      const { data: sourceEntries, error: fetchError } = await supabase
        .from('class_timetable')
        .select('*')
        .eq('class_id', classId)
        .eq('day_order', sourceDayOrder)

      if (fetchError) {
        return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 })
      }

      if (!sourceEntries || sourceEntries.length === 0) {
        return NextResponse.json({ success: false, error: 'No source timetable found' }, { status: 404 })
      }

      // Delete existing target entries
      await supabase
        .from('class_timetable')
        .delete()
        .eq('class_id', classId)
        .eq('day_order', targetDayOrder)

      // Create new entries for target day
      const newEntries = sourceEntries.map((entry: any) => ({
        class_id: classId,
        day_order: targetDayOrder,
        period_number: entry.period_number,
        subject_id: entry.subject_id,
        teacher_id: entry.teacher_id,
        start_time: entry.start_time,
        end_time: entry.end_time,
        is_break: entry.is_break,
        break_name: entry.break_name,
        department: entry.department
      }))

      const { data, error } = await supabase
        .from('class_timetable')
        .insert(newEntries)
        .select()

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, entries: data })
    }

    // Update period configuration
    if (action === 'update_periods') {
      const { periods } = body

      if (!Array.isArray(periods)) {
        return NextResponse.json({ success: false, error: 'Invalid periods data' }, { status: 400 })
      }

      // Delete existing config for department
      await supabase
        .from('period_config')
        .delete()
        .eq('department', department)

      // Insert new config
      const insertData = periods.map((p: any) => ({
        department,
        period_number: p.periodNumber,
        period_name: p.periodName,
        start_time: p.startTime,
        end_time: p.endTime,
        is_break: p.isBreak || false
      }))

      const { data, error } = await supabase
        .from('period_config')
        .insert(insertData)
        .select()

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, periods: data })
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Timetable POST error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Remove timetable entry
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const entryId = searchParams.get('id')
    const classId = searchParams.get('classId')
    const dayOrder = searchParams.get('dayOrder')

    if (entryId) {
      // Delete single entry
      const { error } = await supabase
        .from('class_timetable')
        .delete()
        .eq('id', entryId)

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
      }

      return NextResponse.json({ success: true })
    }

    if (classId && dayOrder) {
      // Delete all entries for a class + day
      const { error } = await supabase
        .from('class_timetable')
        .delete()
        .eq('class_id', classId)
        .eq('day_order', parseInt(dayOrder))

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
      }

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 })
  } catch (error) {
    console.error('Timetable DELETE error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
