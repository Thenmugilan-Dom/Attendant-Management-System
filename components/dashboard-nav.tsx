"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { LogOut, User } from "lucide-react"

interface DashboardNavProps {
  userName?: string
  userEmail?: string
  userRole?: string
}

export function DashboardNav({ userName, userEmail, userRole }: DashboardNavProps) {
  const router = useRouter()

  const handleLogout = () => {
    sessionStorage.removeItem("user")
    sessionStorage.removeItem("token")
    router.push("/login")
  }

  return (
    <nav className="border-b bg-background sticky top-0 z-50">
      <div className="flex h-14 sm:h-16 items-center px-3 sm:px-4 md:px-6">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="bg-primary text-primary-foreground flex size-7 sm:size-8 items-center justify-center rounded-md flex-shrink-0">
            <User className="size-3 sm:size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm sm:text-base md:text-lg font-semibold truncate">
              <span className="hidden sm:inline">Attendance Management</span>
              <span className="sm:hidden">Attendance</span>
            </h1>
            {userRole && (
              <p className="text-[10px] sm:text-xs text-muted-foreground capitalize truncate">
                {userRole} Dashboard
              </p>
            )}
          </div>
        </div>
        <div className="ml-2 sm:ml-4 flex items-center gap-2 sm:gap-4">
          <div className="hidden lg:block text-right">
            {userName && <p className="text-sm font-medium truncate max-w-[150px]">{userName}</p>}
            {userEmail && <p className="text-xs text-muted-foreground truncate max-w-[150px]">{userEmail}</p>}
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout} className="text-xs sm:text-sm h-8 sm:h-9">
            <LogOut className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </div>
    </nav>
  )
}
