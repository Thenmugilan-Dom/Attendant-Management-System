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

// GET - Fetch notifications for a student
export async function GET(request: NextRequest) {
  try {
    const studentId = request.nextUrl.searchParams.get('studentId')
    const classId = request.nextUrl.searchParams.get('classId')
    const unreadOnly = request.nextUrl.searchParams.get('unreadOnly') === 'true'
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50')

    if (!studentId) {
      return NextResponse.json(
        { error: 'studentId is required' },
        { status: 400 }
      )
    }

    // Build query for individual + broadcast notifications
    let query = supabaseAdmin
      .from('student_notifications')
      .select(`
        *,
        users:created_by (name, email)
      `)
      .or(`student_id.eq.${studentId},and(is_broadcast.eq.true,class_id.eq.${classId})`)
      .order('created_at', { ascending: false })
      .limit(limit)

    // Filter by unread if requested
    if (unreadOnly) {
      query = query.eq('is_read', false)
    }

    // Exclude expired notifications
    query = query.or('expires_at.is.null,expires_at.gt.now()')

    const { data, error } = await query

    if (error) {
      console.error('Error fetching notifications:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    // Count unread notifications
    const unreadCount = (data || []).filter(n => !n.is_read).length

    return NextResponse.json({
      success: true,
      notifications: data || [],
      unreadCount,
    })
  } catch (error) {
    console.error('Notifications GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create a new notification
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      studentId, 
      classId, 
      title, 
      message, 
      type = 'info',
      priority = 'normal',
      isBroadcast = false,
      createdBy,
      expiresAt
    } = body

    if (!title || !message) {
      return NextResponse.json(
        { error: 'Title and message are required' },
        { status: 400 }
      )
    }

    if (!isBroadcast && !studentId) {
      return NextResponse.json(
        { error: 'studentId is required for non-broadcast notifications' },
        { status: 400 }
      )
    }

    if (isBroadcast && !classId) {
      return NextResponse.json(
        { error: 'classId is required for broadcast notifications' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('student_notifications')
      .insert({
        student_id: isBroadcast ? null : studentId,
        class_id: classId || null,
        title,
        message,
        type,
        priority,
        is_broadcast: isBroadcast,
        created_by: createdBy || null,
        expires_at: expiresAt || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating notification:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Notification created successfully',
      notification: data,
    })
  } catch (error) {
    console.error('Notifications POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Mark notification as read
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { notificationId, studentId, markAllRead = false } = body

    if (!studentId) {
      return NextResponse.json(
        { error: 'studentId is required' },
        { status: 400 }
      )
    }

    if (markAllRead) {
      // Mark all notifications as read for this student
      const { error } = await supabaseAdmin
        .from('student_notifications')
        .update({ 
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq('student_id', studentId)
        .eq('is_read', false)

      if (error) {
        console.error('Error marking all as read:', error)
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'All notifications marked as read',
      })
    }

    if (!notificationId) {
      return NextResponse.json(
        { error: 'notificationId is required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('student_notifications')
      .update({ 
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('id', notificationId)
      .select()
      .single()

    if (error) {
      console.error('Error marking notification as read:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Notification marked as read',
      notification: data,
    })
  } catch (error) {
    console.error('Notifications PUT error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a notification
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { notificationId } = body

    if (!notificationId) {
      return NextResponse.json(
        { error: 'notificationId is required' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('student_notifications')
      .delete()
      .eq('id', notificationId)

    if (error) {
      console.error('Error deleting notification:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Notification deleted successfully',
    })
  } catch (error) {
    console.error('Notifications DELETE error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
