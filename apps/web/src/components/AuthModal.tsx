import { useState } from "react";
import { login, register, type User } from "../services/auth";

type Props = {
  open: boolean;
  onClose: () => void;
  onLogin: (user: User) => void;
};

export default function AuthModal({ open, onClose, onLogin }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const e = email.trim();
      const u = mode === "login" ? await login(e, password) : await register(e, password);
      setPassword("");
      onLogin(u);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "操作失敗");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="modalMask" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modalTop">
          <div className="modalTitle">{mode === "login" ? "登入" : "註冊"}</div>
          <button className="modalX" onClick={onClose} type="button">
            ×
          </button>
        </div>

        <div className="modalTabs">
          <button className={`tabBtn ${mode === "login" ? "tabActive" : ""}`} onClick={() => setMode("login")} type="button">
            登入
          </button>
          <button className={`tabBtn ${mode === "register" ? "tabActive" : ""}`} onClick={() => setMode("register")} type="button">
            註冊
          </button>
        </div>

        <div className="modalBody">
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
          <input
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="密碼（至少 6 碼）"
            type="password"
            style={{ marginTop: 10 }}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
          />

          {error && <div style={{ marginTop: 10, color: "crimson" }}>{error}</div>}

          <button className="btn btnPrimary" style={{ width: "100%", marginTop: 12 }} onClick={submit} disabled={loading}>
            {loading ? "處理中…" : mode === "login" ? "登入" : "註冊"}
          </button>

          <div className="modalHint">帳號資料已儲存至資料庫，重啟後仍保留。</div>
        </div>
      </div>
    </div>
  );
}
