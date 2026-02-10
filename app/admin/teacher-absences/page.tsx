"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DashboardNav } from "@/components/dashboard-nav"
import { Calendar, User, BookOpen, Search, ChevronDown } from "lucide-react"
import { supabase } from "@/lib/supabase"

interface User {
  id: string
  email: string
  name: string
  role: string
}

interface AbsenceRecord {
  id: string
  teacher_id: string
  absence_start_date: string
  absence_end_date: string
  reason: string
  status: string
  created_at: string
  original_teacher: {
    id: string
    name: string
    email: string
  }
  class_transfers: {
    id: string
    original_teacher_id: string
    substitute_teacher_id: string
    class_id: string
    subject_id: string
    transfer_date: string
    transfer_start_time: string
    transfer_end_time: string
    notes: string
    created_by_teacher_id: string
    substitute_teacher: {
      name: string
      email: string
    }
    classes: {
      id: string
      class_name: string
      section: string
    }
    subjects: {
      id: string
      subject_name: string
      subject_code: string
    }
  }[]
}

interface APIResponse {
  count: number
  data: AbsenceRecord[]
}

export default function TeacherAbsencesPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)

  const [absences, setAbsences] = useState<AbsenceRecord[]>([])
  const [filteredAbsences, setFilteredAbsences] = useState<AbsenceRecord[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [expandedAbsence, setExpandedAbsence] = useState<string | null>(null)
  const [dateFilter, setDateFilter] = useState({ start: "", end: "" })
  const [fetching, setFetching] = useState(false)

  useEffect(() => {
    const checkAuthAndLoadData = async () => {
      try {
        const userData = sessionStorage.getItem("user")
        if (!userData) {
          router.replace("/login")
          return
        }

        const parsedUser = JSON.parse(userData)
        if (parsedUser.role !== "admin") {
          router.replace("/login")
          return
        }

        setUser(parsedUser)
        setIsAuthorized(true)

        await fetchAbsences()
      } catch (error) {
        console.error("Error checking auth:", error)
        router.replace("/login")
      } finally {
        setLoading(false)
      }
    }

    checkAuthAndLoadData()
  }, [router])

  const fetchAbsences = async () => {
    setFetching(true)
    try {
      const response = await fetch(
        `/api/admin/teacher-absences${
          dateFilter.start || dateFilter.end
            ? `?startDate=${dateFilter.start}&endDate=${dateFilter.end}`
            : ""
        }`
      )

      if (!response.ok) {
        console.error("Error fetching absences")
        return
      }

      const data: APIResponse = await response.json()
      setAbsences(data.data || [])
      setFilteredAbsences(data.data || [])
    } catch (error) {
      console.error("Error fetching absences:", error)
    } finally {
      setFetching(false)
    }
  }

  useEffect(() => {
    const filtered = absences.filter((absence) => {
      const teacherMatch =
        absence.original_teacher.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        absence.original_teacher.email.toLowerCase().includes(searchTerm.toLowerCase())

      const classMatch = absence.class_transfers.some(
        (transfer) =>
          transfer.classes.class_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          transfer.subjects.subject_name.toLowerCase().includes(searchTerm.toLowerCase())
      )

      return teacherMatch || classMatch
    })

    setFilteredAbsences(filtered)
  }, [searchTerm, absences])

  const calculateDays = (startDate: string, endDate: string) => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
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
        userRole={user?.role || "admin"}
      />

      <main className="container mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Teacher Absences & Transfers</h2>
          <p className="text-muted-foreground mt-2">
            View all teacher absences and their assigned class substitutes
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Absences</p>
              <p className="text-3xl font-bold mt-2">{absences.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Active Absences</p>
              <p className="text-3xl font-bold mt-2">
                {absences.filter((a) => new Date(a.absence_end_date) >= new Date()).length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Total Transfers</p>
              <p className="text-3xl font-bold mt-2">
                {absences.reduce((sum, a) => sum + a.class_transfers.length, 0)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="search">Search Teacher or Class</Label>
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Search by name, email, or class..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="start-date">Start Date (Optional)</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={dateFilter.start}
                  onChange={(e) => setDateFilter({ ...dateFilter, start: e.target.value })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="end-date">End Date (Optional)</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={dateFilter.end}
                  onChange={(e) => setDateFilter({ ...dateFilter, end: e.target.value })}
                  className="mt-2"
                />
              </div>
            </div>
            <Button onClick={fetchAbsences} disabled={fetching} className="w-full md:w-auto">
              {fetching ? "Searching..." : "Search"}
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="space-y-3">
          {filteredAbsences.length === 0 ? (
            <Card className="p-8">
              <div className="text-center">
                <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-2 opacity-50" />
                <p className="text-muted-foreground">No absences found</p>
              </div>
            </Card>
          ) : (
            filteredAbsences.map((absence) => (
              <Card key={absence.id} className="cursor-pointer hover:shadow-md transition-shadow">
                <div
                  onClick={() =>
                    setExpandedAbsence(expandedAbsence === absence.id ? null : absence.id)
                  }
                  className="p-4 md:p-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <User className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate">
                            {absence.original_teacher.name}
                          </h3>
                          <p className="text-sm text-muted-foreground truncate">
                            {absence.original_teacher.email}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">
                            Period
                          </p>
                          <p className="font-medium mt-1">
                            {formatDate(absence.absence_start_date)} -{" "}
                            {formatDate(absence.absence_end_date)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">
                            Days
                          </p>
                          <p className="font-medium mt-1">
                            {calculateDays(
                              absence.absence_start_date,
                              absence.absence_end_date
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">
                            Classes
                          </p>
                          <p className="font-medium mt-1">{absence.class_transfers.length}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">
                            Status
                          </p>
                          <p className="font-medium mt-1">
                            <span
                              className={`px-2 py-1 rounded-full text-xs ${
                                new Date(absence.absence_end_date) >= new Date()
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-green-100 text-green-800"
                              }`}
                            >
                              {new Date(absence.absence_end_date) >= new Date()
                                ? "Active"
                                : "Completed"}
                            </span>
                          </p>
                        </div>
                      </div>

                      {absence.reason && (
                        <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
                          <span className="font-medium">Reason:</span> {absence.reason}
                        </p>
                      )}
                    </div>

                    <ChevronDown
                      className={`w-5 h-5 text-muted-foreground transition-transform flex-shrink-0 ${
                        expandedAbsence === absence.id ? "rotate-180" : ""
                      }`}
                    />
                  </div>

                  {/* Expanded Details */}
                  {expandedAbsence === absence.id && (
                    <div className="mt-4 pt-4 border-t space-y-3">
                      <h4 className="font-semibold text-sm mb-3">Class Transfers</h4>
                      {absence.class_transfers.map((transfer) => (
                        <div
                          key={transfer.id}
                          className="p-3 bg-muted/50 rounded-lg space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className="font-medium text-sm">
                                {transfer.classes.class_name} {transfer.classes.section}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {transfer.subjects.subject_name}
                              </p>
                            </div>
                            <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded whitespace-nowrap">
                              {transfer.transfer_date
                                ? new Date(transfer.transfer_date).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                  })
                                : "TBD"}
                            </span>
                          </div>

                          <div className="text-xs">
                            <p className="text-muted-foreground">
                              <span className="font-medium">Original Teacher:</span>{" "}
                              {absence.original_teacher.name}
                            </p>
                            <p className="text-muted-foreground">
                              <span className="font-medium">Substitute:</span>{" "}
                              {transfer.substitute_teacher?.name || "Not assigned"}
                            </p>
                            {transfer.substitute_teacher?.email && (
                              <p className="text-muted-foreground text-xs">
                                {transfer.substitute_teacher.email}
                              </p>
                            )}
                          </div>

                          {transfer.notes && (
                            <p className="text-xs bg-white/50 p-2 rounded italic">
                              {transfer.notes}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  )
}
