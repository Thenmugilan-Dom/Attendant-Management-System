import React from "react"
import { Mail, Heart } from "lucide-react"

export function Footer() {
  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-black text-white py-3 border-t border-gray-800 z-50">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="flex flex-col sm:flex-row items-center justify-between space-y-2 sm:space-y-0">
          {/* Main Copyright */}
          <div className="text-center sm:text-left">
            <p className="text-sm font-medium tracking-wide">
              © 2025{" "}
              <span className="font-bold text-white">KPRCAS</span>
              {" • "}
              Powered by{" "}
              <span className="font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                NetCraftStudio
              </span>
            </p>
          </div>
          
          {/* Contact Information */}
          <div className="flex items-center justify-center space-x-2 text-xs text-gray-300">
            <div className="flex items-center space-x-1">
              <Mail className="h-3 w-3 text-blue-400" />
              <span>Contact:</span>
            </div>
            <a 
              href="mailto:netcraftstudio01@gmail.com" 
              className="text-blue-400 hover:text-blue-300 transition-colors duration-200 underline decoration-1 underline-offset-2 font-medium"
            >
              netcraftstudio01@gmail.com
            </a>
          </div>
          
          {/* Built with love */}
          <div className="flex items-center space-x-1 text-xs text-gray-400">
            <span>Built with</span>
            <Heart className="h-2 w-2 text-red-500 fill-red-500 animate-pulse" />
            <span>for KPRCAS</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
