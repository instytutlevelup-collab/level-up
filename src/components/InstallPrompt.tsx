"use client"

import { useState, useEffect } from "react"
import { X, Share, PlusSquare, Download } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function InstallPrompt() {
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(true) // Domyślnie true, by uniknąć mignięcia na PC
  const [showPrompt, setShowPrompt] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)

  useEffect(() => {
    // Sprawdzamy czy apka jest już zainstalowana (dodana do ekranu)
    const isAppInstalled = 
      window.matchMedia("(display-mode: standalone)").matches || 
      (window.navigator as any).standalone === true
      
    setIsStandalone(isAppInstalled)

    // Sprawdzamy, czy użytkownik wcześniej zamknął okienko
    const hasDismissed = localStorage.getItem("installPromptDismissed")

    // Wykrywanie urządzenia (iOS vs Android/Inne)
    const userAgent = window.navigator.userAgent.toLowerCase()
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/.test(userAgent)
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent)
    
    setIsIOS(isIOSDevice)

    // Pokazujemy zachętę tylko na telefonach, jeśli nie jest zainstalowana i nie została odrzucona
    if (isMobile && !isAppInstalled && !hasDismissed) {
      // Małe opóźnienie, by nie atakować użytkownika w pierwszej sekundzie
      const timer = setTimeout(() => setShowPrompt(true), 3000)
      return () => clearTimeout(timer)
    }

    // Android (Chrome) pozwala przechwycić systemowe okienko instalacji
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
  }, [])

  const handleDismiss = () => {
    setShowPrompt(false)
    localStorage.setItem("installPromptDismissed", "true")
  }

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      // Uruchom systemowe okienko instalacji na Androidzie
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === "accepted") {
        setShowPrompt(false)
      }
      setDeferredPrompt(null)
    }
  }

  if (!showPrompt || isStandalone) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 bg-white p-5 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100 z-[9999] animate-in slide-in-from-bottom-10 fade-in duration-500">
      <button 
        onClick={handleDismiss}
        className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
      >
        <X size={20} />
      </button>

      <div className="flex flex-col gap-3">
        <h3 className="font-semibold text-gray-900 text-lg">Zainstaluj aplikację! 🚀</h3>
        <p className="text-sm text-gray-600">
          Dodaj naszą platformę do ekranu głównego, aby rezerwować terminy szybciej i wygodniej.
        </p>

        {isIOS ? (
          <div className="mt-2 bg-gray-50 p-3 rounded-lg text-sm text-gray-700 flex flex-col gap-2">
            <p className="flex items-center gap-2">
              1. Stuknij ikonę <Share size={18} className="text-blue-500" /> w pasku przeglądarki.
            </p>
            <p className="flex items-center gap-2">
              2. Wybierz opcję <PlusSquare size={18} className="text-gray-600" /> <strong>Dodaj do ekranu początkowego</strong>.
            </p>
          </div>
        ) : (
          <Button 
            onClick={handleInstallClick}
            className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white shadow-md flex items-center justify-center gap-2"
          >
            <Download size={18} />
            Zainstaluj aplikację
          </Button>
        )}
      </div>
    </div>
  )
}