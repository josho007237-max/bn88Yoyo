// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  useLocation,
  Route,
} from "react-router-dom";
import { Toaster } from "react-hot-toast";

import App from "./App";
import Dashboard from "./pages/Dashboard";
import BotsPage from "./pages/Bots";
import BotDetail from "./pages/BotDetail";
import Login from "./pages/Login";
import ChatCenter from "./pages/ChatCenter";
import Cases from "./pages/Cases";
import CaseDetail from "./pages/CaseDetail";
import Knowledge from "./pages/Knowledge";
import MarketingLep from "./pages/MarketingLep";
import Faqs from "./pages/Faqs";
import Notifications from "./pages/Notifications";

import Rules from "./pages/Rules";
import DailyRuleStock from "./pages/DailyRuleStock";

import "./index.css";

import { getToken } from "./lib/api"; // ✅ ใช้ตัวเดียวกันทั้งระบบ
import ImageSamplesPage from "./pages/ImageSamples";

// ใน <Routes> ... </Routes>
<Route path="/image-samples" element={<ImageSamplesPage />} />;

function hasToken() {
  return !!getToken();
}

function ScrollTop() {
  const { pathname } = useLocation();
  React.useEffect(() => window.scrollTo(0, 0), [pathname]);
  return null;
}

function RequireAuth({ children }: { children: JSX.Element }) {
  const location = useLocation();
  if (!hasToken()) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}

function RouteError() {
  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold">เกิดข้อผิดพลาดของเส้นทาง</h2>
      <p className="text-sm text-neutral-500">
        ลองรีเฟรชหน้า หรือกลับไปหน้าแรก
      </p>
      <a href="/" className="text-indigo-500 underline">
        กลับหน้าแรก
      </a>
    </div>
  );
}

const router = createBrowserRouter([
  { path: "/login", element: <Login />, errorElement: <RouteError /> },
  {
    path: "/",
    element: (
      <>
        <ScrollTop />
        <App />
      </>
    ),
    errorElement: <RouteError />,
    children: [
      {
        index: true,
        element: (
          <RequireAuth>
            <Dashboard />
          </RequireAuth>
        ),
      },
      {
        path: "dashboard",
        element: (
          <RequireAuth>
            <Dashboard />
          </RequireAuth>
        ),
      },
      {
        path: "bots",
        element: (
          <RequireAuth>
            <BotsPage />
          </RequireAuth>
        ),
      },
      {
        path: "bots/:botId",
        element: (
          <RequireAuth>
            <BotDetail />
          </RequireAuth>
        ),
      },
      {
        path: "chats",
        element: (
          <RequireAuth>
            <ChatCenter />
          </RequireAuth>
        ),
      },
      {
        path: "cases",
        element: (
          <RequireAuth>
            <Cases />
          </RequireAuth>
        ),
      },
      {
        path: "cases/:caseId",
        element: (
          <RequireAuth>
            <CaseDetail />
          </RequireAuth>
        ),
      },
      {
        path: "knowledge",
        element: (
          <RequireAuth>
            <Knowledge />
          </RequireAuth>
        ),
      },
      {
        path: "faqs",
        element: (
          <RequireAuth>
            <Faqs />
          </RequireAuth>
        ),
      },
      {
        path: "notifications",
        element: (
          <RequireAuth>
            <Notifications />
          </RequireAuth>
        ),
      },
      {
        path: "marketing-lep",
        element: (
          <RequireAuth>
            <MarketingLep />
          </RequireAuth>
        ),
      },

      // ✅ เพิ่ม 2 route นี้
      {
        path: "rules",
        element: (
          <RequireAuth>
            <Rules />
          </RequireAuth>
        ),
      },
      {
        path: "rules/:ruleId",
        element: (
          <RequireAuth>
            <DailyRuleStock />
          </RequireAuth>
        ),
      },

      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);

function Root() {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster position="top-right" />
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
