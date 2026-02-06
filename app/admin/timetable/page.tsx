"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ArrowLeft, Calendar, Clock, Save, Copy, Trash2, Plus, BookOpen, User, Settings } from "lucide-react"

interface User {
  id: string
  email: string
  role: string
  name?: string
  department?: string
}

interface Class {
  id: string
  class_name: string
  section?: string
  year?: number
  department?: string
}

interface Subject {
  id: string
  subject_code: string
  subject_name: string
}

interface Teacher {
  id: string
  name: string
  email: string
}

interface Period {
  period_number: number
  period_name: string
  start_time: string
  end_time: string
  is_break: boolean
}

interface TimetableEntry {
  id?: string
  period_number: number
  start_time: string
  end_time: string
  subject_id: string | null
  teacher_id: string | null
  is_break: boolean
  break_name: string | null
  subjects?: Subject
  users?: Teacher
}

interface TeacherAssignment {
  teacher_id: string
  subject_id: string
  class_id: string
  users: Teacher
  subjects: Subject
}

export default function TimetablePage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Data states
  const [classes, setClasses] = useState<Class[]>([])
  const [periods, setPeriods] = useState<Period[]>([])
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([])
  const [timetable, setTimetable] = useState<TimetableEntry[]>([])

  // Selection states
  const [selectedClass, setSelectedClass] = useState<string>("")
  const [selectedDayOrder, setSelectedDayOrder] = useState<number>(1)
  const [totalDayOrders, setTotalDayOrders] = useState<number>(6)

  // Dialog states
  const [showCopyDialog, setShowCopyDialog] = useState(false)
  const [copyTargetDay, setCopyTargetDay] = useState<number>(1)
  const [showPeriodConfig, setShowPeriodConfig] = useState(false)
  const [editablePeriods, setEditablePeriods] = useState<Period[]>([])
  const [savingPeriods, setSavingPeriods] = useState(false)

  // Department
  const [department, setDepartment] = useState<string>("General")

  useEffect(() => {
    const userStr = sessionStorage.getItem("user")
    if (!userStr) {
      router.push("/login")
      return
    }

    const userData = JSON.parse(userStr)
    if (userData.role !== "admin") {
      router.push("/login")
      return
    }

    setUser(userData)
    setDepartment(userData.department || "General")
  }, [router])

  useEffect(() => {
    if (department) {
      fetchClasses()
      fetchPeriods()
      fetchDayOrderConfig()
    }
  }, [department])

  useEffect(() => {
    if (selectedClass) {
      fetchAssignments()
    }
  }, [selectedClass])

  // Fetch timetable when class, day order, OR periods change
  useEffect(() => {
    if (selectedClass && periods.length > 0) {
      fetchTimetable()
    }
  }, [selectedClass, selectedDayOrder, periods])

  const fetchClasses = async () => {
    try {
      const response = await fetch(`/api/admin/timetable?action=classes&department=${department}`)
      const data = await response.json()
      if (data.success) {
        setClasses(data.classes || [])
      }
    } catch (error) {
      console.error("Error fetching classes:", error)
    }
  }

  const fetchPeriods = async () => {
    try {
      const response = await fetch(`/api/admin/timetable?action=periods&department=${department}`)
      const data = await response.json()
      if (data.success && data.periods && data.periods.length > 0) {
        setPeriods(data.periods)
      } else {
        // Use default periods if none configured
        const defaultPeriods = [
          { period_number: 1, period_name: "Period 1", start_time: "09:00", end_time: "09:50", is_break: false },
          { period_number: 2, period_name: "Period 2", start_time: "09:50", end_time: "10:40", is_break: false },
          { period_number: 3, period_name: "Break", start_time: "10:40", end_time: "10:55", is_break: true },
          { period_number: 4, period_name: "Period 3", start_time: "10:55", end_time: "11:45", is_break: false },
          { period_number: 5, period_name: "Period 4", start_time: "11:45", end_time: "12:35", is_break: false },
          { period_number: 6, period_name: "Lunch", start_time: "12:35", end_time: "13:20", is_break: true },
          { period_number: 7, period_name: "Period 5", start_time: "13:20", end_time: "14:10", is_break: false },
          { period_number: 8, period_name: "Period 6", start_time: "14:10", end_time: "15:00", is_break: false },
        ]
        setPeriods(defaultPeriods)
      }
    } catch (error) {
      console.error("Error fetching periods:", error)
      // Use default periods on error
      const defaultPeriods = [
        { period_number: 1, period_name: "Period 1", start_time: "09:00", end_time: "09:50", is_break: false },
        { period_number: 2, period_name: "Period 2", start_time: "09:50", end_time: "10:40", is_break: false },
        { period_number: 3, period_name: "Break", start_time: "10:40", end_time: "10:55", is_break: true },
        { period_number: 4, period_name: "Period 3", start_time: "10:55", end_time: "11:45", is_break: false },
        { period_number: 5, period_name: "Period 4", start_time: "11:45", end_time: "12:35", is_break: false },
        { period_number: 6, period_name: "Lunch", start_time: "12:35", end_time: "13:20", is_break: true },
        { period_number: 7, period_name: "Period 5", start_time: "13:20", end_time: "14:10", is_break: false },
        { period_number: 8, period_name: "Period 6", start_time: "14:10", end_time: "15:00", is_break: false },
      ]
      setPeriods(defaultPeriods)
    }
  }

  const fetchDayOrderConfig = async () => {
    try {
      const response = await fetch(`/api/admin/day-order?action=config&department=${department}`)
      const data = await response.json()
      if (data.success && data.config) {
        setTotalDayOrders(data.config.total_days || 6)
      }
    } catch (error) {
      console.error("Error fetching day order config:", error)
    }
  }

  const fetchAssignments = async () => {
    try {
      const response = await fetch(`/api/admin/assignments?class_id=${selectedClass}`)
      const data = await response.json()
      if (data.success) {
        // Transform to include teacher and subject info
        const transformed = data.assignments?.map((a: any) => ({
          teacher_id: a.teacher_id,
          subject_id: a.subject_id,
          class_id: a.class_id,
          users: a.teacher || { id: a.teacher_id, name: "Unknown", email: "" },
          subjects: a.subject || { id: a.subject_id, subject_name: "Unknown", subject_code: "" }
        })) || []
        setAssignments(transformed)
        console.log("Assignments loaded:", transformed.length)
      }
    } catch (error) {
      console.error("Error fetching assignments:", error)
    }
  }

  const fetchTimetable = async () => {
    setLoading(true)
    try {
      const response = await fetch(
        `/api/admin/timetable?action=timetable&classId=${selectedClass}&dayOrder=${selectedDayOrder}`
      )
      const data = await response.json()
      if (data.success) {
        // Merge with period config to show all periods
        const mergedTimetable = periods.map(period => {
          const existing = data.timetable?.find(
            (t: TimetableEntry) => t.period_number === period.period_number
          )
          if (existing) {
            return existing
          }
          return {
            period_number: period.period_number,
            start_time: period.start_time,
            end_time: period.end_time,
            subject_id: null,
            teacher_id: null,
            is_break: period.is_break,
            break_name: period.is_break ? period.period_name : null
          }
        })
        setTimetable(mergedTimetable)
      }
    } catch (error) {
      console.error("Error fetching timetable:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleEntryChange = (periodNumber: number, field: string, value: any) => {
    setTimetable(prev =>
      prev.map(entry => {
        if (entry.period_number === periodNumber) {
          const updated = { ...entry, [field]: value }
          
          // If subject is selected, try to auto-select teacher
          if (field === "subject_id" && value) {
            const assignment = assignments.find(a => a.subject_id === value)
            if (assignment) {
              updated.teacher_id = assignment.teacher_id
            }
          }
          
          return updated
        }
        return entry
      })
    )
  }

  const saveTimetable = async () => {
    if (!selectedClass || timetable.length === 0) return

    setSaving(true)
    try {
      const entries = timetable.map(entry => ({
        periodNumber: entry.period_number,
        subjectId: entry.subject_id,
        teacherId: entry.teacher_id,
        startTime: entry.start_time,
        endTime: entry.end_time,
        isBreak: entry.is_break,
        breakName: entry.break_name
      }))

      const response = await fetch("/api/admin/timetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_day",
          classId: selectedClass,
          dayOrder: selectedDayOrder,
          entries,
          department
        })
      })

      const data = await response.json()
      if (data.success) {
        alert(`Timetable saved for Day ${selectedDayOrder}!`)
      } else {
        alert(data.error || "Failed to save timetable")
      }
    } catch (error) {
      console.error("Error saving timetable:", error)
      alert("Failed to save timetable")
    } finally {
      setSaving(false)
    }
  }

  const copyToAnotherDay = async () => {
    if (!selectedClass || copyTargetDay === selectedDayOrder) {
      alert("Please select a different day to copy to")
      return
    }

    try {
      const response = await fetch("/api/admin/timetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "copy_day",
          classId: selectedClass,
          sourceDayOrder: selectedDayOrder,
          targetDayOrder: copyTargetDay,
          department
        })
      })

      const data = await response.json()
      if (data.success) {
        alert(`Timetable copied to Day ${copyTargetDay}!`)
        setShowCopyDialog(false)
      } else {
        alert(data.error || "Failed to copy timetable")
      }
    } catch (error) {
      console.error("Error copying timetable:", error)
      alert("Failed to copy timetable")
    }
  }

  const clearDay = async () => {
    if (!selectedClass) return
    if (!confirm(`Are you sure you want to clear timetable for Day ${selectedDayOrder}?`)) return

    try {
      const response = await fetch(
        `/api/admin/timetable?classId=${selectedClass}&dayOrder=${selectedDayOrder}`,
        { method: "DELETE" }
      )

      const data = await response.json()
      if (data.success) {
        fetchTimetable()
        alert("Timetable cleared!")
      } else {
        alert(data.error || "Failed to clear timetable")
      }
    } catch (error) {
      console.error("Error clearing timetable:", error)
    }
  }

  const openPeriodConfig = () => {
    // Clone periods for editing
    setEditablePeriods([...periods])
    setShowPeriodConfig(true)
  }

  const savePeriodConfig = async () => {
    if (editablePeriods.length === 0) {
      alert("Please add at least one period")
      return
    }

    setSavingPeriods(true)
    try {
      // Renumber periods sequentially
      const renumbered = editablePeriods.map((p, i) => ({
        periodNumber: i + 1,
        periodName: p.period_name,
        startTime: p.start_time,
        endTime: p.end_time,
        isBreak: p.is_break
      }))

      const response = await fetch("/api/admin/timetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_periods",
          department,
          periods: renumbered
        })
      })

      const data = await response.json()
      if (data.success) {
        alert("Period configuration saved!")
        setShowPeriodConfig(false)
        fetchPeriods() // Reload periods
      } else {
        alert(data.error || "Failed to save period configuration")
      }
    } catch (error) {
      console.error("Error saving period config:", error)
      alert("Failed to save period configuration")
    } finally {
      setSavingPeriods(false)
    }
  }

  const getClassName = (classId: string) => {
    const cls = classes.find(c => c.id === classId)
    return cls ? `${cls.class_name}${cls.section ? ` - ${cls.section}` : ""}` : ""
  }

  const getSubjectsForClass = () => {
    // Get unique subjects from assignments for this class
    const uniqueSubjects = new Map<string, Subject>()
    assignments.forEach(a => {
      if (a.subjects) {
        uniqueSubjects.set(a.subject_id, a.subjects)
      }
    })
    return Array.from(uniqueSubjects.values())
  }

  const getTeachersForSubject = (subjectId: string) => {
    // Get teachers who can teach this subject in this class
    return assignments
      .filter(a => a.subject_id === subjectId)
      .map(a => a.users)
      .filter((v, i, a) => a.findIndex(t => t.id === v.id) === i)
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-6 px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => router.push("/admin/manage")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Class Timetable Management</h1>
              <p className="text-muted-foreground">
                Configure day order wise timetable for each class
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={openPeriodConfig}>
            <Settings className="h-4 w-4 mr-2" />
            Configure Periods
          </Button>
        </div>

        {/* Selection Row */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Class Selection */}
              <div>
                <Label>Select Class</Label>
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map(cls => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.class_name}{cls.section ? ` - ${cls.section}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Day Order Selection */}
              <div>
                <Label>Select Day Order</Label>
                <div className="flex gap-2 flex-wrap mt-2">
                  {Array.from({ length: totalDayOrders }, (_, i) => i + 1).map(day => (
                    <Button
                      key={day}
                      variant={selectedDayOrder === day ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedDayOrder(day)}
                    >
                      Day {day}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-end gap-2">
                <Button onClick={saveTimetable} disabled={!selectedClass || saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Saving..." : "Save"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowCopyDialog(true)}
                  disabled={!selectedClass}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
                <Button
                  variant="destructive"
                  onClick={clearDay}
                  disabled={!selectedClass}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Timetable Editor */}
        {selectedClass ? (
          <Card>
            <CardHeader>
              <CardTitle>
                <Calendar className="h-5 w-5 inline mr-2" />
                {getClassName(selectedClass)} - Day Order {selectedDayOrder}
              </CardTitle>
              <CardDescription>
                Assign subjects and teachers for each period. Changes are saved when you click Save.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading timetable...
                </div>
              ) : assignments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No teacher-subject assignments found for this class.</p>
                  <p className="text-sm mt-2">
                    Please add assignments in the &quot;Mapping&quot; tab first.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => router.push("/admin/manage")}
                  >
                    Go to Mapping
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">Period</TableHead>
                      <TableHead className="w-32">Time</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Teacher</TableHead>
                      <TableHead className="w-24">Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {timetable.map(entry => (
                      <TableRow
                        key={entry.period_number}
                        className={entry.is_break ? "bg-muted/50" : ""}
                      >
                        <TableCell className="font-medium">
                          {entry.period_number}
                        </TableCell>
                        <TableCell className="text-sm">
                          <Clock className="h-3 w-3 inline mr-1 opacity-50" />
                          {entry.start_time?.slice(0, 5)} - {entry.end_time?.slice(0, 5)}
                        </TableCell>
                        <TableCell>
                          {entry.is_break ? (
                            <Input
                              placeholder="Break name (e.g., Lunch)"
                              value={entry.break_name || ""}
                              onChange={e =>
                                handleEntryChange(entry.period_number, "break_name", e.target.value)
                              }
                              className="max-w-[200px]"
                            />
                          ) : (
                            <Select
                              value={entry.subject_id || "none"}
                              onValueChange={value =>
                                handleEntryChange(entry.period_number, "subject_id", value === "none" ? null : value)
                              }
                            >
                              <SelectTrigger className="max-w-[250px]">
                                <SelectValue placeholder="Select subject">
                                  {entry.subjects?.subject_name || entry.subject_id ? 
                                    getSubjectsForClass().find(s => s.id === entry.subject_id)?.subject_name || "Select subject"
                                    : "Select subject"}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">-- No Subject --</SelectItem>
                                {getSubjectsForClass().map(subject => (
                                  <SelectItem key={subject.id} value={subject.id}>
                                    <BookOpen className="h-3 w-3 inline mr-1" />
                                    {subject.subject_name} ({subject.subject_code})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell>
                          {entry.is_break ? (
                            <span className="text-muted-foreground">-</span>
                          ) : entry.subject_id ? (
                            <Select
                              value={entry.teacher_id || "none"}
                              onValueChange={value =>
                                handleEntryChange(entry.period_number, "teacher_id", value === "none" ? null : value)
                              }
                            >
                              <SelectTrigger className="max-w-[200px]">
                                <SelectValue placeholder="Select teacher">
                                  {entry.users?.name || entry.teacher_id ?
                                    getTeachersForSubject(entry.subject_id).find(t => t.id === entry.teacher_id)?.name || "Select teacher"
                                    : "Select teacher"}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {getTeachersForSubject(entry.subject_id).length === 0 ? (
                                  <SelectItem value="none" disabled>No teachers assigned</SelectItem>
                                ) : (
                                  getTeachersForSubject(entry.subject_id).map(teacher => (
                                    <SelectItem key={teacher.id} value={teacher.id}>
                                      <User className="h-3 w-3 inline mr-1" />
                                      {teacher.name}
                                    </SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-muted-foreground">Select subject first</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={entry.is_break ? "break" : "class"}
                            onValueChange={value =>
                              handleEntryChange(
                                entry.period_number,
                                "is_break",
                                value === "break"
                              )
                            }
                          >
                            <SelectTrigger className="w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="class">Class</SelectItem>
                              <SelectItem value="break">Break</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>Select a class to configure its timetable</p>
            </CardContent>
          </Card>
        )}

        {/* Copy Dialog */}
        <Dialog open={showCopyDialog} onOpenChange={setShowCopyDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Copy Timetable</DialogTitle>
              <DialogDescription>
                Copy Day {selectedDayOrder} timetable to another day order
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label>Copy to Day Order</Label>
              <div className="flex gap-2 flex-wrap mt-2">
                {Array.from({ length: totalDayOrders }, (_, i) => i + 1)
                  .filter(day => day !== selectedDayOrder)
                  .map(day => (
                    <Button
                      key={day}
                      variant={copyTargetDay === day ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCopyTargetDay(day)}
                    >
                      Day {day}
                    </Button>
                  ))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCopyDialog(false)}>
                Cancel
              </Button>
              <Button onClick={copyToAnotherDay}>
                <Copy className="h-4 w-4 mr-2" />
                Copy to Day {copyTargetDay}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Period Configuration Dialog */}
        <Dialog open={showPeriodConfig} onOpenChange={setShowPeriodConfig}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                <Settings className="h-5 w-5 inline mr-2" />
                Configure Period Timings
              </DialogTitle>
              <DialogDescription>
                Set the start and end times for each period. Changes apply to all classes.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm text-muted-foreground">
                  {editablePeriods.length} periods configured
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const lastPeriod = editablePeriods[editablePeriods.length - 1]
                    const newPeriodNum = (lastPeriod?.period_number || 0) + 1
                    setEditablePeriods([
                      ...editablePeriods,
                      {
                        period_number: newPeriodNum,
                        period_name: `Period ${newPeriodNum}`,
                        start_time: lastPeriod?.end_time || "09:00",
                        end_time: "10:00",
                        is_break: false
                      }
                    ])
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Period
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Start Time</TableHead>
                    <TableHead>End Time</TableHead>
                    <TableHead className="w-24">Type</TableHead>
                    <TableHead className="w-16">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {editablePeriods.map((period, index) => (
                    <TableRow key={period.period_number} className={period.is_break ? "bg-muted/50" : ""}>
                      <TableCell className="font-medium">{period.period_number}</TableCell>
                      <TableCell>
                        <Input
                          value={period.period_name}
                          onChange={(e) => {
                            const updated = [...editablePeriods]
                            updated[index] = { ...period, period_name: e.target.value }
                            setEditablePeriods(updated)
                          }}
                          className="w-32"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="time"
                          value={period.start_time}
                          onChange={(e) => {
                            const updated = [...editablePeriods]
                            updated[index] = { ...period, start_time: e.target.value }
                            setEditablePeriods(updated)
                          }}
                          className="w-28"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="time"
                          value={period.end_time}
                          onChange={(e) => {
                            const updated = [...editablePeriods]
                            updated[index] = { ...period, end_time: e.target.value }
                            setEditablePeriods(updated)
                          }}
                          className="w-28"
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={period.is_break ? "break" : "class"}
                          onValueChange={(value) => {
                            const updated = [...editablePeriods]
                            updated[index] = { ...period, is_break: value === "break" }
                            setEditablePeriods(updated)
                          }}
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="class">Class</SelectItem>
                            <SelectItem value="break">Break</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => {
                            setEditablePeriods(editablePeriods.filter((_, i) => i !== index))
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPeriodConfig(false)}>
                Cancel
              </Button>
              <Button onClick={savePeriodConfig} disabled={savingPeriods}>
                <Save className="h-4 w-4 mr-2" />
                {savingPeriods ? "Saving..." : "Save Periods"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
