import { useState, useEffect, useCallback } from "react";
import { IdentifyForm } from "./components/IdentifyForm";
import { TaskBoard } from "./components/TaskBoard";
import { getWorkspace, type WorkspaceInfo } from "./lib/api";

function App() {
  const [portalCode, setPortalCode] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
            setUser(JSON.parse(saved));
          } catch {}
        }
      } else {
        setError("This portal link is invalid or has expired.");
      }
    }).catch(() => {
      setError("Could not connect to the server. Please check your connection and try again.");
    });
  }, [portalCode]);

  const handleIdentify = useCallback((name: string, email: string) => {
    if (!portalCode) return;
    setUser({ name, email });
    localStorage.setItem(`hourlink_portal_${portalCode}`, JSON.stringify({ name, email }));
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
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </div>
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
    return <IdentifyForm workspace={workspace} portalCode={portalCode} onIdentify={handleIdentify} />;
  }

  return <TaskBoard workspace={workspace} portalCode={portalCode} user={user} onLogout={() => {
    setUser(null);
    localStorage.removeItem(`hourlink_portal_${portalCode}`);
  }} />;
}

export default App;
