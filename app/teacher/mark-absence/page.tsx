"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DashboardNav } from "@/components/dashboard-nav"
import { Calendar, Plus, Trash2, Users, AlertCircle } from "lucide-react"
import { supabase } from "@/lib/supabase"

interface User {
  id: string
  email: string
  name: string
  role: string
}

interface TeacherClass {
  id: string
  class_id: string
  subject_id: string
  classes: {
    id: string
    class_name: string
    section: string
    year: number
  }
  subjects: {
    id: string
    subject_name: string
    subject_code: string
  }
}

interface SubstituteTeacher {
  id: string
  name: string
  email: string
}

interface TransferEntry {
  classId: string
  className: string
  subjectId: string
  subjectName: string
  substituteTeacherId: string
  substituteTeacherName: string
  dates: string[] // Array of dates for this transfer
}

export default function MarkAbsencePage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)

  // Form states
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [reason, setReason] = useState("")
  const [teacherClasses, setTeacherClasses] = useState<TeacherClass[]>([])
  const [substituteTeachers, setSubstituteTeachers] = useState<SubstituteTeacher[]>([])
  const [transfers, setTransfers] = useState<TransferEntry[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)

  // Dialog states
  const [showAddTransfer, setShowAddTransfer] = useState(false)
  const [selectedClass, setSelectedClass] = useState("")
  const [selectedSubstitute, setSelectedSubstitute] = useState("")

  useEffect(() => {
    const checkAuthAndLoadData = async () => {
      try {
        const userData = sessionStorage.getItem("user")
        if (!userData) {
          router.replace("/login")
          return
        }

        const parsedUser = JSON.parse(userData)
        if (parsedUser.role !== "teacher") {
          router.replace("/login")
          return
        }

        setUser(parsedUser)
        setIsAuthorized(true)

        // Fetch teacher's assigned classes
        const { data: classesData, error: classesError } = await supabase
          .from("teacher_subjects")
          .select(`
            id,
            class_id,
            subject_id,
            classes (id, class_name, section, year),
            subjects (id, subject_name, subject_code)
          `)
          .eq("teacher_id", parsedUser.id)
          .order("classes(class_name)", { ascending: true })

        if (classesError) {
          console.error("Error fetching classes:", classesError)
        } else {
          setTeacherClasses(classesData || [])
        }

        // Fetch all teachers for substitute selection
        const { data: teachersData, error: teachersError } = await supabase
          .from("users")
          .select("id, name, email")
          .eq("role", "teacher")
          .neq("id", parsedUser.id)
          .order("name", { ascending: true })

        if (teachersError) {
          console.error("Error fetching teachers:", teachersError)
        } else {
          setSubstituteTeachers(teachersData || [])
        }
      } catch (error) {
        console.error("Error checking auth:", error)
        router.replace("/login")
      } finally {
        setLoading(false)
      }
    }

    checkAuthAndLoadData()
  }, [router])

  const addTransfer = () => {
    if (!selectedClass || !selectedSubstitute || !startDate || !endDate) {
      alert("Please select a class, substitute teacher, and dates")
      return
    }

    const classData = teacherClasses.find((tc) => tc.class_id === selectedClass)
    const substituteData = substituteTeachers.find((st) => st.id === selectedSubstitute)

    if (!classData || !substituteData) {
      alert("Invalid class or substitute teacher")
      return
    }

    // Generate array of dates between start and end
    const start = new Date(startDate)
    const end = new Date(endDate)
    const dates: string[] = []

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split("T")[0])
    }

    const newTransfer: TransferEntry = {
      classId: selectedClass,
      className: `${classData.classes.class_name} ${classData.classes.section}`,
      subjectId: classData.subject_id,
      subjectName: classData.subjects.subject_name,
      substituteTeacherId: selectedSubstitute,
      substituteTeacherName: substituteData.name,
      dates,
    }

    setTransfers([...transfers, newTransfer])
    setSelectedClass("")
    setSelectedSubstitute("")
    setShowAddTransfer(false)
  }

  const removeTransfer = (index: number) => {
    setTransfers(transfers.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (!user || !startDate || !endDate || transfers.length === 0) {
      alert("Please fill in all fields and add at least one class transfer")
      return
    }

    if (new Date(startDate) > new Date(endDate)) {
      alert("Start date must be before end date")
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch("/api/teacher/absences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId: user.id,
          startDate,
          endDate,
          reason,
          transfers: transfers.map((t) => ({
            classId: t.classId,
            subjectId: t.subjectId,
            substituteTeacherId: t.substituteTeacherId,
            dates: t.dates,
          })),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        alert(`Error: ${data.message || "Failed to create absence"}`)
        return
      }

      setShowSuccessDialog(true)

      // Reset form
      setStartDate("")
      setEndDate("")
      setReason("")
      setTransfers([])

      setTimeout(() => {
        setShowSuccessDialog(false)
      }, 3000)
    } catch (error) {
      console.error("Error submitting absence:", error)
      alert("Failed to submit absence. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (!isAuthorized) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verifying access...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <DashboardNav
        userName={user?.name || ""}
        userEmail={user?.email || ""}
        userRole={user?.role || "teacher"}
      />

      <main className="container mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Mark Absence</h2>
          <p className="text-muted-foreground mt-2">
            Report your absence and assign substitute teachers for your classes
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Form Section */}
          <div className="md:col-span-2 space-y-6">
            {/* Absence Period Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Absence Period
                </CardTitle>
                <CardDescription>Select the dates for your absence</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start-date">Start Date</Label>
                    <Input
                      id="start-date"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="end-date">End Date</Label>
                    <Input
                      id="end-date"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="reason">Reason (Optional)</Label>
                  <Input
                    id="reason"
                    placeholder="e.g., Medical leave, Personal emergency, etc."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Class Transfers Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Class Transfers
                </CardTitle>
                <CardDescription>Assign substitute teachers for your classes during this period</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {transfers.length === 0 ? (
                  <div className="flex items-center justify-center p-8 border-2 border-dashed rounded-lg bg-muted/50">
                    <div className="text-center">
                      <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground">No class transfers added yet</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Add at least one class transfer below
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {transfers.map((transfer, idx) => (
                      <div key={idx} className="p-4 border rounded-lg bg-card">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <h4 className="font-semibold">{transfer.className}</h4>
                            <p className="text-sm text-muted-foreground">{transfer.subjectName}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeTransfer(idx)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="bg-muted/50 p-3 rounded mb-3">
                          <p className="text-sm">
                            <span className="font-medium">Substitute:</span> {transfer.substituteTeacherName}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {transfer.dates.length} {transfer.dates.length === 1 ? "day" : "days"}
                          </p>
                        </div>
                        <details className="text-sm">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                            View dates
                          </summary>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {transfer.dates.map((date) => (
                              <span
                                key={date}
                                className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded"
                              >
                                {new Date(date).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                })}
                              </span>
                            ))}
                          </div>
                        </details>
                      </div>
                    ))}
                  </div>
                )}

                <Button
                  onClick={() => setShowAddTransfer(true)}
                  className="w-full"
                  variant="outline"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Class Transfer
                </Button>
              </CardContent>
            </Card>

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={submitting || transfers.length === 0 || !startDate || !endDate}
              className="w-full h-11"
              size="lg"
            >
              {submitting ? "Submitting..." : "Submit Absence"}
            </Button>
          </div>

          {/* Summary Section */}
          <div>
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle className="text-lg">Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Period</p>
                  <p className="text-sm font-medium mt-1">
                    {startDate && endDate
                      ? `${new Date(startDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })} - ${new Date(endDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}`
                      : "Not selected"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Classes</p>
                  <p className="text-sm font-medium mt-1">{transfers.length} assigned</p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Days</p>
                  <p className="text-sm font-medium mt-1">
                    {startDate && endDate
                      ? Math.ceil(
                          (new Date(endDate).getTime() - new Date(startDate).getTime()) /
                            (1000 * 60 * 60 * 24)
                        ) + 1
                      : 0}{" "}
                    days
                  </p>
                </div>

                {reason && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Reason</p>
                    <p className="text-sm font-medium mt-1 line-clamp-3">{reason}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Add Transfer Dialog */}
      <Dialog open={showAddTransfer} onOpenChange={setShowAddTransfer}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Class Transfer</DialogTitle>
            <DialogDescription>Assign a substitute teacher for one of your classes</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="class-select">Class</Label>
              <select
                id="class-select"
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm"
              >
                <option value="">Select a class...</option>
                {teacherClasses.map((tc) => (
                  <option key={tc.class_id} value={tc.class_id}>
                    {tc.classes.class_name} {tc.classes.section} - {tc.subjects.subject_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="substitute-select">Substitute Teacher</Label>
              <select
                id="substitute-select"
                value={selectedSubstitute}
                onChange={(e) => setSelectedSubstitute(e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm"
              >
                <option value="">Select a teacher...</option>
                {substituteTeachers.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name} ({st.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 justify-end pt-4">
              <Button variant="outline" onClick={() => setShowAddTransfer(false)}>
                Cancel
              </Button>
              <Button onClick={addTransfer}>Add Transfer</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>✅ Absence Submitted Successfully</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Your absence has been recorded and admin has been notified of all class transfers.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  )
}
