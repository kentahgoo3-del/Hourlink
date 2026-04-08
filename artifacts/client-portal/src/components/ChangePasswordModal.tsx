import { useState } from "react";
import { changePassword, keepPassword, type WorkspaceInfo } from "../lib/api";

interface Props {
  workspace: WorkspaceInfo;
  portalCode: string;
  email: string;
  currentPassword: string;
  onDone: () => void;
}

export function ChangePasswordModal({ workspace, portalCode, email, currentPassword, onDone }: Props) {
  const [mode, setMode] = useState<"choose" | "change">("choose");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showNew, setShowNew] = useState(false);

  const handleKeep = async () => {
    await keepPassword(portalCode, email);
    onDone();
  };

  const handleChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError("");
    const result = await changePassword(portalCode, email, currentPassword, newPassword);
    setLoading(false);
    if (result.ok) {
      onDone();
    } else {
      setError(result.message || "Could not change password.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
        <div className="p-6">
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-foreground">Welcome to HourLink</h2>
            <p className="text-sm text-muted-foreground mt-1">
              This is your first time signing in. Would you like to change your password?
            </p>
          </div>

          {mode === "choose" ? (
            <div className="space-y-3">
              <button
                onClick={() => setMode("change")}
                className="w-full h-10 bg-primary text-primary-foreground font-medium text-sm rounded-lg hover:opacity-90 transition-opacity"
              >
                Change Password
              </button>
              <button
                onClick={handleKeep}
                className="w-full h-10 bg-secondary text-secondary-foreground font-medium text-sm rounded-lg hover:bg-accent transition-colors"
              >
                Keep Current Password
              </button>
            </div>
          ) : (
            <form onSubmit={handleChange} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">New Password</label>
                <div className="relative">
                  <input
                    type={showNew ? "text" : "password"}
                    placeholder="Enter new password (min 4 characters)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full h-10 px-3 pr-10 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Confirm Password</label>
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {error && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                  <p className="text-destructive text-sm">{error}</p>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setMode("choose")}
                  className="flex-1 h-10 bg-secondary text-secondary-foreground text-sm font-medium rounded-lg hover:bg-accent transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 h-10 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {loading ? "Saving..." : "Save Password"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
