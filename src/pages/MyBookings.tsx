import { useState, useEffect } from "react";
import { Calendar, Clock, MapPin, IndianRupee, CalendarPlus, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { supabaseQuery } from "@/lib/supabase-query";
import { db } from "@/integrations/firebase/client";
import { collection, query as fsQuery, where as fsWhere, orderBy as fsOrderBy, getDocs as fsGetDocs } from "firebase/firestore";
import { generateGoogleCalendarUrl } from "@/lib/calendar";

const statusColors: Record<string, string> = {
  pending: "bg-accent/20 text-accent-foreground",
  confirmed: "bg-secondary/20 text-secondary",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-destructive/10 text-destructive",
};

const statusMessages: Record<string, string> = {
  pending: "⏳ Waiting for approval from A TO Z Properties",
  confirmed: "✅ Your visit is confirmed! See you there.",
  completed: "🎉 Visit completed. Thank you!",
  cancelled: "❌ This booking was cancelled.",
};

const MyBookings = () => {
  const { user, isAdmin } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Extract fetch logic so it can be retried by the user
  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (db) {
        // Firestore path: bookings are stored in `bookings` collection
        const bq = fsQuery(collection(db, "bookings"), fsWhere("user_id", "==", user.id), fsOrderBy("createdAt", "desc"));
        let bsnap;
        try {
          bsnap = await fsGetDocs(bq);
        } catch (e: any) {
          // Firestore may require a composite index for this query. Fall back
          // to a simpler query (filter-only) and sort client-side.
          const errMsg = String(e?.message || e);
          console.warn("Bookings query failed, falling back to filter-only query:", errMsg);
          console.warn("If you prefer a server index, create it here:", "https://console.firebase.google.com/v1/r/project/atozproperties-5ab23/firestore/indexes?create_composite=ClVwcm9qZWN0cy9hdG96cHJvcGVydGllcy01YWIyMy9kYXRhYmFzZXMvKGRlZmF1bHQpL2NvbGxlY3Rpb25Hcm91cHMvYm9va2luZ3MvaW5kZXhlcy9fEAEaCwoHdXNlcl9pZBABGg0KCWNyZWF0ZWRBdBACGgwKCF9fbmFtZV9fEAI");
          const simpleQ = fsQuery(collection(db, "bookings"), fsWhere("user_id", "==", user.id));
          bsnap = await fsGetDocs(simpleQ);
        }
        const bk: any[] = [];
        const propIds = new Set<string>();
        bsnap.forEach((doc) => {
          const d = doc.data();
          bk.push({ id: doc.id, ...d });
          (d.property_ids || []).forEach((pid: string) => propIds.add(pid));
        });
        // If the fallback simple query was used, manually sort by createdAt desc
        bk.sort((a, b) => {
          const ta = a.createdAt && a.createdAt.toDate ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
          const tb = b.createdAt && b.createdAt.toDate ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
          return tb - ta;
        });
        // fetch properties titles
        const props: any[] = [];
        if (propIds.size > 0) {
          await Promise.all(Array.from(propIds).map(async (pid) => {
            try {
              const pdoc = await fsGetDocs(fsQuery(collection(db, "properties"), fsWhere("__name__", "==", pid)));
              pdoc.forEach((pd) => props.push({ id: pd.id, ...(pd.data() as any) }));
            } catch (e) {
              // ignore
            }
          }));
        } else {
          // fallback: load all properties (small dataset)
          try {
            const allPropsSnap = await fsGetDocs(fsQuery(collection(db, "properties")));
            allPropsSnap.forEach((pd) => props.push({ id: pd.id, ...(pd.data() as any) }));
          } catch (e) {
            // ignore
          }
        }
        setBookings(bk || []);
        setProperties(props || []);
      } else {
        const [bookingsRes, propsRes] = await Promise.all([
          supabaseQuery({ table: "bookings", filters: { "user_id": `eq.${user.id}` }, order: { column: "created_at", ascending: false } }),
          supabaseQuery({ table: "properties", select: "id,title" }),
        ]);
        setBookings(bookingsRes.data || []);
        setProperties(propsRes.data || []);
      }
      setError(null);
    } catch (err: any) {
      console.error('Failed to load bookings:', err);
      setError(err?.message || String(err));
      setBookings([]);
      setProperties([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchData();

    // no realtime channel (Firestore listeners can be added if desired)
    return () => {};
  }, [user]);
  

  const getPropertyTitle = (id: string) => {
    return properties.find((p) => p.id === id)?.title || "Unknown Property";
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-2">
          My <span className="text-secondary">Booked Visits</span>
        </h1>
        <p className="text-muted-foreground font-body text-sm mb-8">
          Track your site visit bookings — you'll see confirmation status here
        </p>

        {loading ? (
          <div className="text-center py-20 text-muted-foreground font-body">Loading...</div>
        ) : error ? (
          <div className="text-center py-20 font-body">
            <div className="text-destructive mb-3">Error loading bookings: {error.includes('Failed to fetch') ? 'Network error — could not reach the server.' : error}</div>
            <div className="flex items-center justify-center gap-2">
              <Button size="sm" onClick={() => fetchData()}>Retry</Button>
            </div>
          </div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground font-body">
            No bookings yet. Browse properties and book a site visit!
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => (
              <div key={booking.id} className="bg-card rounded-lg p-5 shadow-card">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-body text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      {booking.visit_date}
                      <Clock className="h-4 w-4 ml-2" />
                      {booking.time_slot}
                    </div>
                  </div>
                  <Badge className={`${statusColors[booking.status] || ""} font-body text-xs`}>
                    {booking.status}
                  </Badge>
                </div>

                {/* Status message */}
                <div className={`text-sm font-body mb-3 p-2 rounded-md ${
                  booking.status === "confirmed" ? "bg-secondary/10 text-secondary" :
                  booking.status === "cancelled" ? "bg-destructive/10 text-destructive" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {statusMessages[booking.status] || booking.status}
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-body font-medium text-card-foreground">Properties:</p>
                  {booking.property_ids?.map((pid: string) => (
                    <div key={pid} className="flex items-center gap-1 text-sm font-body text-muted-foreground">
                      <MapPin className="h-3 w-3" /> {getPropertyTitle(pid)}
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-sm font-body text-secondary">
                    <IndianRupee className="h-3.5 w-3.5" /> {booking.charge} Visit Charge
                  </div>
                  {booking.status === "confirmed" && isAdmin && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs font-body text-secondary border-secondary/30"
                      onClick={() => {
                        const url = generateGoogleCalendarUrl({
                          title: `Property Visit - A TO Z Properties`,
                          date: booking.visit_date,
                          timeSlot: booking.time_slot,
                          description: `Site visit with A TO Z Properties\nProperties: ${booking.property_ids?.map((pid: string) => getPropertyTitle(pid)).join(", ")}`,
                          location: "Rajkot, Gujarat",
                        });
                        window.open(url, "_blank");
                      }}
                    >
                      <CalendarPlus className="h-3.5 w-3.5 mr-1" /> Add to Calendar
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default MyBookings;
