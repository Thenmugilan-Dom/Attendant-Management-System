import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { email, studentId, sessionId, sessionCode, studentLatitude, studentLongitude } = await request.json()

    console.log('📥 Received request:', { email, studentId, sessionId, sessionCode, studentLatitude, studentLongitude })

    // Validate input - accept either email or studentId
    if ((!email && !studentId) || !sessionId || !sessionCode) {
      return NextResponse.json(
        { error: 'Email or Student ID, session ID, and session code are required' },
        { status: 400 }
      )
    }

    // If email provided, find or create student
    let finalStudentId = studentId
    
    if (email && !studentId) {
      console.log('📧 Finding/creating student for email:', email)
      const emailLower = email.toLowerCase()
      
      // STEP 1: Check if student exists in students table (admin-added students)
      console.log('🔍 Step 1: Checking students table (admin-added students)...')
      const { data: existingStudent } = await supabase
        .from('students')
        .select('*')
        .eq('email', emailLower)
        .maybeSingle()

      if (existingStudent) {
          console.log('✅ Student found in students table:', existingStudent.id)
        finalStudentId = existingStudent.id
      } else {
        // STEP 2: Student not in students table - need to create one
        console.log('⚠️ Student not found in students table')
        console.log('📝 Creating new student record for attendance...')
        
        // Check if user exists in users table first
        const { data: existingUser } = await supabase
          .from('users')
          .select('*')
          .eq('email', emailLower)
          .maybeSingle()

        let studentName = emailLower.split('@')[0] // Default name from email
        let userExists = false

        if (existingUser) {
          console.log('✅ User found in users table:', existingUser.id)
          studentName = existingUser.name
          userExists = true
        } else {
          console.log('⚠️ User not found in users table - will create both')
        }

        // Create student record WITHOUT class_id (will be assigned during attendance marking)
        const { data: newStudent, error: studentError } = await supabase
          .from('students')
          .insert({
            student_id: emailLower.split('@')[0], // Use email prefix as student_id
            name: studentName,
            email: emailLower,
            class_id: null, // Will be auto-assigned when marking attendance
            status: 'active'
          })
          .select()
          .maybeSingle()

        if (studentError) {
          console.error('❌ Error creating student record:', studentError.message)
          console.error('❌ Error code:', studentError.code)
          
          // If unique constraint violation, fetch existing student
          if (studentError.code === '23505') {
            console.log('⚠️ Student already exists, fetching...')
            const { data: fetchedStudent } = await supabase
              .from('students')
              .select('*')
              .eq('email', emailLower)
              .maybeSingle()
            
            if (fetchedStudent) {
              console.log('✅ Found existing student:', fetchedStudent.id)
              finalStudentId = fetchedStudent.id
            }
          }
        } else if (newStudent) {
          console.log('✅ Student record created:', newStudent.id)
          finalStudentId = newStudent.id

          // Also create user record if it doesn't exist (for login purposes)
          if (!userExists) {
            console.log('📝 Creating user record for login...')
            let role: 'admin' | 'teacher' | 'student' = 'student'

            // Determine role based on email
            if (emailLower.includes('admin') || emailLower.includes('principal')) {
              role = 'admin'
            } else if (
              emailLower.includes('teacher') ||
              emailLower.includes('faculty') ||
              emailLower.includes('staff')
            ) {
              role = 'teacher'
            }

            const { error: userError } = await supabase
              .from('users')
              .insert({
                email: emailLower,
                role: role,
                user_type: role,
                name: studentName,
                status: 'active'
              })

            if (userError && userError.code !== '23505') {
              console.error('⚠️ Error creating user record:', userError.message)
              // Don't fail - student record is more important for attendance
            } else {
              console.log('✅ User record also created')
            }
          }
        }
      }
    }

    // Final check - do we have a student ID?
    if (!finalStudentId) {
      console.error('❌ Failed to determine student ID after all attempts')
      return NextResponse.json(
        { error: 'Failed to create student record. Please contact your teacher.' },
        { status: 500 }
      )
    }

    console.log('✅ Final student ID:', finalStudentId)

    // Verify session exists and is active
    console.log('🔍 Verifying session...')
    const { data: session, error: sessionError } = await supabase
      .from('attendance_sessions')
      .select('*, classes(id, class_name, section, latitude, longitude, location_radius)')
      .eq('id', sessionId)
      .eq('session_code', sessionCode)
      .eq('status', 'active')
      .maybeSingle()

    if (sessionError || !session) {
      console.error('❌ Session error:', sessionError?.message)
      return NextResponse.json(
        { error: 'Invalid or inactive session' },
        { status: 400 }
      )
    }

    // Check geolocation if class has location restriction
    const classData = session.classes as any
    console.log('📍 Class location data:', { 
      hasClassData: !!classData,
      latitude: classData?.latitude, 
      longitude: classData?.longitude, 
      location_radius: classData?.location_radius,
      studentLat: studentLatitude,
      studentLng: studentLongitude
    })
    
    // Check if class has location requirement (using explicit null check to handle 0 coordinates)
    const hasLocationRestriction = classData?.latitude !== null && 
                                    classData?.latitude !== undefined && 
                                    classData?.longitude !== null && 
                                    classData?.longitude !== undefined
    
    if (hasLocationRestriction) {
      console.log('📍 Class has location restriction - verifying student location')
      
      // Validate student location data
      const hasStudentLocation = studentLatitude !== null && 
                                  studentLatitude !== undefined && 
                                  studentLongitude !== null && 
                                  studentLongitude !== undefined &&
                                  !isNaN(Number(studentLatitude)) && 
                                  !isNaN(Number(studentLongitude))
      
      if (!hasStudentLocation) {
        console.log('❌ Student location not provided or invalid:', { studentLatitude, studentLongitude })
        return NextResponse.json(
          { error: 'Location verification required. Please enable location access and try again.' },
          { status: 403 }
        )
      }

      // Parse values to ensure they're numbers
      const classLat = Number(classData.latitude)
      const classLng = Number(classData.longitude)
      const studLat = Number(studentLatitude)
      const studLng = Number(studentLongitude)

      // Calculate distance using Haversine formula
      const R = 6371e3 // Earth's radius in meters
      const φ1 = classLat * Math.PI / 180
      const φ2 = studLat * Math.PI / 180
      const Δφ = (studLat - classLat) * Math.PI / 180
      const Δλ = (studLng - classLng) * Math.PI / 180

      const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      const distance = R * c // Distance in meters

      const allowedRadius = classData.location_radius || 100
      console.log(`📍 Location check: Student(${studLat.toFixed(6)}, ${studLng.toFixed(6)}) Class(${classLat.toFixed(6)}, ${classLng.toFixed(6)})`)
      console.log(`📍 Distance from class: ${distance.toFixed(2)}m (allowed: ${allowedRadius}m)`)

      if (distance > allowedRadius) {
        console.log(`❌ Student is too far from class location (${distance.toFixed(2)}m > ${allowedRadius}m)`)
        return NextResponse.json(
          { 
            error: `You are ${Math.round(distance)}m away from the classroom. You must be within ${allowedRadius}m to mark attendance.`,
            distance: Math.round(distance),
            allowed_radius: allowedRadius
          },
          { status: 403 }
        )
      }

      console.log('✅ Location verification passed')
    } else {
      console.log('📍 Class has no location restriction - skipping location check')
    }

    // Verify student belongs to the session's class
    console.log('🔍 Verifying student class membership...')
    const { data: studentData, error: studentError } = await supabase
      .from('students')
      .select('id, class_id, name, classes(id, class_name, section)')
      .eq('id', finalStudentId)
      .single()

    if (studentError || !studentData) {
      console.error('❌ Student not found:', studentError?.message)
      return NextResponse.json(
        { error: 'Student record not found' },
        { status: 404 }
      )
    }

    // Check if student has a class assigned
    if (studentData.class_id === null) {
      // Student has no class - auto-assign them to the session's class
      console.log(`⚠️ Student has no class assigned - auto-assigning to session class ${session.class_id}`)
      
      const { error: updateError } = await supabase
        .from('students')
        .update({ class_id: session.class_id })
        .eq('id', finalStudentId)
      
      if (updateError) {
        console.error('❌ Error auto-assigning class:', updateError.message)
      } else {
        console.log(`✅ Student auto-assigned to class ${session.class_id}`)
      }
      
      // Continue with attendance marking (class is now assigned)
    } else if (studentData.class_id !== session.class_id) {
      // Student has a different class - block them
      console.log(`❌ Class mismatch: Student class ${studentData.class_id} != Session class ${session.class_id}`)
      const studentClass = studentData.classes ? `${(studentData.classes as any).class_name} ${(studentData.classes as any).section}` : 'Unknown'
      const sessionClass = session.classes ? `${(session.classes as any).class_name} ${(session.classes as any).section}` : 'Unknown'
      
      return NextResponse.json(
        { 
          error: `You cannot mark attendance for this session. This session is for ${sessionClass} but you belong to ${studentClass}.`,
          student_class: studentClass,
          session_class: sessionClass
        },
        { status: 403 } // 403 Forbidden
      )
    } else {
      // Student belongs to the correct class
      console.log(`✅ Class verification passed: ${(studentData.classes as any)?.class_name} ${(studentData.classes as any)?.section}`)
    }

    // Check if session has expired (time-based validation)
    const now = new Date()
    const expiresAt = new Date(session.expires_at)
    
    if (now > expiresAt) {
      console.log(`❌ Session ${session.id} has expired - cannot mark attendance`)
      
      // Auto-update status to expired
      await supabase
        .from('attendance_sessions')
        .update({ status: 'expired' })
        .eq('id', session.id)
      
      return NextResponse.json(
        { error: 'Session has expired. You cannot mark attendance for expired sessions.' },
        { status: 410 } // 410 Gone
      )
    }
    
    const remainingSeconds = Math.floor((expiresAt.getTime() - now.getTime()) / 1000)
    console.log(`✅ Session ${session.id} is valid - ${remainingSeconds} seconds remaining`)

    // Check if student already marked attendance for this session
    console.log('🔍 Checking for duplicate attendance...')
    const { data: existingAttendance } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('student_id', finalStudentId)
      .eq('session_id', sessionId)
      .maybeSingle()

    if (existingAttendance) {
      console.log('⚠️ Attendance already marked for this student')
      return NextResponse.json(
        { error: 'Attendance already marked for this session' },
        { status: 400 }
      )
    }

    // Mark attendance
    console.log('✅ Marking attendance for student:', finalStudentId)
    const { data: attendance, error: attendanceError } = await supabase
      .from('attendance_records')
      .insert({
        student_id: finalStudentId,
        session_id: sessionId,
        status: 'present',
        marked_at: new Date().toISOString(),
        otp_verified: true,
      })
      .select()
      .single()

    if (attendanceError) {
      console.error('❌ Error marking attendance:', attendanceError.message)
      return NextResponse.json(
        { error: 'Failed to mark attendance: ' + attendanceError.message },
        { status: 500 }
      )
    }

    console.log('🎉 Attendance marked successfully!')
    return NextResponse.json({
      success: true,
      message: 'Attendance marked successfully',
      attendance,
    })
  } catch (error) {
    console.error('❌ Error in mark attendance:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
