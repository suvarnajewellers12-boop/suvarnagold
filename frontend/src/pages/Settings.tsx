import { useEffect } from "react";
import { useAccessibility } from "@/components/context/AccessibilityContext";
import { useSpeech } from "@/hooks/useSpeech";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

const Settings = () => {
  const { isEnabled, toggleAccessibility } = useAccessibility();
  const { speak, stop } = useSpeech();

  const handleToggle = () => {
    toggleAccessibility();

    setTimeout(() => {
      if (!isEnabled) {
        speak("Accessibility mode is activated. You can now use voice navigation.");
      } else {
        stop();
      }
    }, 100);
  };

  useEffect(() => {
    if (isEnabled) {
      speak("You opened settings page.");
    }
  }, [isEnabled, speak]);

  return (
    <SidebarProvider>
      <div className="flex w-full min-h-screen bg-gray-50">
        {/* Sidebar */}
        <DashboardSidebar />

        {/* Main Content */}
        <div className="flex-1 w-full p-6 space-y-6">
          <h1 className="text-2xl font-bold">Settings</h1>

          <div className="bg-white shadow rounded-lg p-6 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Accessibility Mode</h2>
              <p className="text-sm text-gray-500">
                Enable voice guidance and keyboard navigation for accessibility.
              </p>
            </div>

            <button
              onClick={handleToggle}
              className={`px-6 py-2 rounded-lg font-medium transition ${isEnabled
                ? "bg-green-600 text-white"
                : "bg-gray-300 text-black"
                }`}
            >
              {isEnabled ? "Enabled" : "Disabled"}
            </button>
          </div>

        </div>
      </div>
    </SidebarProvider>
  );
};

export default Settings;