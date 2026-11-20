import { FeatureSection } from "@/components/marketing/features";
import { Hero } from "@/components/marketing/hero";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteNav } from "@/components/marketing/site-nav";
import { StackSection } from "@/components/marketing/stack";
import { WorkflowSection } from "@/components/marketing/workflow";

export function Landing() {
  return (
    <main className="home-canvas relative min-h-screen overflow-x-hidden text-foreground">
      <div className="home-grid pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />
      <SiteNav />
      <Hero />
      <FeatureSection />
      <WorkflowSection />
      <StackSection />
      <SiteFooter />
    </main>
  );
}
