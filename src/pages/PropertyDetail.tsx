import { useState, useEffect } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, MapPin, BedDouble, Bath, Maximize, Phone, CheckCircle2, Clock, IndianRupee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ContactMenu from "@/components/ContactMenu";
import { useAuth } from "@/hooks/useAuth";
import { supabaseQuery } from "@/lib/supabase-query";
import { db } from "@/integrations/firebase/client";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import {
  formatPrice, TIME_SLOTS_MORNING, TIME_SLOTS_EVENING,
  VISIT_CHARGE, MAX_PROPERTIES_PER_VISIT, PHONE_NUMBER,
} from "@/lib/data";
import { motion } from "framer-motion";

const PropertyDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [property, setProperty] = useState<any>(null);
  const [allProperties, setAllProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedSlot, setSelectedSlot] = useState("");
  const [extraPropertyIds, setExtraPropertyIds] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [agreeToPay, setAgreeToPay] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const fetchData = async () => {
      const [propRes, allRes] = await Promise.all([
        supabaseQuery({ table: "properties", filters: { "id": `eq.${id}` }, limit: 1 }),
        supabaseQuery({ table: "properties", select: "id,title", filters: { "id": `neq.${id || ""}` } }),
      ]);
      setProperty(propRes.data?.[0] || null);
      setAllProperties(allRes.data || []);
      setLoading(false);
    };
    fetchData();
  }, [id]);

  useEffect(() => {
    // if URL has #booking, scroll to booking form
    if (location.hash === "#booking") {
      setTimeout(() => {
        const el = document.getElementById("booking");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 200);
    }
  }, [location.hash]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-20 text-center text-muted-foreground font-body">Loading...</div>
        <Footer />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-20 text-center">
          <h1 className="text-2xl font-display font-bold">Property Not Found</h1>
          <Link to="/properties"><Button className="mt-4 font-body">Back to Properties</Button></Link>
        </div>
        <Footer />
      </div>
    );
  }

  const selectedPropertyIds = [property.id, ...extraPropertyIds];

  const toggleExtra = (pid: string) => {
    if (extraPropertyIds.includes(pid)) {
      setExtraPropertyIds(extraPropertyIds.filter((x) => x !== pid));
    } else if (extraPropertyIds.length < MAX_PROPERTIES_PER_VISIT - 1) {
      setExtraPropertyIds([...extraPropertyIds, pid]);
    } else {
      toast({ title: "Maximum 3 properties", description: `You can select up to ${MAX_PROPERTIES_PER_VISIT} properties per visit.`, variant: "destructive" });
    }
  };

  const handleBooking = async () => {
    if (!user) {
      toast({ title: "Please sign in", description: "You need to sign in to book a visit.", variant: "destructive" });
      navigate("/auth");
      return;
    }
    if (!name || !phone || !selectedDate || !selectedSlot) {
      toast({ title: "Please fill all required fields", description: "Name, phone, date and time slot are required.", variant: "destructive" });
      return;
    }
    if (!agreeToPay) {
      toast({ title: "Payment required", description: `Please agree to pay ₹${VISIT_CHARGE} booking charge.`, variant: "destructive" });
      return;
    }
    try {
      if (!db) {
        toast({ title: "Configuration error", description: "Firebase not configured. Set VITE_FIREBASE_* env vars.", variant: "destructive" });
        return;
      }
      // compute visit_datetime from selectedDate (Date) + selectedSlot (e.g. "10:30 AM")
      const [timePart, meridiem] = selectedSlot.split(" ");
      const [hhStr, mmStr] = timePart.split(":");
      let hh = Number(hhStr) % 12;
      const mm = Number(mmStr || 0);
      if ((meridiem || "").toUpperCase() === "PM") hh += 12;
      const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
      const utcMillis = Date.UTC(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), hh, mm) - IST_OFFSET_MS;
      const visitDateTime = new Date(utcMillis);

      const bookingRef = await addDoc(collection(db, "bookings"), {
        user_id: user.id,
        name,
        phone,
        email: email || null,
        visit_date: format(selectedDate, "yyyy-MM-dd"),
        time_slot: selectedSlot,
        visit_datetime: visitDateTime,
        property_ids: selectedPropertyIds,
        charge: VISIT_CHARGE,
        payment: { amount: VISIT_CHARGE, status: "pending", method: "none" },
        status: "pending",
        createdAt: serverTimestamp(),
      });
      toast({ title: "Visit Booked!", description: "We will confirm your visit shortly." });
      try {
        // create admin notification referencing the booking id
        await addDoc(collection(db, "notifications"), {
          type: "booking",
          refId: bookingRef.id,
          title: "New Booking",
          message: `${name} • ${phone}`,
          read: false,
          createdAt: serverTimestamp(),
        });
        try {
          const fnUrl = import.meta.env.VITE_FUNCTIONS_URL || "/api";
          await fetch(`${fnUrl.replace(/\/$/, '')}/sendNotification`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "booking", refId: bookingRef.id, title: "New Booking", message: `${name} • ${phone}` }),
          });
        } catch (e) {
          console.warn("sendNotification call failed", e);
        }
      } catch (e) {
        console.warn("Failed to create notification", e);
      }
    } catch (err: any) {
      toast({ title: "Error", description: String(err?.message || err), variant: "destructive" });
      return;
    }
    setName(""); setPhone(""); setEmail(""); setMessage("");
    setSelectedDate(undefined); setSelectedSlot(""); setExtraPropertyIds([]);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <Link to="/properties" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground font-body text-sm mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to Properties
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="relative h-64 md:h-96 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                {property.image_url || property.image ? (
                  <img src={property.image_url || property.image} alt={property.title} className="absolute inset-0 w-full h-full object-cover rounded-lg" loading="lazy" />
                ) : (
                  <>
                    <div className="absolute inset-0 bg-hero opacity-10 rounded-lg" />
                    <Maximize className="h-16 w-16 text-muted-foreground/30" />
                  </>
                )}
                <div className="absolute top-4 left-4 flex gap-2">
                  <Badge className="bg-secondary text-secondary-foreground font-body">{property.status}</Badge>
                  <Badge variant="outline" className="bg-card/90 font-body">{property.type}</Badge>
                </div>
              </div>

              <div className="mt-6">
                <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">{property.title}</h1>
                {property.address && (
                  <div className="flex items-center gap-2 mt-2 text-muted-foreground font-body">
                    <MapPin className="h-4 w-4" /> {property.address}
                  </div>
                )}
                <div className="mt-4 text-3xl font-display font-bold text-secondary">
                  {formatPrice(property.price)}
                  {property.status === "For Rent" && <span className="text-base font-body text-muted-foreground">/month</span>}
                </div>

                <div className="flex flex-wrap gap-4 mt-4 font-body text-sm text-muted-foreground">
                  {property.bedrooms && (
                    <span className="flex items-center gap-1 bg-muted px-3 py-1.5 rounded-md"><BedDouble className="h-4 w-4" /> {property.bedrooms} Bedrooms</span>
                  )}
                  {property.bathrooms && (
                    <span className="flex items-center gap-1 bg-muted px-3 py-1.5 rounded-md"><Bath className="h-4 w-4" /> {property.bathrooms} Bathrooms</span>
                  )}
                  {property.area && (
                    <span className="flex items-center gap-1 bg-muted px-3 py-1.5 rounded-md"><Maximize className="h-4 w-4" /> {property.area} sq.ft</span>
                  )}
                </div>

                {property.description && (
                  <div className="mt-6">
                    <h3 className="text-lg font-display font-semibold text-foreground mb-2">Description</h3>
                    <p className="text-muted-foreground font-body leading-relaxed">{property.description}</p>
                  </div>
                )}

                {property.features && property.features.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-lg font-display font-semibold text-foreground mb-3">Features & Amenities</h3>
                    <div className="flex flex-wrap gap-2">
                      {property.features.map((f: string) => (
                        <span key={f} className="flex items-center gap-1 bg-secondary/10 text-secondary-foreground font-body text-sm px-3 py-1.5 rounded-full">
                          <CheckCircle2 className="h-3.5 w-3.5 text-secondary" /> {f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          {/* Booking form */}
          <div>
              <motion.div id="booking" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
                className="bg-card rounded-lg p-6 shadow-card sticky top-24">
              <h3 className="text-xl font-display font-bold text-card-foreground mb-1">Book a Site Visit</h3>
              <div className="flex items-center gap-2 mb-4">
                <Badge className="bg-secondary/10 text-secondary font-body text-xs">
                  <IndianRupee className="h-3 w-3 mr-0.5" /> {VISIT_CHARGE} Visit Charge
                </Badge>
                <Badge variant="outline" className="font-body text-xs">Max {MAX_PROPERTIES_PER_VISIT} Properties</Badge>
              </div>

              <div className="space-y-4">
                <Input placeholder="Your Name *" value={name} onChange={(e) => setName(e.target.value)} className="font-body" />
                <Input placeholder="Phone Number *" value={phone} onChange={(e) => setPhone(e.target.value)} className="font-body" />
                <Input placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} className="font-body" />

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start font-body", !selectedDate && "text-muted-foreground")}>
                      <Clock className="h-4 w-4 mr-2" />
                      {selectedDate ? format(selectedDate, "PPP") : "Select Visit Date *"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate}
                      disabled={(date) => date < new Date()} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>

                <div>
                  <p className="text-sm font-body font-medium text-card-foreground mb-2">Select Time Slot *</p>
                  <p className="text-xs text-muted-foreground font-body mb-2">Morning: 10 AM – 1 PM</p>
                  <div className="grid grid-cols-3 gap-1.5 mb-3">
                    {TIME_SLOTS_MORNING.map((slot) => (
                      <button key={slot} onClick={() => setSelectedSlot(slot)}
                        className={cn("text-xs py-1.5 rounded font-body transition-colors",
                          selectedSlot === slot ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground hover:bg-secondary/20"
                        )}>
                        {slot}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground font-body mb-2">Evening: 4 PM – 10 PM</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {TIME_SLOTS_EVENING.map((slot) => (
                      <button key={slot} onClick={() => setSelectedSlot(slot)}
                        className={cn("text-xs py-1.5 rounded font-body transition-colors",
                          selectedSlot === slot ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground hover:bg-secondary/20"
                        )}>
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>

                {allProperties.length > 0 && (
                  <div>
                    <p className="text-sm font-body font-medium text-card-foreground mb-2">
                      Add More Properties (Max {MAX_PROPERTIES_PER_VISIT - 1} more)
                    </p>
                    <div className="max-h-32 overflow-y-auto space-y-1.5">
                      {allProperties.slice(0, 10).map((p) => (
                        <button key={p.id} onClick={() => toggleExtra(p.id)}
                          className={cn("w-full text-left text-xs p-2 rounded font-body transition-colors",
                            extraPropertyIds.includes(p.id) ? "bg-secondary/20 text-secondary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"
                          )}>
                          {p.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <Textarea placeholder="Any message or requirements..." value={message} onChange={(e) => setMessage(e.target.value)} className="font-body" />

                <div className="bg-muted rounded-md p-3 text-xs font-body text-muted-foreground">
                  <p className="font-medium text-card-foreground mb-1">₹{VISIT_CHARGE} Visit Charge Applicable</p>
                  <p>You can visit up to {MAX_PROPERTIES_PER_VISIT} properties. Selected: {selectedPropertyIds.length}</p>
                </div>

                <div className="flex items-center gap-2">
                  <input id="agree-pay" type="checkbox" checked={agreeToPay} onChange={(e) => setAgreeToPay(e.target.checked)} />
                  <label htmlFor="agree-pay" className="text-sm font-body">I agree to pay ₹{VISIT_CHARGE} as booking charge</label>
                </div>

                <Button onClick={handleBooking} className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 font-body">
                  Book Site Visit
                </Button>

                <div className="text-center">
                  <ContactMenu phone={PHONE_NUMBER} className="inline-block">
                    <Button variant="ghost" className="text-sm font-body text-secondary"><Phone className="h-3.5 w-3.5 mr-1" /> {PHONE_NUMBER}</Button>
                  </ContactMenu>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default PropertyDetail;
