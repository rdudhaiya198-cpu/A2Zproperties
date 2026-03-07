import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Plus, Pencil, Trash2, Eye, Building, Users, Phone, Calendar, MessageSquare, CheckCircle, XCircle, CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ContactMenu from "@/components/ContactMenu";
import { registerAdminFcmToken, onForegroundMessage } from "@/integrations/firebase/fcm";
import { db } from "@/integrations/firebase/client";
import { doc as fsDoc, deleteDoc, updateDoc, collection, query as fsQuery, orderBy as fsOrderBy, onSnapshot, getDocs as fsGetDocs, writeBatch } from "firebase/firestore";
import { formatPrice, PHONE_NUMBER } from "@/lib/data";
import { generateGoogleCalendarUrl } from "@/lib/calendar";

const statusColors: Record<string, string> = {
  pending: "bg-accent/20 text-accent-foreground",
  confirmed: "bg-secondary/20 text-secondary",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-destructive/10 text-destructive",
  new: "bg-blue-100 text-blue-700",
  contacted: "bg-secondary/20 text-secondary",
  closed: "bg-muted text-muted-foreground",
};

const Dashboard = () => {
  const { toast } = useToast();
  const [properties, setProperties] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterProperty, setFilterProperty] = useState<string>("all");
  const [filterDate, setFilterDate] = useState<string>("");

  useEffect(() => {
    // register for push notifications when admin opens dashboard
    if (typeof window !== 'undefined' && (window as any).Notification && (window as any).Notification.requestPermission) {
      (async () => {
        try {
          if ((await (window as any).Notification.requestPermission()) === 'granted') {
            await registerAdminFcmToken();
          }
        } catch (e) {
          console.warn('FCM register failed', e);
        }
      })();
    }

    // optional: show an in-app toast when a foreground push arrives
    const off = onForegroundMessage((payload: any) => {
      try {
        toast({ title: payload?.notification?.title || 'Notification', description: payload?.notification?.body });
      } catch (e) {
        console.warn('Foreground message handler error', e);
      }
    });
    if (!db) {
      toast({ title: "Configuration error", description: "Firebase not configured. Set VITE_FIREBASE_* env vars.", variant: "destructive" });
      return;
    }

    const propsQ = fsQuery(collection(db, "properties"), fsOrderBy("createdAt", "desc"));
    const bookingsQ = fsQuery(collection(db, "bookings"), fsOrderBy("createdAt", "desc"));
    const inquiriesQ = fsQuery(collection(db, "inquiries"), fsOrderBy("createdAt", "desc"));

    const unsubProps = onSnapshot(propsQ, (snap) => {
      const out: any[] = [];
      snap.forEach((d) => out.push({ id: d.id, ...d.data() }));
      setProperties(out);
    }, (err) => console.error("Properties listener error:", err));

    const unsubBookings = onSnapshot(bookingsQ, (snap) => {
      const out: any[] = [];
      snap.forEach((d) => out.push({ id: d.id, ...d.data() }));
      setBookings(out);
    }, (err) => console.error("Bookings listener error:", err));

    const unsubInquiries = onSnapshot(inquiriesQ, (snap) => {
      const out: any[] = [];
      snap.forEach((d) => out.push({ id: d.id, ...d.data() }));
      setInquiries(out);
    }, (err) => console.error("Inquiries listener error:", err));

    const notifsQ = fsQuery(collection(db, "notifications"), fsOrderBy("createdAt", "desc"));
    const unsubNotifs = onSnapshot(notifsQ, (snap) => {
      const out: any[] = [];
      snap.forEach((d) => out.push({ id: d.id, ...d.data() }));
      setNotifications(out);
    }, (err) => console.error("Notifications listener error:", err));

    return () => {
      unsubProps();
      unsubBookings();
      unsubInquiries();
      unsubNotifs();
      if (typeof off === 'function') off();
    };
  }, []);


  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this property?")) return;
    try {
      await deleteDoc(fsDoc(db, "properties", id));
    } catch (err: any) {
      toast({ title: "Error", description: String(err?.message || err), variant: "destructive" });
      return;
    }
    toast({ title: "Property deleted" });
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await updateDoc(fsDoc(db, "bookings", id), { status });
    } catch (err: any) {
      toast({ title: "Error", description: String(err?.message || err), variant: "destructive" });
      return;
    }
    
    if (status === "confirmed") {
      const booking = bookings.find(b => b.id === id);
      if (booking) {
        // Generate Google Calendar link for admin
        const calUrl = generateGoogleCalendarUrl({
          title: `Site Visit - ${booking.name}`,
          date: booking.visit_date,
          timeSlot: booking.time_slot,
          description: `Customer: ${booking.name}\nPhone: ${booking.phone}\nEmail: ${booking.email || 'N/A'}\nProperties: ${booking.property_ids?.length || 0}`,
          location: "Rajkot, Gujarat",
        });
        if (calUrl) {
          window.open(calUrl, "_blank");
        }
      }
      toast({ title: "✅ Booking Confirmed!", description: "Customer will see the confirmation in their bookings. Google Calendar event opened." });
    } else {
      toast({ title: `Booking marked as ${status}` });
    }
  };

  const handleInquiryStatus = async (id: string, status: string) => {
    try {
      await updateDoc(fsDoc(db, "inquiries", id), { status });
    } catch (err: any) {
      toast({ title: "Error", description: String(err?.message || err), variant: "destructive" });
      return;
    }
    toast({ title: `Inquiry marked as ${status}` });
  };

  const handleDeleteInquiry = async (id: string) => {
    if (!confirm("Delete this inquiry?")) return;
    try {
      await deleteDoc(fsDoc(db, "inquiries", id));
    } catch (err: any) {
      toast({ title: "Error", description: String(err?.message || err), variant: "destructive" });
      return;
    }
    toast({ title: "Inquiry deleted" });
  };

  const handleDeleteBooking = async (id: string) => {
    if (!confirm("Delete this booking?")) return;
    try {
      await deleteDoc(fsDoc(db, "bookings", id));
    } catch (err: any) {
      toast({ title: "Error", description: String(err?.message || err), variant: "destructive" });
      return;
    }
    toast({ title: "Booking deleted" });
  };

  const pendingBookings = bookings.filter(b => b.status === "pending").length;
  const newInquiries = inquiries.filter(i => i.status === "new").length;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground font-body text-sm">Manage properties, bookings & inquiries</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Link to="/add-property">
              <Button className="bg-secondary text-secondary-foreground hover:bg-secondary/90 font-body">
                <Plus className="h-4 w-4 mr-2" /> Add Property
              </Button>
            </Link>
            <Button size="sm" variant="ghost" onClick={async () => {
              if (!confirm('Delete all notifications? This cannot be undone.')) return;
              if (!db) { toast({ title: 'Error', description: 'Firebase not configured', variant: 'destructive' }); return; }
              try {
                const q = fsQuery(collection(db, 'notifications'), fsOrderBy('createdAt', 'desc'));
                const snap = await fsGetDocs(q);
                const batch = writeBatch(db);
                snap.forEach((d) => batch.delete(fsDoc(db, 'notifications', d.id)));
                await batch.commit();
                toast({ title: 'Notifications cleared' });
              } catch (e) {
                console.error('Failed to clear notifications', e);
                toast({ title: 'Error', description: String(e), variant: 'destructive' });
              }
            }}>
              Clear Notifications
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
          {[
            { label: "Properties", value: properties.length, icon: Building },
            { label: "Bookings", value: bookings.length, icon: Users },
            { label: "Pending Visits", value: pendingBookings, icon: Calendar },
            { label: "New Inquiries", value: newInquiries, icon: MessageSquare },
            { label: "Notifications", value: notifications.filter(n => !n.read).length, icon: MessageSquare },
            { label: "Available", value: properties.filter((p) => p.status === "available").length, icon: Building },
          ].map((s) => (
            <div key={s.label} className="bg-card rounded-lg p-4 shadow-card">
              <div className="flex items-center gap-3">
                <s.icon className="h-5 w-5 text-secondary" />
                <div>
                  <div className="text-xl font-display font-bold text-card-foreground">{s.value}</div>
                  <div className="text-xs font-body text-muted-foreground">{s.label}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <Tabs defaultValue="bookings" className="space-y-4">
          <TabsList className="font-body">
            <TabsTrigger value="bookings">
              Bookings ({bookings.length})
              {pendingBookings > 0 && <span className="ml-1 bg-destructive text-destructive-foreground text-xs rounded-full px-1.5">{pendingBookings}</span>}
            </TabsTrigger>
            <TabsTrigger value="inquiries">
              Inquiries ({inquiries.length})
              {newInquiries > 0 && <span className="ml-1 bg-destructive text-destructive-foreground text-xs rounded-full px-1.5">{newInquiries}</span>}
            </TabsTrigger>
            <TabsTrigger value="properties">Properties ({properties.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="bookings">
            <div className="bg-card rounded-lg shadow-card overflow-hidden">
              <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-muted-foreground">Status</label>
                  <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-2 py-1 rounded border">
                    <option value="all">All</option>
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 mt-2 sm:mt-0">
                  <label className="text-sm text-muted-foreground">Property</label>
                  <select value={filterProperty} onChange={(e) => setFilterProperty(e.target.value)} className="px-2 py-1 rounded border">
                    <option value="all">All</option>
                    {properties.map((p) => (<option key={p.id} value={p.id}>{p.title}</option>))}
                  </select>
                </div>
                <div className="flex items-center gap-2 ml-auto mt-2 sm:mt-0">
                  <label className="text-sm text-muted-foreground">Date</label>
                  <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="px-2 py-1 rounded border" />
                  <Button size="sm" variant="ghost" onClick={() => { setFilterStatus("all"); setFilterProperty("all"); setFilterDate(""); }}>Reset</Button>
                </div>
              </div>
              <div className="overflow-x-auto">
                  <table className="w-full text-sm font-body">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-3 text-muted-foreground">Name</th>
                      <th className="text-left p-3 text-muted-foreground">Phone</th>
                      <th className="text-left p-3 text-muted-foreground hidden md:table-cell">Date</th>
                      <th className="text-left p-3 text-muted-foreground hidden md:table-cell">Slot</th>
                      <th className="text-left p-3 text-muted-foreground hidden md:table-cell">Properties</th>
                      <th className="text-left p-3 text-muted-foreground">Status</th>
                      <th className="text-right p-3 text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings
                      .filter((b) => {
                        if (filterStatus !== "all" && b.status !== filterStatus) return false;
                        if (filterProperty !== "all" && (!b.property_ids || !b.property_ids.includes(filterProperty))) return false;
                        if (filterDate && b.visit_date !== filterDate) return false;
                        return true;
                      })
                      .map((b) => (
                      <tr key={b.id} className={`border-t border-border hover:bg-muted/50 transition-colors ${b.status === "pending" ? "bg-accent/5" : ""}`}>
                        <td className="p-3 text-card-foreground font-medium">
                          {b.name}
                          {b.email && <div className="text-xs text-muted-foreground">{b.email}</div>}
                        </td>
                          <td className="p-3">
                            <ContactMenu phone={b.phone} className="inline-block">
                              <Button variant="ghost" size="sm"><Phone className="h-4 w-4" /></Button>
                            </ContactMenu>
                        </td>
                        <td className="p-3 hidden md:table-cell">{b.visit_date}</td>
                        <td className="p-3 hidden md:table-cell">{b.time_slot}</td>
                        <td className="p-3 hidden md:table-cell">{b.property_ids?.length || 0} properties</td>
                        <td className="p-3">
                          <Badge className={`${statusColors[b.status] || ""} font-body text-xs`}>{b.status}</Badge>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {b.status === "pending" && (
                              <>
                                <Button size="sm" variant="ghost" onClick={() => handleStatusChange(b.id, "confirmed")} className="text-xs font-body text-secondary" title="Approve & Add to Calendar">
                                  <CheckCircle className="h-4 w-4 mr-1" /> Approve
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => handleStatusChange(b.id, "cancelled")} className="text-xs font-body text-destructive">
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {b.status === "confirmed" && (
                              <>
                                <Button size="sm" variant="ghost" onClick={() => {
                                  const url = generateGoogleCalendarUrl({
                                    title: `Site Visit - ${b.name}`,
                                    date: b.visit_date,
                                    timeSlot: b.time_slot,
                                    description: `Customer: ${b.name}\nPhone: ${b.phone}`,
                                    location: "Rajkot, Gujarat",
                                  });
                                  window.open(url, "_blank");
                                }} className="text-xs font-body text-secondary" title="Add to Google Calendar">
                                  <CalendarPlus className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => handleStatusChange(b.id, "completed")} className="text-xs font-body text-green-600">Complete</Button>
                                <Button size="sm" variant="ghost" onClick={() => handleStatusChange(b.id, "cancelled")} className="text-xs font-body text-destructive">
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => handleDeleteBooking(b.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {bookings.length === 0 && (
                      <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No bookings yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="inquiries">
            <div className="bg-card rounded-lg shadow-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm font-body">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-3 text-muted-foreground">Name</th>
                      <th className="text-left p-3 text-muted-foreground">Phone</th>
                      <th className="text-left p-3 text-muted-foreground hidden md:table-cell">Location</th>
                      <th className="text-left p-3 text-muted-foreground hidden md:table-cell">Budget</th>
                      <th className="text-left p-3 text-muted-foreground hidden md:table-cell">Type</th>
                      <th className="text-left p-3 text-muted-foreground hidden lg:table-cell">Caste</th>
                      <th className="text-left p-3 text-muted-foreground">Status</th>
                      <th className="text-right p-3 text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inquiries.map((inq: any) => (
                      <tr key={inq.id} className={`border-t border-border hover:bg-muted/50 transition-colors ${inq.status === "new" ? "bg-blue-50/50" : ""}`}>
                        <td className="p-3 text-card-foreground font-medium">
                          {inq.name}
                          {inq.message && <div className="text-xs text-muted-foreground truncate max-w-[150px]">{inq.message}</div>}
                        </td>
                        <td className="p-3">
                            <ContactMenu phone={inq.phone} className="inline-block">
                              <Button variant="ghost" size="sm"><Phone className="h-4 w-4" /></Button>
                            </ContactMenu>
                        </td>
                        <td className="p-3 hidden md:table-cell text-muted-foreground">{inq.location || "-"}</td>
                        <td className="p-3 hidden md:table-cell text-muted-foreground">{inq.budget || "-"}</td>
                        <td className="p-3 hidden md:table-cell text-muted-foreground">{inq.property_type || "-"}</td>
                        <td className="p-3 hidden lg:table-cell text-muted-foreground">{inq.caste || "-"}</td>
                        <td className="p-3">
                          <Badge className={`${statusColors[inq.status] || ""} font-body text-xs`}>{inq.status}</Badge>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {inq.status === "new" && (
                              <Button size="sm" variant="ghost" onClick={() => handleInquiryStatus(inq.id, "contacted")} className="text-xs font-body text-secondary">
                                Contacted
                              </Button>
                            )}
                            {inq.status === "contacted" && (
                              <Button size="sm" variant="ghost" onClick={() => handleInquiryStatus(inq.id, "closed")} className="text-xs font-body text-green-600">
                                Close
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => handleDeleteInquiry(inq.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {inquiries.length === 0 && (
                      <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No inquiries yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="properties">
            <div className="bg-card rounded-lg shadow-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm font-body">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-3 text-muted-foreground">Title</th>
                      <th className="text-left p-3 text-muted-foreground hidden md:table-cell">Type</th>
                      <th className="text-left p-3 text-muted-foreground">Price</th>
                      <th className="text-left p-3 text-muted-foreground hidden md:table-cell">Status</th>
                      <th className="text-right p-3 text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {properties.map((p) => (
                      <tr key={p.id} className="border-t border-border hover:bg-muted/50 transition-colors">
                        <td className="p-3 text-card-foreground font-medium">{p.title}</td>
                        <td className="p-3 hidden md:table-cell"><Badge variant="outline" className="font-body text-xs">{p.type}</Badge></td>
                        <td className="p-3 text-secondary font-semibold">{formatPrice(p.price)}</td>
                        <td className="p-3 hidden md:table-cell"><Badge className="bg-secondary/10 text-secondary font-body text-xs">{p.status}</Badge></td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Link to="/properties"><Button size="sm" variant="ghost"><Eye className="h-4 w-4" /></Button></Link>
                            <Link to={`/edit-property/${p.id}`}><Button size="sm" variant="ghost"><Pencil className="h-4 w-4" /></Button></Link>
                            <Button size="sm" variant="ghost" onClick={() => handleDelete(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {properties.length === 0 && (
                      <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No properties yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
      <Footer />
    </div>
  );
};

export default Dashboard;
