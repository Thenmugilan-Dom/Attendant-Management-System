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
import { Users, BookOpen, GraduationCap, Link2, Plus, Pencil, Trash2, LogOut, LayoutDashboard, Eye, Upload, Download, Calendar, RefreshCw, Clock, X, AlertCircle, MapPin, Crosshair } from "lucide-react"

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
  total_students: number
  department?: string
  class_email?: string
  latitude?: number | null
  longitude?: number | null
  location_radius?: number
}

interface Subject {
  id: string
  subject_code: string
  subject_name: string
  credits?: number
  semester?: number
}

interface Teacher {
  id: string
  name: string
  email: string
  username: string
  department?: string
  phone?: string
  user_type: string
  status: string
  plain_password?: string
  created_at?: string
  assignments?: Array<{
    subject: {
      subject_code: string
      subject_name: string
      credits?: number
      semester?: number
    }
    class: {
      class_name: string
      section?: string
      year?: number
    }
  }>
}

interface Assignment {
  id: string
  teacher_id: string
  subject_id: string
  class_id: string
  teacher?: Teacher
  subject?: Subject
  class?: Class
}

interface Student {
  id: string
  student_id: string
  name: string
  email: string
  phone?: string
  address?: string
  parent_phone?: string
  parent_name?: string
  class_id: string
  status: string
  classes?: {
    id: string
    class_name: string
    section?: string
    year?: number
  }
}

export default function AdminManagementPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [activeTab, setActiveTab] = useState<"classes" | "subjects" | "teachers" | "assignments" | "students" | "dayorder">("classes")
  
  // Data states
  const [classes, setClasses] = useState<Class[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [selectedStudentClass, setSelectedStudentClass] = useState<string | null>(null)
  
  // Day Order states
  const [currentDayOrder, setCurrentDayOrder] = useState<number | null>(null)
  const [dayOrderConfig, setDayOrderConfig] = useState<{totalDays: number; department: string} | null>(null)
  const [dayOrderHistory, setDayOrderHistory] = useState<Array<{
    id: string
    day_order: number
    effective_date: string
    is_holiday: boolean
    holiday_name: string | null
    reason: string | null
    users?: { name: string; email: string }
  }>>([])
  const [upcomingDayOrders, setUpcomingDayOrders] = useState<Array<{
    date: string
    dayOrder: number
    isHoliday: boolean
    holidayName: string | null
    isExplicit: boolean
  }>>([])
  const [dayOrderLoading, setDayOrderLoading] = useState(false)
  const [showDayOrderDialog, setShowDayOrderDialog] = useState(false)
  const [dayOrderDialogMode, setDayOrderDialogMode] = useState<"set" | "holiday" | "config">("set")
  
  // Excel import states
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [selectedClassForImport, setSelectedClassForImport] = useState("")
  
  // Loading states
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  
  // Dialog states
  const [showDialog, setShowDialog] = useState(false)
  const [dialogMode, setDialogMode] = useState<"add" | "edit">("add")
  const [selectedItem, setSelectedItem] = useState<Class | Subject | Teacher | Student | Assignment | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [generatedPassword, setGeneratedPassword] = useState("")
  const [showViewDialog, setShowViewDialog] = useState(false)
  const [viewTeacher, setViewTeacher] = useState<Teacher | null>(null)
  const [loadingView, setLoadingView] = useState(false)
  const [isAuthorized, setIsAuthorized] = useState(false)

  useEffect(() => {
    // Check authentication immediately
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

    // User is authorized
    setIsAuthorized(true)
    setUser(parsedUser)
    fetchAllData()
  }, []) // Remove router dependency

  const fetchAllData = async () => {
    setFetching(true)
    // Pre-fetch commonly used data in parallel for better UX
    // Classes, teachers, and assignments are needed for most operations
    const userObj = JSON.parse(sessionStorage.getItem("user") || "{}")
    const department = userObj.department || "General"
    
    try {
      await Promise.all([
        fetchClassesOptimized(userObj.id, department),
        fetchTeachersOptimized(),
        fetchAssignmentsOptimized(),
        fetchSubjectsOptimized(userObj.id, department)
      ])
    } catch (error) {
      console.error("Error in parallel fetch:", error)
    }
    setFetching(false)
  }

  // Optimized fetch functions that don't depend on user state
  const fetchClassesOptimized = async (adminId: string, department: string) => {
    try {
      const response = await fetch(`/api/admin/classes?adminId=${adminId}&department=${department}`)
      const data = await response.json()
      if (data?.success && Array.isArray(data.data)) {
        setClasses(data.data)
      } else if (Array.isArray(data)) {
        setClasses(data)
      }
    } catch (error) {
      console.error("Error fetching classes:", error)
    }
  }

  const fetchTeachersOptimized = async () => {
    try {
      const response = await fetch(`/api/admin/users?type=teacher&t=${Date.now()}`)
      const data = await response.json()
      if (data.success) {
        setTeachers(data.users || [])
      }
    } catch (error) {
      console.error("Error fetching teachers:", error)
    }
  }

  const fetchAssignmentsOptimized = async () => {
    try {
      const response = await fetch("/api/admin/assignments")
      const data = await response.json()
      if (data.success) {
        setAssignments(data.assignments || [])
      }
    } catch (error) {
      console.error("Error fetching assignments:", error)
    }
  }

  const fetchSubjectsOptimized = async (adminId: string, department: string) => {
    try {
      const response = await fetch(`/api/admin/subjects?adminId=${adminId}&department=${department}`)
      const data = await response.json()
      if (Array.isArray(data)) {
        setSubjects(data)
      }
    } catch (error) {
      console.error("Error fetching subjects:", error)
    }
  }

  // Fetch data when switching tabs (only for tabs not pre-loaded)
  useEffect(() => {
    // Classes, teachers, subjects, and assignments are pre-loaded
    // Only fetch students and dayorder on demand
    if (activeTab === 'students' && students.length === 0) {
      fetchStudents()
    } else if (activeTab === 'dayorder' && currentDayOrder === null) {
      fetchDayOrderData()
    }
  }, [activeTab])

  const fetchClasses = async () => {
    try {
      if (!user?.id) return
      const userObj = JSON.parse(sessionStorage.getItem("user") || "{}")
      const department = userObj.department || "General"
      const response = await fetch(`/api/admin/classes?adminId=${user.id}&department=${department}`)
      const data = await response.json()
      // Handle success response with data property
      if (data?.success && Array.isArray(data.data)) {
        setClasses(data.data)
      } else if (Array.isArray(data)) {
        setClasses(data)
      } else {
        console.warn("Unexpected response format from classes API:", data)
        setClasses([])
      }
    } catch (error) {
      console.error("Error fetching classes:", error)
      setClasses([])
    }
  }

  const fetchSubjects = async () => {
    try {
      if (!user?.id) return
      const userObj = JSON.parse(sessionStorage.getItem("user") || "{}")
      const department = userObj.department || "General"
      const response = await fetch(`/api/admin/subjects?adminId=${user.id}&department=${department}`)
      const data = await response.json()
      // Ensure data is always an array
      if (Array.isArray(data)) {
        setSubjects(data)
      } else {
        console.warn("Expected array from subjects API, got:", typeof data)
        setSubjects([])
      }
    } catch (error) {
      console.error("Error fetching subjects:", error)
      setSubjects([])
    }
  }

  const fetchTeachers = async () => {
    try {
      const response = await fetch(`/api/admin/users?type=teacher&t=${Date.now()}`)
      const data = await response.json()
      if (data.success) {
        setTeachers(data.users || [])
      }
    } catch (error) {
      console.error("Error fetching teachers:", error)
    }
  }

  const fetchAssignments = async () => {
    try {
      const response = await fetch("/api/admin/assignments")
      const data = await response.json()
      if (data.success) {
        setAssignments(data.assignments || [])
      }
    } catch (error) {
      console.error("Error fetching assignments:", error)
    }
  }

  const fetchStudents = async () => {
    try {
      const response = await fetch("/api/admin/students")
      const data = await response.json()
      if (data.success) {
        setStudents(data.students || [])
      }
    } catch (error) {
      console.error("Error fetching students:", error)
    }
  }

  // Day Order functions
  const fetchDayOrderData = async () => {
    setDayOrderLoading(true)
    try {
      const userObj = JSON.parse(sessionStorage.getItem("user") || "{}")
      const department = userObj.department || "General"
      
      // Fetch current day order
      const currentResponse = await fetch(`/api/admin/day-order?department=${department}&action=current`)
      const currentData = await currentResponse.json()
      if (currentData.success) {
        setCurrentDayOrder(currentData.dayOrder)
        if (currentData.config) {
          setDayOrderConfig(currentData.config)
        }
      }
      
      // Fetch config
      const configResponse = await fetch(`/api/admin/day-order?department=${department}&action=config`)
      const configData = await configResponse.json()
      if (configData.success) {
        setDayOrderConfig(configData.config)
      }
      
      // Fetch history
      const historyResponse = await fetch(`/api/admin/day-order?department=${department}&action=history`)
      const historyData = await historyResponse.json()
      if (historyData.success) {
        setDayOrderHistory(historyData.history || [])
      }
      
      // Fetch upcoming
      const upcomingResponse = await fetch(`/api/admin/day-order?department=${department}&action=upcoming`)
      const upcomingData = await upcomingResponse.json()
      if (upcomingData.success) {
        setUpcomingDayOrders(upcomingData.upcoming || [])
      }
    } catch (error) {
      console.error("Error fetching day order data:", error)
    } finally {
      setDayOrderLoading(false)
    }
  }

  const handleSetDayOrder = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    
    const formData = new FormData(e.currentTarget)
    const userObj = JSON.parse(sessionStorage.getItem("user") || "{}")
    const department = userObj.department || "General"
    
    try {
      const response = await fetch("/api/admin/day-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_day_order",
          department,
          adminId: user?.id,
          dayOrder: parseInt(formData.get("dayOrder") as string),
          effectiveDate: formData.get("effectiveDate"),
          reason: formData.get("reason") || null,
          isHoliday: false
        })
      })
      
      const result = await response.json()
      if (result.success) {
        alert(result.message)
        await fetchDayOrderData()
        setShowDayOrderDialog(false)
      } else {
        alert(result.error || "Failed to set day order")
      }
    } catch (error) {
      console.error("Error:", error)
      alert("Failed to set day order")
    } finally {
      setLoading(false)
    }
  }

  const handleSetHoliday = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    
    const formData = new FormData(e.currentTarget)
    const userObj = JSON.parse(sessionStorage.getItem("user") || "{}")
    const department = userObj.department || "General"
    
    try {
      const response = await fetch("/api/admin/day-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_day_order",
          department,
          adminId: user?.id,
          dayOrder: null,
          effectiveDate: formData.get("effectiveDate"),
          reason: formData.get("reason") || null,
          isHoliday: true,
          holidayName: formData.get("holidayName")
        })
      })
      
      const result = await response.json()
      if (result.success) {
        alert(result.message)
        await fetchDayOrderData()
        setShowDayOrderDialog(false)
      } else {
        alert(result.error || "Failed to set holiday")
      }
    } catch (error) {
      console.error("Error:", error)
      alert("Failed to set holiday")
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateConfig = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    
    const formData = new FormData(e.currentTarget)
    const userObj = JSON.parse(sessionStorage.getItem("user") || "{}")
    const department = userObj.department || "General"
    
    try {
      const response = await fetch("/api/admin/day-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_config",
          department,
          adminId: user?.id,
          totalDays: parseInt(formData.get("totalDays") as string),
          currentDayOrder: parseInt(formData.get("currentDayOrder") as string)
        })
      })
      
      const result = await response.json()
      if (result.success) {
        alert(result.message)
        await fetchDayOrderData()
        setShowDayOrderDialog(false)
      } else {
        alert(result.error || "Failed to update configuration")
      }
    } catch (error) {
      console.error("Error:", error)
      alert("Failed to update configuration")
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteDayOrderSetting = async (settingId: string) => {
    if (!confirm("Are you sure you want to delete this day order setting?")) return
    
    const userObj = JSON.parse(sessionStorage.getItem("user") || "{}")
    const department = userObj.department || "General"
    
    try {
      const response = await fetch("/api/admin/day-order", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settingId, department })
      })
      
      const result = await response.json()
      if (result.success) {
        alert(result.message)
        await fetchDayOrderData()
      } else {
        alert(result.error || "Failed to delete setting")
      }
    } catch (error) {
      console.error("Error:", error)
      alert("Failed to delete setting")
    }
  }

  const handleLogout = () => {
    sessionStorage.removeItem("user")
    sessionStorage.removeItem("token")
    router.push("/login")
  }

  const openAddDialog = () => {
    setDialogMode("add")
    setSelectedItem(null)
    setGeneratedPassword("")
    // Reset assignment form
    setSelectedTeacher("")
    setSelectedSubject("")
    setSelectedClass("")
    setSelectedDayOrder("")
    setSelectedStartTime("")
    setSelectedEndTime("")
    setAutoSessionEnabled(false)
    setShowDialog(true)
  }

  const openEditDialog = (item: Class | Subject | Teacher | Student | Assignment) => {
    setDialogMode("edit")
    setSelectedItem(item)
    setShowDialog(true)
  }

  const closeDialog = () => {
    setShowDialog(false)
    setSelectedItem(null)
    setGeneratedPassword("")
    setShowPassword(false)
    setLoading(false)
    // Reset schedule fields
    setAutoSessionEnabled(false)
    setSelectedDayOrder("")
    setSelectedStartTime("")
    setSelectedEndTime("")
  }

  // Class CRUD operations
  const handleClassSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const userObj = JSON.parse(sessionStorage.getItem("user") || "{}")
    const department = userObj.department || "General"
    
    const data = {
      adminId: user?.id,
      classId: selectedItem?.id,
      class_name: formData.get("class_name"),
      section: formData.get("section") || null,
      year: formData.get("year") ? parseInt(formData.get("year") as string) : null,
      department: department,
      class_email: formData.get("class_email") || null,
      latitude: formData.get("latitude") ? parseFloat(formData.get("latitude") as string) : null,
      longitude: formData.get("longitude") ? parseFloat(formData.get("longitude") as string) : null,
      location_radius: formData.get("location_radius") ? parseInt(formData.get("location_radius") as string) : 100,
    }

    try {
      const url = "/api/admin/classes"
      const method = dialogMode === "add" ? "POST" : "PUT"
      
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (result.success) {
        alert(result.message)
        await fetchClasses()
        closeDialog()
      } else {
        alert(result.error || "Operation failed")
      }
    } catch (error) {
      console.error("Error:", error)
      alert("Operation failed")
    } finally {
      setLoading(false)
    }
  }

  const handleClassDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this class?")) return

    try {
      const userObj = JSON.parse(sessionStorage.getItem("user") || "{}")
      const department = userObj.department || "General"
      
      const response = await fetch(`/api/admin/classes`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminId: user?.id,
          classId: id,
          department: department,
        }),
      })
      const result = await response.json()

      if (result.success) {
        alert(result.message)
        await fetchClasses()
      } else {
        alert(result.error || "Delete failed")
      }
    } catch (error) {
      console.error("Error:", error)
      alert("Delete failed")
    }
  }

  // Subject CRUD operations
  const handleSubjectSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const userObj = JSON.parse(sessionStorage.getItem("user") || "{}")
    const department = userObj.department || "General"
    
    const data = {
      id: selectedItem?.id,
      subject_code: formData.get("subject_code"),
      subject_name: formData.get("subject_name"),
      credits: formData.get("credits") ? parseInt(formData.get("credits") as string) : null,
      semester: formData.get("semester") ? parseInt(formData.get("semester") as string) : null,
      department: department,
      adminId: user?.id,
    }

    try {
      const url = "/api/admin/subjects"
      const method = dialogMode === "add" ? "POST" : "PUT"
      
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (result.success) {
        alert(result.message)
        await fetchSubjects()
        closeDialog()
      } else {
        alert(result.error || "Operation failed")
      }
    } catch (error) {
      console.error("Error:", error)
      alert("Operation failed")
    } finally {
      setLoading(false)
    }
  }

  const handleSubjectDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this subject?")) return

    try {
      const userObj = JSON.parse(sessionStorage.getItem("user") || "{}")
      const department = userObj.department || "General"
      
      const response = await fetch("/api/admin/subjects", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          department,
          adminId: user?.id,
        }),
      })
      const result = await response.json()

      if (result.success) {
        alert(result.message)
        await fetchSubjects()
      } else {
        alert(result.error || "Delete failed")
      }
    } catch (error) {
      console.error("Error:", error)
      alert("Delete failed")
    }
  }

  // Teacher CRUD operations
  const handleTeacherSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const data = {
      name: formData.get("name"),
      email: formData.get("email"),
      username: formData.get("username"),
      department: formData.get("department"),
      phone: formData.get("phone"),
      user_type: "teacher",
    }

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (result.success) {
        setGeneratedPassword(result.user.password)
        setShowPassword(true)
        await fetchTeachers()
        // Don't close dialog yet - show password
      } else {
        alert(result.error || "Operation failed")
        setLoading(false)
      }
    } catch (error) {
      console.error("Error:", error)
      alert("Operation failed")
      setLoading(false)
    }
  }

  const handleViewTeacher = async (teacherId: string) => {
    setLoadingView(true)
    setShowViewDialog(true)
    try {
      const response = await fetch(`/api/admin/users?id=${teacherId}`)
      const result = await response.json()

      if (result.success) {
        setViewTeacher(result.user)
      } else {
        alert(result.error || "Failed to fetch teacher details")
        setShowViewDialog(false)
      }
    } catch (error) {
      console.error("Error:", error)
      alert("Failed to fetch teacher details")
      setShowViewDialog(false)
    } finally {
      setLoadingView(false)
    }
  }

  const handleTeacherDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this teacher?")) return

    try {
      const response = await fetch(`/api/admin/users?id=${id}`, { method: "DELETE" })
      const result = await response.json()

      if (result.success) {
        alert(result.message)
        await fetchTeachers()
      } else {
        alert(result.error || "Delete failed")
      }
    } catch (error) {
      console.error("Error:", error)
      alert("Delete failed")
    }
  }

  // Assignment form state
  const [selectedTeacher, setSelectedTeacher] = useState("")
  const [selectedSubject, setSelectedSubject] = useState("")
  const [selectedClass, setSelectedClass] = useState("")
  const [selectedDayOrder, setSelectedDayOrder] = useState("")
  const [selectedStartTime, setSelectedStartTime] = useState("")
  const [selectedEndTime, setSelectedEndTime] = useState("")
  const [autoSessionEnabled, setAutoSessionEnabled] = useState(false)

  // Assignment CRUD operations
  const handleAssignmentSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    const data = {
      teacher_id: selectedTeacher,
      subject_id: selectedSubject,
      class_id: selectedClass,
      day_order: selectedDayOrder ? parseInt(selectedDayOrder) : null,
      start_time: selectedStartTime || null,
      end_time: selectedEndTime || null,
      auto_session_enabled: autoSessionEnabled,
    }

    console.log('Submitting assignment:', data)

    if (!data.teacher_id || !data.subject_id || !data.class_id) {
      alert("Please select all required fields")
      setLoading(false)
      return
    }

    try {
      const response = await fetch("/api/admin/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (result.success) {
        alert(result.message)
        await fetchAssignments()
        closeDialog()
        // Reset form
        setSelectedTeacher("")
        setSelectedSubject("")
        setSelectedClass("")
        setSelectedDayOrder("")
        setSelectedStartTime("")
        setSelectedEndTime("")
        setAutoSessionEnabled(false)
      } else {
        alert(result.error || "Operation failed")
      }
    } catch (error) {
      console.error("Error:", error)
      alert("Operation failed")
    } finally {
      setLoading(false)
    }
  }

  const handleAssignmentDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this assignment?")) return

    try {
      const response = await fetch(`/api/admin/assignments?id=${id}`, { method: "DELETE" })
      const result = await response.json()

      if (result.success) {
        alert(result.message)
        await fetchAssignments()
      } else {
        alert(result.error || "Delete failed")
      }
    } catch (error) {
      console.error("Error:", error)
      alert("Delete failed")
    }
  }

  // Student CRUD operations
  const handleStudentSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const data = {
      id: selectedItem?.id,
      student_id: formData.get("student_id"),
      name: formData.get("name"),
      email: formData.get("email"),
      phone: formData.get("phone") || null,
      address: formData.get("address") || null,
      parent_phone: formData.get("parent_phone") || null,
      parent_name: formData.get("parent_name") || null,
      class_id: formData.get("class_id"),
      status: formData.get("status") || "active",
    }

    try {
      const url = "/api/admin/students"
      const method = dialogMode === "add" ? "POST" : "PUT"
      
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (result.success) {
        alert(result.message)
        await fetchStudents()
        closeDialog()
      } else {
        alert(result.error || "Operation failed")
      }
    } catch (error) {
      console.error("Error:", error)
      alert("Operation failed")
    } finally {
      setLoading(false)
    }
  }

  const handleStudentDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this student?")) return

    try {
      const response = await fetch(`/api/admin/students?id=${id}`, { method: "DELETE" })
      const result = await response.json()

      if (result.success) {
        alert(result.message)
        await fetchStudents()
      } else {
        alert(result.error || "Delete failed")
      }
    } catch (error) {
      console.error("Error:", error)
      alert("Delete failed")
    }
  }

  // Excel import handler
  const handleExcelImport = async (file: File, classId: string) => {
    if (!classId) {
      alert("Please select a class first")
      return
    }

    setImportLoading(true)
    try {
      const XLSX = await import('xlsx')
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = XLSX.utils.sheet_to_json(worksheet)

      const response = await fetch("/api/admin/students/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          students: jsonData,
          class_id: classId,
        }),
      })

      const result = await response.json()

      if (result.success) {
        alert(result.message)
        await fetchStudents()
        setShowImportDialog(false)
        setSelectedClassForImport("")
      } else {
        alert(result.error || "Import failed")
      }
    } catch (error) {
      console.error("Error:", error)
      alert("Import failed")
    } finally {
      setImportLoading(false)
    }
  }

  const downloadExcelTemplate = () => {
    const template = [
      {
        student_id: "2024001",
        name: "John Doe",
        email: "john@example.com",
        phone: "1234567890",
        address: "123 Main St",
        parent_phone: "0987654321",
        parent_name: "Jane Doe"
      }
    ]
    
    import('xlsx').then(XLSX => {
      const ws = XLSX.utils.json_to_sheet(template)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Students")
      XLSX.writeFile(wb, "student_import_template.xlsx")
    })
  }

  // Show loading screen while checking authorization
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

  if (fetching) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="border-b bg-background">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="h-6 w-6" />
            <h1 className="text-xl font-bold">Admin Management</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user?.name}</span>
            <Button variant="outline" size="sm" onClick={() => router.push("/admin")}>
              Dashboard
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          <Button
            variant={activeTab === "classes" ? "default" : "outline"}
            onClick={() => setActiveTab("classes")}
          >
            <GraduationCap className="h-4 w-4 mr-2" />
            Classes
          </Button>
          <Button
            variant={activeTab === "subjects" ? "default" : "outline"}
            onClick={() => setActiveTab("subjects")}
          >
            <BookOpen className="h-4 w-4 mr-2" />
            Subjects
          </Button>
          <Button
            variant={activeTab === "teachers" ? "default" : "outline"}
            onClick={() => setActiveTab("teachers")}
            data-tab="teachers"
          >
            <Users className="h-4 w-4 mr-2" />
            Teachers
          </Button>
          <Button
            variant={activeTab === "assignments" ? "default" : "outline"}
            onClick={() => setActiveTab("assignments")}
          >
            <Link2 className="h-4 w-4 mr-2" />
            Mapping
          </Button>
          <Button
            variant={activeTab === "students" ? "default" : "outline"}
            onClick={() => setActiveTab("students")}
          >
            <GraduationCap className="h-4 w-4 mr-2" />
            Students
          </Button>
          <Button
            variant={activeTab === "dayorder" ? "default" : "outline"}
            onClick={() => setActiveTab("dayorder")}
          >
            <Calendar className="h-4 w-4 mr-2" />
            Day Order
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/admin/timetable")}
          >
            <Clock className="h-4 w-4 mr-2" />
            Timetable
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/admin/teacher-absences")}
          >
            <AlertCircle className="h-4 w-4 mr-2" />
            Absences
          </Button>
        </div>

        {/* Classes Tab */}
        {activeTab === "classes" && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Manage Classes</CardTitle>
                  <CardDescription>Add, edit, or delete classes</CardDescription>
                </div>
                <Button onClick={openAddDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Class
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Class Name</TableHead>
                    <TableHead>Section</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Class Email</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No classes found. Click &quot;Add Class&quot; to create one.
                      </TableCell>
                    </TableRow>
                  ) : (
                    classes.map((cls) => (
                      <TableRow key={cls.id}>
                        <TableCell className="font-medium">{cls.class_name}</TableCell>
                        <TableCell>{cls.section || "-"}</TableCell>
                        <TableCell>{cls.year || "-"}</TableCell>
                        <TableCell>{cls.department || "General"}</TableCell>
                        <TableCell className="text-sm font-mono">{cls.class_email || "-"}</TableCell>
                        <TableCell>
                          {cls.latitude && cls.longitude ? (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">
                              <MapPin className="h-3 w-3" />
                              {cls.location_radius || 100}m
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(cls)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleClassDelete(cls.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Subjects Tab */}
        {activeTab === "subjects" && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Manage Subjects</CardTitle>
                  <CardDescription>Add, edit, or delete subjects</CardDescription>
                </div>
                <Button onClick={openAddDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Subject
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject Code</TableHead>
                    <TableHead>Subject Name</TableHead>
                    <TableHead>Credits</TableHead>
                    <TableHead>Semester</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subjects.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No subjects found. Click &quot;Add Subject&quot; to create one.
                      </TableCell>
                    </TableRow>
                  ) : (
                    subjects.map((subject) => (
                      <TableRow key={subject.id}>
                        <TableCell className="font-medium">{subject.subject_code}</TableCell>
                        <TableCell>{subject.subject_name}</TableCell>
                        <TableCell>{subject.credits || "-"}</TableCell>
                        <TableCell>{subject.semester || "-"}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(subject)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSubjectDelete(subject.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Teachers Tab */}
        {activeTab === "teachers" && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Manage Teachers</CardTitle>
                  <CardDescription>Add or remove teachers</CardDescription>
                </div>
                <Button onClick={openAddDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Teacher
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teachers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No teachers found. Click &quot;Add Teacher&quot; to create one.
                      </TableCell>
                    </TableRow>
                  ) : (
                    teachers.map((teacher) => (
                      <TableRow key={teacher.id}>
                        <TableCell className="font-medium">{teacher.name}</TableCell>
                        <TableCell>{teacher.email}</TableCell>
                        <TableCell>{teacher.username}</TableCell>
                        <TableCell>{teacher.phone || "-"}</TableCell>
                        <TableCell>{teacher.department || "-"}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            teacher.status === "active" 
                              ? "bg-green-100 text-green-800" 
                              : "bg-red-100 text-red-800"
                          }`}>
                            {teacher.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewTeacher(teacher.id)}
                            title="View Details"
                          >
                            <Eye className="h-4 w-4 text-blue-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleTeacherDelete(teacher.id)}
                            title="Delete Teacher"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Students Tab */}
        {activeTab === "students" && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Manage Students</CardTitle>
                  <CardDescription>Add, edit, view, or delete students</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={downloadExcelTemplate}>
                    <Download className="h-4 w-4 mr-2" />
                    Download Template
                  </Button>
                  <Button variant="outline" onClick={() => setShowImportDialog(true)}>
                    <Upload className="h-4 w-4 mr-2" />
                    Import Excel
                  </Button>
                  <Button onClick={openAddDialog}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Student
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Class Filter */}
              <div className="flex items-end gap-2">
                <div className="flex-1 md:w-80">
                  <label className="text-sm font-medium mb-2 block">Filter by Class</label>
                  <Select value={selectedStudentClass || ""} onValueChange={(value) => setSelectedStudentClass(value || null)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a class to view students..." />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>
                          {cls.class_name} {cls.section || ""}{cls.year ? ` (Year ${cls.year})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedStudentClass && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedStudentClass(null)}
                    className="text-xs"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                )}
              </div>

              {/* Students Table */}
              {!selectedStudentClass ? (
                <div className="flex items-center justify-center py-12 text-center">
                  <div>
                    <GraduationCap className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                    <p className="text-muted-foreground mb-2">Select a class to view students</p>
                    <p className="text-xs text-muted-foreground">Choose a class from the dropdown above to display students</p>
                  </div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.filter(s => s.class_id === selectedStudentClass).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                          No students found in this class. Click &quot;Add Student&quot; to add students.
                        </TableCell>
                      </TableRow>
                    ) : (
                      students
                        .filter(s => s.class_id === selectedStudentClass)
                        .map((student) => (
                          <TableRow key={student.id}>
                            <TableCell className="font-medium">{student.student_id}</TableCell>
                            <TableCell>{student.name}</TableCell>
                            <TableCell>{student.email}</TableCell>
                            <TableCell>
                              {student.classes?.class_name} {student.classes?.section || ""}
                              {student.classes?.year ? ` (Year ${student.classes.year})` : ""}
                            </TableCell>
                            <TableCell>{student.phone || "-"}</TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                student.status === "active" 
                                  ? "bg-green-100 text-green-800" 
                                  : "bg-red-100 text-red-800"
                              }`}>
                                {student.status}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditDialog(student)}
                                title="Edit Student"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleStudentDelete(student.id)}
                                title="Delete Student"
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {/* Mapping Tab */}
        {activeTab === "assignments" && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Manage Teacher Mapping</CardTitle>
                  <CardDescription>Assign teachers to subjects and classes</CardDescription>
                </div>
                <Button onClick={openAddDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Mapping
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Teacher</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Credits</TableHead>
                    <TableHead>Semester</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        No assignments found. Click &quot;New Assignment&quot; to create one.
                      </TableCell>
                    </TableRow>
                  ) : (
                    assignments.map((assignment) => (
                      <TableRow key={assignment.id}>
                        <TableCell className="font-medium">
                          {assignment.teacher?.name || "N/A"}
                        </TableCell>
                        <TableCell>
                          {assignment.teacher?.email || "-"}
                        </TableCell>
                        <TableCell>
                          {assignment.subject?.subject_code} - {assignment.subject?.subject_name}
                        </TableCell>
                        <TableCell>{assignment.subject?.credits || "-"}</TableCell>
                        <TableCell>{assignment.subject?.semester || "-"}</TableCell>
                        <TableCell>
                          {assignment.class?.class_name} {assignment.class?.section}
                        </TableCell>
                        <TableCell>{assignment.class?.year || "-"}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAssignmentDelete(assignment.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Day Order Tab */}
        {activeTab === "dayorder" && (
          <div className="space-y-6">
            {/* Current Day Order Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Today&apos;s Day Order
                    </CardTitle>
                    <CardDescription>Current timetable day order for today</CardDescription>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={fetchDayOrderData}
                    disabled={dayOrderLoading}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${dayOrderLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {dayOrderLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-6">
                    <div className="text-center">
                      <div className="text-6xl font-bold text-primary mb-2">
                        Day {currentDayOrder || 1}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {new Date().toLocaleDateString('en-US', { 
                          weekday: 'long', 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </p>
                      {dayOrderConfig && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Cycle: Day 1 to Day {dayOrderConfig.totalDays}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => { setDayOrderDialogMode("set"); setShowDayOrderDialog(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Set Day Order
              </Button>
              <Button variant="outline" onClick={() => { setDayOrderDialogMode("holiday"); setShowDayOrderDialog(true); }}>
                <Calendar className="h-4 w-4 mr-2" />
                Mark Holiday
              </Button>
              <Button variant="outline" onClick={() => { setDayOrderDialogMode("config"); setShowDayOrderDialog(true); }}>
                Configure Cycle
              </Button>
            </div>

            {/* Upcoming Schedule */}
            <Card>
              <CardHeader>
                <CardTitle>Upcoming Schedule (Next 7 Days)</CardTitle>
                <CardDescription>Day order forecast for the upcoming week</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
                  {upcomingDayOrders.map((day, index) => {
                    const date = new Date(day.date)
                    const isToday = index === 0
                    return (
                      <div 
                        key={day.date}
                        className={`p-3 rounded-lg border text-center ${
                          isToday 
                            ? 'bg-primary text-primary-foreground border-primary' 
                            : day.isHoliday 
                              ? 'bg-red-50 border-red-200' 
                              : day.isExplicit 
                                ? 'bg-blue-50 border-blue-200' 
                                : 'bg-muted/50'
                        }`}
                      >
                        <p className={`text-xs font-medium ${isToday ? 'text-primary-foreground' : 'text-muted-foreground'}`}>
                          {date.toLocaleDateString('en-US', { weekday: 'short' })}
                        </p>
                        <p className={`text-sm ${isToday ? 'text-primary-foreground' : ''}`}>
                          {date.getDate()}/{date.getMonth() + 1}
                        </p>
                        {day.isHoliday ? (
                          <p className="text-lg font-bold text-red-600">Holiday</p>
                        ) : (
                          <p className={`text-lg font-bold ${isToday ? 'text-primary-foreground' : 'text-primary'}`}>
                            Day {day.dayOrder}
                          </p>
                        )}
                        {day.holidayName && (
                          <p className="text-xs text-red-600 truncate">{day.holidayName}</p>
                        )}
                        {day.isExplicit && !day.isHoliday && (
                          <p className="text-xs text-blue-600">Modified</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* History */}
            <Card>
              <CardHeader>
                <CardTitle>Day Order History</CardTitle>
                <CardDescription>Recent changes to day order settings</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Day Order</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Changed By</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dayOrderHistory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          No day order changes recorded yet. Use &quot;Set Day Order&quot; to make changes.
                        </TableCell>
                      </TableRow>
                    ) : (
                      dayOrderHistory.map((setting) => (
                        <TableRow key={setting.id}>
                          <TableCell className="font-medium">
                            {new Date(setting.effective_date).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {setting.is_holiday ? (
                              <span className="text-red-600 font-medium">Holiday</span>
                            ) : (
                              <span className="text-primary font-bold">Day {setting.day_order}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              setting.is_holiday 
                                ? "bg-red-100 text-red-800" 
                                : "bg-blue-100 text-blue-800"
                            }`}>
                              {setting.is_holiday ? setting.holiday_name || 'Holiday' : 'Day Change'}
                            </span>
                          </TableCell>
                          <TableCell>{setting.reason || "-"}</TableCell>
                          <TableCell>{setting.users?.name || "-"}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteDayOrderSetting(setting.id)}
                              title="Delete Setting"
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Day Order Dialog */}
      <Dialog open={showDayOrderDialog} onOpenChange={setShowDayOrderDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dayOrderDialogMode === "set" && "Set Day Order"}
              {dayOrderDialogMode === "holiday" && "Mark Holiday"}
              {dayOrderDialogMode === "config" && "Configure Day Order Cycle"}
            </DialogTitle>
            <DialogDescription>
              {dayOrderDialogMode === "set" && "Change the day order for a specific date. The schedule will continue from this day."}
              {dayOrderDialogMode === "holiday" && "Mark a date as a holiday. No classes will be scheduled."}
              {dayOrderDialogMode === "config" && "Configure the total number of days in your timetable cycle."}
            </DialogDescription>
          </DialogHeader>

          {dayOrderDialogMode === "set" && (
            <form onSubmit={handleSetDayOrder} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="effectiveDate">Date</Label>
                <Input
                  id="effectiveDate"
                  name="effectiveDate"
                  type="date"
                  required
                  defaultValue={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dayOrder">Day Order</Label>
                <Select name="dayOrder" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select day order" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: dayOrderConfig?.totalDays || 6 }, (_, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>
                        Day {i + 1}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reason">Reason (Optional)</Label>
                <Input
                  id="reason"
                  name="reason"
                  placeholder="e.g., Compensatory class, schedule adjustment"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowDayOrderDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Saving..." : "Save"}
                </Button>
              </DialogFooter>
            </form>
          )}

          {dayOrderDialogMode === "holiday" && (
            <form onSubmit={handleSetHoliday} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="effectiveDate">Date</Label>
                <Input
                  id="effectiveDate"
                  name="effectiveDate"
                  type="date"
                  required
                  defaultValue={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="holidayName">Holiday Name</Label>
                <Input
                  id="holidayName"
                  name="holidayName"
                  required
                  placeholder="e.g., Diwali, Christmas, Local Festival"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reason">Notes (Optional)</Label>
                <Input
                  id="reason"
                  name="reason"
                  placeholder="Additional notes about the holiday"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowDayOrderDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Saving..." : "Mark Holiday"}
                </Button>
              </DialogFooter>
            </form>
          )}

          {dayOrderDialogMode === "config" && (
            <form onSubmit={handleUpdateConfig} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="totalDays">Total Days in Cycle</Label>
                <Select name="totalDays" defaultValue={String(dayOrderConfig?.totalDays || 6)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select total days" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 10 }, (_, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>
                        {i + 1} Days
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Number of unique days in your timetable (e.g., 6 for Day 1 to Day 6)
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="currentDayOrder">Current Day Order</Label>
                <Select name="currentDayOrder" defaultValue={String(currentDayOrder || 1)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select current day" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: dayOrderConfig?.totalDays || 6 }, (_, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>
                        Day {i + 1}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Reset the current day order to this value starting from today
                </p>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowDayOrderDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Saving..." : "Update Configuration"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog for Add/Edit */}
      <Dialog open={showDialog} onOpenChange={closeDialog}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "add" ? "Add" : "Edit"} {activeTab.slice(0, -1).charAt(0).toUpperCase() + activeTab.slice(1, -1)}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === "add" ? "Create a new" : "Update the"} {activeTab.slice(0, -1)}
            </DialogDescription>
          </DialogHeader>

          {!showPassword ? (
            <>
              {/* Student Form */}
              {activeTab === "students" && (
                <form onSubmit={handleStudentSubmit}>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="student_id">Student ID *</Label>
                      <Input
                        id="student_id"
                        name="student_id"
                        defaultValue={(selectedItem as Student)?.student_id}
                        placeholder="e.g., STU001, 2024BCA001"
                        required
                        disabled={dialogMode === "edit"}
                      />
                      {dialogMode === "edit" && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Student ID cannot be changed
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="name">Full Name *</Label>
                      <Input
                        id="name"
                        name="name"
                        defaultValue={(selectedItem as Student)?.name}
                        placeholder="e.g., John Doe"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        defaultValue={(selectedItem as Student)?.email}
                        placeholder="student@example.com"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="class_id">Class *</Label>
                      <select
                        id="class_id"
                        name="class_id"
                        defaultValue={(selectedItem as Student)?.class_id || ""}
                        required
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="" disabled>Select a class</option>
                        {classes.map((cls) => (
                          <option key={cls.id} value={cls.id}>
                            {cls.class_name} {cls.section || ""} 
                            {cls.year ? ` (Year ${cls.year})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        name="phone"
                        type="tel"
                        defaultValue={(selectedItem as Student)?.phone}
                        placeholder="e.g., +91 98765 43210"
                      />
                    </div>
                    <div>
                      <Label htmlFor="address">Address</Label>
                      <Input
                        id="address"
                        name="address"
                        defaultValue={(selectedItem as Student)?.address}
                        placeholder="Student's address"
                      />
                    </div>
                    <div>
                      <Label htmlFor="parent_name">Parent/Guardian Name</Label>
                      <Input
                        id="parent_name"
                        name="parent_name"
                        defaultValue={(selectedItem as Student)?.parent_name}
                        placeholder="e.g., Jane Doe"
                      />
                    </div>
                    <div>
                      <Label htmlFor="parent_phone">Parent/Guardian Phone</Label>
                      <Input
                        id="parent_phone"
                        name="parent_phone"
                        type="tel"
                        defaultValue={(selectedItem as Student)?.parent_phone}
                        placeholder="e.g., +91 98765 43210"
                      />
                    </div>
                    <div>
                      <Label htmlFor="status">Status *</Label>
                      <select
                        id="status"
                        name="status"
                        defaultValue={(selectedItem as Student)?.status || "active"}
                        required
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                    <Button type="submit" className="w-full">
                      {dialogMode === "add" ? "Add Student" : "Update Student"}
                    </Button>
                  </div>
                </form>
              )}

              {/* Class Form */}
              {activeTab === "classes" && (
                <form key={`class-form-${selectedItem?.id || 'new'}`} onSubmit={handleClassSubmit}>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="class_name">Class Name *</Label>
                      <Input
                        id="class_name"
                        name="class_name"
                        defaultValue={(selectedItem as Class)?.class_name}
                        placeholder="e.g., BCA, MCA, B.Sc CS"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="section">Section</Label>
                      <Input
                        id="section"
                        name="section"
                        defaultValue={(selectedItem as Class)?.section}
                        placeholder="e.g., A, B, C"
                      />
                    </div>
                    <div>
                      <Label htmlFor="year">Year</Label>
                      <Input
                        id="year"
                        name="year"
                        type="number"
                        min="1"
                        max="5"
                        defaultValue={(selectedItem as Class)?.year}
                        placeholder="e.g., 1, 2, 3"
                      />
                    </div>
                    <div>
                      <Label htmlFor="department">Department *</Label>
                      <Input
                        id="department"
                        name="department"
                        placeholder="e.g., Computer Science, IT, Master of Science"
                        defaultValue={(JSON.parse(sessionStorage.getItem("user") || "{}")).department || "Computer Science"}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="class_email">Class Email *</Label>
                      <Input
                        id="class_email"
                        name="class_email"
                        type="email"
                        defaultValue={(selectedItem as Class)?.class_email}
                        placeholder="e.g., cs-a@kprcas.ac.in"
                        required
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        QR codes and session info will be sent to this email for all teachers in this class
                      </p>
                    </div>
                    
                    {/* Geolocation Section */}
                    <div className="border-t pt-4 mt-4">
                      <div className="flex items-center gap-2 mb-3">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <Label className="text-sm font-medium">Location Restriction (Optional)</Label>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">
                        If set, students can only mark attendance when they are near this location.
                      </p>
                      
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <Label htmlFor="latitude">Latitude</Label>
                            <Input
                              id="latitude"
                              name="latitude"
                              type="number"
                              step="any"
                              defaultValue={(selectedItem as Class)?.latitude ?? ""}
                              placeholder="e.g., 10.9027"
                            />
                          </div>
                          <div className="flex-1">
                            <Label htmlFor="longitude">Longitude</Label>
                            <Input
                              id="longitude"
                              name="longitude"
                              type="number"
                              step="any"
                              defaultValue={(selectedItem as Class)?.longitude ?? ""}
                              placeholder="e.g., 76.8986"
                            />
                          </div>
                        </div>
                        
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => {
                            if (navigator.geolocation) {
                              navigator.geolocation.getCurrentPosition(
                                (position) => {
                                  const latInput = document.getElementById("latitude") as HTMLInputElement
                                  const lngInput = document.getElementById("longitude") as HTMLInputElement
                                  if (latInput && lngInput) {
                                    latInput.value = position.coords.latitude.toFixed(8)
                                    lngInput.value = position.coords.longitude.toFixed(8)
                                  }
                                  const accuracy = position.coords.accuracy
                                  if (accuracy > 50) {
                                    alert(`Location captured with ${Math.round(accuracy)}m accuracy. For better accuracy, try again outdoors or wait for GPS to stabilize.`)
                                  }
                                },
                                (error) => {
                                  let message = "Could not get location."
                                  switch (error.code) {
                                    case error.PERMISSION_DENIED:
                                      message = "Location permission denied. Please enable location access in your browser settings."
                                      break
                                    case error.POSITION_UNAVAILABLE:
                                      message = "Location unavailable. Please try again or enter coordinates manually."
                                      break
                                    case error.TIMEOUT:
                                      message = "Location request timed out. Please try again."
                                      break
                                  }
                                  alert(message)
                                },
                                { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
                              )
                            } else {
                              alert("Geolocation is not supported by your browser")
                            }
                          }}
                        >
                          <Crosshair className="h-4 w-4 mr-2" />
                          Use Current Location
                        </Button>
                        
                        {/* Remove Location Button - only show if location is set */}
                        {((selectedItem as Class)?.latitude || (selectedItem as Class)?.longitude) && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => {
                              const latInput = document.getElementById("latitude") as HTMLInputElement
                              const lngInput = document.getElementById("longitude") as HTMLInputElement
                              if (latInput && lngInput) {
                                latInput.value = ""
                                lngInput.value = ""
                              }
                              alert("Location cleared. Click Save to apply changes.")
                            }}
                          >
                            <X className="h-4 w-4 mr-2" />
                            Remove Location Restriction
                          </Button>
                        )}
                        
                        <div>
                          <Label htmlFor="location_radius">Allowed Radius (meters)</Label>
                          <Input
                            id="location_radius"
                            name="location_radius"
                            type="number"
                            min="10"
                            max="1000"
                            defaultValue={(selectedItem as Class)?.location_radius ?? 100}
                            placeholder="100"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Students must be within this distance from the class location (default: 100m)
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <DialogFooter className="mt-6">
                    <Button type="button" variant="outline" onClick={closeDialog}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={loading}>
                      {loading ? "Saving..." : "Save"}
                    </Button>
                  </DialogFooter>
                </form>
              )}

              {/* Subject Form */}
              {activeTab === "subjects" && (
                <form onSubmit={handleSubjectSubmit}>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="subject_code">Subject Code *</Label>
                      <Input
                        id="subject_code"
                        name="subject_code"
                        defaultValue={(selectedItem as Subject)?.subject_code}
                        placeholder="e.g., CS101, MATH201"
                        required
                        disabled={dialogMode === "edit"}
                      />
                    </div>
                    <div>
                      <Label htmlFor="subject_name">Subject Name *</Label>
                      <Input
                        id="subject_name"
                        name="subject_name"
                        defaultValue={(selectedItem as Subject)?.subject_name}
                        placeholder="e.g., Data Structures"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="credits">Credits</Label>
                      <Input
                        id="credits"
                        name="credits"
                        type="number"
                        min="1"
                        max="10"
                        defaultValue={(selectedItem as Subject)?.credits}
                        placeholder="e.g., 3, 4"
                      />
                    </div>
                    <div>
                      <Label htmlFor="semester">Semester</Label>
                      <Input
                        id="semester"
                        name="semester"
                        type="number"
                        min="1"
                        max="8"
                        defaultValue={(selectedItem as Subject)?.semester}
                        placeholder="e.g., 1, 2"
                      />
                    </div>
                  </div>
                  <DialogFooter className="mt-6">
                    <Button type="button" variant="outline" onClick={closeDialog}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={loading}>
                      {loading ? "Saving..." : "Save"}
                    </Button>
                  </DialogFooter>
                </form>
              )}

              {/* Teacher Form */}
              {activeTab === "teachers" && (
                <form onSubmit={handleTeacherSubmit}>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="name">Full Name *</Label>
                      <Input
                        id="name"
                        name="name"
                        placeholder="Dr. John Doe"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="john.doe@kprcas.ac.in"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="username">Username</Label>
                      <Input
                        id="username"
                        name="username"
                        placeholder="johndoe"
                      />
                    </div>
                    <div>
                      <Label htmlFor="department">Department</Label>
                      <Input
                        id="department"
                        name="department"
                        placeholder="Computer Science"
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        name="phone"
                        type="tel"
                        placeholder="+91 9876543210"
                      />
                    </div>
                    <div className="bg-blue-50 p-3 rounded-md">
                      <p className="text-sm text-blue-800">
                        🔐 Password will be auto-generated and shown after creation
                      </p>
                    </div>
                  </div>
                  <DialogFooter className="mt-6">
                    <Button type="button" variant="outline" onClick={closeDialog}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={loading}>
                      {loading ? "Creating..." : "Create Teacher"}
                    </Button>
                  </DialogFooter>
                </form>
              )}

              {/* Assignment Form */}
              {activeTab === "assignments" && (
                <form onSubmit={handleAssignmentSubmit}>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="teacher_id">Teacher *</Label>
                      <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select teacher" />
                        </SelectTrigger>
                        <SelectContent>
                          {teachers.map((teacher) => (
                            <SelectItem key={teacher.id} value={teacher.id}>
                              {teacher.name} {teacher.department ? `- ${teacher.department}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="subject_id">Subject *</Label>
                      <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select subject" />
                        </SelectTrigger>
                        <SelectContent>
                          {subjects.map((subject) => (
                            <SelectItem key={subject.id} value={subject.id}>
                              {subject.subject_code} - {subject.subject_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="class_id">Class *</Label>
                      <Select value={selectedClass} onValueChange={setSelectedClass}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select class" />
                        </SelectTrigger>
                        <SelectContent>
                          {classes.map((cls) => (
                            <SelectItem key={cls.id} value={cls.id}>
                              {cls.class_name} {cls.section || ''}{cls.year ? ` (Year ${cls.year})` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Schedule Settings */}
                    <div className="border-t pt-4 mt-4">
                      <h4 className="text-sm font-semibold mb-3">📅 Auto-Session Schedule (Optional)</h4>
                      
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="auto_session_enabled"
                            checked={autoSessionEnabled}
                            onChange={(e) => {
                              console.log('Auto-session checkbox changed:', e.target.checked)
                              setAutoSessionEnabled(e.target.checked)
                            }}
                            className="h-4 w-4"
                          />
                          <Label htmlFor="auto_session_enabled" className="text-sm cursor-pointer">
                            Enable automatic session creation
                          </Label>
                        </div>

                        {autoSessionEnabled && (
                          <div className="space-y-3 pl-6 border-l-2 border-blue-300">
                            <p className="text-xs text-blue-600 font-medium">📌 Schedule Configuration</p>
                            <div>
                              <Label htmlFor="day_order">Day Order</Label>
                              <Select value={selectedDayOrder} onValueChange={setSelectedDayOrder}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select day order" />
                                </SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: dayOrderConfig?.totalDays || 6 }, (_, i) => (
                                    <SelectItem key={i + 1} value={String(i + 1)}>
                                      Day {i + 1}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-muted-foreground mt-1">
                                Select which day order this class should run on
                              </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label htmlFor="start_time">Start Time</Label>
                                <div className="relative">
                                  <Input
                                    type="time"
                                    id="start_time"
                                    value={selectedStartTime}
                                    onChange={(e) => setSelectedStartTime(e.target.value)}
                                    placeholder="HH:MM"
                                    className="flex-1 cursor-pointer"
                                  />
                                </div>
                                <p className="text-sm font-semibold text-green-700 mt-2">
                                  {selectedStartTime ? (() => {
                                    const [hours, minutes] = selectedStartTime.split(':')
                                    const h = parseInt(hours)
                                    const m = minutes
                                    const period = h >= 12 ? 'PM' : 'AM'
                                    const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h
                                    return `${String(h12).padStart(2, '0')}:${m} ${period}`
                                  })() : 'Select time'}
                                </p>
                              </div>
                              <div>
                                <Label htmlFor="end_time">End Time</Label>
                                <div className="relative">
                                  <Input
                                    type="time"
                                    id="end_time"
                                    value={selectedEndTime}
                                    onChange={(e) => setSelectedEndTime(e.target.value)}
                                    placeholder="HH:MM"
                                    className="flex-1 cursor-pointer"
                                  />
                                </div>
                                <p className="text-sm font-semibold text-green-700 mt-2">
                                  {selectedEndTime ? (() => {
                                    const [hours, minutes] = selectedEndTime.split(':')
                                    const h = parseInt(hours)
                                    const m = minutes
                                    const period = h >= 12 ? 'PM' : 'AM'
                                    const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h
                                    return `${String(h12).padStart(2, '0')}:${m} ${period}`
                                  })() : 'Select time'}
                                </p>
                              </div>
                            </div>

                            {/* AM/PM Conversion Guide */}
                            <div className="bg-blue-50 p-3 rounded text-xs text-blue-800 border border-blue-200">
                              <p className="font-semibold mb-2">How to Set Time:</p>
                              <ol className="space-y-1 ml-4 list-decimal">
                                <li>Click on Start/End Time field</li>
                                <li>A clock picker will appear</li>
                                <li>Select hours and minutes</li>
                                <li>Time will show in 12-hour AM/PM format below</li>
                              </ol>
                              <p className="mt-2 font-semibold">Example:</p>
                              <div className="grid grid-cols-2 gap-2 mt-2">
                                <div>
                                  <p className="font-medium text-blue-900">Morning (AM)</p>
                                  <ul className="space-y-1 mt-1 ml-2">
                                    <li>• 9:00 AM</li>
                                    <li>• 10:30 AM</li>
                                  </ul>
                                </div>
                                <div>
                                  <p className="font-medium text-blue-900">Afternoon (PM)</p>
                                  <ul className="space-y-1 mt-1 ml-2">
                                    <li>• 1:00 PM</li>
                                    <li>• 3:45 PM</li>
                                  </ul>
                                </div>
                              </div>
                            </div>

                            <div className="bg-blue-50 p-3 rounded text-xs text-blue-800">
                              ℹ️ Session will automatically start 5 minutes before the scheduled time and the QR code + session code will be emailed to the teacher.
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <DialogFooter className="mt-6">
                    <Button type="button" variant="outline" onClick={closeDialog}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={loading}>
                      {loading ? "Assigning..." : "Assign"}
                    </Button>
                  </DialogFooter>
                </form>
              )}
            </>
          ) : (
            /* Show Generated Password */
            <div className="space-y-4">
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h3 className="text-lg font-semibold text-green-800 mb-2">
                  ✅ Teacher Created Successfully!
                </h3>
                <p className="text-sm text-green-700 mb-4">
                  Please share these credentials with the teacher:
                </p>
                <div className="bg-white p-4 rounded border">
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs text-gray-500">Email</Label>
                      <p className="font-mono text-sm">{(selectedItem as Teacher)?.email}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Password</Label>
                      <p className="font-mono text-lg font-bold text-blue-600">
                        {generatedPassword}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="text-xs text-yellow-800">
                    ⚠️ <strong>Important:</strong> Copy this password now! It won&apos;t be shown again.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => {
                  navigator.clipboard.writeText(`Email: ${(selectedItem as Teacher)?.email}\nPassword: ${generatedPassword}`)
                  alert("Credentials copied to clipboard!")
                }}>
                  Copy Credentials
                </Button>
                <Button onClick={closeDialog}>
                  Done
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View Teacher Details Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Teacher Details</DialogTitle>
            <DialogDescription>
              Complete information about the teacher
            </DialogDescription>
          </DialogHeader>

          {loadingView ? (
            <div className="flex items-center justify-center py-8">
              <p>Loading...</p>
            </div>
          ) : viewTeacher ? (
            <div className="space-y-6">
              {/* Personal Information */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-lg mb-3">Personal Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-gray-500">Name</Label>
                    <p className="font-medium">{viewTeacher.name}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Email</Label>
                    <p className="font-medium">{viewTeacher.email}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Username</Label>
                    <p className="font-medium">{viewTeacher.username}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Phone</Label>
                    <p className="font-medium">{viewTeacher.phone || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Department</Label>
                    <p className="font-medium">{viewTeacher.department || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Status</Label>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      viewTeacher.status === "active" 
                        ? "bg-green-100 text-green-800" 
                        : "bg-red-100 text-red-800"
                    }`}>
                      {viewTeacher.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Login Credentials */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h3 className="font-semibold text-lg mb-3">Login Credentials</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-gray-500">Email/Username</Label>
                    <p className="font-mono text-sm">{viewTeacher.email}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Password</Label>
                    <p className="font-mono text-sm font-bold text-blue-600">
                      {viewTeacher.plain_password || "********"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Assigned Subjects */}
              {viewTeacher.assignments && viewTeacher.assignments.length > 0 && (
                <div className="bg-green-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-lg mb-3">Assigned Subjects & Classes</h3>
                  <div className="space-y-3">
                    {viewTeacher.assignments.map((assignment, index) => (
                      <div key={index} className="bg-white p-3 rounded border">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs text-gray-500">Subject</Label>
                            <p className="font-medium">
                              {assignment.subject?.subject_code} - {assignment.subject?.subject_name}
                            </p>
                            <p className="text-xs text-gray-600">
                              Credits: {assignment.subject?.credits || "-"} | Semester: {assignment.subject?.semester || "-"}
                            </p>
                          </div>
                          <div>
                            <Label className="text-xs text-gray-500">Class</Label>
                            <p className="font-medium">
                              {assignment.class?.class_name} {assignment.class?.section || ""}
                            </p>
                            <p className="text-xs text-gray-600">
                              Year: {assignment.class?.year || "-"}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {viewTeacher.assignments && viewTeacher.assignments.length === 0 && (
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <p className="text-sm text-yellow-800">
                    No subjects assigned to this teacher yet.
                  </p>
                </div>
              )}

              {/* Metadata */}
              <div className="text-xs text-gray-500">
                <p>Created: {viewTeacher.created_at ? new Date(viewTeacher.created_at).toLocaleString() : "-"}</p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No data available
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setShowViewDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Excel Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Import Students from Excel</DialogTitle>
            <DialogDescription>
              Upload an Excel file to import multiple students at once
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="import_class_id">Select Class *</Label>
              <select
                id="import_class_id"
                value={selectedClassForImport || ""}
                onChange={(e) => setSelectedClassForImport(e.target.value)}
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="" disabled>Choose a class for these students</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.class_name} {cls.section || ""} 
                    {cls.year ? ` (Year ${cls.year})` : ""}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                All students in the Excel file will be assigned to this class
              </p>
            </div>

            <div>
              <Label htmlFor="excel_file">Excel File *</Label>
              <input
                id="excel_file"
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file && selectedClassForImport) {
                    handleExcelImport(file, selectedClassForImport)
                  } else if (file && !selectedClassForImport) {
                    alert("Please select a class first")
                    e.target.value = ""
                  }
                }}
                disabled={!selectedClassForImport || importLoading}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Must contain columns: student_id, name, email
              </p>
            </div>

            {importLoading && (
              <div className="flex items-center justify-center py-4">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
                  <p className="text-sm text-muted-foreground">Importing students...</p>
                </div>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 p-3 rounded-md">
              <p className="text-sm font-medium text-blue-900 mb-2">Excel Format Requirements:</p>
              <ul className="text-xs text-blue-800 space-y-1">
                <li>• <strong>student_id</strong> (required, unique)</li>
                <li>• <strong>name</strong> (required)</li>
                <li>• <strong>email</strong> (required, unique)</li>
                <li>• <strong>phone</strong> (optional)</li>
                <li>• <strong>address</strong> (optional)</li>
                <li>• <strong>parent_name</strong> (optional)</li>
                <li>• <strong>parent_phone</strong> (optional)</li>
                <li>• <strong>status</strong> (optional, &quot;active&quot; or &quot;inactive&quot;)</li>
              </ul>
              <Button
                variant="link"
                size="sm"
                onClick={downloadExcelTemplate}
                className="mt-2 p-0 h-auto text-blue-600"
              >
                Download sample template
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowImportDialog(false)
                setSelectedClassForImport("")
              }}
              disabled={importLoading}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
