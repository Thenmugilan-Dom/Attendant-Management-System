import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET - Fetch day order settings and current day order
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const department = searchParams.get('department') || 'General'
    const action = searchParams.get('action') || 'current'

    if (action === 'current') {
      // Get current day order for the department
      const today = new Date().toISOString().split('T')[0]
      
      // First check if there's an explicit setting for today
      const { data: todaySetting, error: todayError } = await supabase
        .from('day_order_settings')
        .select('*')
        .eq('department', department)
        .eq('effective_date', today)
        .single()
      
      if (todaySetting) {
        return NextResponse.json({
          success: true,
          dayOrder: todaySetting.day_order,
          isHoliday: todaySetting.is_holiday,
          holidayName: todaySetting.holiday_name,
          effectiveDate: todaySetting.effective_date,
          isExplicitSetting: true
        })
      }

      // Get config and calculate day order
      let config = await getOrCreateConfig(department)
      
      // Get the most recent non-holiday setting before today
      const { data: lastSetting } = await supabase
        .from('day_order_settings')
        .select('*')
        .eq('department', department)
        .lt('effective_date', today)
        .eq('is_holiday', false)
        .order('effective_date', { ascending: false })
        .limit(1)
        .single()
      
      let calculatedDayOrder: number
      
      if (lastSetting) {
        // Calculate based on last explicit setting
        const lastDate = new Date(lastSetting.effective_date)
        const todayDate = new Date(today)
        const daysPassed = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
        calculatedDayOrder = ((lastSetting.day_order - 1 + daysPassed) % config.total_days) + 1
      } else {
        // Calculate based on config
        const lastUpdatedDate = new Date(config.last_updated_date)
        const todayDate = new Date(today)
        const daysPassed = Math.floor((todayDate.getTime() - lastUpdatedDate.getTime()) / (1000 * 60 * 60 * 24))
        calculatedDayOrder = ((config.current_day_order - 1 + daysPassed) % config.total_days) + 1
      }
      
      return NextResponse.json({
        success: true,
        dayOrder: calculatedDayOrder,
        isHoliday: false,
        holidayName: null,
        effectiveDate: today,
        isExplicitSetting: false,
        config: {
          totalDays: config.total_days,
          department: config.department
        }
      })
    }

    if (action === 'config') {
      // Get or create config for department
      const config = await getOrCreateConfig(department)
      return NextResponse.json({ success: true, config })
    }

    if (action === 'history') {
      // Get history of day order changes
      const limit = parseInt(searchParams.get('limit') || '30')
      
      const { data: history, error } = await supabase
        .from('day_order_settings')
        .select(`
          *,
          users:changed_by_admin_id (name, email)
        `)
        .eq('department', department)
        .order('effective_date', { ascending: false })
        .limit(limit)
      
      if (error) {
        console.error('Error fetching history:', error)
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
      }
      
      return NextResponse.json({ success: true, history })
    }

    if (action === 'upcoming') {
      // Get upcoming day order schedule (next 7 days)
      const config = await getOrCreateConfig(department)
      const today = new Date()
      const upcoming = []
      
      // Get current day order
      const { data: currentData } = await supabase
        .from('day_order_settings')
        .select('*')
        .eq('department', department)
        .lte('effective_date', today.toISOString().split('T')[0])
        .eq('is_holiday', false)
        .order('effective_date', { ascending: false })
        .limit(1)
        .single()
      
      let baseDayOrder = currentData?.day_order || config.current_day_order
      const baseDate = currentData ? new Date(currentData.effective_date) : new Date(config.last_updated_date)
      
      for (let i = 0; i < 7; i++) {
        const date = new Date(today)
        date.setDate(today.getDate() + i)
        const dateStr = date.toISOString().split('T')[0]
        
        // Check if it's Sunday (0 = Sunday)
        const isSunday = date.getDay() === 0
        
        // Check if there's an explicit setting for this date
        const { data: explicitSetting } = await supabase
          .from('day_order_settings')
          .select('*')
          .eq('department', department)
          .eq('effective_date', dateStr)
          .single()
        
        if (explicitSetting) {
          upcoming.push({
            date: dateStr,
            dayOrder: explicitSetting.day_order,
            isHoliday: explicitSetting.is_holiday,
            holidayName: explicitSetting.holiday_name,
            isExplicit: true
          })
        } else if (isSunday) {
          // Automatically mark Sundays as holidays
          upcoming.push({
            date: dateStr,
            dayOrder: 0,
            isHoliday: true,
            holidayName: 'Sunday',
            isExplicit: false
          })
        } else {
          // Calculate day order
          const daysPassed = Math.floor((date.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24))
          const calculatedDay = ((baseDayOrder - 1 + daysPassed) % config.total_days) + 1
          upcoming.push({
            date: dateStr,
            dayOrder: calculatedDay,
            isHoliday: false,
            holidayName: null,
            isExplicit: false
          })
        }
      }
      
      return NextResponse.json({ success: true, upcoming, config })
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Day order GET error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Set day order for a specific date or update config
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, department = 'General', adminId } = body

    if (action === 'set_day_order') {
      // Set day order for a specific date
      const { dayOrder, effectiveDate, reason, isHoliday = false, holidayName } = body
      
      if (!dayOrder && !isHoliday) {
        return NextResponse.json({ success: false, error: 'Day order is required' }, { status: 400 })
      }
      
      if (!effectiveDate) {
        return NextResponse.json({ success: false, error: 'Effective date is required' }, { status: 400 })
      }

      // Check if setting already exists for this date
      const { data: existing } = await supabase
        .from('day_order_settings')
        .select('id')
        .eq('department', department)
        .eq('effective_date', effectiveDate)
        .single()

      if (existing) {
        // Update existing setting
        const { data, error } = await supabase
          .from('day_order_settings')
          .update({
            day_order: isHoliday ? null : dayOrder,
            is_holiday: isHoliday,
            holiday_name: isHoliday ? holidayName : null,
            reason,
            changed_by_admin_id: adminId
          })
          .eq('id', existing.id)
          .select()
          .single()
        
        if (error) {
          console.error('Error updating day order:', error)
          return NextResponse.json({ success: false, error: error.message }, { status: 500 })
        }
        
        return NextResponse.json({ 
          success: true, 
          message: 'Day order updated successfully',
          setting: data
        })
      } else {
        // Create new setting
        const { data, error } = await supabase
          .from('day_order_settings')
          .insert({
            department,
            day_order: isHoliday ? null : dayOrder,
            effective_date: effectiveDate,
            is_holiday: isHoliday,
            holiday_name: isHoliday ? holidayName : null,
            reason,
            changed_by_admin_id: adminId
          })
          .select()
          .single()
        
        if (error) {
          console.error('Error creating day order setting:', error)
          return NextResponse.json({ success: false, error: error.message }, { status: 500 })
        }
        
        return NextResponse.json({ 
          success: true, 
          message: 'Day order set successfully',
          setting: data
        })
      }
    }

    if (action === 'update_config') {
      // Update configuration (total days in cycle)
      const { totalDays, currentDayOrder } = body
      
      if (!totalDays || totalDays < 1 || totalDays > 10) {
        return NextResponse.json({ success: false, error: 'Total days must be between 1 and 10' }, { status: 400 })
      }

      const { data: existing } = await supabase
        .from('day_order_config')
        .select('id')
        .eq('department', department)
        .single()

      if (existing) {
        const { data, error } = await supabase
          .from('day_order_config')
          .update({
            total_days: totalDays,
            current_day_order: currentDayOrder || 1,
            last_updated_date: new Date().toISOString().split('T')[0],
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
          .select()
          .single()
        
        if (error) {
          return NextResponse.json({ success: false, error: error.message }, { status: 500 })
        }
        
        return NextResponse.json({ success: true, message: 'Configuration updated', config: data })
      } else {
        const { data, error } = await supabase
          .from('day_order_config')
          .insert({
            department,
            total_days: totalDays,
            current_day_order: currentDayOrder || 1,
            last_updated_date: new Date().toISOString().split('T')[0]
          })
          .select()
          .single()
        
        if (error) {
          return NextResponse.json({ success: false, error: error.message }, { status: 500 })
        }
        
        return NextResponse.json({ success: true, message: 'Configuration created', config: data })
      }
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Day order POST error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Remove a day order setting
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { settingId, department = 'General' } = body

    if (!settingId) {
      return NextResponse.json({ success: false, error: 'Setting ID is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('day_order_settings')
      .delete()
      .eq('id', settingId)
      .eq('department', department)

    if (error) {
      console.error('Error deleting day order setting:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Day order setting deleted' })
  } catch (error) {
    console.error('Day order DELETE error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// Helper function to get or create config
async function getOrCreateConfig(department: string) {
  const { data: config, error } = await supabase
    .from('day_order_config')
    .select('*')
    .eq('department', department)
    .single()

  if (config) {
    return config
  }

  // Create default config
  const { data: newConfig, error: createError } = await supabase
    .from('day_order_config')
    .insert({
      department,
      total_days: 6,
      current_day_order: 1,
      last_updated_date: new Date().toISOString().split('T')[0]
    })
    .select()
    .single()

  if (createError) {
    console.error('Error creating config:', createError)
    throw createError
  }

  return newConfig
}
