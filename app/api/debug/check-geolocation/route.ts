import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Debug endpoint to check geolocation data in classes and sessions
export async function GET(request: NextRequest) {
  try {
    const className = request.nextUrl.searchParams.get('className')
    const sessionCode = request.nextUrl.searchParams.get('sessionCode')
    
    const result: any = {}
    
    // Get all classes with location data
    const { data: classes, error: classError } = await supabase
      .from('classes')
      .select('id, class_name, section, latitude, longitude, location_radius')
      .order('class_name')
    
    if (classError) {
      result.classError = classError.message
    } else {
      result.classes = classes?.map(c => ({
        id: c.id,
        name: `${c.class_name} ${c.section || ''}`.trim(),
        latitude: c.latitude,
        longitude: c.longitude,
        location_radius: c.location_radius,
        hasLocation: c.latitude !== null && c.longitude !== null
      }))
      
      // Filter for classes with location set
      result.classesWithLocation = result.classes?.filter((c: any) => c.hasLocation)
    }
    
    // If sessionCode provided, check that specific session
    if (sessionCode) {
      // Find session regardless of status
      const { data: session, error: sessionError } = await supabase
        .from('attendance_sessions')
        .select(`
          id,
          session_code,
          status,
          class_id,
          classes (
            id,
            class_name,
            section,
            latitude,
            longitude,
            location_radius
          )
        `)
        .eq('session_code', sessionCode.toUpperCase())
        .maybeSingle()
      
      if (sessionError) {
        result.sessionError = sessionError.message
      } else {
        const classInfo = session?.classes as any
        result.session = {
          id: session?.id,
          session_code: session?.session_code,
          status: session?.status,
          class_id: session?.class_id,
          class_name: classInfo?.class_name,
          class_section: classInfo?.section,
          class_latitude: classInfo?.latitude,
          class_longitude: classInfo?.longitude,
          class_location_radius: classInfo?.location_radius,
          hasLocationRestriction: classInfo?.latitude !== null && classInfo?.longitude !== null
        }
      }
    }
    
    // If className provided, search for that class
    if (className) {
      const { data: classData, error: classSearchError } = await supabase
        .from('classes')
        .select('*')
        .ilike('class_name', `%${className}%`)
      
      if (classSearchError) {
        result.classSearchError = classSearchError.message
      } else {
        result.matchingClasses = classData
      }
    }
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result
    })
  } catch (error) {
    console.error('Debug geolocation error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    )
  }
}
