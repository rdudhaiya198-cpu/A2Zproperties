import { useState, useEffect, useMemo } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PropertyCard from "@/components/PropertyCard";
import { db } from "@/integrations/firebase/client";
import { collection, query as fsQuery, orderBy as fsOrderBy, onSnapshot } from "firebase/firestore";

const Properties = () => {
  const [allProperties, setAllProperties] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // realtime listener so admin adds show immediately to users
    const col = collection(db, "properties");
    const q = fsQuery(col, fsOrderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const out: any[] = [];
      snap.forEach((d) => out.push({ id: d.id, ...d.data() }));
      setAllProperties(out);
      setLoading(false);
    }, (err) => {
      console.error("Properties listener error:", err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const locationOptions = useMemo(() => {
    const uniq = new Set<string>();
    allProperties.forEach((p) => {
      const loc = (p?.location || "").toString().trim();
      if (loc) uniq.add(loc);
    });
    return Array.from(uniq).sort((a, b) => a.localeCompare(b));
  }, [allProperties]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sortFeaturedFirst = (items: any[]) => {
      return [...items].sort((a, b) => {
        const aFeatured = Boolean(a?.is_featured ?? a?.isFeatured);
        const bFeatured = Boolean(b?.is_featured ?? b?.isFeatured);
        return Number(bFeatured) - Number(aFeatured);
      });
    };

    const matchSearch = (p: any) => {
      const title = (p.title || "").toString().toLowerCase();
      const loc = (p.location || "").toString().toLowerCase();
      return title.includes(q) || loc.includes(q);
    };

    const matchType = (p: any) => {
      if (typeFilter === "all") return true;
      const t = (p.type || "").toString().toLowerCase();
      if (typeFilter === "residential") return /flat|residential|apartment|house|bhk|studio/.test(t);
      if (typeFilter === "commercial") return /commercial|shop|office|retail/.test(t);
      if (typeFilter === "land") return /land|plot|site/.test(t);
      return true;
    };

    const matchLocation = (p: any) => {
      if (locationFilter === "all") return true;
      const loc = (p.location || "").toString().trim().toLowerCase();
      return loc === locationFilter.toLowerCase();
    };

    const matchStatus = (p: any) => {
      if (statusFilter === "all") return true;
      const s = (p.status || "").toString().toLowerCase();
      const isSell = /sold|sell|sale/.test(s);
      const isRent = /rent|rented|lease/.test(s);
      if (statusFilter === "sale") return isSell;
      if (statusFilter === "rent") return isRent;
      return true;
    };

    const matched = allProperties.filter((p) => matchSearch(p) && matchType(p) && matchLocation(p) && matchStatus(p));
    return sortFeaturedFirst(matched);
  }, [allProperties, search, typeFilter, locationFilter, statusFilter]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-10">
        <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-2">
          All <span className="text-secondary">Properties</span>
        </h1>
        <p className="text-muted-foreground font-body mb-8">Browse {allProperties.length} properties across Rajkot</p>

        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by title or location..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 font-body" />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-40 font-body">
              <SlidersHorizontal className="h-4 w-4 mr-2" /><SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent className="w-full sm:w-auto">
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="residential">Residential</SelectItem>
              <SelectItem value="commercial">Commercial</SelectItem>
              <SelectItem value="land">Land/Plot</SelectItem>
            </SelectContent>
          </Select>
          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger className="w-full sm:w-48 font-body"><SelectValue placeholder="Location" /></SelectTrigger>
            <SelectContent className="w-full sm:w-auto">
              <SelectItem value="all">All Locations</SelectItem>
              {locationOptions.map((loc) => (
                <SelectItem key={loc} value={loc}>{loc}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40 font-body"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent className="w-full sm:w-auto">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="sale">Sale</SelectItem>
              <SelectItem value="rent">Rent</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="text-center py-20 text-muted-foreground font-body">Loading properties...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground font-body">No properties found matching your filters.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((p, i) => (<PropertyCard key={p.id} property={p} index={i} />))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default Properties;