import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface AttendanceRecord {
  students: {
    student_id: string
    name: string
    email: string
    classes?: {
      class_name: string
      section: string
      year: number
    }
  }
  status: string
  marked_at: string
  otp_verified: boolean
}

interface SessionInfo {
  session_code: string
  session_date: string
  teacher: {
    name: string
    department: string
  }
  class: {
    class_name: string
    section: string
    year: number
  }
  subject: {
    subject_name: string
    subject_code: string
    credits: number
    semester: number
  }
}

interface Statistics {
  total_records: number
  total_present: number
  total_absent: number
  attendance_percentage: string
}

export function generatePDF(
  session: SessionInfo,
  records: AttendanceRecord[],
  statistics: Statistics
) {
  const doc = new jsPDF()

  // Header
  doc.setFillColor(59, 130, 246) // Blue background
  doc.rect(0, 0, 210, 40, 'F')
  
  doc.setTextColor(255, 255, 255) // White text
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text('KPRCAS Attendance Report', 105, 15, { align: 'center' })
  
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text('Attendance Management System', 105, 25, { align: 'center' })
  
  // Session Information
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Session Details', 14, 50)
  
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  let yPos = 58
  
  // Session details table
  const sessionDetails = [
    ['Session Code:', session.session_code],
    ['Date:', new Date(session.session_date).toLocaleDateString('en-IN', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    })],
    ['Subject:', `${session.subject.subject_name} (${session.subject.subject_code})`],
    ['Credits:', session.subject.credits?.toString() || 'N/A'],
    ['Semester:', session.subject.semester?.toString() || 'N/A'],
    ['Class:', `${session.class.class_name} ${session.class.section || ''} - Year ${session.class.year || 'N/A'}`],
    ['Teacher:', session.teacher.name],
    ['Department:', session.teacher.department || 'N/A'],
  ]

  autoTable(doc, {
    startY: yPos,
    head: [],
    body: sessionDetails,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 40 },
      1: { cellWidth: 140 }
    },
    margin: { left: 14 },
  })

  // Statistics
  yPos = (doc as any).lastAutoTable.finalY + 10
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Attendance Statistics', 14, yPos)
  
  yPos += 8
  const statsData = [
    ['Total Students', statistics.total_records.toString()],
    ['Present', statistics.total_present.toString()],
    ['Absent', statistics.total_absent.toString()],
    ['Attendance %', `${statistics.attendance_percentage}%`],
  ]

  autoTable(doc, {
    startY: yPos,
    head: [],
    body: statsData,
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 3, halign: 'center' },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [241, 245, 249] },
      1: { fontStyle: 'bold' }
    },
    margin: { left: 14, right: 14 },
  })

  // Attendance Records
  yPos = (doc as any).lastAutoTable.finalY + 10
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Attendance Records', 14, yPos)

  // Prepare table data
  const tableData = records.map((record, index) => {
    const student = record.students
    const time = new Date(record.marked_at).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
    
    return [
      (index + 1).toString(),
      student.student_id || 'N/A',
      student.name || 'Unknown',
      student.email || 'N/A',
      record.status === 'present' ? '✓ Present' : '✗ Absent',
      time,
    ]
  })

  autoTable(doc, {
    startY: yPos + 5,
    head: [['#', 'Student ID', 'Name', 'Email', 'Status', 'Time']],
    body: tableData,
    theme: 'striped',
    headStyles: { 
      fillColor: [59, 130, 246],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center'
    },
    styles: { 
      fontSize: 9, 
      cellPadding: 3,
      overflow: 'linebreak'
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 25, halign: 'center' },
      2: { cellWidth: 40 },
      3: { cellWidth: 50 },
      4: { cellWidth: 25, halign: 'center' },
      5: { cellWidth: 25, halign: 'center' },
    },
    margin: { left: 14, right: 14 },
  })

  // Footer
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(100)
    doc.text(
      `Generated on ${new Date().toLocaleString('en-IN')}`,
      14,
      doc.internal.pageSize.height - 10
    )
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.width - 30,
      doc.internal.pageSize.height - 10
    )
  }

  // Save PDF
  const fileName = `Attendance_${session.session_code}_${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(fileName)
}

export function generateCSV(
  session: SessionInfo,
  records: AttendanceRecord[],
  statistics: Statistics
) {
  // CSV Header with session info
  let csv = 'KPRCAS Attendance Report\n\n'
  csv += 'Session Information\n'
  csv += `Session Code,${session.session_code}\n`
  csv += `Date,${new Date(session.session_date).toLocaleDateString('en-IN')}\n`
  csv += `Subject,"${session.subject.subject_name} (${session.subject.subject_code})"\n`
  csv += `Credits,${session.subject.credits || 'N/A'}\n`
  csv += `Semester,${session.subject.semester || 'N/A'}\n`
  csv += `Class,"${session.class.class_name} ${session.class.section || ''} - Year ${session.class.year || 'N/A'}"\n`
  csv += `Teacher,${session.teacher.name}\n`
  csv += `Department,${session.teacher.department || 'N/A'}\n\n`

  // Statistics
  csv += 'Attendance Statistics\n'
  csv += `Total Students,${statistics.total_records}\n`
  csv += `Present,${statistics.total_present}\n`
  csv += `Absent,${statistics.total_absent}\n`
  csv += `Attendance Percentage,${statistics.attendance_percentage}%\n\n`

  // Attendance Records
  csv += 'Attendance Records\n'
  csv += 'S.No,Student ID,Name,Email,Status,Time Marked\n'

  records.forEach((record, index) => {
    const student = record.students
    const time = new Date(record.marked_at).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
    
    csv += `${index + 1},`
    csv += `${student.student_id || 'N/A'},`
    csv += `"${student.name || 'Unknown'}",`
    csv += `${student.email || 'N/A'},`
    csv += `${record.status === 'present' ? 'Present' : 'Absent'},`
    csv += `${time}\n`
  })

  // Download CSV
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  
  link.setAttribute('href', url)
  link.setAttribute('download', `Attendance_${session.session_code}_${new Date().toISOString().split('T')[0]}.csv`)
  link.style.visibility = 'hidden'
  
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// ============================================================================
// COMPREHENSIVE REPORT GENERATORS (Multiple Sessions)
// ============================================================================

interface ComprehensiveReportData {
  sessions: Array<{
    session_id: string
    session_code: string
    session_date: string
    class: { class_name: string; section: string; year: number }
    subject: { subject_name: string; subject_code: string }
    statistics: {
      total_students: number
      present: number
      absent: number
      attendance_percentage: string
    }
    records: Array<{
      students: { student_id: string; name: string; email: string }
      status: string
      marked_at: string | null
    }>
  }>
  summary: {
    total_sessions: number
    total_students: number
    total_present: number
    total_absent: number
    average_attendance: string
  }
  filters: {
    classId?: string
    subjectId?: string
    startDate?: string
    endDate?: string
  }
}

export function generateComprehensivePDF(data: ComprehensiveReportData, teacherName: string) {
  const doc = new jsPDF()
  let yPos = 10

  // Header
  doc.setFillColor(59, 130, 246)
  doc.rect(0, 0, 210, 45, 'F')
  
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(24)
  doc.setFont('helvetica', 'bold')
  doc.text('KPRCAS', 105, 15, { align: 'center' })
  
  doc.setFontSize(18)
  doc.text('Comprehensive Attendance Report', 105, 25, { align: 'center' })
  
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text(`Teacher: ${teacherName}`, 105, 35, { align: 'center' })

  yPos = 55

  // Report Info
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(10)
  doc.text(`Generated on: ${new Date().toLocaleString('en-IN')}`, 14, yPos)
  yPos += 6
  
  if (data.filters.startDate || data.filters.endDate) {
    const dateRange = `Period: ${data.filters.startDate || 'Start'} to ${data.filters.endDate || 'End'}`
    doc.text(dateRange, 14, yPos)
    yPos += 6
  }

  yPos += 5

  // Overall Summary Section
  doc.setFillColor(240, 240, 240)
  doc.rect(14, yPos, 182, 8, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Overall Summary', 16, yPos + 5.5)
  yPos += 12

  const summaryData = [
    ['Total Sessions', data.summary.total_sessions.toString()],
    ['Total Students Enrolled', data.summary.total_students.toString()],
    ['Total Present', data.summary.total_present.toString()],
    ['Total Absent', data.summary.total_absent.toString()],
    ['Average Attendance', `${data.summary.average_attendance}%`]
  ]

  autoTable(doc, {
    startY: yPos,
    head: [['Metric', 'Value']],
    body: summaryData,
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246], fontSize: 10, fontStyle: 'bold' },
    styles: { fontSize: 10, cellPadding: 4 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 100 },
      1: { halign: 'center', cellWidth: 82 }
    }
  })

  yPos = (doc as any).lastAutoTable.finalY + 15

  // Session-wise Breakdown
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Session-wise Breakdown', 14, yPos)
  yPos += 8

  const sessionTableData = data.sessions.map((session, index) => [
    (index + 1).toString(),
    new Date(session.session_date).toLocaleDateString('en-IN'),
    session.session_code,
    `${session.class.class_name} ${session.class.section}`,
    session.subject.subject_name,
    session.statistics.total_students.toString(),
    session.statistics.present.toString(),
    session.statistics.absent.toString(),
    `${session.statistics.attendance_percentage}%`
  ])

  autoTable(doc, {
    startY: yPos,
    head: [['#', 'Date', 'Code', 'Class', 'Subject', 'Total', 'Present', 'Absent', '%']],
    body: sessionTableData,
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246], fontSize: 9, fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 25 },
      2: { cellWidth: 22 },
      3: { cellWidth: 30 },
      4: { cellWidth: 35 },
      5: { cellWidth: 15, halign: 'center' },
      6: { cellWidth: 18, halign: 'center' },
      7: { cellWidth: 18, halign: 'center' },
      8: { cellWidth: 15, halign: 'center' }
    },
    didDrawPage: (data) => {
      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages()
      doc.setFontSize(8)
      doc.setTextColor(100)
      doc.text(
        `Page ${(doc as any).internal.getCurrentPageInfo().pageNumber} of ${pageCount}`,
        105,
        doc.internal.pageSize.height - 10,
        { align: 'center' }
      )
    }
  })

  // Save PDF
  const fileName = `Comprehensive_Report_${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(fileName)
}

export function generateComprehensiveCSV(data: ComprehensiveReportData, teacherName: string) {
  let csv = 'KPRCAS Comprehensive Attendance Report\n\n'
  
  csv += `Teacher,${teacherName}\n`
  csv += `Generated On,${new Date().toLocaleString('en-IN')}\n`
  
  if (data.filters.startDate || data.filters.endDate) {
    csv += `Period,${data.filters.startDate || 'Start'} to ${data.filters.endDate || 'End'}\n`
  }
  
  csv += '\n'
  csv += 'OVERALL SUMMARY\n'
  csv += 'Metric,Value\n'
  csv += `Total Sessions,${data.summary.total_sessions}\n`
  csv += `Total Students,${data.summary.total_students}\n`
  csv += `Total Present,${data.summary.total_present}\n`
  csv += `Total Absent,${data.summary.total_absent}\n`
  csv += `Average Attendance,${data.summary.average_attendance}%\n`
  
  csv += '\n'
  csv += 'SESSION-WISE BREAKDOWN\n'
  csv += 'S.No,Date,Session Code,Class,Subject,Total Students,Present,Absent,Attendance %\n'
  
  data.sessions.forEach((session, index) => {
    csv += `${index + 1},`
    csv += `${new Date(session.session_date).toLocaleDateString('en-IN')},`
    csv += `${session.session_code},`
    csv += `"${session.class.class_name} ${session.class.section}",`
    csv += `"${session.subject.subject_name}",`
    csv += `${session.statistics.total_students},`
    csv += `${session.statistics.present},`
    csv += `${session.statistics.absent},`
    csv += `${session.statistics.attendance_percentage}%\n`
  })
  
  // Detailed student-wise data for each session
  csv += '\n\n'
  csv += 'DETAILED ATTENDANCE RECORDS\n\n'
  
  data.sessions.forEach((session, sessionIndex) => {
    csv += `\nSession ${sessionIndex + 1}: ${session.session_code} - ${session.class.class_name} ${session.class.section} - ${session.subject.subject_name}\n`
    csv += `Date: ${new Date(session.session_date).toLocaleDateString('en-IN')}\n`
    csv += 'S.No,Student ID,Name,Email,Status,Time\n'
    
    session.records.forEach((record, index) => {
      const time = record.marked_at 
        ? new Date(record.marked_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
        : '-'
      
      csv += `${index + 1},`
      csv += `${record.students.student_id},`
      csv += `"${record.students.name}",`
      csv += `${record.students.email},`
      csv += `${record.status === 'present' ? 'Present' : 'Absent'},`
      csv += `${time}\n`
    })
  })

  // Download CSV
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  
  link.setAttribute('href', url)
  link.setAttribute('download', `Comprehensive_Report_${new Date().toISOString().split('T')[0]}.csv`)
  link.style.visibility = 'hidden'
  
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// ============================================================================
// DATE-WISE REPORT GENERATORS (Admin Reports)
// ============================================================================

interface DateWiseReportData {
  dateRange: { startDate: string; endDate: string }
  summary: {
    total_sessions: number
    total_students: number
    total_present: number
    total_absent: number
    average_attendance: string
  }
  sessions: Array<{
    session_id: string
    session_code: string
    session_date: string
    teacher: { name: string; department: string }
    class: { class_name: string; section: string; year: number }
    subject: { subject_name: string; subject_code: string }
    statistics: {
      total_students: number
      present: number
      absent: number
      attendance_percentage: string
    }
    records: Array<{
      student_info: {
        student_id: string
        name: string
        email: string
        phone?: string
        address?: string
      }
      status: string
      marked_at: string | null
    }>
  }>
  student_wise: Array<{
    student_id: string
    name: string
    email: string
    phone?: string
    total_sessions: number
    present_count: number
    absent_count: number
    attendance_percentage: string
  }>
}

export function generateDateWisePDF(data: DateWiseReportData) {
  const doc = new jsPDF()
  let yPos = 10

  // Header
  doc.setFillColor(59, 130, 246)
  doc.rect(0, 0, 210, 40, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(24)
  doc.setFont('helvetica', 'bold')
  doc.text('KPRCAS', 105, 15, { align: 'center' })

  doc.setFontSize(18)
  doc.text('Date-wise Attendance Report', 105, 25, { align: 'center' })

  yPos = 55

  // Report Period
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(10)
  doc.text(
    `Period: ${data.dateRange.startDate} to ${data.dateRange.endDate}`,
    14,
    yPos
  )
  doc.text(`Generated on: ${new Date().toLocaleString('en-IN')}`, 14, yPos + 6)

  yPos += 15

  // Overall Summary Section
  doc.setFillColor(240, 240, 240)
  doc.rect(14, yPos, 182, 8, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Overall Summary', 16, yPos + 5.5)
  yPos += 12

  const summaryData = [
    ['Total Sessions', data.summary.total_sessions.toString()],
    ['Total Student Records', data.summary.total_students.toString()],
    ['Total Present', data.summary.total_present.toString()],
    ['Total Absent', data.summary.total_absent.toString()],
    ['Average Attendance', `${data.summary.average_attendance}%`]
  ]

  autoTable(doc, {
    startY: yPos,
    head: [['Metric', 'Value']],
    body: summaryData,
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246], fontSize: 10, fontStyle: 'bold' },
    styles: { fontSize: 10, cellPadding: 4 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 100 },
      1: { halign: 'center', cellWidth: 82 }
    }
  })

  yPos = (doc as any).lastAutoTable.finalY + 15

  // Session-wise Breakdown
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Session-wise Breakdown', 14, yPos)
  yPos += 8

  const sessionTableData = data.sessions.map((session, index) => [
    (index + 1).toString(),
    new Date(session.session_date).toLocaleDateString('en-IN'),
    session.session_code,
    `${session.class.class_name} ${session.class.section}`,
    session.subject.subject_name,
    session.statistics.total_students.toString(),
    session.statistics.present.toString(),
    session.statistics.absent.toString(),
    `${session.statistics.attendance_percentage}%`
  ])

  autoTable(doc, {
    startY: yPos,
    head: [['#', 'Date', 'Code', 'Class', 'Subject', 'Total', 'Present', 'Absent', '%']],
    body: sessionTableData,
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246], fontSize: 9, fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 22 },
      2: { cellWidth: 22 },
      3: { cellWidth: 30 },
      4: { cellWidth: 35 },
      5: { cellWidth: 15, halign: 'center' },
      6: { cellWidth: 15, halign: 'center' },
      7: { cellWidth: 15, halign: 'center' },
      8: { cellWidth: 12, halign: 'center' }
    },
    pageBreak: 'auto'
  })

  yPos = (doc as any).lastAutoTable.finalY + 15

  // Student-wise Summary
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Student-wise Summary', 14, yPos)
  yPos += 8

  const studentTableData = data.student_wise.map((student, index) => [
    (index + 1).toString(),
    student.student_id,
    student.name,
    student.email,
    student.total_sessions.toString(),
    student.present_count.toString(),
    student.absent_count.toString(),
    `${student.attendance_percentage}%`
  ])

  autoTable(doc, {
    startY: yPos,
    head: [['#', 'Student ID', 'Name', 'Email', 'Sessions', 'Present', 'Absent', '%']],
    body: studentTableData,
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246], fontSize: 9, fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 35 },
      3: { cellWidth: 45 },
      4: { cellWidth: 15, halign: 'center' },
      5: { cellWidth: 15, halign: 'center' },
      6: { cellWidth: 15, halign: 'center' },
      7: { cellWidth: 12, halign: 'center' }
    },
    pageBreak: 'auto',
    didDrawPage: (data) => {
      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages()
      const currentPage = (doc as any).internal.getCurrentPageInfo().pageNumber
      doc.setFontSize(8)
      doc.setTextColor(100)
      doc.text(
        `Page ${currentPage} of ${pageCount}`,
        105,
        doc.internal.pageSize.height - 10,
        { align: 'center' }
      )
    }
  })

  // Save PDF
  const fileName = `DateWise_Report_${data.dateRange.startDate}_to_${data.dateRange.endDate}.pdf`
  doc.save(fileName)
}

export function generateDateWiseCSV(data: DateWiseReportData) {
  let csv = 'KPRCAS Date-wise Attendance Report\n\n'

  csv += `Period,${data.dateRange.startDate} to ${data.dateRange.endDate}\n`
  csv += `Generated On,${new Date().toLocaleString('en-IN')}\n\n`

  csv += 'OVERALL SUMMARY\n'
  csv += 'Metric,Value\n'
  csv += `Total Sessions,${data.summary.total_sessions}\n`
  csv += `Total Student Records,${data.summary.total_students}\n`
  csv += `Total Present,${data.summary.total_present}\n`
  csv += `Total Absent,${data.summary.total_absent}\n`
  csv += `Average Attendance,${data.summary.average_attendance}%\n\n`

  csv += 'SESSION-WISE BREAKDOWN\n'
  csv += 'S.No,Date,Session Code,Class,Subject,Teacher,Total Students,Present,Absent,Attendance %\n'

  data.sessions.forEach((session, index) => {
    csv += `${index + 1},`
    csv += `${new Date(session.session_date).toLocaleDateString('en-IN')},`
    csv += `${session.session_code},`
    csv += `"${session.class.class_name} ${session.class.section}",`
    csv += `"${session.subject.subject_name}",`
    csv += `"${session.teacher.name}",`
    csv += `${session.statistics.total_students},`
    csv += `${session.statistics.present},`
    csv += `${session.statistics.absent},`
    csv += `${session.statistics.attendance_percentage}%\n`
  })

  csv += '\nSTUDENT-WISE SUMMARY\n'
  csv += 'S.No,Student ID,Name,Email,Phone,Total Sessions,Present,Absent,Attendance %\n'

  data.student_wise.forEach((student, index) => {
    csv += `${index + 1},`
    csv += `${student.student_id},`
    csv += `"${student.name}",`
    csv += `${student.email},`
    csv += `"${student.phone || 'N/A'}",`
    csv += `${student.total_sessions},`
    csv += `${student.present_count},`
    csv += `${student.absent_count},`
    csv += `${student.attendance_percentage}%\n`
  })

  // Detailed records for each session
  csv += '\n\nDETAILED SESSION RECORDS\n\n'

  data.sessions.forEach((session, sessionIndex) => {
    csv += `Session ${sessionIndex + 1}: ${session.session_code}\n`
    csv += `Date: ${new Date(session.session_date).toLocaleDateString('en-IN')}\n`
    csv += `Class: ${session.class.class_name} ${session.class.section}\n`
    csv += `Subject: ${session.subject.subject_name}\n`
    csv += `Teacher: ${session.teacher.name}\n`
    csv += `Department: ${session.teacher.department}\n`
    csv += `Attendance: ${session.statistics.present}/${session.statistics.total_students} (${session.statistics.attendance_percentage}%)\n\n`
    csv += 'S.No,Student ID,Name,Email,Status,Time Marked\n'

    session.records.forEach((record, index) => {
      const time = record.marked_at
        ? new Date(record.marked_at).toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          })
        : '-'

      csv += `${index + 1},`
      csv += `${record.student_info.student_id},`
      csv += `"${record.student_info.name}",`
      csv += `${record.student_info.email},`
      csv += `${record.status === 'present' ? 'Present' : 'Absent'},`
      csv += `${time}\n`
    })

    csv += '\n'
  })

  // Download CSV
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.setAttribute('href', url)
  link.setAttribute(
    'download',
    `DateWise_Report_${data.dateRange.startDate}_to_${data.dateRange.endDate}.csv`
  )
  link.style.visibility = 'hidden'

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// ============================================================================
// MATRIX-STYLE REPORT GENERATORS (Student rows x Date columns)
// ============================================================================

interface MatrixReportData {
  sessions: Array<{
    session_id: string
    session_code: string
    session_date: string
    session_time?: string
    class: { class_name: string; section: string }
    subject: { subject_name: string; subject_code: string }
    records: Array<{
      student_id: string
      student_info: { student_id: string; name: string; email: string }
      status: string
      marked_at: string | null
    }>
  }>
  className: string
  subjectName: string
  teacherName: string
  dateRange: { startDate: string; endDate: string }
}

export function generateMatrixCSV(data: MatrixReportData) {
  // Collect all unique students across all sessions
  const studentMap = new Map<string, { student_id: string; name: string; email: string }>()
  
  data.sessions.forEach(session => {
    session.records.forEach(record => {
      if (!studentMap.has(record.student_id)) {
        studentMap.set(record.student_id, record.student_info)
      }
    })
  })

  const students = Array.from(studentMap.values()).sort((a, b) => 
    a.student_id.localeCompare(b.student_id)
  )

  // Sort sessions by date
  const sortedSessions = [...data.sessions].sort((a, b) => 
    new Date(a.session_date).getTime() - new Date(b.session_date).getTime()
  )

  // Build header row: S.No, Student ID, Name, Email, then Date columns with Section under each
  let csv = 'KPRCAS Attendance Matrix Report\n\n'
  csv += `Class,${data.className}\n`
  csv += `Subject,${data.subjectName}\n`
  csv += `Teacher,${data.teacherName}\n`
  csv += `Period,${data.dateRange.startDate} to ${data.dateRange.endDate}\n`
  csv += `Generated On,${new Date().toLocaleString('en-IN')}\n\n`

  // First header row with dates
  csv += ',,,,'  // Empty cells for S.No, Student ID, Name, Email
  sortedSessions.forEach(session => {
    const date = new Date(session.session_date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
    csv += `${date},`
  })
  csv += '\n'

  // Second header row with Section/Subject info
  csv += 'S.No,Student ID,Name,Email,'
  sortedSessions.forEach(session => {
    csv += `${session.subject.subject_code || 'Section'},`
  })
  csv += '\n'

  // Data rows for each student
  students.forEach((student, index) => {
    csv += `${index + 1},`
    csv += `${student.student_id},`
    csv += `"${student.name}",`
    csv += `${student.email},`

    // For each session, find this student's attendance
    sortedSessions.forEach(session => {
      const record = session.records.find(r => r.student_id === student.student_id)
      if (record) {
        csv += `${record.status === 'present' ? 'P' : 'A'},`
      } else {
        csv += '-,'
      }
    })
    csv += '\n'
  })

  // Summary row
  csv += '\n'
  csv += ',,,Total Present,'
  sortedSessions.forEach(session => {
    const presentCount = session.records.filter(r => r.status === 'present').length
    csv += `${presentCount},`
  })
  csv += '\n'

  csv += ',,,Total Absent,'
  sortedSessions.forEach(session => {
    const absentCount = session.records.filter(r => r.status === 'absent').length
    csv += `${absentCount},`
  })
  csv += '\n'

  csv += ',,,Attendance %,'
  sortedSessions.forEach(session => {
    const total = session.records.length
    const present = session.records.filter(r => r.status === 'present').length
    const percentage = total > 0 ? Math.round((present / total) * 100) : 0
    csv += `${percentage}%,`
  })
  csv += '\n'

  // Download CSV
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.setAttribute('href', url)
  link.setAttribute(
    'download',
    `Attendance_Matrix_${data.className}_${data.dateRange.startDate}_to_${data.dateRange.endDate}.csv`
  )
  link.style.visibility = 'hidden'

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function generateMatrixPDF(data: MatrixReportData) {
  const doc = new jsPDF({ orientation: 'landscape' })

  // Collect all unique students
  const studentMap = new Map<string, { student_id: string; name: string; email: string }>()
  
  data.sessions.forEach(session => {
    session.records.forEach(record => {
      if (!studentMap.has(record.student_id)) {
        studentMap.set(record.student_id, record.student_info)
      }
    })
  })

  const students = Array.from(studentMap.values()).sort((a, b) => 
    a.student_id.localeCompare(b.student_id)
  )

  // Sort sessions by date
  const sortedSessions = [...data.sessions].sort((a, b) => 
    new Date(a.session_date).getTime() - new Date(b.session_date).getTime()
  )

  // Header
  doc.setFillColor(59, 130, 246)
  doc.rect(0, 0, 297, 35, 'F')
  
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('KPRCAS Attendance Matrix Report', 148.5, 12, { align: 'center' })
  
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text(`Class: ${data.className} | Subject: ${data.subjectName} | Teacher: ${data.teacherName}`, 148.5, 22, { align: 'center' })
  doc.text(`Period: ${data.dateRange.startDate} to ${data.dateRange.endDate}`, 148.5, 30, { align: 'center' })

  // Build table headers
  const headers = ['S.No', 'Student ID', 'Name', 'Email']
  const dateHeaders = sortedSessions.map(session => {
    const date = new Date(session.session_date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short'
    })
    return `${date}\n${session.subject.subject_code || 'Sec'}`
  })
  headers.push(...dateHeaders)

  // Build table data
  const tableData = students.map((student, index) => {
    const row = [
      (index + 1).toString(),
      student.student_id,
      student.name,
      student.email
    ]

    sortedSessions.forEach(session => {
      const record = session.records.find(r => r.student_id === student.student_id)
      if (record) {
        row.push(record.status === 'present' ? 'P' : 'A')
      } else {
        row.push('-')
      }
    })

    return row
  })

  // Calculate column widths dynamically
  const fixedColWidth = [12, 25, 40, 50] // S.No, ID, Name, Email
  const dateColWidth = sortedSessions.length > 0 
    ? Math.min(20, Math.max(12, (297 - 127 - 20) / sortedSessions.length))
    : 15

  const columnStyles: { [key: number]: { cellWidth: number; halign?: string } } = {
    0: { cellWidth: fixedColWidth[0], halign: 'center' },
    1: { cellWidth: fixedColWidth[1] },
    2: { cellWidth: fixedColWidth[2] },
    3: { cellWidth: fixedColWidth[3] }
  }

  for (let i = 0; i < sortedSessions.length; i++) {
    columnStyles[4 + i] = { cellWidth: dateColWidth, halign: 'center' }
  }

  autoTable(doc, {
    startY: 42,
    head: [headers],
    body: tableData,
    theme: 'grid',
    headStyles: { 
      fillColor: [59, 130, 246], 
      fontSize: 7, 
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
      minCellHeight: 12
    },
    styles: { 
      fontSize: 7, 
      cellPadding: 1.5,
      overflow: 'linebreak'
    },
    columnStyles: columnStyles,
    didParseCell: (data) => {
      // Color code P/A cells
      if (data.section === 'body' && data.column.index >= 4) {
        if (data.cell.raw === 'P') {
          data.cell.styles.fillColor = [220, 252, 231] // Green for Present
          data.cell.styles.textColor = [22, 101, 52]
        } else if (data.cell.raw === 'A') {
          data.cell.styles.fillColor = [254, 226, 226] // Red for Absent
          data.cell.styles.textColor = [153, 27, 27]
        }
      }
    },
    didDrawPage: () => {
      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages()
      doc.setFontSize(8)
      doc.setTextColor(100)
      doc.text(
        `Page ${(doc as any).internal.getCurrentPageInfo().pageNumber} of ${pageCount} | Generated: ${new Date().toLocaleString('en-IN')}`,
        148.5,
        doc.internal.pageSize.height - 8,
        { align: 'center' }
      )
    }
  })

  // Save PDF
  const fileName = `Attendance_Matrix_${data.className}_${data.dateRange.startDate}_to_${data.dateRange.endDate}.pdf`
  doc.save(fileName)
}
