import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-guard";

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/home");
  }

  return (
    <div className="landing-page">
      <div className="landing-panel">
        <section className="landing-copy">
          <span className="landing-kicker">Threadline</span>
          <h1 className="landing-title">Find people. Connect. Message them directly.</h1>
          <p className="landing-subtitle">
            Threadline helps you search by name, location, hobbies, interests, music, or shows, then start real conversations
            without the clutter.
          </p>
          <div className="landing-actions">
            <Link href="/signup" className="submit-button" style={{ width: "auto", padding: "14px 32px", fontSize: 16 }}>
              Get started
            </Link>
            <Link href="/login" className="submit-button secondary" style={{ width: "auto", padding: "14px 32px", fontSize: 16 }}>
              Log in
            </Link>
          </div>
        </section>

        <aside className="landing-preview" aria-label="Product preview">
          <div className="landing-preview-card">
            <div className="landing-preview-row">
              <div>
                <div className="landing-preview-heading">A personal inbox for people you actually want to talk to.</div>
                <div className="landing-preview-text">No loud feed, no public pressure, no professional profile theater.</div>
              </div>
            </div>
            <div className="landing-preview-list" aria-label="Threadline workflow">
              <div className="landing-preview-item">
                <strong>Search by personal details</strong>
                <span>Location, hobbies, interests, music, and shows.</span>
              </div>
              <div className="landing-preview-item">
                <strong>Open a profile</strong>
                <span>Read the short version, then the note they chose to add.</span>
              </div>
              <div className="landing-preview-item">
                <strong>Start the chat</strong>
                <span>Keep the conversation private and easy to return to.</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
