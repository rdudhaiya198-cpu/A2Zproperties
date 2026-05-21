import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { storage, db } from "@/integrations/firebase/client";
import { doc as fsDoc, getDoc as fsGetDoc, addDoc, collection, serverTimestamp, getDocs as fsGetDocs, query as fsQuery, where as fsWhere } from "firebase/firestore";
import { TIME_SLOTS_MORNING, TIME_SLOTS_EVENING, VISIT_CHARGE, MAX_PROPERTIES_PER_VISIT, UPI_ID, GOOGLE_SHEET_URL } from "@/lib/data";
import { openBookingWhatsApp } from "@/lib/whatsapp";
import { isValidPhone } from "@/lib/validation";

export default function BookSlot() {
  const [search] = useSearchParams();
  const propertyId = search.get("propertyId");
  const [property, setProperty] = useState<any | null>(null);
  const [relatedProperties, setRelatedProperties] = useState<any[]>([]);
  const [extraPropertyIds, setExtraPropertyIds] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState("");
  const [caste, setCaste] = useState("");
  const [bookedSlots, setBookedSlots] = useState<Record<string, number>>({});
  const [bookedProperties, setBookedProperties] = useState<Record<string, string[]>>({});
  const [todayMin, setTodayMin] = useState("");
  const [agree, setAgree] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cash_upi_on_visit");
  const [paymentScreenshot, setPaymentScreenshot] = useState<File | null>(null);
  const [paymentScreenshotPreview, setPaymentScreenshotPreview] = useState<string | null>(null);
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; phone?: string; date?: string; slot?: string; caste?: string; agree?: string; screenshot?: string }>({});
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();

  const normalizeIntent = (status: any) => {
    const s = (status || "").toString().toLowerCase();
    if (/rent|rented|lease/.test(s)) return "rent";
    if (/sell|sold|sale/.test(s)) return "sell";
    return "other";
  };

  const normalizeType = (type: any) => {
    const t = (type || "").toString().toLowerCase();
    if (/commercial|shop|office|retail/.test(t)) return "commercial";
    if (/land|plot|site/.test(t)) return "land";
    return "residential";
  };

  const selectedPropertyIds = propertyId ? [propertyId, ...extraPropertyIds] : [];
  const brokerage = property && (property.status === "For Rent" || (property.listed_by && String(property.status).toLowerCase().includes("rent"))) ? Number(property.price || 0) : 0;
  const totalDueNow = VISIT_CHARGE + (brokerage || 0);
  const upiPayUrl = (() => {
    const note = property?.title ? `Site Visit - ${property.title}` : "Site Visit Booking";
    const params = new URLSearchParams({
      pa: UPI_ID,
      pn: "ATOZ PROPERTIES",
      am: String(totalDueNow),
      cu: "INR",
      tn: note,
    });
    return `upi://pay?${params.toString()}`;
  })();

  const isMobile = (() => {
    if (typeof navigator === "undefined") return false;
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  })();

  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(upiPayUrl)}`;

  useEffect(() => {
    if (!propertyId) return;
    (async () => {
      if (!db) return;
      try {
        const dref = fsDoc(db, "properties", propertyId);
        const snap = await fsGetDoc(dref);
        if (!snap.exists()) return;

        const selected = { id: snap.id, ...snap.data() } as any;
        setProperty(selected);

        // load related properties so user can book multiple in one slot
        const allSnap = await fsGetDocs(collection(db, "properties"));
        const all: any[] = [];
        allSnap.forEach((d) => all.push({ id: d.id, ...d.data() }));

        const selectedIntent = normalizeIntent(selected.status);
        const selectedType = normalizeType(selected.type);
        const selectedLocation = (selected.location || "").toString().trim().toLowerCase();

        const rankedBase = all
          .filter((p) => p.id !== propertyId)
          .map((p) => {
            const sameLocation = (p.location || "").toString().trim().toLowerCase() === selectedLocation;
            const sameIntent = normalizeIntent(p.status) === selectedIntent;
            const sameType = normalizeType(p.type) === selectedType;
            const relScore = (sameIntent ? 5 : 0) + (sameType ? 4 : 0) + (sameLocation ? 2 : 0);
            return { ...p, _relScore: relScore, _sameIntent: sameIntent, _sameType: sameType };
          });

        const strictMatches = rankedBase.filter((p: any) => p._sameIntent && p._sameType);
        const softMatches = rankedBase.filter((p: any) => p._sameIntent || p._sameType);
        const pool = strictMatches.length > 0 ? strictMatches : (softMatches.length > 0 ? softMatches : rankedBase);

        const ranked = pool
          .sort((a: any, b: any) => b._relScore - a._relScore)
          .slice(0, 20);

        setRelatedProperties(ranked);
      } catch (err) {
        console.warn(err);
      }
    })();
  }, [propertyId]);

  const toggleExtra = (pid: string) => {
    if (extraPropertyIds.includes(pid)) {
      setExtraPropertyIds(extraPropertyIds.filter((x) => x !== pid));
      return;
    }
    if (extraPropertyIds.length >= MAX_PROPERTIES_PER_VISIT - 1) {
      toast({
        title: "Maximum reached",
        description: `You can select up to ${MAX_PROPERTIES_PER_VISIT} properties in one booking.`,
        variant: "destructive",
      });
      return;
    }
    setExtraPropertyIds([...extraPropertyIds, pid]);
  };

  // compute today's date in IST for setting min on date input
  useEffect(() => {
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    const nowIst = new Date(Date.now() + IST_OFFSET_MS);
    const y = nowIst.getUTCFullYear();
    const m = String(nowIst.getUTCMonth() + 1).padStart(2, "0");
    const d = String(nowIst.getUTCDate()).padStart(2, "0");
    setTodayMin(`${y}-${m}-${d}`);
  }, []);

  useEffect(() => {
    return () => {
      if (paymentScreenshotPreview) URL.revokeObjectURL(paymentScreenshotPreview);
    };
  }, [paymentScreenshotPreview]);

  useEffect(() => {
    if (paymentMethod !== "online") {
      setPaymentScreenshot(null);
      setPaymentScreenshotPreview(null);
      setShowQr(false);
      if (errors.screenshot) setErrors((prev) => ({ ...prev, screenshot: undefined }));
    }
  }, [paymentMethod, errors.screenshot]);

  const handlePaymentScreenshotChange = (file: File | null) => {
    if (!file) {
      setPaymentScreenshot(null);
      setPaymentScreenshotPreview(null);
      return;
    }
    setPaymentScreenshot(file);
    if (errors.screenshot) setErrors((prev) => ({ ...prev, screenshot: undefined }));
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
      formData.append("amount", String(totalDueNow));
      formData.append("upi", UPI_ID);
      formData.append("propertyId", propertyId || "");
      formData.append("propertyTitle", property?.title || "");
      formData.append("visitDate", date || "");
      formData.append("timeSlot", slot || "");
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

  // fetch already booked slots for selected properties + date
  useEffect(() => {
    if (selectedPropertyIds.length === 0 || !date) return;
    (async () => {
      if (!db) return;
      try {
        const q = fsQuery(collection(db, "bookings"), fsWhere("visit_date", "==", date));
        const snap = await fsGetDocs(q);
        const taken: Record<string, number> = {};
        snap.forEach((sdoc) => {
          const d = sdoc.data() as any;
          const ts = d.time_slot;
          const pids = Array.isArray(d.property_ids) ? d.property_ids : [];
          if (ts && pids.some((pid: string) => selectedPropertyIds.includes(pid))) {
            taken[ts] = (taken[ts] || 0) + 1;
          }
        });
        setBookedSlots(taken);
      } catch (err) {
        console.warn(err);
      }
    })();
  }, [selectedPropertyIds, date]);

  // fetch bookings for the selected date across all properties to show which properties are booked per slot
  useEffect(() => {
    if (!date) return;
    (async () => {
      if (!db) return;
      try {
        const q = fsQuery(collection(db, "bookings"), fsWhere("visit_date", "==", date));
        const snap = await fsGetDocs(q);
        const slotToPropIds: Record<string, Set<string>> = {};
        const propIdSet = new Set<string>();
        snap.forEach((doc) => {
          const d = doc.data() as any;
          const ts = d.time_slot;
          const pids = Array.isArray(d.property_ids) ? d.property_ids : [];
          if (!ts) return;
          slotToPropIds[ts] = slotToPropIds[ts] || new Set();
          pids.forEach((pid: string) => {
            slotToPropIds[ts].add(pid);
            propIdSet.add(pid);
          });
        });

        // fetch property titles for all involved property ids
        const idToTitle: Record<string, string> = {};
        if (propIdSet.size > 0) {
          const ids = Array.from(propIdSet);
          await Promise.all(ids.map(async (id) => {
            try {
              const pref = fsDoc(db, "properties", id);
              const psnap = await fsGetDoc(pref);
              if (psnap.exists()) idToTitle[id] = (psnap.data() as any).title || id;
              else idToTitle[id] = id;
            } catch (e) {
              idToTitle[id] = id;
            }
          }));
        }

        const slotToTitles: Record<string, string[]> = {};
        Object.keys(slotToPropIds).forEach((ts) => {
          const titles: string[] = [];
          slotToPropIds[ts].forEach((pid) => {
            const title = idToTitle[pid] || pid;
            // exclude current property from the "other bookings" list
            if (propertyId && pid === propertyId) return;
            titles.push(title);
          });
          slotToTitles[ts] = titles;
        });
        setBookedProperties(slotToTitles);
      } catch (err) {
        console.warn("failed to fetch bookings for date", err);
      }
    })();
  }, [date, propertyId]);

  const handleBook = async () => {
    const nextErrors: { name?: string; phone?: string; date?: string; slot?: string; caste?: string; agree?: string; screenshot?: string } = {};
    if (!name.trim()) nextErrors.name = "Name is required";
    if (!phone.trim()) nextErrors.phone = "Phone number is required";
    else if (!isValidPhone(phone)) nextErrors.phone = "Enter a valid phone number";
    if (!date) nextErrors.date = "Visit date is required";
    if (!slot) nextErrors.slot = "Please select a time slot";
    if (!caste.trim()) nextErrors.caste = "Caste / Community is required";
    if (paymentMethod === "online" && !paymentScreenshot) nextErrors.screenshot = "Payment screenshot is required";
    if (!agree) nextErrors.agree = "You must agree to the booking charge";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      const firstError = Object.values(nextErrors).find(Boolean);
      toast({ title: "Please fix the highlighted fields", description: firstError, variant: "destructive" });
      return;
    }
    try {
      if (!db) throw new Error("Firebase not configured");

      // parse date + slot into a Date representing the selected time in India (IST = UTC+5:30)
      const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // 19800000
      const [y, m, d] = date.split("-").map((v) => Number(v));
      const [timePart, meridiem] = slot.split(" ");
      const [hhStr, mmStr] = timePart.split(":");
      let hh = Number(hhStr) % 12;
      const mm = Number(mmStr || 0);
      if ((meridiem || "").toUpperCase() === "PM") hh += 12;
      // Date.UTC treats the given values as UTC; subtract IST offset to get the UTC instant for the IST local time
      const utcMillis = Date.UTC(y, m - 1, d, hh, mm) - IST_OFFSET_MS;
      const visitDateTime = new Date(utcMillis);

      // double-check availability before saving
      const checkQ = fsQuery(collection(db, "bookings"), fsWhere("visit_date", "==", date), fsWhere("time_slot", "==", slot));
      const checkSnap = await fsGetDocs(checkQ);
      const perPropertyCount: Record<string, number> = {};
      checkSnap.forEach((sdoc) => {
        const d = sdoc.data() as any;
        const pids = Array.isArray(d.property_ids) ? d.property_ids : [];
        pids.forEach((pid: string) => {
          perPropertyCount[pid] = (perPropertyCount[pid] || 0) + 1;
        });
      });

      const fullPid = selectedPropertyIds.find((pid) => (perPropertyCount[pid] || 0) >= 3);
      if (fullPid) {
        return toast({
          title: "Slot full",
          description: "One selected property is already fully booked for this slot. Choose another slot.",
          variant: "destructive",
        });
      }

      const bkRef = await addDoc(collection(db, "bookings"), {
        user_id: user ? user.id : null,
        name,
        phone,
        email: null,
        visit_date: date,
        time_slot: slot,
        visit_datetime: visitDateTime,
        caste,
        property_ids: selectedPropertyIds,
        charge: VISIT_CHARGE,
        brokerage: brokerage || 0,
        payment: {
          amount: totalDueNow,
          status: paymentMethod === "online" ? "submitted" : "pending",
          method: paymentMethod,
          breakdown: { visit: VISIT_CHARGE, brokerage: brokerage || 0 },
        },
        status: "pending",
        createdAt: serverTimestamp(),
      });

      if (paymentMethod === "online") {
        await submitPaymentScreenshot(bkRef.id);
      }

      const allKnown = [property, ...relatedProperties].filter(Boolean);
      const propertyTitles = selectedPropertyIds.map((pid) => allKnown.find((p) => p.id === pid)?.title || pid);
      openBookingWhatsApp({
        bookingId: bkRef.id,
        name,
        phone,
        date,
        slot,
        propertyTitles,
        location: property?.location,
        caste,
        charge: VISIT_CHARGE,
        brokerage: brokerage || 0,
        total: totalDueNow,
      });

      try {
        await addDoc(collection(db, "notifications"), {
          type: "booking",
          refId: bkRef.id,
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
            body: JSON.stringify({ type: "booking", refId: bkRef.id, title: "New Booking", message: `${name} • ${phone}` }),
          });
        } catch (e) {
          console.warn("sendNotification call failed", e);
        }
      } catch (e) {
        console.warn("Failed to create notification", e);
      }
      toast({ title: "Booked", description: "Your slot request is recorded." });
      navigate("/my-bookings");
    } catch (err: any) {
      toast({ title: "Error", description: String(err?.message || err), variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-4 max-w-2xl">
        <div className="mb-0">
          <Link to="/properties"><Button size="sm" variant="ghost">← Back to Properties</Button></Link>
        </div>
      </div>
      <div className="container mx-auto px-4 py-10 max-w-2xl">
        <h1 className="text-2xl font-display font-bold mb-4">Book Site Visit</h1>
        {property && (
          <div className="mb-4 p-3 rounded bg-card">
            <div className="font-medium">{property.title}</div>
            <div className="text-sm text-muted-foreground">{property.location}</div>
            <div className="text-xs text-muted-foreground mt-1">
              You can add up to {MAX_PROPERTIES_PER_VISIT - 1} more related properties in this booking.
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <Input placeholder="Your Name" value={name} onChange={(e) => {
              setName(e.target.value);
              if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
            }} />
            {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name}</p>}
          </div>
          <div>
            <Input placeholder="Phone" value={phone} onChange={(e) => {
              setPhone(e.target.value);
              if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }));
            }} />
            {errors.phone && <p className="mt-1 text-xs text-destructive">{errors.phone}</p>}
          </div>
          <div>
            <div className="relative">
              <Input type="date" className="pr-10" value={date} min={todayMin} onChange={(e) => {
                setDate(e.target.value);
                if (errors.date) setErrors((prev) => ({ ...prev, date: undefined }));
              }} aria-label="Choose visit date" />
              {!date && (
                <span className="absolute left-3 top-2 pointer-events-none text-muted-foreground text-sm block sm:hidden">Choose date</span>
              )}
            </div>
            {!date && (
              <div className="text-xs text-muted-foreground mt-1">Choose a visit date (tap to open date picker)</div>
            )}
            {errors.date && <p className="mt-1 text-xs text-destructive">{errors.date}</p>}
          </div>
          <div>
            <Input placeholder="Caste / Community" value={caste} onChange={(e) => {
              setCaste(e.target.value);
              if (errors.caste) setErrors((prev) => ({ ...prev, caste: undefined }));
            }} />
            {errors.caste && <p className="mt-1 text-xs text-destructive">{errors.caste}</p>}
          </div>
          {relatedProperties.length > 0 && (
            <div className="rounded-md border border-border p-3">
              <div className="text-sm font-medium mb-2">Add Related Properties (Optional)</div>
              <div className="text-xs text-muted-foreground mb-2">Suggestions are based on your selected need (same type and rent/sell preference).</div>
              <div className="max-h-40 overflow-y-auto space-y-1.5">
                {relatedProperties.map((p) => {
                  const selected = extraPropertyIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleExtra(p.id)}
                      className={`w-full text-left rounded px-2 py-1.5 text-xs ${selected ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"}`}
                    >
                      <div className="font-medium truncate">{p.title}</div>
                      <div className="truncate">{p.location || "Unknown location"}</div>
                      <div className="truncate">{p.type || "-"} • {p.status || "-"}</div>
                    </button>
                  );
                })}
              </div>
              <div className="text-xs mt-2 text-muted-foreground">
                Selected: {selectedPropertyIds.length} / {MAX_PROPERTIES_PER_VISIT}
              </div>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            {[...TIME_SLOTS_MORNING, ...TIME_SLOTS_EVENING].map((s) => {
              // compute if slot is in past relative to now (IST)
              let isPast = false;
              if (date) {
                  try {
                    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
                    const CUTOFF_MS = 30 * 60 * 1000; // 30 minutes
                    const cutoff = Date.now() + CUTOFF_MS;
                    const [y, m, d] = date.split("-").map((v) => Number(v));
                    const [timePart, meridiem] = s.split(" ");
                    const [hhStr, mmStr] = timePart.split(":");
                    let hh = Number(hhStr) % 12;
                    const mm = Number(mmStr || 0);
                    if ((meridiem || "").toUpperCase() === "PM") hh += 12;
                    const utcMillis = Date.UTC(y, m - 1, d, hh, mm) - IST_OFFSET_MS;
                    if (utcMillis <= cutoff) isPast = true;
                  } catch (e) {
                    isPast = false;
                  }
              }
              const takenCount = bookedSlots[s] || 0;
              const disabled = isPast || takenCount >= 3;
              let bgClass = "bg-emerald-600 text-white"; // available
              if (takenCount >= 2) bgClass = "bg-amber-400 text-amber-900"; // fast-filling
              if (disabled) bgClass = "bg-muted text-muted-foreground";
              const isSelected = slot === s;
              const selectedClass = "bg-secondary text-secondary-foreground";
              return (
                <button key={s} type="button" onClick={() => { if (!disabled) { setSlot(s); if (errors.slot) setErrors((prev) => ({ ...prev, slot: undefined })); } }} disabled={disabled} className={`text-xs py-1 rounded ${isSelected ? selectedClass : bgClass} ${disabled?"opacity-60 cursor-not-allowed":""}`}>
                  <div className="flex items-center justify-center gap-2">
                    <span>{s}</span>
                    {takenCount > 0 && <span className="text-[10px] font-medium">({takenCount})</span>}
                  </div>
                  {bookedProperties[s] && bookedProperties[s].length > 0 && (
                    <div className="text-[10px] text-muted-foreground mt-1 truncate px-1">Booked: {bookedProperties[s].slice(0,3).join(", ")}{bookedProperties[s].length>3?` +${bookedProperties[s].length-3}`:""}</div>
                  )}
                </button>
              );
            })}
          </div>
          {errors.slot && <p className="mt-1 text-xs text-destructive">{errors.slot}</p>}
          <div>
            <div className="text-sm font-medium mb-2">Payment Method</div>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Select payment method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="online">Pay Online (UPI / Card / Net Banking)</SelectItem>
                <SelectItem value="cash_upi_on_visit">Cash at site Visit</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {paymentMethod === "online" && (
            <div className="rounded-md border border-border p-3 space-y-2">
              <div className="text-sm font-medium">Pay Now (UPI)</div>
              <div className="text-xs text-muted-foreground">UPI ID: {UPI_ID}</div>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  if (isMobile) {
                    window.location.href = upiPayUrl;
                  } else {
                    setShowQr(true);
                  }
                }}
              >
                {isMobile ? "Pay Now" : "Show QR"}
              </Button>
              {!isMobile && showQr && (
                <div className="flex flex-col items-center gap-2 pt-2">
                  <img src={qrSrc} alt="UPI QR" className="h-48 w-48 rounded border border-border bg-white p-2" />
                  <div className="text-xs text-muted-foreground">Scan this QR with any UPI app to pay ₹{totalDueNow}.</div>
                </div>
              )}
              <div className="text-xs text-muted-foreground">After payment, upload a screenshot for verification.</div>
              <Input type="file" accept="image/*" onChange={(e) => handlePaymentScreenshotChange(e.target.files?.[0] || null)} />
              {paymentScreenshotPreview && (
                <img src={paymentScreenshotPreview} alt="Payment screenshot" className="w-full max-h-48 object-contain rounded border border-border" />
              )}
              {errors.screenshot && <p className="text-xs text-destructive">{errors.screenshot}</p>}
            </div>
          )}
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={agree} onChange={(e) => {
              setAgree(e.target.checked);
              if (errors.agree) setErrors((prev) => ({ ...prev, agree: undefined }));
            }} />
            <span>I agree to pay ₹200 booking charge (non-refundable)</span>
          </label>
          {errors.agree && <p className="mt-1 text-xs text-destructive">{errors.agree}</p>}
          {brokerage > 0 && (
            <div className="text-sm text-muted-foreground mt-2">
              one rent brokarge charges applicable 100% at token time
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={handleBook} disabled={uploadingScreenshot} className="bg-primary text-primary-foreground">Confirm Site Visit</Button>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
