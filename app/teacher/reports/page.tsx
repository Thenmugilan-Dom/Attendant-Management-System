"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { FileDown, FileText, Table as TableIcon, Download, Loader2 } from "lucide-react"
import { createClient } from "@supabase/supabase-js"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import * as XLSX from "xlsx"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
)

interface Teacher {
  id: string
  name: string
  email: string
}

interface Assignment {
  class: {
    id: string
    class_name: string
    section: string
    year: number
  }
  subjects: Array<{
    id: string
    subject_name: string
    subject_code: string
  }>
}

export default function TeacherReports() {
  const router = useRouter()
  const [teacher, setTeacher] = useState<Teacher | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [selectedClass, setSelectedClass] = useState("")
  const [selectedSubject, setSelectedSubject] = useState("")
  const [period, setPeriod] = useState("monthly")
  const [reportData, setReportData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  // OD Report states
  const [showODReport, setShowODReport] = useState(false)
  const [odReportClass, setOdReportClass] = useState("")
  const [odReportData, setOdReportData] = useState<any>(null)
  const [odLoading, setOdLoading] = useState(false)

  useEffect(() => {
    const teacherData = localStorage.getItem("user")
    if (!teacherData) {
      router.push("/login")
      return
    }

    const user = JSON.parse(teacherData)
    if (user.role !== "teacher") {
      router.push("/login")
      return
    }

    setTeacher(user)
    fetchAssignments(user.id)
  }, [router])

  const fetchAssignments = async (teacherId: string) => {
    try {
      const response = await fetch(`/api/teacher/assignments?teacher_id=${teacherId}`)
      const data = await response.json()

      if (data.success) {
        setAssignments(data.assignments)
      }
    } catch (error) {
      console.error("Error:", error)
    }
  }

  const fetchODReport = async () => {
    if (!teacher || !odReportClass) {
      return
    }

    setOdLoading(true)
    try {
      const { data, error } = await supabase
        .from("od_requests")
        .select(
          `
          id,
          od_start_date,
          od_end_date,
          reason,
          status,
          teacher_approved,
          admin_approved,
          students (id, name, email),
          classes (id, class_name)
        `
        )
        .eq("teacher_id", teacher.id)
        .eq("class_id", odReportClass)
        .order("created_at", { ascending: false })

      if (!error && data) {
        // Process OD data for report
        const pending = data.filter(r => r.status === "pending").length
        const approved = data.filter(r => r.status === "approved").length
        const rejected = data.filter(r => r.status === "rejected").length

        setOdReportData({
          total: data.length,
          pending,
          approved,
          rejected,
          requests: data
        })
      }
    } catch (error) {
      console.error("Error fetching OD report:", error)
    } finally {
      setOdLoading(false)
    }
  }

  const fetchReport = async () => {
    if (!teacher) return

    setLoading(true)
    try {
      let url = `/api/teacher/reports?teacher_id=${teacher.id}&period=${period}`
      
      if (selectedClass) url += `&class_id=${selectedClass}`
      if (selectedSubject) url += `&subject_id=${selectedSubject}`

      const response = await fetch(url)
      const data = await response.json()

      if (data.success) {
        setReportData(data)
      } else {
        setReportData(null)
      }
    } catch (error) {
      console.error("Error:", error)
    } finally {
      setLoading(false)
    }
  }

  const exportToPDF = () => {
    if (!reportData || !teacher) return

    const doc = new jsPDF()
    
    // Title
    doc.setFontSize(20)
    doc.text("Attendance Report", 14, 20)
    
    // Teacher Info
    doc.setFontSize(10)
    doc.text(`Teacher: ${teacher.name}`, 14, 30)
    doc.text(`Period: ${period}`, 14, 36)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 42)
    
    // Summary
    doc.setFontSize(14)
    doc.text("Summary", 14, 52)
    doc.setFontSize(10)
    doc.text(`Total Sessions: ${reportData.summary.total_sessions}`, 14, 60)
    doc.text(`Total Students Marked: ${reportData.summary.total_students_marked}`, 14, 66)
    doc.text(`Average Attendance: ${reportData.summary.average_attendance}%`, 14, 72)
    
    // Session-wise table
    const sessionData = reportData.session_wise.map((session: any) => [
      new Date(session.date).toLocaleDateString(),
      session.class,
      session.subject,
      session.present_count,
      session.total_count,
      `${session.attendance_percentage}%`
    ])

    autoTable(doc, {
      startY: 80,
      head: [["Date", "Class", "Subject", "Present", "Total", "Attendance %"]],
      body: sessionData,
      theme: "grid",
      headStyles: { fillColor: [102, 126, 234] }
    })

    // Student-wise table (new page if needed)
    if (reportData.student_wise.length > 0) {
      doc.addPage()
      doc.setFontSize(14)
      doc.text("Student-wise Report", 14, 20)
      
      const studentData = reportData.student_wise.map((student: any) => [
        student.student_id,
        student.name,
        student.present,
        student.absent,
        student.total_sessions,
        `${student.attendance_percentage}%`
      ])

      autoTable(doc, {
        startY: 30,
        head: [["Student ID", "Name", "Present", "Absent", "Total", "Attendance %"]],
        body: studentData,
        theme: "grid",
        headStyles: { fillColor: [102, 126, 234] }
      })
    }

    doc.save(`attendance_report_${period}_${Date.now()}.pdf`)
  }

  const exportToCSV = () => {
    if (!reportData) return

    // Create workbook
    const wb = XLSX.utils.book_new()

    // Summary sheet
    const summaryData = [
      ["Attendance Report Summary"],
      [""],
      ["Period", period],
      ["Total Sessions", reportData.summary.total_sessions],
      ["Total Students Marked", reportData.summary.total_students_marked],
      ["Average Attendance", `${reportData.summary.average_attendance}%`],
      [""],
      ["Generated On", new Date().toLocaleString()]
    ]
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(wb, summaryWs, "Summary")

    // Session-wise sheet
    const sessionData = reportData.session_wise.map((session: any) => ({
      Date: new Date(session.date).toLocaleString(),
      "Session Code": session.session_code,
      Class: session.class,
      Subject: session.subject,
      "Subject Code": session.subject_code,
      Status: session.status,
      Present: session.present_count,
      Total: session.total_count,
      "Attendance %": `${session.attendance_percentage}%`
    }))
    const sessionWs = XLSX.utils.json_to_sheet(sessionData)
    XLSX.utils.book_append_sheet(wb, sessionWs, "Session-wise")

    // Student-wise sheet
    const studentData = reportData.student_wise.map((student: any) => ({
      "Student ID": student.student_id,
      Name: student.name,
      Email: student.email,
      "Total Sessions": student.total_sessions,
      Present: student.present,
      Absent: student.absent,
      Late: student.late,
      "On Duty": student.on_duty,
      "Attendance %": `${student.attendance_percentage}%`
    }))
    const studentWs = XLSX.utils.json_to_sheet(studentData)
    XLSX.utils.book_append_sheet(wb, studentWs, "Student-wise")

    // Detailed records sheet
    const detailedData: any[] = []
    reportData.session_wise.forEach((session: any) => {
      session.students.forEach((student: any) => {
        detailedData.push({
          Date: new Date(session.date).toLocaleDateString(),
          Class: session.class,
          Subject: session.subject,
          "Student ID": student.student_id,
          "Student Name": student.name,
          Email: student.email,
          Status: student.status,
          "Marked At": new Date(student.marked_at).toLocaleString()
        })
      })
    })
    const detailedWs = XLSX.utils.json_to_sheet(detailedData)
    XLSX.utils.book_append_sheet(wb, detailedWs, "Detailed Records")

    XLSX.writeFile(wb, `attendance_report_${period}_${Date.now()}.xlsx`)
  }

  const exportODToPDF = () => {
    if (!odReportData || !teacher) return

    const doc = new jsPDF()
    
    // Title
    doc.setFontSize(20)
    doc.text("On-Duty (OD) Report", 14, 20)
    
    // Teacher Info
    doc.setFontSize(10)
    doc.text(`Teacher: ${teacher.name}`, 14, 30)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 36)
    
    // Summary
    doc.setFontSize(14)
    doc.text("Summary", 14, 46)
    doc.setFontSize(10)
    doc.text(`Total OD Requests: ${odReportData.total}`, 14, 54)
    doc.text(`Pending: ${odReportData.pending}`, 14, 60)
    doc.text(`Approved: ${odReportData.approved}`, 14, 66)
    doc.text(`Rejected: ${odReportData.rejected}`, 14, 72)
    
    // OD Requests table
    const odData = odReportData.requests.map((req: any) => [
      req.students?.name || "N/A",
      req.students?.email || "N/A",
      new Date(req.od_start_date).toLocaleDateString(),
      new Date(req.od_end_date).toLocaleDateString(),
      req.reason,
      req.status.charAt(0).toUpperCase() + req.status.slice(1)
    ])

    autoTable(doc, {
      startY: 80,
      head: [["Student Name", "Email", "Start Date", "End Date", "Reason", "Status"]],
      body: odData,
      theme: "grid",
      headStyles: { fillColor: [59, 130, 246] }
    })

    doc.save(`od_report_${Date.now()}.pdf`)
  }

  const exportODToCSV = () => {
    if (!odReportData) return

    const wb = XLSX.utils.book_new()

    // Summary sheet
    const summaryData = [
      ["OD Report Summary"],
      [""],
      ["Total Requests", odReportData.total],
      ["Pending", odReportData.pending],
      ["Approved", odReportData.approved],
      ["Rejected", odReportData.rejected],
      [""],
      ["Generated On", new Date().toLocaleString()]
    ]
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(wb, summaryWs, "Summary")

    // Detailed OD requests
    const odData = odReportData.requests.map((req: any) => ({
      "Student Name": req.students?.name || "N/A",
      "Email": req.students?.email || "N/A",
      "Start Date": new Date(req.od_start_date).toLocaleDateString(),
      "End Date": new Date(req.od_end_date).toLocaleDateString(),
      "Reason": req.reason,
      "Status": req.status.charAt(0).toUpperCase() + req.status.slice(1),
      "Teacher Approved": req.teacher_approved ? "Yes" : "No",
      "Admin Approved": req.admin_approved ? "Yes" : "No"
    }))
    const odWs = XLSX.utils.json_to_sheet(odData)
    XLSX.utils.book_append_sheet(wb, odWs, "OD Requests")

    XLSX.writeFile(wb, `od_report_${Date.now()}.xlsx`)
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Attendance Reports</CardTitle>
            <CardDescription>
              Generate and export attendance reports for your classes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Period</Label>
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>

              <div>
                <Label>Class (Optional)</Label>
                <select
                  value={selectedClass}
                  onChange={(e) => {
                    setSelectedClass(e.target.value)
                    setSelectedSubject("")
                  }}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">All Classes</option>
                  {assignments.map((a) => (
                    <option key={a.class.id} value={a.class.id}>
                      {a.class.class_name} {a.class.section}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label>Subject (Optional)</Label>
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  disabled={!selectedClass}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">All Subjects</option>
                  {selectedClass && assignments
                    .find((a) => a.class.id === selectedClass)
                    ?.subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.subject_name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <Button onClick={fetchReport} disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating Report...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Generate Report
                </>
              )}
            </Button>

            {/* Report Display */}
            {reportData && (
              <>
                <div className="border-t pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Total Sessions</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold">{reportData.summary.total_sessions}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Students Marked</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold">{reportData.summary.total_students_marked}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Avg Attendance</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold">{reportData.summary.average_attendance}%</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Export Buttons */}
                  <div className="flex gap-4 mb-6">
                    <Button onClick={exportToPDF} variant="outline" className="flex-1">
                      <FileDown className="h-4 w-4 mr-2" />
                      Export as PDF
                    </Button>
                    <Button onClick={exportToCSV} variant="outline" className="flex-1">
                      <TableIcon className="h-4 w-4 mr-2" />
                      Export as Excel
                    </Button>
                  </div>

                  {/* Session-wise Table */}
                  <div className="mb-6">
                    <h3 className="font-semibold mb-3">Session-wise Report</h3>
                    <div className="border rounded-lg overflow-auto max-h-96">
                      <table className="w-full text-sm">
                        <thead className="bg-muted">
                          <tr>
                            <th className="p-2 text-left">Date</th>
                            <th className="p-2 text-left">Class</th>
                            <th className="p-2 text-left">Subject</th>
                            <th className="p-2 text-center">Present</th>
                            <th className="p-2 text-center">Total</th>
                            <th className="p-2 text-center">Attendance %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.session_wise.map((session: any, idx: number) => (
                            <tr key={idx} className="border-t">
                              <td className="p-2">{new Date(session.date).toLocaleDateString()}</td>
                              <td className="p-2">{session.class}</td>
                              <td className="p-2">{session.subject}</td>
                              <td className="p-2 text-center">{session.present_count}</td>
                              <td className="p-2 text-center">{session.total_count}</td>
                              <td className="p-2 text-center">
                                <span className={`px-2 py-1 rounded ${
                                  session.attendance_percentage >= 75 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                                }`}>
                                  {session.attendance_percentage}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Student-wise Table */}
                  {reportData.student_wise.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-3">Student-wise Report</h3>
                      <div className="border rounded-lg overflow-auto max-h-96">
                        <table className="w-full text-sm">
                          <thead className="bg-muted">
                            <tr>
                              <th className="p-2 text-left">Student ID</th>
                              <th className="p-2 text-left">Name</th>
                              <th className="p-2 text-center">Present</th>
                              <th className="p-2 text-center">Absent</th>
                              <th className="p-2 text-center">Total</th>
                              <th className="p-2 text-center">Attendance %</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reportData.student_wise.map((student: any, idx: number) => (
                              <tr key={idx} className="border-t">
                                <td className="p-2">{student.student_id}</td>
                                <td className="p-2">{student.name}</td>
                                <td className="p-2 text-center">{student.present}</td>
                                <td className="p-2 text-center">{student.absent}</td>
                                <td className="p-2 text-center">{student.total_sessions}</td>
                                <td className="p-2 text-center">
                                  <span className={`px-2 py-1 rounded ${
                                    student.attendance_percentage >= 75 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                                  }`}>
                                    {student.attendance_percentage}%
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* OD Report Card */}
        <Card>
          <CardHeader>
            <CardTitle>📋 OD Request Reports</CardTitle>
            <CardDescription>
              Generate reports for On-Duty requests by class
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Class Selector */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Select Class</Label>
                <select
                  value={odReportClass}
                  onChange={(e) => setOdReportClass(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">-- Select a Class --</option>
                  {assignments.map((a) => (
                    <option key={a.class.id} value={a.class.id}>
                      {a.class.class_name} {a.class.section}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end gap-2">
                <Button 
                  onClick={fetchODReport}
                  disabled={odLoading || !odReportClass}
                  className="flex-1"
                >
                  {odLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <FileText className="mr-2 h-4 w-4" />
                      Generate Report
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* OD Report Results */}
            {odReportData && (
              <>
                {/* Summary Statistics */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="p-4 border rounded-lg bg-blue-50">
                    <p className="text-sm text-gray-600">Total Requests</p>
                    <p className="text-2xl font-bold text-blue-600">{odReportData.total}</p>
                  </div>
                  <div className="p-4 border rounded-lg bg-yellow-50">
                    <p className="text-sm text-gray-600">Pending</p>
                    <p className="text-2xl font-bold text-yellow-600">{odReportData.pending}</p>
                  </div>
                  <div className="p-4 border rounded-lg bg-green-50">
                    <p className="text-sm text-gray-600">Approved</p>
                    <p className="text-2xl font-bold text-green-600">{odReportData.approved}</p>
                  </div>
                  <div className="p-4 border rounded-lg bg-red-50">
                    <p className="text-sm text-gray-600">Rejected</p>
                    <p className="text-2xl font-bold text-red-600">{odReportData.rejected}</p>
                  </div>
                </div>

                {/* Detailed Table */}
                <div>
                  <h3 className="font-semibold mb-3">OD Requests Details</h3>
                  <div className="border rounded-lg overflow-auto max-h-96">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="p-2 text-left">Student Name</th>
                          <th className="p-2 text-left">Email</th>
                          <th className="p-2 text-left">Start Date</th>
                          <th className="p-2 text-left">End Date</th>
                          <th className="p-2 text-left">Reason</th>
                          <th className="p-2 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {odReportData.requests.map((request: any, idx: number) => (
                          <tr key={idx} className="border-t">
                            <td className="p-2">{request.students?.name || "N/A"}</td>
                            <td className="p-2 text-xs">{request.students?.email || "N/A"}</td>
                            <td className="p-2">{new Date(request.od_start_date).toLocaleDateString()}</td>
                            <td className="p-2">{new Date(request.od_end_date).toLocaleDateString()}</td>
                            <td className="p-2 text-xs">{request.reason}</td>
                            <td className="p-2 text-center">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                request.status === "approved" ? "bg-green-100 text-green-800" :
                                request.status === "rejected" ? "bg-red-100 text-red-800" :
                                "bg-yellow-100 text-yellow-800"
                              }`}>
                                {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Export Buttons */}
                <div className="flex gap-2 justify-end">
                  <Button 
                    onClick={exportODToPDF}
                    variant="outline"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download PDF
                  </Button>
                  <Button 
                    onClick={exportODToCSV}
                    variant="outline"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download CSV
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
