import HeroSection from "@/components/landing/HeroSection";
import HeroActions from "@/components/landing/HeroActions";
import FeaturesSection from "@/components/landing/FeaturesSection";
import JournalSection from "@/components/landing/JournalSection";
import { getSession } from "@/lib/session";

export default async function HomePage() {
  const session = await getSession();

  return (
    <main className="landing">
      <div className="landing-hero-block fade-in-up">
        <HeroSection />
        <HeroActions isLoggedIn={!!session} />
      </div>
      <div className="fade-in-up fade-in-delay-1">
        <FeaturesSection />
      </div>
      <div className="fade-in-up fade-in-delay-2">
        <JournalSection />
      </div>
    </main>
  );
}