import React, { useState } from "react";
import { 
  Shield, Menu, X, ArrowRight, LayoutDashboard, Globe, Smartphone, LogOut, 
  Users, Key, Compass, HeartHandshake, ShieldAlert, Sparkles, Bell
} from "lucide-react";

interface NavbarProps {
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
  viewMode: "public" | "dashboard" | "companion";
  setViewMode: (mode: "public" | "dashboard" | "companion") => void;
  scrollToSection: (id: string) => void;
  user: any;
  userData: any;
  isGuestMode: boolean;
  onLogout: () => void;
  onOpenTour?: () => void;
  navigate?: (to: string) => void;
  pendingNotificationCount?: number;
  onOpenFamilyRequests?: () => void;
}

export default function Navbar({
  isDarkMode,
  setIsDarkMode,
  viewMode,
  setViewMode,
  scrollToSection,
  user,
  userData,
  isGuestMode,
  onLogout,
  onOpenTour,
  navigate,
  pendingNotificationCount = 0,
  onOpenFamilyRequests
}: NavbarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showPortalDropdown, setShowPortalDropdown] = useState(false);

  const handleNav = (path: string) => {
    if (navigate) {
      navigate(path);
    } else {
      if (path === "/") setViewMode("public");
      else if (path.startsWith("/parent")) setViewMode("dashboard");
      else if (path.startsWith("/child")) setViewMode("dashboard");
    }
  };

  const userRole = userData?.role || (user ? "parent" : null);

  return (
    <nav className="sticky top-0 z-50 w-full bg-slate-950/85 backdrop-blur-md border-b border-slate-800 transition-colors duration-300">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-18 items-center justify-between">
          
          {/* Logo */}
          <div 
            onClick={() => handleNav("/")}
            className="flex cursor-pointer items-center space-x-3 group"
          >
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-teal-400 text-white shadow-lg shadow-blue-500/20 group-hover:scale-105 transition">
              <Shield className="h-5 w-5" />
              <div className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-ping rounded-full bg-teal-400"></div>
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-display text-lg font-bold tracking-tight text-white">
                  Guardian<span className="text-teal-400">AI</span>
                </span>
                <span className="text-[10px] font-mono bg-blue-500/10 border border-blue-500/30 text-blue-400 px-1.5 py-0.2 rounded">
                  v3.0
                </span>
              </div>
              <p className="text-[9px] font-mono tracking-wider leading-none text-slate-400">AI CHILD SAFETY & WELLNESS</p>
            </div>
          </div>

          {/* Desktop Nav Items */}
          <div className="hidden lg:flex items-center space-x-6">
            <button 
              onClick={() => {
                if (window.location.pathname !== "/") {
                  handleNav("/");
                  setTimeout(() => scrollToSection("features"), 200);
                } else {
                  scrollToSection("features");
                }
              }} 
              className="text-xs font-semibold text-slate-300 hover:text-teal-400 transition-colors cursor-pointer"
            >
              Features
            </button>
            <button 
              onClick={() => {
                if (window.location.pathname !== "/") {
                  handleNav("/");
                  setTimeout(() => scrollToSection("ai-features"), 200);
                } else {
                  scrollToSection("ai-features");
                }
              }} 
              className="text-xs font-semibold text-slate-300 hover:text-teal-400 transition-colors cursor-pointer"
            >
              Neural Shield
            </button>

            <button 
              onClick={() => {
                if (window.location.pathname !== "/") {
                  handleNav("/");
                  setTimeout(() => scrollToSection("analytics-hub"), 200);
                } else {
                  scrollToSection("analytics-hub");
                }
              }} 
              className="text-xs font-semibold text-slate-300 hover:text-teal-400 transition-colors cursor-pointer"
            >
              Live Telemetry
            </button>

            {/* Portals Quick Selector Menu (Parent & Child only) */}
            <div className="relative">
              <button
                onClick={() => setShowPortalDropdown(!showPortalDropdown)}
                className="flex items-center space-x-1 text-xs font-semibold text-slate-300 hover:text-teal-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl transition cursor-pointer"
              >
                <span>Portals</span>
                <span className="text-[10px] text-slate-500">▼</span>
              </button>

              {showPortalDropdown && (
                <div 
                  className="absolute left-0 mt-2 w-56 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-2 z-50 space-y-1 animate-fadeIn"
                  onMouseLeave={() => setShowPortalDropdown(false)}
                >
                  <button
                    onClick={() => {
                      handleNav("/parent");
                      setShowPortalDropdown(false);
                    }}
                    className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-left hover:bg-slate-800 text-xs text-slate-200 transition cursor-pointer"
                  >
                    <HeartHandshake className="h-4 w-4 text-blue-400" />
                    <div>
                      <p className="font-semibold text-white">Parent Portal</p>
                      <p className="text-[10px] text-slate-400">Controls & Geofence</p>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      handleNav("/child");
                      setShowPortalDropdown(false);
                    }}
                    className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-left hover:bg-slate-800 text-xs text-slate-200 transition cursor-pointer"
                  >
                    <Compass className="h-4 w-4 text-emerald-400" />
                    <div>
                      <p className="font-semibold text-white">Child Portal</p>
                      <p className="text-[10px] text-slate-400">Homework & Safety</p>
                    </div>
                  </button>
                </div>
              )}
            </div>

            <button 
              onClick={() => {
                if (window.location.pathname !== "/") {
                  handleNav("/");
                  setTimeout(() => scrollToSection("faq"), 200);
                } else {
                  scrollToSection("faq");
                }
              }} 
              className="text-xs font-semibold text-slate-300 hover:text-teal-400 transition-colors cursor-pointer"
            >
              FAQ
            </button>

            <button 
              onClick={() => {
                if (window.location.pathname !== "/") {
                  handleNav("/");
                  setTimeout(() => scrollToSection("contact"), 200);
                } else {
                  scrollToSection("contact");
                }
              }} 
              className="text-xs font-semibold text-slate-300 hover:text-teal-400 transition-colors cursor-pointer"
            >
              Support
            </button>
          </div>

          {/* Right Action buttons */}
          <div className="hidden md:flex items-center space-x-3">
            {onOpenTour && (
              <button
                onClick={onOpenTour}
                className="inline-flex items-center space-x-1.5 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 hover:bg-teal-500/20 px-3 py-1.5 text-xs font-bold transition-all cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5 text-teal-400" />
                <span>Feature Tour</span>
              </button>
            )}

            {/* Authenticated User Status Pill or Logged-out Portal Access */}
            {user ? (
              <div className="flex items-center space-x-2">
                {/* Real-time Family Link Notification Badge */}
                {pendingNotificationCount > 0 && (
                  <button
                    onClick={onOpenFamilyRequests || (() => handleNav("/parent"))}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-300 hover:bg-amber-500/30 transition cursor-pointer text-xs font-black shadow-lg shadow-amber-500/20 animate-bounce"
                    title={`${pendingNotificationCount} Pending Family Link Request(s)`}
                  >
                    <Bell className="h-4 w-4 text-amber-400" />
                    <span className="font-mono text-xs">{pendingNotificationCount}</span>
                  </button>
                )}

                <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-xs">
                  <div className={`h-2 w-2 rounded-full ${
                    userRole === "admin" ? "bg-rose-400" : userRole === "child" ? "bg-emerald-400" : "bg-blue-400"
                  } animate-pulse`}></div>
                  <div className="text-left">
                    <p className="text-slate-200 font-semibold truncate max-w-[120px]">{user.email}</p>
                    <p className="text-[10px] text-slate-500 uppercase font-mono">{userRole || "User"}</p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (userRole === "admin") handleNav("/admin");
                    else if (userRole === "child") handleNav("/child");
                    else handleNav("/parent");
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition cursor-pointer shadow-md"
                >
                  Dashboard
                </button>

                <button
                  onClick={onLogout}
                  className="p-2 rounded-xl bg-slate-900 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-800/40 transition cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleNav("/demo")}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-xs font-bold transition cursor-pointer shadow-sm hover:shadow-cyan-500/20"
                >
                  <Sparkles className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
                  <span>Explore Demo</span>
                </button>
                <button
                  onClick={() => handleNav("/child/login")}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-slate-800 text-xs font-bold transition cursor-pointer"
                >
                  Child Portal
                </button>
                <button
                  onClick={() => handleNav("/parent/login")}
                  className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-500 hover:to-teal-400 text-white text-xs font-bold shadow-lg shadow-blue-600/20 transition cursor-pointer"
                >
                  Parent Portal
                </button>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center space-x-2 md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-900"
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isOpen && (
        <div className="md:hidden border-t border-slate-800 bg-slate-950 px-4 py-4 space-y-3 shadow-2xl animate-fadeIn">
          {/* Explore Demo Quick Access in Mobile Drawer */}
          <button
            onClick={() => { handleNav("/demo"); setIsOpen(false); }}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-950 via-slate-900 to-blue-950 border border-cyan-500/40 text-cyan-300 text-xs font-bold flex items-center justify-center space-x-2 shadow-md cursor-pointer"
          >
            <Sparkles className="h-4 w-4 text-cyan-400 animate-pulse" />
            <span>Explore Demo (No Login Required)</span>
          </button>

          <div className="grid grid-cols-2 gap-2 pb-2">
            <button
              onClick={() => { handleNav("/parent"); setIsOpen(false); }}
              className="p-2.5 rounded-xl bg-blue-950/40 border border-blue-800/40 text-center text-xs font-semibold text-blue-300 flex items-center justify-center space-x-1.5"
            >
              <HeartHandshake className="h-4 w-4" />
              <span>Parent Portal</span>
            </button>
            <button
              onClick={() => { handleNav("/child"); setIsOpen(false); }}
              className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/40 text-center text-xs font-semibold text-emerald-300 flex items-center justify-center space-x-1.5"
            >
              <Compass className="h-4 w-4" />
              <span>Child Portal</span>
            </button>
          </div>

          <div className="flex flex-col space-y-2 pb-2 text-sm border-t border-slate-800 pt-2">
            <button 
              onClick={() => { scrollToSection("features"); setIsOpen(false); }}
              className="text-left px-3 py-2 text-slate-300 hover:text-teal-400"
            >
              Features
            </button>
            <button 
              onClick={() => { scrollToSection("ai-features"); setIsOpen(false); }}
              className="text-left px-3 py-2 text-slate-300 hover:text-teal-400"
            >
              Neural Shield
            </button>
            <button 
              onClick={() => { scrollToSection("faq"); setIsOpen(false); }}
              className="text-left px-3 py-2 text-slate-300 hover:text-teal-400"
            >
              FAQ
            </button>
            <button 
              onClick={() => { scrollToSection("contact"); setIsOpen(false); }}
              className="text-left px-3 py-2 text-slate-300 hover:text-teal-400"
            >
              Support
            </button>
          </div>

          {user ? (
            <div className="border-t border-slate-800 pt-3 space-y-2">
              {pendingNotificationCount > 0 && (
                <button
                  onClick={() => {
                    if (onOpenFamilyRequests) onOpenFamilyRequests();
                    else handleNav("/parent");
                    setIsOpen(false);
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-300 text-xs font-bold flex items-center justify-center space-x-2 animate-pulse"
                >
                  <Bell className="h-4 w-4 text-amber-400" />
                  <span>{pendingNotificationCount} Pending Family Link Request(s)</span>
                </button>
              )}
              <button
                onClick={() => {
                  if (userRole === "admin") handleNav("/admin");
                  else if (userRole === "child") handleNav("/child");
                  else handleNav("/parent");
                  setIsOpen(false);
                }}
                className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold"
              >
                Go to Dashboard ({userRole || "User"})
              </button>
              <button
                onClick={() => { onLogout(); setIsOpen(false); }}
                className="w-full py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold flex items-center justify-center space-x-2"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out ({user.email})</span>
              </button>
            </div>
          ) : (
            <div className="border-t border-slate-800 pt-3 space-y-2">
              <button
                onClick={() => { handleNav("/parent/login"); setIsOpen(false); }}
                className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold"
              >
                Parent Portal
              </button>
              <button
                onClick={() => { handleNav("/child/login"); setIsOpen(false); }}
                className="w-full py-2.5 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold"
              >
                Child Portal
              </button>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
