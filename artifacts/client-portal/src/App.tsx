import { useState, useEffect, useCallback } from "react";
import { LoginForm } from "./components/LoginForm";
import { ChangePasswordModal } from "./components/ChangePasswordModal";
import { TaskBoard } from "./components/TaskBoard";
import { getWorkspace, type WorkspaceInfo } from "./lib/api";

function App() {
  const [portalCode, setPortalCode] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      setPortalCode(code.toUpperCase());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!portalCode) return;
    getWorkspace(portalCode).then((ws) => {
      if (ws) {
        setWorkspace(ws);
        const saved = localStorage.getItem(`hourlink_portal_${portalCode}`);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed.name && parsed.email) {
              setUser(parsed);
            }
          } catch {}
        }
      } else {
        setError("This portal link is invalid or has expired.");
      }
    }).catch(() => {
      setError("Could not connect to the server. Please check your connection and try again.");
    });
  }, [portalCode]);

  const handleLogin = useCallback((name: string, email: string, password: string, firstLogin: boolean) => {
    if (!portalCode) return;
    setUser({ name, email });
    setCurrentPassword(password);
    localStorage.setItem(`hourlink_portal_${portalCode}`, JSON.stringify({ name, email }));
    if (firstLogin) {
      setShowChangePassword(true);
    }
  }, [portalCode]);

  const handleLogout = useCallback(() => {
    if (!portalCode) return;
    setUser(null);
    setCurrentPassword("");
    localStorage.removeItem(`hourlink_portal_${portalCode}`);
  }, [portalCode]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!portalCode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full text-center">
          <img src={`${import.meta.env.BASE_URL}hourlink_icon.png`} alt="HourLink" className="w-16 h-16 rounded-2xl mx-auto mb-6" />
          <h1 className="text-2xl font-semibold text-foreground mb-2">HourLink Task Portal</h1>
          <p className="text-muted-foreground mb-6">
            This portal lets you submit tasks to your freelancer. You need a valid portal link to continue.
          </p>
          <p className="text-sm text-muted-foreground">
            Ask your freelancer to share their portal link with you.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-destructive/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-destructive">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-foreground mb-2">Invalid Portal</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Connecting to portal...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm workspace={workspace} portalCode={portalCode} onLogin={handleLogin} />;
  }

  return (
    <>
      <TaskBoard workspace={workspace} portalCode={portalCode} user={user} onLogout={handleLogout} />
      {showChangePassword && (
        <ChangePasswordModal
          workspace={workspace}
          portalCode={portalCode}
          email={user.email}
          currentPassword={currentPassword}
          onDone={() => setShowChangePassword(false)}
        />
      )}
    </>
  );
}

export default App;
