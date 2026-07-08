import FAQS from "@/components/frontend/FAQ";
import Hero from "@/components/frontend/Hero";
import Partners from "@/components/frontend/Partners";
import About from "@/components/frontend/About";
import Services from "@/components/frontend/Services";
import MissionAndVision from "@/components/frontend/MissionAndVision";
import WhyUs from "@/components/frontend/WhyUs";
import SuccessStories from "@/components/frontend/SuccessStories";
import ContactForm from "@/components/frontend/ContactForm";
import CTASection from "@/components/frontend/CTASection";

export default function BUTSACCOLanding() {
  return (
    <div className="min-h-screen bg-white font-manrope">
      {/* Hero Section */}
      <Hero />

      {/* Trust Indicators */}
      <Partners />

      {/* About Section */}
      <About />

      {/* Mission & Vision */}
      <MissionAndVision />

      {/* Services Section */}
      <Services />

      {/* Why Choose Us */}
      <WhyUs />

      {/* Success Stories */}
      <SuccessStories />
      {/* FAQ Section */}
      <FAQS />

      {/* Contact Form Section */}
      <ContactForm />
      {/* CTA Section */}
      <CTASection />
    </div>
  );
}
