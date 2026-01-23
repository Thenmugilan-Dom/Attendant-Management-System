import { LoginForm } from "@/components/login-form";

export default function Home() {
  return (
    <div className="font-sans flex flex-col items-center justify-center min-h-screen p-4 sm:p-8 gap-8 sm:gap-16 md:p-20 safe-area-insets">
      <main className="flex flex-col gap-4 sm:gap-6 md:gap-8 items-center w-full max-w-md sm:max-w-lg">
        <LoginForm />
        
        {/* Student Portal Links */}
        <div className="w-full mt-6 pt-6 border-t border-gray-300 space-y-3">
          <p className="text-center text-sm text-gray-600 font-medium">Student Portal</p>
          <a 
            href="/students"
            className="w-full inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors text-sm"
          >
            📱 Mark Attendance (QR Code)
          </a>
          <a 
            href="/student/od-request"
            className="w-full inline-flex items-center justify-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-md transition-colors text-sm"
          >
            📋 Submit OD Request
          </a>
        </div>
      </main>
    </div>
  );
}
