import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Phone, Building, Home, MapPin, Star } from "lucide-react";
import ContactMenu from "@/components/ContactMenu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PropertyCard from "@/components/PropertyCard";
import { PHONE_NUMBER } from "@/lib/data";
import { supabaseQuery } from "@/lib/supabase-query";
import heroBg from "@/assets/hero-bg.jpg";
import { db } from "@/integrations/firebase/client";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { isValidPhone } from "@/lib/validation";

const Index = () => {
  const { toast } = useToast();
  const [featured, setFeatured] = useState<any[]>([]);
  const [stats, setStats] = useState<{ properties: number | null; locations: number | null }>({
    properties: null,
    locations: null,
  });
  const [quickForm, setQuickForm] = useState({
    name: "",
    phone: "",
    requirement: "",
    propertyType: "",
  });
  const [quickErrors, setQuickErrors] = useState<{ name?: string; phone?: string; requirement?: string }>({});
  const [quickLoading, setQuickLoading] = useState(false);

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
    const fetchStats = async () => {
      const { data, error } = await supabaseQuery({ table: "properties" });
      if (error) {
        console.error("Error fetching stats:", error);
        return;
      }
      const items = data || [];
      const locationSet = new Set<string>();
      items.forEach((p: any) => {
        const loc = (p.location || p.address || "").toString().trim();
        if (loc) locationSet.add(loc);
      });
      setStats({ properties: items.length, locations: locationSet.size });
    };
    fetchFeatured();
    fetchStats();
  }, []);

  const updateQuickForm = (field: string, value: string) => {
    setQuickForm((prev) => ({ ...prev, [field]: value }));
    if (quickErrors[field as "name" | "phone" | "requirement"]) {
      setQuickErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: { name?: string; phone?: string; requirement?: string } = {};
    if (!quickForm.name.trim()) nextErrors.name = "Name is required";
    if (!quickForm.phone.trim()) nextErrors.phone = "Phone number is required";
    else if (!isValidPhone(quickForm.phone)) nextErrors.phone = "Enter a valid phone number";
    if (!quickForm.requirement.trim()) nextErrors.requirement = "Requirement is required";
    setQuickErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      const firstError = Object.values(nextErrors).find(Boolean);
      toast({ title: "Please fix the highlighted fields", description: firstError, variant: "destructive" });
      return;
    }

    setQuickLoading(true);
    try {
      if (!db) throw new Error("Firebase not configured. Set VITE_FIREBASE_* env vars.");
      const docRef = await addDoc(collection(db, "inquiries"), {
        name: quickForm.name.trim(),
        phone: quickForm.phone.trim(),
        requirement: quickForm.requirement.trim(),
        message: quickForm.requirement.trim(),
        property_type: quickForm.propertyType || null,
        source: "homepage_quick_enquiry",
        status: "new",
        createdAt: serverTimestamp(),
      });

      try {
        await addDoc(collection(db, "notifications"), {
          type: "inquiry",
          refId: docRef.id,
          title: "New Inquiry",
          message: `${quickForm.name.trim()} • ${quickForm.phone.trim()}`,
          read: false,
          createdAt: serverTimestamp(),
        });
        try {
          const fnUrl = import.meta.env.VITE_FUNCTIONS_URL || "/api";
          await fetch(`${fnUrl.replace(/\/$/, "")}/sendNotification`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "inquiry", refId: docRef.id, title: "New Inquiry", message: `${quickForm.name.trim()} • ${quickForm.phone.trim()}` }),
          });
        } catch (err) {
          console.warn("sendNotification call failed", err);
        }
      } catch (err) {
        console.warn("Failed to create notification", err);
      }

      try {
        const webhookUrl = import.meta.env.VITE_APPS_SCRIPT_WEBHOOK_URL;
        const webhookSecret = import.meta.env.VITE_APPS_SCRIPT_WEBHOOK_SECRET;
        if (webhookUrl) {
          await fetch(webhookUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(webhookSecret ? { "x-webhook-secret": webhookSecret } : {}),
            },
            body: JSON.stringify({ ...quickForm, submittedAt: new Date().toISOString() }),
          });
        }
      } catch (err) {
        console.warn("Apps Script webhook failed", err);
      }

      toast({ title: "Inquiry Submitted!", description: "We will contact you shortly." });
      setQuickForm({ name: "", phone: "", requirement: "", propertyType: "" });
    } catch (err: any) {
      toast({ title: "Error", description: String(err?.message || err), variant: "destructive" });
    } finally {
      setQuickLoading(false);
    }
  };

  const statsCards = [
    { label: "Properties Listed", value: stats.properties === null ? "—" : String(stats.properties), icon: Building },
    { label: "Happy Clients", value: "3000+", icon: Star },
    { label: "Locations", value: stats.locations === null ? "—" : String(stats.locations), icon: MapPin },
  ];

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
          {statsCards.map((stat, i) => (
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

      {/* Quick Enquiry */}
      <section className="relative py-20">
        <div className="absolute inset-0 bg-gradient-to-br from-secondary/10 via-background to-primary/10" />
        <div className="relative container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
              <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground">
                Quick <span className="text-secondary">Enquiry</span>
              </h2>
              <p className="mt-3 text-muted-foreground font-body max-w-lg">
                Want to explore more property options? Make an enquiry and our team will reach out to you.
              </p>
              <div className="mt-6 flex items-center gap-4 text-sm text-muted-foreground">
                <div className="px-3 py-1 rounded-full bg-secondary/10 text-secondary font-body">Fast response</div>
                <div className="px-3 py-1 rounded-full bg-secondary/10 text-secondary font-body">Personalized options</div>
              </div>
            </motion.div>

            <motion.form onSubmit={handleQuickSubmit} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              className="bg-card rounded-xl p-6 shadow-card space-y-4">
              <div>
                <Input placeholder="Your Name *" value={quickForm.name} onChange={(e) => updateQuickForm("name", e.target.value)} className="font-body" />
                {quickErrors.name && <p className="mt-1 text-xs text-destructive">{quickErrors.name}</p>}
              </div>
              <div>
                <Input placeholder="Mobile Number *" value={quickForm.phone} onChange={(e) => updateQuickForm("phone", e.target.value)} className="font-body" />
                {quickErrors.phone && <p className="mt-1 text-xs text-destructive">{quickErrors.phone}</p>}
              </div>
              <div>
                <Textarea placeholder="Requirement *" value={quickForm.requirement} onChange={(e) => updateQuickForm("requirement", e.target.value)} className="font-body min-h-[90px]" />
                {quickErrors.requirement && <p className="mt-1 text-xs text-destructive">{quickErrors.requirement}</p>}
              </div>
              <Select value={quickForm.propertyType} onValueChange={(v) => updateQuickForm("propertyType", v)}>
                <SelectTrigger className="font-body">
                  <SelectValue placeholder="Property Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rent">Rent</SelectItem>
                  <SelectItem value="sale">Sale</SelectItem>
                  <SelectItem value="residential">Residential</SelectItem>
                  <SelectItem value="commercial">Commercial</SelectItem>
                  <SelectItem value="land">Land/Plot</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" disabled={quickLoading} className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 font-body">
                {quickLoading ? "Submitting..." : "Submit Enquiry"}
              </Button>
            </motion.form>
          </div>
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
