export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="flex items-center gap-3 mb-8">
          <img src="/client-portal/hourlink_icon.png" alt="HourLink" className="w-10 h-10 rounded-xl object-contain" />
          <h1 className="text-2xl font-semibold">HourLink Privacy Policy</h1>
        </div>

        <div className="bg-primary/10 border border-primary/20 rounded-2xl p-5 mb-8 flex gap-4 items-start">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary mt-0.5 shrink-0">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <div>
            <p className="font-semibold mb-1">Your Privacy Matters</p>
            <p className="text-sm text-muted-foreground">Your personal and business data stays on your device. Team workspace data is stored securely in the cloud only when you enable collaboration features. We never sell or share your information.</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-8">Last updated: 26 April 2026</p>

        {SECTIONS.map((s, i) => (
          <div key={i} className="mb-8">
            <h2 className="text-base font-semibold mb-3">{s.title}</h2>
            <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{s.body}</p>
          </div>
        ))}

        <p className="text-center text-xs text-muted-foreground mt-12">
          © {new Date().getFullYear()} HourLink. All rights reserved.
        </p>
      </div>
    </div>
  );
}

const SECTIONS = [
  {
    title: "1. Information We Collect",
    body: `HourLink is designed with your privacy in mind. We collect and store the minimum amount of data needed to provide you with a functional experience.

Local Data (stored on your device only):
• Your profile information (name, email)
• Company branding details (name, address, logo)
• Client records and contact information
• Time entries, invoices, quotes, and expenses
• App preferences and theme settings

This data never leaves your device unless you explicitly choose to share it (e.g., exporting or sharing an invoice).

Team & Collaboration Data (stored in the cloud):
If you use team workspaces or the client portal, the following data is stored on our secure cloud servers:
• Workspace details and invite codes
• Shared tasks, time entries, and comments
• Team member and client access credentials (hashed)

This data is only created when you actively set up a team workspace.`,
  },
  {
    title: "2. Data Storage & Security",
    body: `Personal and business data (clients, invoices, expenses) is stored locally on your device using secure local storage (AsyncStorage) and never transmitted to any server.

Team collaboration data is stored on cloud infrastructure hosted by Render (render.com), a US-based cloud platform. Their servers use encrypted connections and industry-standard security practices. Only the data necessary for team features to function is stored there.

We recommend keeping your device secured with a passcode or biometric lock to protect your local HourLink data.`,
  },
  {
    title: "3. Data We Do NOT Collect",
    body: `We want to be transparent about what we don't do:

• We do NOT track your location
• We do NOT collect analytics or usage data
• We do NOT use advertising trackers
• We do NOT sell or share your data with third parties
• We do NOT create user profiles for marketing purposes
• We do NOT access your contacts, camera, or microphone without explicit permission`,
  },
  {
    title: "4. Third-Party Services",
    body: `HourLink works with the following third-party services:

• Render (render.com): Hosts the API server and PostgreSQL database used for team workspaces and the client portal. Data transmitted is limited to what is needed for those features.
• Cloudflare (cloudflare.com): Provides DNS and email routing for the hour-link.com domain. Cloudflare may process email metadata when messages are routed to our support inbox.
• Expo (expo.dev): The framework used to build and distribute the app. Expo may collect anonymous crash reports and diagnostics to help improve stability.
• RevenueCat (revenuecat.com): Manages in-app subscriptions and purchase validation. RevenueCat may process your app user ID and purchase history.
• Email (device client): When you share an invoice or quote via email, your device's own email app handles the transmission.

We do not integrate with any advertising networks or data brokers.`,
  },
  {
    title: "5. Your Rights & Data Control",
    body: `You have full control over your data:

• View: All your data is visible within the app at all times
• Export: You can export invoices and reports as needed
• Delete local data: Use Settings to permanently remove all locally stored app data
• Delete team data: Contact us at support@hour-link.com to request removal of any data stored in the cloud for your workspace

For local-only data there is no external account to delete. For team workspace data, we will action any removal request within a reasonable time.`,
  },
  {
    title: "6. Children's Privacy",
    body: "HourLink is designed for professional freelancers and business users. We do not knowingly collect information from children under 13. If you believe a child has used this app, the local data can be cleared through the app settings and you may contact us to remove any associated cloud data.",
  },
  {
    title: "7. Changes to This Policy",
    body: "We may update this privacy policy from time to time. Any changes will be reflected in the app with an updated Last Updated date. We encourage you to review this policy periodically.",
  },
  {
    title: "8. Contact Us",
    body: "If you have any questions or concerns about this privacy policy or HourLink's data practices, please contact us at:\n\nsupport@hour-link.com",
  },
];
