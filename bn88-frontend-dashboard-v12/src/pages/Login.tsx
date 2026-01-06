import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getApiBase, login, TOKEN_KEY } from "../lib/api";

export default function Login() {
  const nav = useNavigate();

  const [email, setEmail] = useState("admin@bn9.local");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showPwd, setShowPwd] = useState(false);

  useEffect(() => {
    try {
      const legacy = localStorage.getItem("BN9_TOKEN");
      if (legacy && !localStorage.getItem(TOKEN_KEY)) {
        localStorage.setItem(TOKEN_KEY, legacy);
        localStorage.removeItem("BN9_TOKEN");
      }
      const tok = localStorage.getItem(TOKEN_KEY);
      if (tok && tok.trim()) nav("/bots", { replace: true });
    } catch {
      // ignore
    }
  }, [nav]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;

    setErr(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
      nav("/bots", { replace: true });
    } catch (ex: any) {
      const msg = String(ex?.message || "");
      if (/401|unauthorized|invalid/i.test(msg)) setErr("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
      else if (/fetch|network|Failed to fetch|Network Error/i.test(msg))
        setErr("ติดต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบ API Base หรืออินเทอร์เน็ต");
      else setErr(msg || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-gray-50 text-gray-900 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-lg border border-gray-200 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">BN9 Login</h1>
            <p className="text-xs text-gray-500 mt-1">API: {getApiBase()}</p>
          </div>

          <button
            type="button"
            onClick={() => {
              setEmail("root@bn9.local");
              setPassword("bn9@12345");
            }}
            className="text-xs text-indigo-600 hover:text-indigo-700"
            title="กรอกค่าเดโม่"
          >
            demo
          </button>
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <div className="mt-1 relative">
              <input
                id="password"
                name="password"
                type={showPwd ? "text" : "password"}
                autoComplete="current-password"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 outline-none focus:ring-2 focus:ring-indigo-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-gray-700 text-sm"
                title={showPwd ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
              >
                {showPwd ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {err && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 text-white font-medium py-2.5 hover:bg-indigo-700 active:scale-[.99] transition disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>

          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Tenant: {import.meta.env.VITE_TENANT || "bn9"}</span>
            <span>v{import.meta.env.VITE_APP_VERSION || "dev"}</span>
          </div>
        </form>
      </div>
    </div>
  );
}
