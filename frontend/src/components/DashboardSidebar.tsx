import { NavLink } from "@/components/NavLink";
import { Crown } from "@/components/Crown";
import {
  LayoutDashboard,
  Users,
  Package,
  FileText,
  Receipt,
  Settings,
  LogOut,
  Store,
  Plus
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { AccessibleFocus } from "./accessibility/AccessibleFocus";

const menuItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Billing", url: "/dashboard/billing", icon: Receipt },
  { title: "Reports", url: "/dashboard/reports", icon: FileText },
  { title: "Products", url: "/dashboard/products", icon: Package },
  { title: "Create Scheme", url: "/dashboard/create-scheme", icon: Plus },
  { title: "Customer Management", url: "/dashboard/customers", icon: Users },
  { title: "Estimation Terminal", url: "/dashboard/estimation-terminal", icon: Receipt },
  { title: "Job Work", url: "/dashboard/jobwork", icon: Package },
  { title: "Gold Purchase", url: "/dashboard/gold-purchase", icon: Package },
  { title: "Staff Management", url: "/dashboard/staff", icon: Users },
  { title: "Admin Management", url: "/dashboard/admins", icon: Users },
  { title: "Photos", url: "/dashboard/photos", icon: Package },
  { title: "Credit Notes", url: "/dashboard/credit-notes", icon: FileText }
];

export function DashboardSidebar() {
  // Collapse logic removed - Sidebar will now remain permanently visible/expanded
  
  return (
    <Sidebar className="border-r border-sidebar-border">
      {/* HEADER SECTION: Fixed at top */}
      <SidebarHeader className="p-4 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center">
            <img
              src="/logo.png"
              alt="Suvarna Logo"
              className="w-25 h-10 object-contain"
            />
          </div>
          <div className="fade-in-up">
            <h2 className="font-serif text-lg font-bold text-sidebar-foreground">
              Suvarna Portal
            </h2>
            <p className="text-xs text-sidebar-foreground/60">Super Admin</p>
          </div>
        </div>

        {/* FIXED LABEL */}
        <div className="px-2 text-sidebar-foreground/50 uppercase text-xs tracking-wider font-semibold">
          Main Menu
        </div>
      </SidebarHeader>

      {/* SCROLLABLE CONTENT: Scrollbar hidden */}
      <SidebarContent className="overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <SidebarGroup className="pt-0">
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <AccessibleFocus label={`${item.title} selected`}>
                      <NavLink
                        to={item.url}
                        end={item.url === "/dashboard"}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                        activeClassName="bg-sidebar-primary text-sidebar-primary-foreground shadow-gold"
                      >
                        <item.icon className="w-5 h-5 flex-shrink-0" />
                        <span>{item.title}</span>
                      </NavLink>
                    </AccessibleFocus>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* FOOTER SECTION: Logout arranged to the left side */}
      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className="flex items-center justify-start">
          <AccessibleFocus label="Logout button">
            <NavLink
              to="/"
              className="flex items-center gap-2 text-sidebar-foreground/60 hover:text-destructive transition-colors group"
            >
              <LogOut className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
              <span className="text-sm font-medium">Logout</span>
            </NavLink>
          </AccessibleFocus>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}