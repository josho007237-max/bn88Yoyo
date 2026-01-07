// src/App.tsx
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useCallback } from "react";
import { clearToken } from "./lib/api";
import ImageSamplesPage from "./pages/ImageSamples";

export default function App() {
  const nav = useNavigate();
  const location = useLocation();

  const onLogout = useCallback(() => {
    clearToken();
    nav("/login", { replace: true });
  }, [nav]);

  const isActive = (path: string) =>
    location.pathname === path ||
    (path !== "/dashboard" && location.pathname.startsWith(path));

  const navLinkClass = (path: string) =>
    [
      "px-3 py-1.5 rounded-lg text-sm",
      "hover:bg-white/5",
      isActive(path) ? "bg-white/10 font-medium" : "",
    ]
      .filter(Boolean)
      .join(" ");

  return (
    <div className="min-h-screen bg-[#0f1113] text-gray-100">
      <header className="sticky top-0 z-10 bg-[#0f1113]/80 backdrop-blur border-b border-neutral-800">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/dashboard" className="text-lg font-semibold">
            Kumphan.bot
          </Link>

          <nav className="ml-auto flex items-center gap-2 text-sm">
            <Link to="/dashboard" className={navLinkClass("/dashboard")}>
              Dashboard
            </Link>
            <Link to="/bots" className={navLinkClass("/bots")}>
              Bots
            </Link>
            <Link to="/chats" className={navLinkClass("/chats")}>
              Chat Center
            </Link>
            <Link to="/cases" className={navLinkClass("/cases")}>
              Cases
            </Link>
            <Link to="/faqs" className={navLinkClass("/faqs")}>
              FAQ
            </Link>
            <Link to="/knowledge" className={navLinkClass("/knowledge")}>
              Knowledge
            </Link>
            <Link
              to="/marketing-lep"
              className={navLinkClass("/marketing-lep")}
            >
              LEP Monitor
            </Link>
            <Link
              to="/rules"
              className="px-3 py-1.5 rounded-lg hover:bg-white/5"
            >
              Rules
            </Link>

            <button
              onClick={onLogout}
              className="ml-2 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-sm"
              title="ออกจากระบบ"
            >
              Logout
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
