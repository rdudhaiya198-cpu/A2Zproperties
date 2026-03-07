import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { storage, db } from "@/integrations/firebase/client";
import { doc as fsDoc, getDoc as fsGetDoc, addDoc, collection, serverTimestamp, getDocs as fsGetDocs, query as fsQuery, where as fsWhere } from "firebase/firestore";
import { TIME_SLOTS_MORNING, TIME_SLOTS_EVENING, VISIT_CHARGE } from "@/lib/data";

export default function BookSlot() {
  const [search] = useSearchParams();
  const propertyId = search.get("propertyId");
  const [property, setProperty] = useState<any | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState("");
  const [caste, setCaste] = useState("");
  const [bookedSlots, setBookedSlots] = useState<Record<string, number>>({});
  const [bookedProperties, setBookedProperties] = useState<Record<string, string[]>>({});
  const [todayMin, setTodayMin] = useState("");
  const [agree, setAgree] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const brokerage = property && (property.status === "For Rent" || (property.listed_by && String(property.status).toLowerCase().includes("rent"))) ? Number(property.price || 0) : 0;

  useEffect(() => {
    if (!propertyId) return;
    (async () => {
      if (!db) return;
      try {
        const dref = fsDoc(db, "properties", propertyId);
        const snap = await fsGetDoc(dref);
        if (snap.exists()) setProperty({ id: snap.id, ...snap.data() });
      } catch (err) {
        console.warn(err);
      }
    })();
  }, [propertyId]);

  // compute today's date in IST for setting min on date input
  useEffect(() => {
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    const nowIst = new Date(Date.now() + IST_OFFSET_MS);
    const y = nowIst.getUTCFullYear();
    const m = String(nowIst.getUTCMonth() + 1).padStart(2, "0");
    const d = String(nowIst.getUTCDate()).padStart(2, "0");
    setTodayMin(`${y}-${m}-${d}`);
  }, []);

  // fetch already booked slots for selected property + date
  useEffect(() => {
    if (!propertyId || !date) return;
    (async () => {
      if (!db) return;
      try {
        const q = fsQuery(collection(db, "bookings"), fsWhere("property_ids", "array-contains", propertyId), fsWhere("visit_date", "==", date));
        const snap = await fsGetDocs(q);
        const taken: Record<string, number> = {};
        snap.forEach((doc) => {
          const d = doc.data();
          if (d.time_slot) {
            taken[d.time_slot] = (taken[d.time_slot] || 0) + 1;
          }
        });
        setBookedSlots(taken);
      } catch (err) {
        console.warn(err);
      }
    })();
  }, [propertyId, date]);

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
    if (!name || !phone || !date || !slot || !caste) return toast({ title: "Fill required", description: "Name, phone, date, time and caste required", variant: "destructive" });
    // compute brokerage if this is a rental property
    const brokerage = property && (property.status === "For Rent" || (property.listed_by && String(property.status).toLowerCase().includes("rent"))) ? Number(property.price || 0) : 0;
    const totalDueNow = VISIT_CHARGE + (brokerage || 0);
    if (!agree) return toast({ title: "Payment required", description: `Please agree to pay ₹${VISIT_CHARGE}${brokerage ? ` + ₹${brokerage} brokerage (payable 100% at token)` : ""}`, variant: "destructive" });
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
      const checkQ = fsQuery(collection(db, "bookings"), fsWhere("property_ids", "array-contains", propertyId), fsWhere("visit_date", "==", date), fsWhere("time_slot", "==", slot));
      const checkSnap = await fsGetDocs(checkQ);
      if (checkSnap.size >= 3) return toast({ title: "Slot full", description: "Selected slot already fully booked. Choose another slot.", variant: "destructive" });

      const bkRef = await addDoc(collection(db, "bookings"), {
        user_id: user ? user.id : null,
        name,
        phone,
        email: null,
        visit_date: date,
        time_slot: slot,
        visit_datetime: visitDateTime,
        caste,
        property_ids: propertyId ? [propertyId] : [],
        charge: VISIT_CHARGE,
        brokerage: brokerage || 0,
        payment: {
          amount: totalDueNow,
          status: "pending",
          method: "none",
          breakdown: { visit: VISIT_CHARGE, brokerage: brokerage || 0 },
        },
        status: "pending",
        createdAt: serverTimestamp(),
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
        <h1 className="text-2xl font-display font-bold mb-4">Book Slot</h1>
        {property && (
          <div className="mb-4 p-3 rounded bg-card">
            <div className="font-medium">{property.title}</div>
            <div className="text-sm text-muted-foreground">{property.location}</div>
          </div>
        )}

        <div className="space-y-3">
          <Input placeholder="Your Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <div className="relative">
            <Input type="date" className="pr-10" value={date} min={todayMin} onChange={(e) => setDate(e.target.value)} aria-label="Choose visit date" />
            {!date && (
              <span className="absolute left-3 top-2 pointer-events-none text-muted-foreground text-sm block sm:hidden">Choose date</span>
            )}
          </div>
          {!date && (
            <div className="text-xs text-muted-foreground mt-1">Choose a visit date (tap to open date picker)</div>
          )}
          <Input placeholder="Caste / Community" value={caste} onChange={(e) => setCaste(e.target.value)} />
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
                <button key={s} type="button" onClick={() => { if (!disabled) setSlot(s); }} disabled={disabled} className={`text-xs py-1 rounded ${isSelected ? selectedClass : bgClass} ${disabled?"opacity-60 cursor-not-allowed":""}`}>
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
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>I agree to pay ₹200 booking charge</span>
          </label>
          {brokerage > 0 && (
            <div className="text-sm text-muted-foreground mt-2">
              one rent brokarge charges applicable 100% at token time
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={handleBook} className="bg-primary text-primary-foreground">Confirm Booking</Button>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
