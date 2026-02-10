"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { DashboardNav } from "@/components/dashboard-nav"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Search, GraduationCap, Mail, Book, ChevronDown, ChevronRight, Users, X } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { supabase } from "@/lib/supabase"

interface User {
  id: string
  email: string
  role: string
  name?: string
}

interface Student {
  id: string
  email: string
  name: string
  class_name?: string
  section?: string
  created_at: string
}

export default function StudentsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedClass, setSelectedClass] = useState<string | null>(null)
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set())

  useEffect(() => {
    // Check authentication
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
    fetchStudents()
  }, [router])

  useEffect(() => {
    // Filter students based on search term and selected class
    let filtered = students

    // Apply class filter
    if (selectedClass) {
      filtered = filtered.filter(student => {
        const studentClassKey = student.class_name
          ? `${student.class_name}${student.section ? " - " + student.section : ""}`
          : "Unassigned"
        return studentClassKey === selectedClass
      })
    }

    // Apply search term filter
    if (searchTerm.trim() !== "") {
      filtered = filtered.filter(student =>
        student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (student.class_name && student.class_name.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    }

    setFilteredStudents(filtered)
  }, [searchTerm, students, selectedClass])

  // Group students by class
  const groupedStudents = useMemo(() => {
    const groups: Record<string, Student[]> = {}
    filteredStudents.forEach(student => {
      const key = student.class_name
        ? `${student.class_name}${student.section ? " - " + student.section : ""}`
        : "Unassigned"
      if (!groups[key]) groups[key] = []
      groups[key].push(student)
    })
    // Sort class names alphabetically
    const sorted: Record<string, Student[]> = {}
    Object.keys(groups).sort((a, b) => {
      if (a === "Unassigned") return 1
      if (b === "Unassigned") return -1
      return a.localeCompare(b)
    }).forEach(key => {
      sorted[key] = groups[key]
    })
    return sorted
  }, [filteredStudents])

  // When search term changes, auto-expand all classes so filtered results are visible
  useEffect(() => {
    if (searchTerm.trim() !== "") {
      setExpandedClasses(new Set(Object.keys(groupedStudents)))
    }
  }, [searchTerm, groupedStudents])

  const fetchStudents = async () => {
    try {
      setLoading(true)
      
      const { data: studentsData, error: studentsError } = await supabase
        .from("students")
        .select(`
          *,
          classes (
            class_name
          )
        `)
        .order("name", { ascending: true })

      if (studentsError) {
        console.error("Error fetching students:", studentsError)
      } else {
        const formattedStudents = (studentsData || []).map(student => ({
          id: student.student_id,
          email: student.email,
          name: student.name,
          class_name: student.classes?.class_name,
          section: student.section,
          created_at: student.created_at
        }))

        setStudents(formattedStudents)
        setFilteredStudents(formattedStudents)
      }
    } catch (error) {
      console.error("Error fetching students:", error)
    } finally {
      setLoading(false)
    }
  }

  const toggleClass = (className: string) => {
    setExpandedClasses(prev => {
      const next = new Set(prev)
      if (next.has(className)) {
        next.delete(className)
      } else {
        next.add(className)
      }
      return next
    })
  }

  const expandAll = () => {
    setExpandedClasses(new Set(Object.keys(groupedStudents)))
  }

  const collapseAll = () => {
    setExpandedClasses(new Set())
  }

  if (!user) {
    return null
  }

  const classNames = Object.keys(groupedStudents)

  return (
    <div className="min-h-screen bg-muted/40">
      <DashboardNav userName={user.name} userEmail={user.email} userRole={user.role} />
      
      <main className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => router.push("/admin")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
            <div>
              <h2 className="text-3xl font-bold tracking-tight">All Students</h2>
              <p className="text-muted-foreground">
                Manage and view all registered students
              </p>
            </div>
          </div>
        </div>

        {/* Search & Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Filters & Search
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Class Filter */}
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">Filter by Class</label>
                <div className="flex gap-2 flex-wrap items-end">
                  <Select value={selectedClass || ""} onValueChange={(value) => setSelectedClass(value || null)}>
                    <SelectTrigger className="w-full md:w-80">
                      <SelectValue placeholder="Select a class to view students..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Classes</SelectItem>
                      {classNames.map((className) => (
                        <SelectItem key={className} value={className}>
                          {className} ({groupedStudents[className].length} students)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedClass && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedClass(null)}
                      className="text-xs"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Clear
                    </Button>
                  )}
                </div>
              </div>

              {/* Search */}
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">Search Students</label>
                <div className="flex items-center space-x-2 flex-1">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              {/* Controls */}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={expandAll}>
                  Expand All
                </Button>
                <Button variant="outline" size="sm" onClick={collapseAll}>
                  Collapse All
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{filteredStudents.length}</p>
                  <p className="text-xs text-muted-foreground">Total Students</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{classNames.length}</p>
                  <p className="text-xs text-muted-foreground">Classes</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Students Grouped by Class */}
        {loading ? (
          <Card>
            <CardContent className="py-8">
              <div className="text-center text-muted-foreground">Loading students...</div>
            </CardContent>
          </Card>
        ) : classNames.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <div className="text-center text-muted-foreground">
                {searchTerm ? "No students found matching your search." : "No students found."}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {classNames.map((className) => {
              const classStudents = groupedStudents[className]
              const isExpanded = expandedClasses.has(className)

              return (
                <Card key={className} className="overflow-hidden">
                  <CardHeader
                    className="cursor-pointer hover:bg-primary/5 transition-all duration-200 rounded-t-lg select-none"
                    onClick={() => toggleClass(className)}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="flex-shrink-0">
                          {isExpanded ? (
                            <ChevronDown className="h-6 w-6 text-primary font-bold" />
                          ) : (
                            <ChevronRight className="h-6 w-6 text-primary font-bold" />
                          )}
                        </div>
                        <Book className="h-6 w-6 text-primary flex-shrink-0" />
                        <div className="min-w-0">
                          <CardTitle className="text-lg font-bold text-primary truncate">
                            {className}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground mt-1">
                            Click to view {classStudents.length} student{classStudents.length !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                      <span className="flex-shrink-0 text-sm font-semibold text-white bg-primary px-3 py-2 rounded-lg whitespace-nowrap">
                        {classStudents.length} student{classStudents.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </CardHeader>

                  {isExpanded && (
                    <CardContent className="pt-0">
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full">
                          <thead>
                            <tr className="bg-muted/50 text-left text-sm font-medium text-muted-foreground">
                              <th className="px-4 py-3 w-12">#</th>
                              <th className="px-4 py-3">Name</th>
                              <th className="px-4 py-3">Email</th>
                              <th className="px-4 py-3">Student ID</th>
                              <th className="px-4 py-3">Joined</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {classStudents.map((student, idx) => (
                              <tr key={student.id} className="hover:bg-muted/30 transition-colors">
                                <td className="px-4 py-3 text-sm text-muted-foreground">{idx + 1}</td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                      <GraduationCap className="h-4 w-4 text-primary" />
                                    </div>
                                    <span className="font-medium">{student.name}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-sm text-muted-foreground">
                                  <div className="flex items-center gap-1">
                                    <Mail className="h-3 w-3" />
                                    {student.email}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-sm font-mono text-muted-foreground">
                                  {student.id}
                                </td>
                                <td className="px-4 py-3 text-sm text-muted-foreground">
                                  {new Date(student.created_at).toLocaleDateString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
