import { useState } from "react";
import { joinWorkspace, type WorkspaceInfo } from "../lib/api";

interface Props {
  workspace: WorkspaceInfo;
  portalCode: string;
  onIdentify: (name: string, email: string) => void;
}

export function IdentifyForm({ workspace, portalCode, onIdentify }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError("Please enter both your name and email.");
      return;
    }
    if (!email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    setLoading(true);
    setError("");
    const result = await joinWorkspace(portalCode, name.trim(), email.trim());
    setLoading(false);
    if (result.ok) {
      onIdentify(name.trim(), email.trim());
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <img src={`${import.meta.env.BASE_URL}hourlink_icon.png`} alt="HourLink" className="w-32 h-32 rounded-3xl mx-auto mb-4 object-contain" />
          <h1 className="text-2xl font-semibold text-foreground mb-1">Task Portal</h1>
          <p className="text-muted-foreground text-sm">
            Submit tasks to <span className="font-medium text-foreground">{workspace.ownerName}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Your Name</label>
            <input
              type="text"
              placeholder="John Smith"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Your Email</label>
            <input
              type="email"
              placeholder="john@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
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
            {loading ? "Verifying..." : "Continue"}
          </button>

          <p className="text-xs text-muted-foreground text-center">
            Only clients registered by {workspace.ownerName} can access this portal.
          </p>
        </form>
      </div>
    </div>
  );
}
