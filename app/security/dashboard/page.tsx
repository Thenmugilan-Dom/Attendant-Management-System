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
  roll_number: string
  class_name: string
  section: string
  od_date: string
  start_date: string
  end_date: string
  reason: string
  teacher_approval: string
  admin_approval: string
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
      let studentQuery = supabase.from("students").select("id, name, email, roll_number, class_id")
      
      if (searchType === "roll") {
        studentQuery = studentQuery.ilike("roll_number", `%${searchQuery}%`)
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
          students (name, email, roll_number, class_id, classes (class_name, section)),
          subjects (subject_name, subject_code)
        `)
        .in("student_id", studentIds)
        .or(`od_date.eq.${todayDate},and(start_date.lte.${todayDate},end_date.gte.${todayDate})`)
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
        roll_number: od.students?.roll_number || "",
        class_name: od.students?.classes?.class_name || "",
        section: od.students?.classes?.section || "",
        od_date: od.od_date,
        start_date: od.start_date,
        end_date: od.end_date,
        reason: od.reason,
        teacher_approval: od.teacher_approval || "pending",
        admin_approval: od.admin_approval || "pending",
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

  const getApprovalStatus = (teacherApproval: string, adminApproval: string) => {
    if (teacherApproval === "approved" && adminApproval === "approved") {
      return { status: "APPROVED", color: "bg-green-500", icon: CheckCircle }
    } else if (teacherApproval === "rejected" || adminApproval === "rejected") {
      return { status: "REJECTED", color: "bg-red-500", icon: XCircle }
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
      <header className="bg-slate-800/80 backdrop-blur border-b border-slate-700 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Security Portal</h1>
              <p className="text-xs text-slate-400">OD Verification System</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-slate-300">{formatDate(todayDate)}</p>
              <p className="text-xs text-slate-500">Today</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Search Card */}
        <Card className="bg-slate-800/50 border-slate-700 mb-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
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
                  className={searchType === "roll" ? "bg-amber-500 hover:bg-amber-600" : "border-slate-600 text-slate-300"}
                >
                  Roll No
                </Button>
                <Button
                  variant={searchType === "name" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSearchType("name")}
                  className={searchType === "name" ? "bg-amber-500 hover:bg-amber-600" : "border-slate-600 text-slate-300"}
                >
                  Name
                </Button>
                <Button
                  variant={searchType === "email" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSearchType("email")}
                  className={searchType === "email" ? "bg-amber-500 hover:bg-amber-600" : "border-slate-600 text-slate-300"}
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
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                />
                <Button
                  onClick={handleSearch}
                  disabled={loading}
                  className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
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
            <h2 className="text-lg font-semibold text-white">
              {results.length > 0 
                ? `Found ${results.length} OD request(s) for today` 
                : "No OD requests found for today"}
            </h2>

            {results.length === 0 && (
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="py-12 text-center">
                  <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                  <p className="text-slate-300 text-lg">No approved OD found for this student today</p>
                  <p className="text-slate-500 text-sm mt-2">
                    The student does not have any OD request approved for {formatDate(todayDate)}
                  </p>
                </CardContent>
              </Card>
            )}

            {results.map((od) => {
              const approval = getApprovalStatus(od.teacher_approval, od.admin_approval)
              const StatusIcon = approval.icon
              
              return (
                <Card key={od.id} className="bg-slate-800/50 border-slate-700 overflow-hidden">
                  <div className={`h-2 ${approval.color}`} />
                  <CardContent className="p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Student Info */}
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center">
                          <User className="w-6 h-6 text-slate-400" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-white">{od.student_name}</h3>
                          <p className="text-slate-400">{od.roll_number}</p>
                          <p className="text-sm text-slate-500">{od.class_name} - {od.section}</p>
                        </div>
                      </div>

                      {/* OD Details */}
                      <div className="flex flex-col sm:flex-row gap-4 lg:gap-8">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-slate-500" />
                          <div>
                            <p className="text-xs text-slate-500">OD Date</p>
                            <p className="text-sm text-white">
                              {od.start_date && od.end_date 
                                ? `${formatDate(od.start_date)} - ${formatDate(od.end_date)}`
                                : formatDate(od.od_date)}
                            </p>
                          </div>
                        </div>

                        {od.subject_name && (
                          <div className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-slate-500" />
                            <div>
                              <p className="text-xs text-slate-500">Subject</p>
                              <p className="text-sm text-white">{od.subject_code || od.subject_name}</p>
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
                    <div className="mt-4 p-3 bg-slate-700/50 rounded-lg">
                      <p className="text-xs text-slate-500 mb-1">Reason</p>
                      <p className="text-sm text-slate-300">{od.reason}</p>
                    </div>

                    {/* Approval Details */}
                    <div className="mt-4 grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-2">
                        {od.teacher_approval === "approved" ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : od.teacher_approval === "rejected" ? (
                          <XCircle className="w-4 h-4 text-red-500" />
                        ) : (
                          <Clock className="w-4 h-4 text-yellow-500" />
                        )}
                        <span className="text-sm text-slate-400">
                          Teacher: <span className="text-white capitalize">{od.teacher_approval}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {od.admin_approval === "approved" ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : od.admin_approval === "rejected" ? (
                          <XCircle className="w-4 h-4 text-red-500" />
                        ) : (
                          <Clock className="w-4 h-4 text-yellow-500" />
                        )}
                        <span className="text-sm text-slate-400">
                          Admin: <span className="text-white capitalize">{od.admin_approval}</span>
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
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="py-8">
              <h3 className="text-lg font-semibold text-white mb-4 text-center">How to Use</h3>
              <div className="grid sm:grid-cols-3 gap-6 max-w-2xl mx-auto">
                <div className="text-center">
                  <div className="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-amber-500 font-bold">1</span>
                  </div>
                  <p className="text-sm text-slate-400">Select search type (Roll No, Name, or Email)</p>
                </div>
                <div className="text-center">
                  <div className="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-amber-500 font-bold">2</span>
                  </div>
                  <p className="text-sm text-slate-400">Enter student details and click Search</p>
                </div>
                <div className="text-center">
                  <div className="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-amber-500 font-bold">3</span>
                  </div>
                  <p className="text-sm text-slate-400">Check if OD is APPROVED by both Teacher & Admin</p>
                </div>
              </div>

              <div className="mt-8 p-4 bg-slate-700/50 rounded-lg max-w-md mx-auto">
                <h4 className="text-sm font-semibold text-white mb-2">Status Legend</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full" />
                    <span className="text-slate-300">APPROVED - Student can leave campus</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                    <span className="text-slate-300">PENDING - Awaiting approval</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full" />
                    <span className="text-slate-300">REJECTED - OD not approved</span>
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
