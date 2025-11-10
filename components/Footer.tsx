import React from "react"

export function Footer() {
  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-black text-white py-3 border-t border-gray-800 z-50 shadow-lg">
      <div className="container mx-auto px-4 max-w-full">
        <div className="flex flex-col items-center space-y-2 min-h-[60px]">
          {/* Top: Centered Copyright */}
          <div className="flex items-center justify-center">
            <p className="text-sm font-medium tracking-wide text-center">
              © 2025{" "}
              <span className="font-bold text-white">KPRCAS</span>
              {" "}
              Powered by{" "}
              <span className="font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                NetCraftStudio
              </span>
            </p>
          </div>
          
          {/* Bottom: Contact Information */}
          <div className="flex items-center justify-between w-full max-w-md">
            {/* Left: Phone */}
            <div className="text-xs text-gray-300">
              <span className="text-white font-medium">Phone_No:</span>{" "}
              <a 
                href="tel:+918122696986" 
                className="text-gray-300 hover:text-white transition-colors duration-200"
              >
                8122696986
              </a>
            </div>
            
            {/* Right: Email */}
            <div className="text-xs text-gray-300">
              <span className="text-white font-medium">Contact Us:</span>{" "}
              <a 
                href="mailto:netcraftstudio01@gmail.com" 
                className="text-gray-300 hover:text-white transition-colors duration-200"
              >
                netcraftstudio01@gmail.com
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
