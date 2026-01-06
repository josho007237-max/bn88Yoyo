import { useEffect, useState, useMemo } from "react";
import { clearToken } from "../lib/auth";

const getToken = () => localStorage.getItem("bn9.admin.token") || "";
const mask = (t: string) => (!t ? "" : t.length <= 10 ? "********" : `${t.slice(0, 4)}…${t.slice(-4)}`);

export default function AuthBadge() {
  const [tok, setTok] = useState(getToken());
  useEffect(() => {
    const on = () => setTok(getToken());
    window.addEventListener("bn9:token-changed", on);
    return () => window.removeEventListener("bn9:token-changed", on);
  }, []);
  const label = useMemo(() => (tok ? `JWT ${mask(tok)}` : "Not logged in"), [tok]);

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="px-2 py-1 rounded bg-gray-100 text-gray-700">{tok ? "JWT" : "GUEST"}</span>
      <span className="opacity-70">{label}</span>
      {tok ? (
        <button className="px-2 py-1 border rounded hover:bg-gray-50" onClick={() => clearToken()}>
          Logout
        </button>
      ) : null}
    </div>
  );
}

