import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Sunaidi Design Central",
  description:
    "How Sunaidi Design Central collects, uses, and protects data when managing our own social media accounts.",
};

const UPDATED = "July 7, 2026";
const CONTACT = "info@sunaidiexpo.com";

const wrap: React.CSSProperties = {
  maxWidth: 760,
  margin: "0 auto",
  padding: "56px 22px 96px",
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
  color: "#1f2733",
  lineHeight: 1.7,
  fontSize: 16,
};
const h1: React.CSSProperties = { fontSize: 30, fontWeight: 800, margin: "0 0 6px", letterSpacing: "-0.01em" };
const h2: React.CSSProperties = { fontSize: 20, fontWeight: 700, margin: "34px 0 10px" };
const muted: React.CSSProperties = { color: "#6b7280", fontSize: 14, margin: "0 0 8px" };
const p: React.CSSProperties = { margin: "0 0 12px" };
const li: React.CSSProperties = { margin: "0 0 8px" };

export default function PrivacyPage() {
  return (
    <main style={wrap}>
      <h1 style={h1}>Privacy Policy</h1>
      <p style={muted}>Sunaidi Design Central · Last updated {UPDATED}</p>

      <p style={p}>
        Sunaidi Design Central (&quot;the App&quot;, &quot;we&quot;, &quot;us&quot;) is an
        internal social-media management tool operated by Sunaidi and used by our own
        marketing team to schedule, publish, and measure content on the social media
        accounts and Company Pages that we own and administer. This policy explains what
        data the App handles and how we protect it.
      </p>

      <h2 style={h2}>Who this applies to</h2>
      <p style={p}>
        The App is an internal, first-party tool. Its users are Sunaidi employees and
        authorized team members. It is not a public consumer product and it is not used to
        manage social media accounts on behalf of third parties or external clients.
      </p>

      <h2 style={h2}>Information we collect</h2>
      <ul>
        <li style={li}>
          <strong>Team account data:</strong> the name, email address, and role of each
          team member who signs in, used for authentication and access control.
        </li>
        <li style={li}>
          <strong>Social platform credentials:</strong> access tokens and account
          identifiers that you authorize us to store when you connect one of our own
          Instagram, Facebook, X, or LinkedIn accounts/Pages, used solely to publish and
          read insights for those accounts.
        </li>
        <li style={li}>
          <strong>Content you create:</strong> the posts, captions, media, and schedules
          you prepare in the App for publishing to our accounts.
        </li>
        <li style={li}>
          <strong>Analytics data:</strong> aggregate engagement and audience metrics
          returned by the social platforms for our own accounts, used for reporting.
        </li>
      </ul>

      <h2 style={h2}>How we use information</h2>
      <ul>
        <li style={li}>To authenticate team members and enforce role-based access.</li>
        <li style={li}>
          To publish approved content to the social media accounts and Company Pages we
          own, at the times we schedule.
        </li>
        <li style={li}>
          To retrieve and display performance metrics for those accounts so our team can
          measure results.
        </li>
      </ul>
      <p style={p}>
        We do not sell personal data, and we do not use connected-account data for
        advertising or for any purpose other than operating our own social media presence.
      </p>

      <h2 style={h2}>Platforms and service providers</h2>
      <p style={p}>
        To provide these functions the App interacts with the official APIs of the
        platforms whose accounts we connect — Meta (Instagram and Facebook), X (Twitter),
        and LinkedIn — and uses trusted infrastructure providers for hosting, database, and
        media storage. Data shared with these platforms is limited to what is necessary to
        publish to, and read insights from, our own accounts, and is governed by each
        platform&apos;s own terms and privacy policies.
      </p>

      <h2 style={h2}>Data retention and security</h2>
      <p style={p}>
        Access tokens are stored so the App can publish on our behalf and are removed when
        an account is disconnected. Data is protected with encryption in transit,
        access controls, and least-privilege practices. We retain data only as long as
        needed to operate the App and meet our legal and business obligations.
      </p>

      <h2 style={h2}>Your choices</h2>
      <p style={p}>
        An administrator can disconnect any connected account at any time from the App&apos;s
        Integrations screen, which deletes the stored access token. You may also revoke the
        App&apos;s access directly from the relevant platform&apos;s app or connected-apps
        settings.
      </p>

      <h2 style={h2}>Changes to this policy</h2>
      <p style={p}>
        We may update this policy from time to time. Material changes will be reflected by
        updating the &quot;Last updated&quot; date above.
      </p>

      <h2 style={h2}>Contact</h2>
      <p style={p}>
        Questions about this policy or the data we handle can be sent to{" "}
        <a href={`mailto:${CONTACT}`} style={{ color: "#2563eb" }}>
          {CONTACT}
        </a>
        .
      </p>
    </main>
  );
}
