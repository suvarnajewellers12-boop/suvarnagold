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
  ChevronLeft,
  ChevronRight,
  Plus
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const menuItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Admin Management", url: "/dashboard/admins", icon: Users },
  { title: "Create Scheme", url: "/dashboard/create-scheme", icon: Plus },
  { title: "Customer Management", url: "/dashboard/customers", icon: Users },
  { title: "Products", url: "/dashboard/products", icon: Package },
  // { title: "Store", url: "/dashboard/store", icon: Store },
  { title: "Billing", url: "/dashboard/billing", icon: Receipt },
  { title: "Reports", url: "/dashboard/reports", icon: FileText },
  // { title: "Settings", url: "/dashboard/settings", icon: Settings },
];

export function DashboardSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center">
            <img
              src="/logo.png"
              alt="Suvarna Logo"
              className="w-25 h-10 object-contain"
            />
          </div>
            {!isCollapsed && (
            <div className="fade-in-up">
              <h2 className="font-serif text-lg font-bold text-sidebar-foreground">
                Suvarna Portal
              </h2>
              <p className="text-xs text-sidebar-foreground/60">Super Admin</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          {!isCollapsed && (
            <SidebarGroupLabel className="text-sidebar-foreground/50 uppercase text-xs tracking-wider">
              Main Menu
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/dashboard"}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      activeClassName="bg-sidebar-primary text-sidebar-primary-foreground shadow-gold"
                    >
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          >
            {isCollapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <ChevronLeft className="w-5 h-5" />
            )}
          </Button>
          {!isCollapsed && (
            <NavLink
              to="/"
              className="flex items-center gap-2 text-sidebar-foreground/60 hover:text-destructive transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="text-sm">Logout</span>
            </NavLink>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
