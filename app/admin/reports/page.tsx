"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { DashboardNav } from "@/components/dashboard-nav"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table } from "@/components/ui/table"
import { LoadingSkeleton } from "@/components/loading-skeleton"

interface StudentRecord {
  student_id: string
  name: string
  email: string
  phone?: string
  address?: string
  total_sessions: number
  present_count: number
  absent_count: number
  attendance_percentage: string
}

interface SessionRecord {
  session_id: string
  session_code: string
  session_date: string
  class: any
  subject: any
  statistics: any
  records: any[]
}

export default function ReportsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState<any>(null)
  const [viewType, setViewType] = useState<"summary" | "student" | "session">("summary")

  useEffect(() => {
    const userData = localStorage.getItem("user")
    if (!userData) return router.replace("/login")
    const parsed = JSON.parse(userData)
    if (parsed.role !== "admin") return router.replace("/login")
    setUser(parsed)

    // Set default date range (last 30 days)
    const today = new Date()
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
    setEndDate(today.toISOString().split("T")[0])
    setStartDate(thirtyDaysAgo.toISOString().split("T")[0])
  }, [router])

  const generateReport = async () => {
    if (!startDate || !endDate) {
      alert("Please select both start and end dates")
      return
    }

    if (new Date(startDate) > new Date(endDate)) {
      alert("Start date must be before end date")
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/admin/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate,
          endDate
        })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      setReportData(data)
      setViewType("summary")
    } catch (error: any) {
      alert("Error generating report: " + error.message)
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const downloadPDF = async () => {
    if (!reportData) return

    try {
      const { jsPDF } = await import("jspdf")
      const autoTable = await import("jspdf-autotable")
      const doc = new jsPDF()

      // Header
      doc.setFillColor(59, 130, 246)
      doc.rect(0, 0, 210, 40, "F")

      doc.setTextColor(255, 255, 255)
      doc.setFontSize(22)
      doc.setFont("helvetica", "bold")
      doc.text("KPRCAS Date-wise Attendance Report", 105, 15, { align: "center" })

      doc.setFontSize(10)
      doc.setFont("helvetica", "normal")
      doc.text(
        `Period: ${startDate} to ${endDate}`,
        105,
        25,
        { align: "center" }
      )

      let yPos = 50

      // Summary Section
      doc.setTextColor(0, 0, 0)
      doc.setFontSize(14)
      doc.setFont("helvetica", "bold")
      doc.text("Summary", 14, yPos)

      yPos += 8

      const summaryData = [
        ["Total Sessions", reportData.summary.total_sessions.toString()],
        ["Total Students", reportData.summary.total_students.toString()],
        ["Total Present", reportData.summary.total_present.toString()],
        ["Total Absent", reportData.summary.total_absent.toString()],
        [
          "Average Attendance",
          `${reportData.summary.average_attendance}%`
        ]
      ]

      autoTable.default(doc, {
        startY: yPos,
        head: [],
        body: summaryData,
        theme: "plain",
        styles: { fontSize: 10, cellPadding: 2 },
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 80 },
          1: { cellWidth: 100 }
        },
        margin: { left: 14 }
      })

      yPos = (doc as any).lastAutoTable.finalY + 10

      // Session-wise breakdown
      doc.setFont("helvetica", "bold")
      doc.setFontSize(12)
      doc.text("Session-wise Breakdown", 14, yPos)

      yPos += 8

      const sessionTableData = reportData.sessions.map(
        (session: SessionRecord, index: number) => [
          (index + 1).toString(),
          new Date(session.session_date).toLocaleDateString("en-IN"),
          session.session_code,
          `${session.class?.class_name || "N/A"} ${session.class?.section || ""}`,
          session.subject?.subject_name || "N/A",
          session.statistics.total_students.toString(),
          session.statistics.present.toString(),
          session.statistics.absent.toString(),
          `${session.statistics.attendance_percentage}%`
        ]
      )

      autoTable.default(doc, {
        startY: yPos,
        head: [
          ["#", "Date", "Code", "Class", "Subject", "Total", "Present", "Absent", "%"]
        ],
        body: sessionTableData,
        theme: "striped",
        headStyles: {
          fillColor: [59, 130, 246],
          textColor: [255, 255, 255],
          fontStyle: "bold"
        },
        styles: { fontSize: 9, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 10, halign: "center" },
          1: { cellWidth: 22 },
          2: { cellWidth: 20 },
          3: { cellWidth: 28 },
          4: { cellWidth: 35 },
          5: { cellWidth: 12, halign: "center" },
          6: { cellWidth: 15, halign: "center" },
          7: { cellWidth: 15, halign: "center" },
          8: { cellWidth: 12, halign: "center" }
        }
      })

      yPos = (doc as any).lastAutoTable.finalY + 10

      // Student-wise summary
      doc.setFont("helvetica", "bold")
      doc.setFontSize(12)
      doc.text("Student-wise Summary", 14, yPos)

      yPos += 8

      const studentTableData = (
        reportData.student_wise || []
      ).slice(0, 50).map(
        (student: StudentRecord, index: number) => [
          (index + 1).toString(),
          student.student_id,
          student.name,
          student.email,
          student.total_sessions.toString(),
          student.present_count.toString(),
          student.absent_count.toString(),
          `${student.attendance_percentage}%`
        ]
      )

      autoTable.default(doc, {
        startY: yPos,
        head: [
          ["#", "Student ID", "Name", "Email", "Sessions", "Present", "Absent", "%"]
        ],
        body: studentTableData,
        theme: "striped",
        headStyles: {
          fillColor: [59, 130, 246],
          textColor: [255, 255, 255],
          fontStyle: "bold"
        },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 8, halign: "center" },
          1: { cellWidth: 18, halign: "center" },
          2: { cellWidth: 30 },
          3: { cellWidth: 40 },
          4: { cellWidth: 15, halign: "center" },
          5: { cellWidth: 15, halign: "center" },
          6: { cellWidth: 15, halign: "center" },
          7: { cellWidth: 12, halign: "center" }
        }
      })

      const fileName = `Attendance_Report_${startDate}_to_${endDate}.pdf`
      doc.save(fileName)
    } catch (error) {
      console.error("Error generating PDF:", error)
      alert("Error generating PDF")
    }
  }

  const downloadCSV = () => {
    if (!reportData) return

    let csv = "KPRCAS Date-wise Attendance Report\n\n"
    csv += `Period,${startDate} to ${endDate}\n`
    csv += `Generated On,${new Date().toLocaleString("en-IN")}\n\n`

    csv += "SUMMARY\n"
    csv += `Total Sessions,${reportData.summary.total_sessions}\n`
    csv += `Total Students,${reportData.summary.total_students}\n`
    csv += `Total Present,${reportData.summary.total_present}\n`
    csv += `Total Absent,${reportData.summary.total_absent}\n`
    csv += `Average Attendance,${reportData.summary.average_attendance}%\n\n`

    csv += "SESSION-WISE BREAKDOWN\n"
    csv +=
      "S.No,Date,Session Code,Class,Subject,Total Students,Present,Absent,Attendance %\n"
    reportData.sessions.forEach((session: SessionRecord, index: number) => {
      csv += `${index + 1},`
      csv += `${new Date(session.session_date).toLocaleDateString("en-IN")},`
      csv += `${session.session_code},`
      csv += `"${session.class?.class_name || "N/A"} ${session.class?.section || ""}",`
      csv += `"${session.subject?.subject_name || "N/A"}",`
      csv += `${session.statistics.total_students},`
      csv += `${session.statistics.present},`
      csv += `${session.statistics.absent},`
      csv += `${session.statistics.attendance_percentage}%\n`
    })

    csv += "\nSTUDENT-WISE SUMMARY\n"
    csv += "S.No,Student ID,Name,Email,Phone,Total Sessions,Present,Absent,Attendance %\n"
    reportData.student_wise.forEach(
      (student: StudentRecord, index: number) => {
        csv += `${index + 1},`
        csv += `${student.student_id},`
        csv += `"${student.name}",`
        csv += `${student.email},`
        csv += `"${student.phone || "N/A"}",`
        csv += `${student.total_sessions},`
        csv += `${student.present_count},`
        csv += `${student.absent_count},`
        csv += `${student.attendance_percentage}%\n`
      }
    )

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)

    link.setAttribute("href", url)
    link.setAttribute(
      "download",
      `Attendance_Report_${startDate}_to_${endDate}.csv`
    )
    link.style.visibility = "hidden"

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-muted/40">
      <DashboardNav
        userName={user.name}
        userEmail={user.email}
        userRole={user.role}
      />
      <main className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold">Date-wise Attendance Reports</h2>
            <p className="text-muted-foreground">
              Generate and download attendance reports with student details
            </p>
          </div>
          <div>
            <Button onClick={() => router.push("/admin")}>
              Back to Dashboard
            </Button>
          </div>
        </div>

        {/* Date Filter Card */}
        <Card>
          <CardHeader>
            <CardTitle>Generate Report</CardTitle>
            <CardDescription>
              Select date range to generate detailed attendance report
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Start Date
                  </label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    End Date
                  </label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              <Button
                onClick={generateReport}
                disabled={loading}
                className="w-full"
              >
                {loading ? "Generating..." : "Generate Report"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Report Data */}
        {reportData && (
          <>
            {/* Summary Statistics */}
            <Card>
              <CardHeader>
                <CardTitle>Report Summary</CardTitle>
                <CardDescription>
                  {startDate} to {endDate}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="bg-blue-50 p-4 rounded">
                    <div className="text-2xl font-bold">
                      {reportData.summary.total_sessions}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Total Sessions
                    </div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded">
                    <div className="text-2xl font-bold">
                      {reportData.summary.total_students}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Total Students
                    </div>
                  </div>
                  <div className="bg-green-50 p-4 rounded">
                    <div className="text-2xl font-bold">
                      {reportData.summary.total_present}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Total Present
                    </div>
                  </div>
                  <div className="bg-red-50 p-4 rounded">
                    <div className="text-2xl font-bold">
                      {reportData.summary.total_absent}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Total Absent
                    </div>
                  </div>
                  <div className="bg-orange-50 p-4 rounded">
                    <div className="text-2xl font-bold">
                      {reportData.summary.average_attendance}%
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Avg Attendance
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* View Type Selector */}
            <div className="flex gap-2">
              <Button
                variant={viewType === "summary" ? "default" : "outline"}
                onClick={() => setViewType("summary")}
              >
                Summary
              </Button>
              <Button
                variant={viewType === "session" ? "default" : "outline"}
                onClick={() => setViewType("session")}
              >
                Session-wise
              </Button>
              <Button
                variant={viewType === "student" ? "default" : "outline"}
                onClick={() => setViewType("student")}
              >
                Student-wise
              </Button>
              <div className="ml-auto flex gap-2">
                <Button onClick={downloadPDF} variant="outline">
                  Download PDF
                </Button>
                <Button onClick={downloadCSV} variant="outline">
                  Download CSV
                </Button>
              </div>
            </div>

            {/* Session-wise View */}
            {viewType === "session" && (
              <Card>
                <CardHeader>
                  <CardTitle>Session-wise Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">#</th>
                          <th className="text-left p-2">Date</th>
                          <th className="text-left p-2">Code</th>
                          <th className="text-left p-2">Class</th>
                          <th className="text-left p-2">Subject</th>
                          <th className="text-center p-2">Total</th>
                          <th className="text-center p-2">Present</th>
                          <th className="text-center p-2">Absent</th>
                          <th className="text-center p-2">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.sessions.map(
                          (session: SessionRecord, index: number) => (
                            <tr key={session.session_id} className="border-b hover:bg-muted/50">
                              <td className="p-2">{index + 1}</td>
                              <td className="p-2">
                                {new Date(session.session_date).toLocaleDateString(
                                  "en-IN"
                                )}
                              </td>
                              <td className="p-2">{session.session_code}</td>
                              <td className="p-2">
                                {session.class?.class_name}{" "}
                                {session.class?.section}
                              </td>
                              <td className="p-2">
                                {session.subject?.subject_name}
                              </td>
                              <td className="text-center p-2">
                                {session.statistics.total_students}
                              </td>
                              <td className="text-center p-2 text-green-600 font-semibold">
                                {session.statistics.present}
                              </td>
                              <td className="text-center p-2 text-red-600 font-semibold">
                                {session.statistics.absent}
                              </td>
                              <td className="text-center p-2">
                                {session.statistics.attendance_percentage}%
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Student-wise View */}
            {viewType === "student" && (
              <Card>
                <CardHeader>
                  <CardTitle>
                    Student-wise Summary ({reportData.student_wise.length} students)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">#</th>
                          <th className="text-left p-2">Student ID</th>
                          <th className="text-left p-2">Name</th>
                          <th className="text-left p-2">Email</th>
                          <th className="text-center p-2">Sessions</th>
                          <th className="text-center p-2">Present</th>
                          <th className="text-center p-2">Absent</th>
                          <th className="text-center p-2">Attendance %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.student_wise.map(
                          (student: StudentRecord, index: number) => (
                            <tr
                              key={student.student_id}
                              className="border-b hover:bg-muted/50"
                            >
                              <td className="p-2">{index + 1}</td>
                              <td className="p-2">{student.student_id}</td>
                              <td className="p-2 font-medium">{student.name}</td>
                              <td className="p-2">{student.email}</td>
                              <td className="text-center p-2">
                                {student.total_sessions}
                              </td>
                              <td className="text-center p-2 text-green-600 font-semibold">
                                {student.present_count}
                              </td>
                              <td className="text-center p-2 text-red-600 font-semibold">
                                {student.absent_count}
                              </td>
                              <td className="text-center p-2 font-semibold">
                                <span
                                  className={
                                    parseFloat(
                                      student.attendance_percentage
                                    ) >= 75
                                      ? "text-green-600"
                                      : "text-red-600"
                                  }
                                >
                                  {student.attendance_percentage}%
                                </span>
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Summary View */}
            {viewType === "summary" && (
              <Card>
                <CardHeader>
                  <CardTitle>Report Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-2">Key Metrics</h3>
                      <ul className="space-y-2 text-sm">
                        <li>
                          <span className="font-medium">Total Sessions:</span>{" "}
                          {reportData.summary.total_sessions}
                        </li>
                        <li>
                          <span className="font-medium">
                            Unique Students:
                          </span>{" "}
                          {reportData.total_unique_students}
                        </li>
                        <li>
                          <span className="font-medium">Total Records:</span>{" "}
                          {reportData.summary.total_students}
                        </li>
                        <li>
                          <span className="font-medium">Overall Present:</span>{" "}
                          {reportData.summary.total_present}
                        </li>
                        <li>
                          <span className="font-medium">Overall Absent:</span>{" "}
                          {reportData.summary.total_absent}
                        </li>
                        <li>
                          <span className="font-medium">
                            Average Attendance:
                          </span>{" "}
                          {reportData.summary.average_attendance}%
                        </li>
                      </ul>
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">Report Period</h3>
                      <p className="text-sm">
                        From {startDate} to {endDate} (
                        {Math.ceil(
                          (new Date(endDate).getTime() -
                            new Date(startDate).getTime()) /
                            (1000 * 60 * 60 * 24)
                        )}{" "}
                        days)
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  )
}
