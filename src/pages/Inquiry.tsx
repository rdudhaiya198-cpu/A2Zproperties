import { useState } from "react";
import { Send, User, Phone, MapPin, IndianRupee, FileText, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { db } from "@/integrations/firebase/client";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { motion } from "framer-motion";

const Inquiry = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    caste: "",
    location: "",
    budget: "",
    property_type: "",
    message: "",
  });

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      toast({ title: "Name and Phone are required", variant: "destructive" });
      return;
    }
    if (form.phone.length < 10) {
      toast({ title: "Please enter a valid phone number", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      if (!db) throw new Error("Firebase not configured. Set VITE_FIREBASE_* env vars.");
      const docRef = await addDoc(collection(db, "inquiries"), {
        name: form.name.trim(),
        phone: form.phone.trim(),
        caste: form.caste.trim() || null,
        location: form.location.trim() || null,
        budget: form.budget.trim() || null,
        property_type: form.property_type || null,
        message: form.message.trim() || null,
        status: "new",
        createdAt: serverTimestamp(),
      });
      toast({ title: "Inquiry Submitted!", description: "We will contact you shortly." });
      try {
        // create an admin notification for this inquiry
        await addDoc(collection(db, "notifications"), {
          type: "inquiry",
          refId: docRef.id,
          title: "New Inquiry",
          message: `${form.name.trim()} • ${form.phone.trim()}`,
          read: false,
          createdAt: serverTimestamp(),
        });
        // trigger push via functions endpoint (best-effort)
        try {
          const fnUrl = import.meta.env.VITE_FUNCTIONS_URL || "/api";
          await fetch(`${fnUrl.replace(/\/$/, '')}/sendNotification`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "inquiry", refId: docRef.id, title: "New Inquiry", message: `${form.name.trim()} • ${form.phone.trim()}` }),
          });
        } catch (e) {
          console.warn("sendNotification call failed", e);
        }
      } catch (e) {
        console.warn("Failed to create notification", e);
      }
      // Post to Google Sheets via Apps Script webhook (if configured)
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
            body: JSON.stringify({ ...form, submittedAt: new Date().toISOString() }),
          });
        }
      } catch (err) {
        console.warn("Apps Script webhook failed", err);
      }
      setForm({ name: "", phone: "", caste: "", location: "", budget: "", property_type: "", message: "" });
    } catch (err: any) {
      toast({ title: "Error", description: String(err?.message || err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-lg mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">
              Quick <span className="text-secondary">Inquiry</span>
            </h1>
            <p className="text-muted-foreground font-body text-sm mt-1">
              Tell us what you're looking for — we'll get back to you fast!
            </p>
          </div>

          <form onSubmit={handleSubmit} className="bg-card rounded-lg p-6 shadow-card space-y-4">
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Your Name *" value={form.name} onChange={(e) => handleChange("name", e.target.value)} className="pl-9 font-body" required />
            </div>

            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Phone Number *" value={form.phone} onChange={(e) => handleChange("phone", e.target.value)} className="pl-9 font-body" required />
            </div>

            <div className="relative">
              <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Caste / Community" value={form.caste} onChange={(e) => handleChange("caste", e.target.value)} className="pl-9 font-body" />
            </div>

            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Preferred Location" value={form.location} onChange={(e) => handleChange("location", e.target.value)} className="pl-9 font-body" />
            </div>

            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Budget (e.g. 20-30 Lac)" value={form.budget} onChange={(e) => handleChange("budget", e.target.value)} className="pl-9 font-body" />
            </div>

            <Select value={form.property_type} onValueChange={(v) => handleChange("property_type", v)}>
              <SelectTrigger className="font-body">
                <SelectValue placeholder="Property Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="flat">Flat / Apartment</SelectItem>
                <SelectItem value="bungalow">Bungalow / Villa</SelectItem>
                <SelectItem value="plot">Plot / Land</SelectItem>
                <SelectItem value="shop">Shop / Commercial</SelectItem>
                <SelectItem value="office">Office Space</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>

            <div className="relative">
              <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Textarea placeholder="Any specific requirements..." value={form.message} onChange={(e) => handleChange("message", e.target.value)} className="pl-9 font-body min-h-[80px]" />
            </div>

            <Button type="submit" disabled={loading} className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 font-body">
              <Send className="h-4 w-4 mr-2" /> {loading ? "Submitting..." : "Submit Inquiry"}
            </Button>
          </form>
        </motion.div>
      </div>
      <Footer />
    </div>
  );
};

export default Inquiry;
