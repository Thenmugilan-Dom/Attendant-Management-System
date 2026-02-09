"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Shield, Eye, EyeOff } from "lucide-react"

export default function SecurityLogin() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)



  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      // Query Supabase for security user
      const { data, error } = await supabase
        .from("security_users")
        .select("id, username, password, name")
        .eq("username", username)
        .single()

      if (error || !data) {
        setError("Invalid username or password")
        setLoading(false)
        return
      }

      // In production, use hashed passwords
      if (data.password !== password) {
        setError("Invalid username or password")
        setLoading(false)
        return
      }

      // Store security session
      localStorage.setItem("security_session", JSON.stringify({
        loggedIn: true,
        loginTime: new Date().toISOString(),
        userId: data.id,
        name: data.name,
        username: data.username
      }))
      router.push("/security/dashboard")
    } catch (err) {
      setError("Login failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl border-slate-700 bg-slate-800/50 backdrop-blur">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-white">Security Login</CardTitle>
          <CardDescription className="text-slate-400">
            Verify student OD approvals
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Username</label>
              <Input
                type="text"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                required
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Password</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold"
            >
              {loading ? "Logging in..." : "Login"}
            </Button>
          </form>

          <div className="mt-6 p-4 bg-slate-700/50 rounded-lg">
            <p className="text-xs text-slate-400 text-center">
              This portal is for security personnel to verify student OD (On Duty) approvals.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
