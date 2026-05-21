import { useState, useEffect, useMemo } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, MapPin, Maximize, Phone, CheckCircle2, Clock, IndianRupee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ContactMenu from "@/components/ContactMenu";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/integrations/firebase/client";
import { collection, addDoc, serverTimestamp, doc as fsDoc, getDoc as fsGetDoc, getDocs as fsGetDocs, query as fsQuery, orderBy as fsOrderBy } from "firebase/firestore";
import { formatPrice, VISIT_CHARGE, MAX_PROPERTIES_PER_VISIT, PHONE_NUMBER, UPI_ID, GOOGLE_SHEET_URL } from "@/lib/data";
import { motion } from "framer-motion";
import { openBookingWhatsApp } from "@/lib/whatsapp";

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
  const [paymentMethod, setPaymentMethod] = useState("cash_upi_on_visit");
  const location = useLocation();
  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [paymentScreenshot, setPaymentScreenshot] = useState<File | null>(null);
  const [paymentScreenshotPreview, setPaymentScreenshotPreview] = useState<string | null>(null);
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      if (!id) return;
      if (!db) {
        toast({ title: "Configuration error", description: "Firebase not configured. Set VITE_FIREBASE_* env vars.", variant: "destructive" });
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const propRef = fsDoc(db, "properties", id);
        const [propSnap, allSnap] = await Promise.all([
          fsGetDoc(propRef),
          fsGetDocs(fsQuery(collection(db, "properties"), fsOrderBy("createdAt", "desc"))),
        ]);
        if (cancelled) return;
        const propData = propSnap.exists() ? { id: propSnap.id, ...propSnap.data() } : null;
        const allData = allSnap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => p.id !== id);
        setProperty(propData);
        setAllProperties(allData);
      } catch (err: any) {
        console.error("Failed to load property", err);
        toast({ title: "Error", description: String(err?.message || err), variant: "destructive" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [id, toast]);

  useEffect(() => {
    // if URL has #booking, scroll to booking form
    if (location.hash === "#booking") {
      setTimeout(() => {
        const el = document.getElementById("booking");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 200);
    }
  }, [location.hash]);

  const images = useMemo(() => {
    const list = Array.isArray(property?.images) ? property.images : [];
    const cleaned = list.filter((src: any) => typeof src === "string" && src.trim() !== "");
    const fallback = property?.image_url || property?.image || null;
    if (fallback && !cleaned.includes(fallback)) cleaned.unshift(fallback);
    return cleaned;
  }, [property]);

  const summaryLine = useMemo(() => {
    if (!property) return "";
    const parts: string[] = [];
    if (property.bedrooms) parts.push(`${property.bedrooms} BHK`);
    if (property.bathrooms) parts.push(`${property.bathrooms} Bathroom${property.bathrooms > 1 ? "s" : ""}`);
    if (property.area) parts.push(`${property.area} sqft`);
    return parts.join(" - ");
  }, [property]);

  const displayValue = (value: any) => {
    if (value === null || value === undefined || value === "") return "-";
    return String(value);
  };

  const detailItems: { label: string; value: string }[] = property
    ? [
        { label: "Type", value: displayValue(property.type) },
        { label: "Super Built-up area sqft", value: displayValue(property.super_builtup ?? property.superBuiltup ?? property.area) },
        { label: "Furnishing", value: displayValue(property.furnishing ?? property.furnished) },
        { label: "Listed By", value: displayValue(property.listed_by ?? property.listedBy ?? "ATOZ PROPERTIES") },
        { label: "Carpet area sqft", value: displayValue(property.carpet_area ?? property.carpetArea ?? property.area) },
        { label: "Maintenance (Monthly)", value: displayValue(property.maintenance ?? property.maintenance_monthly ?? property.maintenanceMonthly) },
        { label: "Floor No", value: displayValue(property.floor_no ?? property.floorNo) },
        { label: "Bedrooms", value: displayValue(property.bedrooms ?? property.bhk) },
        { label: "Bathrooms", value: displayValue(property.bathrooms) },
        { label: "Project Status", value: displayValue(property.project_status ?? property.projectStatus) },
        { label: "Facing", value: displayValue(property.facing) },
        { label: "Car Parking", value: displayValue(property.car_parking ?? property.carParking) },
        { label: "Total Floors", value: displayValue(property.total_floors ?? property.totalFloors) },
      ]
    : [];

  const upiPayUrl = useMemo(() => {
    const note = property?.title ? `Site Visit - ${property.title}` : "Site Visit Booking";
    const params = new URLSearchParams({
      pa: UPI_ID,
      pn: "ATOZ PROPERTIES",
      am: String(VISIT_CHARGE),
      cu: "INR",
      tn: note,
    });
    return `upi://pay?${params.toString()}`;
  }, [property?.title]);

  const isMobile = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  }, []);

  const qrSrc = useMemo(() => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(upiPayUrl)}`;
  }, [upiPayUrl]);

  useEffect(() => {
    if (!carouselApi) return;
    const onSelect = () => setSelectedIndex(carouselApi.selectedScrollSnap());
    onSelect();
    carouselApi.on("select", onSelect);
    return () => {
      carouselApi.off("select", onSelect);
    };
  }, [carouselApi]);

  useEffect(() => {
    if (!carouselApi) return;
    carouselApi.scrollTo(0, true);
    setSelectedIndex(0);
  }, [carouselApi, property?.id]);

  useEffect(() => {
    if (paymentMethod !== "online") {
      setPaymentScreenshot(null);
      setPaymentScreenshotPreview(null);
      setShowQr(false);
    }
  }, [paymentMethod]);

  useEffect(() => {
    return () => {
      if (paymentScreenshotPreview) URL.revokeObjectURL(paymentScreenshotPreview);
    };
  }, [paymentScreenshotPreview]);

  const handlePaymentScreenshotChange = (file: File | null) => {
    if (!file) {
      setPaymentScreenshot(null);
      setPaymentScreenshotPreview(null);
      return;
    }
    setPaymentScreenshot(file);
    const nextPreview = URL.createObjectURL(file);
    setPaymentScreenshotPreview(nextPreview);
  };

  const fileToBase64 = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });

  const submitPaymentScreenshot = async (bookingId?: string) => {
    if (!paymentScreenshot) return;
    setUploadingScreenshot(true);
    try {
      const base64 = await fileToBase64(paymentScreenshot);
      const formData = new FormData();
      formData.append("bookingId", bookingId || "");
      formData.append("name", name || "");
      formData.append("phone", phone || "");
      formData.append("amount", String(VISIT_CHARGE));
      formData.append("upi", UPI_ID);
      formData.append("propertyId", property?.id || "");
      formData.append("propertyTitle", property?.title || "");
      formData.append("visitDate", selectedDate ? format(selectedDate, "yyyy-MM-dd") : "");
      formData.append("timeSlot", selectedSlot || "");
      formData.append("paymentMethod", paymentMethod);
      formData.append("screenshotName", paymentScreenshot.name);
      formData.append("screenshot", base64);
      formData.append("timestamp", new Date().toISOString());

      try {
        const res = await fetch(GOOGLE_SHEET_URL, { method: "POST", body: formData });
        if (res.type !== "opaque" && !res.ok) throw new Error(`Sheet error ${res.status}`);
      } catch (err) {
        await fetch(GOOGLE_SHEET_URL, { method: "POST", mode: "no-cors", body: formData });
      }
    } catch (err: any) {
      console.warn("Failed to upload payment screenshot", err);
      toast({ title: "Screenshot upload failed", description: "We will verify manually if needed.", variant: "destructive" });
    } finally {
      setUploadingScreenshot(false);
    }
  };

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
    if (paymentMethod === "online" && !paymentScreenshot) {
      toast({ title: "Upload required", description: "Please upload your payment screenshot.", variant: "destructive" });
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
        payment: { amount: VISIT_CHARGE, status: paymentMethod === "online" ? "submitted" : "pending", method: paymentMethod },
        status: "pending",
        createdAt: serverTimestamp(),
      });

      if (paymentMethod === "online") {
        await submitPaymentScreenshot(bookingRef.id);
      }

      const propertyTitleMap = [property, ...allProperties].reduce((acc: Record<string, string>, p: any) => {
        if (p?.id) acc[p.id] = p.title || p.id;
        return acc;
      }, {});
      openBookingWhatsApp({
        bookingId: bookingRef.id,
        name,
        phone,
        date: format(selectedDate, "yyyy-MM-dd"),
        slot: selectedSlot,
        propertyTitles: selectedPropertyIds.map((pid) => propertyTitleMap[pid] || pid),
        location: property?.location || property?.address,
        charge: VISIT_CHARGE,
        total: VISIT_CHARGE,
        notes: message || undefined,
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
    setPaymentScreenshot(null);
    setPaymentScreenshotPreview(null);
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
              <div className="relative">
                <Carousel setApi={setCarouselApi} className="h-64 md:h-[420px]">
                  <CarouselContent className="h-full">
                    {images.length > 0 ? (
                      images.map((src, i) => (
                        <CarouselItem key={`${src}-${i}`} className="h-full">
                          <div className="relative h-64 md:h-[420px] bg-muted rounded-lg overflow-hidden">
                            <img src={src} alt={`${property.title}-${i}`} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                          </div>
                        </CarouselItem>
                      ))
                    ) : (
                      <CarouselItem className="h-full">
                        <div className="relative h-64 md:h-[420px] bg-muted rounded-lg flex items-center justify-center">
                          <div className="text-muted-foreground flex flex-col items-center gap-2">
                            <Maximize className="h-10 w-10" />
                            <span className="text-sm">No image</span>
                          </div>
                        </div>
                      </CarouselItem>
                    )}
                  </CarouselContent>
                  {images.length > 1 && (
                    <>
                      <CarouselPrevious className="left-3 bg-white/90 hover:bg-white" />
                      <CarouselNext className="right-3 bg-white/90 hover:bg-white" />
                    </>
                  )}
                </Carousel>

                <div className="absolute top-4 left-4 flex gap-2 z-10">
                  <Badge className="bg-secondary text-secondary-foreground font-body">{property.status}</Badge>
                  <Badge variant="outline" className="bg-card/90 font-body">{property.type}</Badge>
                </div>
              </div>

              {images.length > 1 && (
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  {images.map((src, i) => (
                    <button
                      key={`${src}-thumb-${i}`}
                      type="button"
                      onClick={() => carouselApi?.scrollTo(i)}
                      className={cn(
                        "h-16 w-20 shrink-0 rounded-md overflow-hidden border",
                        selectedIndex === i ? "border-secondary" : "border-border",
                      )}
                    >
                      <img src={src} alt={`${property.title}-thumb-${i}`} className="h-full w-full object-cover" loading="lazy" />
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">{property.title}</h1>
                    {(property.location || property.address) && (
                      <div className="flex items-center gap-2 mt-2 text-muted-foreground font-body">
                        <MapPin className="h-4 w-4" /> {property.location || property.address}
                      </div>
                    )}
                    {summaryLine && (
                      <div className="mt-2 text-sm text-muted-foreground font-body">{summaryLine}</div>
                    )}
                  </div>
                  <div className="text-2xl md:text-3xl font-display font-bold text-secondary">
                    {formatPrice(property.price)}
                    {property.status === "For Rent" && <span className="text-base font-body text-muted-foreground">/month</span>}
                  </div>
                </div>

                <div className="mt-6 border-t border-border pt-6">
                  <h3 className="text-lg font-display font-semibold text-foreground mb-4">Details</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm font-body">
                    {detailItems.map((item) => (
                      <div key={item.label} className="flex items-center justify-between gap-3 border-b border-border pb-2">
                        <span className="text-muted-foreground">{item.label}</span>
                        <span className="text-card-foreground font-medium text-right">{item.value}</span>
                      </div>
                    ))}
                  </div>
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
                <div className="text-sm text-muted-foreground font-body">
                  Book using the full booking form to select a slot and upload payment proof.
                </div>
                <Link to={`/book?propertyId=${property.id}`}>
                  <Button className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 font-body">
                    Book Site Visit
                  </Button>
                </Link>
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
