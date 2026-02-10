"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Shield, Search, CheckCircle, XCircle, Clock, LogOut, User, Calendar, BookOpen, AlertTriangle } from "lucide-react"

interface ODRequest {
  id: string
  student_id: string
  student_name: string
  student_email: string
  student_id_text: string
  class_name: string
  section: string
  od_start_date: string
  od_end_date: string
  reason: string
  status: string
  teacher_approved: boolean
  admin_approved: boolean
  created_at: string
  subject_name?: string
  subject_code?: string
}

export default function SecurityDashboard() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [searchType, setSearchType] = useState<"roll" | "name" | "email">("roll")
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<ODRequest[]>([])
  const [searched, setSearched] = useState(false)
  const [todayDate] = useState(new Date().toISOString().split("T")[0])

  useEffect(() => {
    // Check if security is logged in
    const session = localStorage.getItem("security_session")
    if (!session) {
      router.push("/security")
      return
    }

    try {
      const parsed = JSON.parse(session)
      if (!parsed.loggedIn) {
        router.push("/security")
      }
    } catch {
      router.push("/security")
    }
  }, [router])

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      alert("Please enter a search term")
      return
    }

    setLoading(true)
    setSearched(true)

    try {
      // First, find the student
      let studentQuery = supabase.from("students").select("id, name, email, student_id, class_id")
      
      if (searchType === "roll") {
        studentQuery = studentQuery.ilike("student_id", `%${searchQuery}%`)
      } else if (searchType === "name") {
        studentQuery = studentQuery.ilike("name", `%${searchQuery}%`)
      } else {
        studentQuery = studentQuery.ilike("email", `%${searchQuery}%`)
      }

      const { data: students, error: studentError } = await studentQuery

      if (studentError) {
        console.error("Student search error:", studentError)
        setResults([])
        return
      }

      if (!students || students.length === 0) {
        setResults([])
        return
      }

      // Get OD requests for these students (for today or active date range)
      const studentIds = students.map(s => s.id)
      
      const { data: odRequests, error: odError } = await supabase
        .from("od_requests")
        .select(`
          *,
          students (name, email, student_id, class_id, classes (class_name, section)),
          subjects (subject_name, subject_code)
        `)
        .in("student_id", studentIds)
        .lte("od_start_date", todayDate)
        .gte("od_end_date", todayDate)
        .order("created_at", { ascending: false })

      if (odError) {
        console.error("OD search error:", odError)
        setResults([])
        return
      }

      // Format results
      const formattedResults: ODRequest[] = (odRequests || []).map((od: any) => ({
        id: od.id,
        student_id: od.student_id,
        student_name: od.students?.name || "Unknown",
        student_email: od.students?.email || "",
        student_id_text: od.students?.student_id || "",
        class_name: od.students?.classes?.class_name || "",
        section: od.students?.classes?.section || "",
        od_start_date: od.od_start_date,
        od_end_date: od.od_end_date,
        reason: od.reason,
        status: od.status || "pending",
        teacher_approved: od.teacher_approved || false,
        admin_approved: od.admin_approved || false,
        created_at: od.created_at,
        subject_name: od.subjects?.subject_name,
        subject_code: od.subjects?.subject_code,
      }))

      setResults(formattedResults)
    } catch (err) {
      console.error("Search error:", err)
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("security_session")
    router.push("/security")
  }

  const getApprovalStatus = (teacherApproved: boolean, adminApproved: boolean, status: string) => {
    if (status === "rejected") {
      return { status: "REJECTED", color: "bg-red-500", icon: XCircle }
    } else if (teacherApproved && adminApproved) {
      return { status: "APPROVED", color: "bg-green-500", icon: CheckCircle }
    } else if (status === "approved") {
      return { status: "APPROVED", color: "bg-green-500", icon: CheckCircle }
    } else {
      return { status: "PENDING", color: "bg-yellow-500", icon: Clock }
    }
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A"
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Security Portal</h1>
              <p className="text-xs text-muted-foreground">OD Verification System</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm">{formatDate(todayDate)}</p>
              <p className="text-xs text-muted-foreground">Today</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Search Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              Search Student OD Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex gap-2">
                <Button
                  variant={searchType === "roll" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSearchType("roll")}
                  className={searchType === "roll" ? "bg-primary hover:bg-primary/90 text-white" : ""}
                >
                  Roll No
                </Button>
                <Button
                  variant={searchType === "name" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSearchType("name")}
                  className={searchType === "name" ? "bg-primary hover:bg-primary/90 text-white" : ""}
                >
                  Name
                </Button>
                <Button
                  variant={searchType === "email" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSearchType("email")}
                  className={searchType === "email" ? "bg-primary hover:bg-primary/90 text-white" : ""}
                >
                  Email
                </Button>
              </div>
              <div className="flex-1 flex gap-2">
                <Input
                  placeholder={`Enter student ${searchType === "roll" ? "roll number" : searchType}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <Button
                  onClick={handleSearch}
                  disabled={loading}
                  className="bg-primary hover:bg-primary/90 text-white"
                >
                  {loading ? "Searching..." : "Search"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {searched && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">
              {results.length > 0 
                ? `Found ${results.length} OD request(s) for today` 
                : "No OD requests found for today"}
            </h2>

            {results.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <AlertTriangle className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
                  <p className="text-lg">No approved OD found for this student today</p>
                  <p className="text-muted-foreground text-sm mt-2">
                    The student does not have any OD request approved for {formatDate(todayDate)}
                  </p>
                </CardContent>
              </Card>
            )}

            {results.map((od) => {
              const approval = getApprovalStatus(od.teacher_approved, od.admin_approved, od.status)
              const StatusIcon = approval.icon
              
              return (
                <Card key={od.id} className="overflow-hidden">
                  <div className={`h-2 ${approval.color}`} />
                  <CardContent className="p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Student Info */}
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                          <User className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold">{od.student_name}</h3>
                          <p className="text-muted-foreground">{od.student_id_text}</p>
                          <p className="text-sm text-muted-foreground">{od.class_name} - {od.section}</p>
                        </div>
                      </div>

                      {/* OD Details */}
                      <div className="flex flex-col sm:flex-row gap-4 lg:gap-8">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="text-xs text-muted-foreground">OD Date</p>
                            <p className="text-sm">
                              {od.od_start_date === od.od_end_date
                                ? formatDate(od.od_start_date)
                                : `${formatDate(od.od_start_date)} - ${formatDate(od.od_end_date)}`}
                            </p>
                          </div>
                        </div>

                        {od.subject_name && (
                          <div className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-muted-foreground" />
                            <div>
                              <p className="text-xs text-muted-foreground">Subject</p>
                              <p className="text-sm">{od.subject_code || od.subject_name}</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Approval Status */}
                      <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${approval.color}`}>
                        <StatusIcon className="w-5 h-5 text-white" />
                        <span className="font-bold text-white">{approval.status}</span>
                      </div>
                    </div>

                    {/* Reason */}
                    <div className="mt-4 p-3 bg-muted rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Reason</p>
                      <p className="text-sm">{od.reason}</p>
                    </div>

                    {/* Approval Details */}
                    <div className="mt-4 grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-2">
                        {od.teacher_approved ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <Clock className="w-4 h-4 text-yellow-600" />
                        )}
                        <span className="text-sm">
                          Teacher: <span className="font-medium">{od.teacher_approved ? "Approved" : "Pending"}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {od.admin_approved ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <Clock className="w-4 h-4 text-yellow-600" />
                        )}
                        <span className="text-sm">
                          Admin: <span className="font-medium">{od.admin_approved ? "Approved" : "Pending"}</span>
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* Quick Guide */}
        {!searched && (
          <Card>
            <CardContent className="py-8">
              <h3 className="text-lg font-semibold mb-4 text-center">How to Use</h3>
              <div className="grid sm:grid-cols-3 gap-6 max-w-2xl mx-auto">
                <div className="text-center">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-primary font-bold">1</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Select search type (Roll No, Name, or Email)</p>
                </div>
                <div className="text-center">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-primary font-bold">2</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Enter student details and click Search</p>
                </div>
                <div className="text-center">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-primary font-bold">3</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Check if OD is APPROVED by both Teacher & Admin</p>
                </div>
              </div>

              <div className="mt-8 p-4 bg-muted rounded-lg max-w-md mx-auto">
                <h4 className="text-sm font-semibold mb-2">Status Legend</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-600 rounded-full" />
                    <span className="text-muted-foreground">APPROVED - Student can leave campus</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-yellow-600 rounded-full" />
                    <span className="text-muted-foreground">PENDING - Awaiting approval</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-600 rounded-full" />
                    <span className="text-muted-foreground">REJECTED - OD not approved</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
