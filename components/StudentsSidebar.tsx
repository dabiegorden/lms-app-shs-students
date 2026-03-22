"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  BarChart3,
  TrendingUp,
  BookOpen,
  GraduationCap,
  Users,
  MessageSquare,
  Calendar,
  FileText,
  Video,
  Award,
  Signal,
  User,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const menuItems = [
  {
    title: "Dashboard",
    url: "/user-dashboard",
    icon: BarChart3,
  },
  {
    title: "Community",
    items: [
      {
        title: "Daily Signals",
        url: "/user-dashboard/signals",
        icon: Signal,
      },
      {
        title: "Live Sessions",
        url: "/user-dashboard/sessions",
        icon: Calendar,
      },
      {
        title: "Discussion",
        url: "/user-dashboard/discussion",
        icon: MessageSquare,
      },
    ],
  },
  {
    title: "Trading",
    items: [
      {
        title: "One On One Mentorship",
        url: "/user-dashboard/mentorship",
        icon: User,
      },
      {
        title: "Market Analysis",
        url: "/user-dashboard/market-analysis",
        icon: TrendingUp,
      },
      {
        title: "Trading Strategies",
        url: "/user-dashboard/strategies",
        icon: BookOpen,
      },
      {
        title: "Performance",
        url: "/user-dashboard/performance",
        icon: Award,
      },
    ],
  },
  {
    title: "Education",
    items: [
      {
        title: "Courses",
        url: "/user-dashboard/courses",
        icon: GraduationCap,
      },
      {
        title: "Video Tutorials",
        url: "/user-dashboard/tutorials",
        icon: Video,
      },
      {
        title: "Resources",
        url: "/user-dashboard/resources",
        icon: FileText,
      },
    ],
  },
];

export default function StudentsSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar className="bg-gray-900 border-r border-gray-800">
      <SidebarHeader className="p-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-linear-to-r from-red-500 to-pink-500 rounded-lg flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-base">FX</span>
          </div>
          <div>
            <h2 className="font-semibold text-white text-base">Forex Mentor</h2>
            <p className="text-xs text-gray-400">Trading Dashboard</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-gray-900">
        {menuItems.map((item, index) => (
          <SidebarGroup key={index}>
            {item.title && !item.items && (
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                    className="w-full hover:bg-gray-800/80 hover:text-white data-[active=true]:bg-linear-to-r data-[active=true]:from-red-500 data-[active=true]:to-pink-500 text-gray-300 data-[active=true]:text-white transition-all duration-200 mx-2 rounded-lg"
                  >
                    <Link
                      href={item.url}
                      className="flex items-center gap-3 px-3 py-2"
                    >
                      <item.icon className="w-5 h-5" />
                      <span className="font-medium">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            )}

            {item.items && (
              <>
                <SidebarGroupLabel className="text-gray-500 text-xs font-bold uppercase tracking-wider px-5 py-3 mt-2">
                  {item.title}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {item.items.map((subItem) => (
                      <SidebarMenuItem key={subItem.title}>
                        <SidebarMenuButton
                          asChild
                          isActive={pathname.startsWith(subItem.url)}
                          className="hover:bg-gray-800/80 hover:text-white data-[active=true]:bg-linear-to-r data-[active=true]:from-red-500 data-[active=true]:to-pink-500 text-gray-300 data-[active=true]:text-white transition-all duration-200 mx-2 rounded-lg"
                        >
                          <Link
                            href={subItem.url}
                            className="flex items-center gap-3 px-3 py-2"
                          >
                            <subItem.icon className="w-5 h-5" />
                            <span className="font-medium">{subItem.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </>
            )}
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-gray-800 bg-gray-900">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="w-full">{/* User Info */}</div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
