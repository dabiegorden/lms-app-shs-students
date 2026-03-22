import CTA from "@/components/CTA";
import DashboardPreview from "@/components/Dashboardpreview";
import Features from "@/components/Features";
import Footer from "@/components/Footer";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import Navbar from "@/components/Navbar";
import Subjects from "@/components/Subjects";
import Testimonials from "@/components/Testimonials";

const Home = () => {
  return (
    <main className="min-h-screen">
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      <Subjects />
      <DashboardPreview />
      <Testimonials />
      <CTA />
      <Footer />
    </main>
  );
};

export default Home;
