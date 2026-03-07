import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Phone, Building, Home, MapPin, Star } from "lucide-react";
import ContactMenu from "@/components/ContactMenu";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PropertyCard from "@/components/PropertyCard";
import { PHONE_NUMBER } from "@/lib/data";
import { supabaseQuery } from "@/lib/supabase-query";
import heroBg from "@/assets/hero-bg.jpg";

const stats = [
  { label: "Properties Listed", value: "500+", icon: Building },
  { label: "Happy Clients", value: "1200+", icon: Star },
  { label: "Locations", value: "50+", icon: MapPin },
];

const Index = () => {
  const [featured, setFeatured] = useState<any[]>([]);

  useEffect(() => {
    const fetchFeatured = async () => {
      const { data, error } = await supabaseQuery({
        table: "properties",
        filters: { "is_featured": "eq.true" },
        limit: 4,
      });
      if (error) console.error("Error fetching featured:", error);
      setFeatured(data || []);
    };
    fetchFeatured();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative h-[85vh] flex items-center justify-center overflow-hidden">
        <img src={heroBg} alt="Rajkot skyline" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-primary/75" />
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-display font-bold text-primary-foreground leading-tight">
              Find Your <span className="text-gradient-gold">Dream Property</span> in Rajkot
            </h1>
            <p className="mt-4 text-lg md:text-xl text-primary-foreground/80 font-body max-w-2xl mx-auto">
              A TO Z Properties — Your trusted real estate partner. Buy, sell, or rent residential & commercial properties across Rajkot.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/properties">
                <Button size="lg" className="bg-secondary text-secondary-foreground hover:bg-secondary/90 font-body text-base px-8">
                  Browse Properties <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
                <ContactMenu phone={PHONE_NUMBER} className="w-full block">
                  <Button size="lg" className="w-full"><Phone className="mr-2 h-5 w-5" /> Call for Inquiry</Button>
                </ContactMenu>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="relative -mt-16 z-20 container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {stats.map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.1 }}
              className="bg-card rounded-lg p-6 shadow-card flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-secondary/10 flex items-center justify-center">
                <stat.icon className="h-6 w-6 text-secondary" />
              </div>
              <div>
                <div className="text-2xl font-display font-bold text-card-foreground">{stat.value}</div>
                <div className="text-sm font-body text-muted-foreground">{stat.label}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Featured */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground">
            Featured <span className="text-secondary">Properties</span>
          </h2>
          <p className="mt-2 text-muted-foreground font-body">Handpicked properties from the best locations in Rajkot</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {featured.map((p, i) => (
            <PropertyCard key={p.id} property={p} index={i} />
          ))}
        </div>
        <div className="text-center mt-10">
          <Link to="/properties">
            <Button variant="outline" size="lg" className="font-body">View All Properties <ArrowRight className="ml-2 h-4 w-4" /></Button>
          </Link>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-hero py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-display font-bold text-primary-foreground">
            Book a <span className="text-gradient-gold">Site Visit</span>
          </h2>
          <p className="mt-4 text-primary-foreground/80 font-body max-w-xl mx-auto">
            Visit up to 3 properties for just <span className="text-secondary font-bold">₹200</span>.
            Available slots: 10 AM – 1 PM & 4 PM – 10 PM (30 min each).
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/properties">
              <Button size="lg" className="bg-secondary text-secondary-foreground hover:bg-secondary/90 font-body">
                <Home className="mr-2 h-5 w-5" /> Choose Properties & Book
              </Button>
            </Link>
              <ContactMenu phone={PHONE_NUMBER}>
                <Button variant="outline"><Phone className="mr-2 h-4 w-4" /> Call</Button>
              </ContactMenu>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;
