import { useState } from "react";
import { loginClient, loginTeamMember, type WorkspaceInfo } from "../lib/api";

interface Props {
  workspace: WorkspaceInfo;
  portalCode: string;
  mode: "client" | "team";
  onLogin: (name: string, email: string, password: string, firstLogin: boolean, userType: "client" | "team", role?: string) => void;
  onSwitchMode: () => void;
}

export function LoginForm({ workspace, portalCode, mode, onLogin, onSwitchMode }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError("Please enter your email address."); return; }
    if (!password.trim()) { setError("Please enter your password."); return; }
    setLoading(true);
    setError("");

    try {
      if (mode === "team") {
        const result = await loginTeamMember(portalCode, email.trim(), password.trim());
        if (result.ok) {
          onLogin(result.name, result.email, password.trim(), result.firstLogin, "team", result.role);
        } else {
          setError(result.message);
        }
      } else {
        const result = await loginClient(portalCode, email.trim(), password.trim());
        if (result.ok) {
          onLogin(result.name, result.email, password.trim(), result.firstLogin, "client");
        } else {
          setError(result.message);
        }
      }
    } catch {
      setError("Could not connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <img src={`${import.meta.env.BASE_URL}hourlink_icon.png`} alt="HourLink" className="w-16 h-16 rounded-2xl mx-auto mb-4" />
          <h1 className="text-2xl font-semibold text-foreground mb-1">
            {mode === "team" ? "Team Portal" : "Task Portal"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {mode === "team"
              ? <>Sign in to view your assigned tasks from <span className="font-medium text-foreground">{workspace.ownerName}</span></>
              : <>Sign in to submit tasks to <span className="font-medium text-foreground">{workspace.ownerName}</span></>
            }
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-10 px-3 pr-10 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              <p className="text-destructive text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 bg-primary text-primary-foreground font-medium text-sm rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>

          <p className="text-xs text-muted-foreground text-center">
            Your login details were provided by {workspace.ownerName}.
          </p>
        </form>

        <div className="mt-4 text-center">
          <button onClick={onSwitchMode} className="text-xs text-primary font-medium hover:underline">
            {mode === "team" ? "Sign in as a client instead" : "Sign in as a team member instead"}
          </button>
        </div>
      </div>
    </div>
  );
}
