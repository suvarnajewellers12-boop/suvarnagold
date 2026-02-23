import { useState } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import { LuxuryCard } from "@/components/LuxuryCard";
import { GoldDivider } from "@/components/GoldDivider";
import { SuccessToast } from "@/components/SuccessToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Lock, Bell, Save } from "lucide-react";

const AdminSettings = () => {
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const handleSave = () => {
    setToastMessage("Settings saved successfully!");
    setShowToast(true);
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AdminSidebar />
        
        <main className="flex-1 overflow-auto">
          <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-6 py-4">
            <div>
              <h1 className="text-2xl font-serif font-bold text-foreground">Settings</h1>
              <p className="text-sm text-muted-foreground">Manage your account preferences</p>
            </div>
          </header>

          <div className="p-6 space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Profile Settings */}
              <LuxuryCard delay={0}>
                <div className="flex items-center gap-3 mb-6">
                  <User className="w-6 h-6 text-primary" />
                  <h3 className="font-serif font-bold text-xl">Profile Settings</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Full Name</label>
                    <Input defaultValue="Branch Admin" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Email</label>
                    <Input defaultValue="admin@goldencrown.com" type="email" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Branch</label>
                    <Input defaultValue="Main Branch" disabled />
                  </div>
                </div>
              </LuxuryCard>

              {/* Security Settings */}
              <LuxuryCard delay={50}>
                <div className="flex items-center gap-3 mb-6">
                  <Lock className="w-6 h-6 text-primary" />
                  <h3 className="font-serif font-bold text-xl">Security</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Current Password</label>
                    <Input type="password" placeholder="Enter current password" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">New Password</label>
                    <Input type="password" placeholder="Enter new password" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Confirm Password</label>
                    <Input type="password" placeholder="Confirm new password" />
                  </div>
                </div>
              </LuxuryCard>
            </div>

            <GoldDivider />

            {/* Notification Settings */}
            <LuxuryCard delay={100}>
              <div className="flex items-center gap-3 mb-6">
                <Bell className="w-6 h-6 text-primary" />
                <h3 className="font-serif font-bold text-xl">Notifications</h3>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                  <span>Email notifications for new sales</span>
                  <input type="checkbox" defaultChecked className="w-5 h-5 accent-primary" />
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                  <span>Daily report summaries</span>
                  <input type="checkbox" defaultChecked className="w-5 h-5 accent-primary" />
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                  <span>Low stock alerts</span>
                  <input type="checkbox" className="w-5 h-5 accent-primary" />
                </div>
              </div>
            </LuxuryCard>

            <div className="flex justify-end">
              <Button variant="gold" size="lg" onClick={handleSave}>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
            </div>
          </div>
        </main>
      </div>

      <SuccessToast message={toastMessage} isVisible={showToast} onClose={() => setShowToast(false)} />
    </SidebarProvider>
  );
};

export default AdminSettings;
