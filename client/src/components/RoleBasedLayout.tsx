import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Video,
  Upload,
  Search,
  Users,
  Workflow,
  LogOut,
  Scissors,
  Building2,
  Target,
  Cloud,
  FolderInput,
  User,
} from "lucide-react";

type UserRole = "superadmin" | "admin" | "creative" | "search" | "pickone";

interface NavItem {
  title: string;
  url: string;
  icon: typeof Video;
  roles: UserRole[];
}

const navItems: NavItem[] = [
  {
    title: "My Videos",
    url: "/",
    icon: Video,
    roles: ["superadmin", "admin", "creative"],
  },
  {
    title: "Upload",
    url: "/upload",
    icon: Upload,
    roles: ["superadmin", "admin", "creative"],
  },
  {
    title: "Cloud Storage",
    url: "/cloud-storage",
    icon: Cloud,
    roles: ["superadmin", "admin", "creative"],
  },
  {
    title: "Import Progress",
    url: "/import-progress",
    icon: FolderInput,
    roles: ["superadmin", "admin", "creative"],
  },
  {
    title: "Ask a Video",
    url: "/search",
    icon: Search,
    roles: ["superadmin", "admin", "creative", "search"],
  },
  {
    title: "Local Business Research",
    url: "/leads",
    icon: Building2,
    roles: ["superadmin", "admin", "creative"],
  },
  {
    title: "SWOT Analysis",
    url: "/swot",
    icon: Target,
    roles: ["superadmin", "admin", "creative"],
  },
];

const adminItems: NavItem[] = [
  {
    title: "Users",
    url: "/admin",
    icon: Users,
    roles: ["superadmin"],
  },
  {
    title: "Workflow",
    url: "/admin/workflow",
    icon: Workflow,
    roles: ["superadmin", "admin"],
  },
];

interface RoleBasedLayoutProps {
  children: React.ReactNode;
}

export default function RoleBasedLayout({ children }: RoleBasedLayoutProps) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const userRole = (user?.role || "search") as UserRole;

  const filteredNavItems = navItems.filter((item) =>
    item.roles.includes(userRole)
  );
  const filteredAdminItems = adminItems.filter((item) =>
    item.roles.includes(userRole)
  );

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <Sidebar>
          <SidebarHeader className="border-b border-sidebar-border p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                <Video className="w-4 h-4" />
              </div>
              <span className="font-bold text-lg">Video Studio</span>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Navigation</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {filteredNavItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={location === item.url}
                        tooltip={item.title}
                      >
                        <Link href={item.url} data-testid={`nav-${item.url.replace(/\//g, '-').slice(1) || 'home'}`}>
                          <item.icon className="w-4 h-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {filteredAdminItems.length > 0 && (
              <SidebarGroup>
                <SidebarGroupLabel>Admin</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {filteredAdminItems.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          isActive={location === item.url || location.startsWith(item.url + '/')}
                          tooltip={item.title}
                        >
                          <Link href={item.url} data-testid={`nav-admin-${item.url.replace(/\//g, '-').slice(1)}`}>
                            <item.icon className="w-4 h-4" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </SidebarContent>

          <SidebarFooter className="border-t border-sidebar-border p-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.profileImageUrl || ""} />
                <AvatarFallback>
                  {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {user?.firstName || user?.email?.split('@')[0] || "User"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user?.role || "search"}
                </p>
              </div>
              <div className="flex gap-1">
                <Link href="/profile">
                  <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-profile">
                    <User className="w-4 h-4" />
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => logout()}
                  data-testid="button-logout"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </SidebarFooter>
        </Sidebar>

        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center gap-2 p-2 border-b bg-background">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
          </header>
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}

export function canAccessRoute(role: UserRole | undefined, path: string): boolean {
  const userRole = role || "search";
  
  if (path === "/profile") {
    return true;
  }
  
  if (userRole === "search") {
    return path === "/search";
  }
  
  if (userRole === "pickone") {
    return path.startsWith("/workbook") || path === "/";
  }
  
  if (path.startsWith("/admin")) {
    if (path === "/admin") {
      return userRole === "superadmin";
    }
    return userRole === "superadmin" || userRole === "admin";
  }
  
  return ["superadmin", "admin", "creative"].includes(userRole);
}

export function getDefaultRoute(role: UserRole | undefined): string {
  const userRole = role || "search";
  
  if (userRole === "search") {
    return "/search";
  }
  
  if (userRole === "pickone") {
    return "/workbook";
  }
  
  return "/";
}
