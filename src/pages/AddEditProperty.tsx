import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { db, storage } from "@/integrations/firebase/client";
import { collection, addDoc, setDoc, doc as fsDoc, getDoc as fsGetDoc, serverTimestamp } from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";

const defaultForm = {
  title: "", type: "Flat", status: "For Sale",
  listed_by: "ATOZ PROPERTIES",
  furnishing: "-",
  bachelors_allowed: "-",
  price: 0, area: 0, bedrooms: 0, bathrooms: 0,
  location: "", address: "", description: "", features: [] as string[],
  image_url: "", images: [] as string[], is_featured: false,
};

const AddEditProperty = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [form, setForm] = useState({ ...defaultForm });
  const [featureInput, setFeatureInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [tempPreviews, setTempPreviews] = useState<string[]>([]);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(!!id);
  const isEdit = !!id;

  useEffect(() => {
    if (id) {
      // Read property from Firestore
      (async () => {
        try {
          const docRef = fsDoc(db, "properties", id);
          const snap = await fsGetDoc(docRef);
          if (snap.exists()) {
            const d = snap.data();
            setForm({
              title: d.title || "",
              type: d.type || "Flat",
              status: d.status || "For Sale",
              listed_by: d.listed_by || "OWNER",
              furnishing: d.furnishing ?? "-",
              bachelors_allowed: d.bachelors_allowed ?? d.bachelorsAllowed ?? "-",
              price: d.price || 0,
              area: d.area || 0,
              bedrooms: d.bedrooms || 0,
              bathrooms: d.bathrooms || 0,
              location: d.location || "",
              address: d.address || "",
              description: d.description || "",
              features: d.features || [],
              image_url: d.image_url || "",
              images: d.images || [],
              is_featured: d.is_featured || false,
            });
          }
        } catch (err) {
          console.warn("Failed to read Firestore property", err);
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [id]);

  // Upload helper to Firebase Storage fallback
  const uploadToFirebase = async (file: File) => {
    if (!storage) throw new Error('Firebase Storage not configured');
    const path = `properties/${Date.now()}_${file.name}`;
    const ref = storageRef(storage, path);
    return await new Promise<string>((resolve, reject) => {
      const uploadTask = uploadBytesResumable(ref, file);
      uploadTask.on('state_changed', (snapshot) => {
        if (snapshot.totalBytes) {
          const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(Math.round(p));
        }
      }, (err) => {
        reject(err);
      }, async () => {
        try {
          const url = await getDownloadURL(ref);
          resolve(url);
        } catch (e) {
          reject(e);
        }
      });
    });
  };

  // Accept FileList or single File; if replaceIndex provided, replace that image
  const handleFileChange = async (files?: FileList | null, replaceIdx?: number | null) => {
    if (!files || files.length === 0) return;
    // show local previews immediately
    const localUrls: string[] = [];
    for (let i = 0; i < files.length; i++) localUrls.push(URL.createObjectURL(files[i]));
    setTempPreviews((p) => [...p, ...localUrls]);

    try {
      setUploading(true);
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress(0);
        // first try functions/Cloudinary
        const inferredLocal = (typeof window !== 'undefined' && window.location && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
          ? `${window.location.protocol}//${window.location.hostname}:3000`
          : undefined;
        const fnUrl = (import.meta.env.VITE_FUNCTIONS_URL || inferredLocal || "/api").replace(/\/$/, "");
        const url = `${fnUrl}/uploadImage`;

        const uploadedUrl = await new Promise<string>(async (resolve, reject) => {
          try {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', url);
            xhr.onload = () => {
              try {
                if (xhr.status >= 200 && xhr.status < 300) {
                  const body = JSON.parse(xhr.responseText);
                  const returned = body?.secure_url || body?.url || body?.image?.url || body?.image?.secure_url || body?.image?.secureUrl;
                  if (returned) { resolve(returned); return; }
                  return reject(new Error('Missing url in functions response'));
                }
                // non-2xx -> fallback to firebase
                return reject(new Error(`Functions responded ${xhr.status}`));
              } catch (e) { return reject(e); }
            };
            xhr.onerror = () => reject(new Error('Network error to functions endpoint'));
            if (xhr.upload && typeof xhr.upload.addEventListener === 'function') {
              xhr.upload.addEventListener('progress', (ev: ProgressEvent) => {
                if (ev.lengthComputable) setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
              });
            }
            const fd = new FormData(); fd.append('image', file, file.name);
            xhr.send(fd);
          } catch (e) { reject(e); }
        }).catch(async () => {
          // functions failed -> try firebase storage fallback
          try {
            const fb = await uploadToFirebase(file);
            return fb;
          } catch (e) {
            throw e;
          }
        });

        // update form images
        setForm((prev) => {
          const imgs = Array.isArray(prev.images) ? [...prev.images] : [];
          if (typeof replaceIdx === 'number') imgs[replaceIdx] = uploadedUrl;
          else imgs.push(uploadedUrl);
          return { ...prev, images: imgs, image_url: imgs[0] || prev.image_url } as any;
        });
      }
    } catch (err) {
      console.error('Upload error', err);
      toast({ title: 'Upload failed', description: String(err), variant: 'destructive' });
    } finally {
      setUploading(false);
      setUploadProgress(null);
      // revoke local previews after short delay
      setTimeout(() => { tempPreviews.forEach((u) => URL.revokeObjectURL(u)); setTempPreviews([]); }, 2000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploading) {
      toast({ title: "Upload in progress", description: "Please wait for image upload to finish before saving.", variant: "destructive" });
      return;
    }
    if (!form.title || !form.location || !form.price) {
      toast({ title: "Fill required fields", variant: "destructive" });
      return;
    }
    const payload = {
      title: form.title,
      type: form.type,
      listed_by: (form as any).listed_by || 'OWNER',
      furnishing: (form as any).furnishing || '-',
      bachelors_allowed: (form as any).bachelors_allowed || '-',
      status: form.status,
      price: form.price,
      area: form.area || null,
      bedrooms: form.bedrooms || null,
      bathrooms: form.bathrooms || null,
      location: form.location,
      address: form.address || null,
      description: form.description || null,
      features: form.features,
      image_url: form.image_url || (form.images && form.images[0]) || null,
      images: form.images || [],
      is_featured: form.is_featured,
    };

      try {
      if (!db) {
        toast({ title: "Configuration error", description: "Firebase not configured. Set VITE_FIREBASE_* env vars.", variant: "destructive" });
        return;
      }
      if (isEdit && id) {
        // Update Firestore document (will create if not exists)
        await setDoc(fsDoc(db, "properties", id), {
          ...payload,
          updatedAt: serverTimestamp(),
        }, { merge: true });
        toast({ title: "Property Updated!" });
      } else {
        // Create a new Firestore document
        const col = collection(db, "properties");
        await addDoc(col, { ...payload, createdAt: serverTimestamp() });
        toast({ title: "Property Added!" });
      }
      navigate("/dashboard");
    } catch (err: any) {
      console.error("Failed to save property:", err);
      toast({ title: "Error saving property", description: String(err.message || err), variant: "destructive" });
    }
  };

  const addFeature = () => {
    if (featureInput.trim()) {
      setForm({ ...form, features: [...form.features, featureInput.trim()] });
      setFeatureInput("");
    }
  };

  const removeFeature = (idx: number) => {
    setForm({ ...form, features: form.features.filter((_, i) => i !== idx) });
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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground font-body text-sm mb-6">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <h1 className="text-2xl font-display font-bold text-foreground mb-6">
          {isEdit ? "Edit" : "Add New"} <span className="text-secondary">Property</span>
        </h1>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label className="font-body">Title *</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="font-body" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="font-body">Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger className="font-body"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Flat", "Residential", "Commercial", "Plot", "Shop", "Office"].map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="font-body">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className="font-body"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="For Sale">For Sale</SelectItem>
                  <SelectItem value="For Rent">For Rent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="font-body">Listed By</Label>
            <Select value={(form as any).listed_by} onValueChange={(v) => setForm({ ...form, listed_by: v })}>
              <SelectTrigger className="font-body"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="OWNER">OWNER</SelectItem>
                <SelectItem value="BROKER">BROKER</SelectItem>
                <SelectItem value="AGENT">AGENT</SelectItem>
                <SelectItem value="BUILDER">BUILDER</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="font-body">Price (₹) *</Label>
              <Input type="number" value={form.price || ""} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} className="font-body" />
            </div>
            <div>
              <Label className="font-body">Area (sq.ft)</Label>
              <Input type="number" value={form.area || ""} onChange={(e) => setForm({ ...form, area: Number(e.target.value) })} className="font-body" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="font-body">Furnishing</Label>
              <Select value={(form as any).furnishing} onValueChange={(v) => setForm({ ...form, furnishing: v })}>
                <SelectTrigger className="font-body"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="-">-</SelectItem>
                  <SelectItem value="Furnished">Furnished</SelectItem>
                  <SelectItem value="Semi-Furnished">Semi-Furnished</SelectItem>
                  <SelectItem value="Unfurnished">Unfurnished</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="font-body">Bachelors Allowed</Label>
              <Select value={(form as any).bachelors_allowed} onValueChange={(v) => setForm({ ...form, bachelors_allowed: v })}>
                <SelectTrigger className="font-body"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="-">-</SelectItem>
                  <SelectItem value="Yes">Yes</SelectItem>
                  <SelectItem value="No">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="font-body">Bedrooms</Label>
              <Input type="number" value={form.bedrooms || ""} onChange={(e) => setForm({ ...form, bedrooms: Number(e.target.value) })} className="font-body" />
            </div>
            <div>
              <Label className="font-body">Bathrooms</Label>
              <Input type="number" value={form.bathrooms || ""} onChange={(e) => setForm({ ...form, bathrooms: Number(e.target.value) })} className="font-body" />
            </div>
          </div>

          <div>
            <Label className="font-body">Location *</Label>
            <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="font-body" />
          </div>
          <div>
            <Label className="font-body">Full Address</Label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="font-body" />
          </div>
          <div>
            <Label className="font-body">Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="font-body" rows={4} />
          </div>

          <div>
            <Label className="font-body">Features & Amenities</Label>
            <div className="flex gap-2 mt-1">
              <Input value={featureInput} onChange={(e) => setFeatureInput(e.target.value)} placeholder="e.g. Modular Kitchen" className="font-body"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addFeature(); } }} />
              <Button type="button" variant="outline" onClick={addFeature} className="font-body">Add</Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {form.features.map((f, i) => (
                <span key={i} className="bg-muted text-muted-foreground text-xs font-body px-2 py-1 rounded-full flex items-center gap-1">
                  {f} <button type="button" onClick={() => removeFeature(i)} className="hover:text-destructive">×</button>
                </span>
              ))}
            </div>
          </div>

          <div>
            <Label className="font-body">Images</Label>
            <div className="mt-2">
              <div className="flex flex-wrap gap-2 mb-3">
                {(form.images || []).map((src, i) => (
                  <div key={i} className="relative w-32 h-20 bg-muted rounded overflow-hidden">
                    <img src={src} alt={`img-${i}`} className="w-full h-full object-cover" />
                    <div className="absolute top-1 right-1 flex gap-1">
                      <button type="button" onClick={() => { setReplaceIndex(i); replaceInputRef.current?.click(); }} className="bg-white/80 text-xs px-1 rounded">Replace</button>
                      <button type="button" onClick={() => setForm({ ...form, images: form.images.filter((_, idx) => idx !== i), image_url: (i === 0 ? (form.images[1] || '') : form.image_url) })} className="bg-white/80 text-xs px-1 rounded">Remove</button>
                    </div>
                  </div>
                ))}
                {tempPreviews.map((src, i) => (
                  <div key={`tmp-${i}`} className="w-32 h-20 bg-muted rounded overflow-hidden border-dashed border">
                    <img src={src} alt={`tmp-${i}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>

              <input type="file" accept="image/*" multiple onChange={(e) => handleFileChange(e.target.files)} />
              <input ref={(el) => { replaceInputRef.current = el; }} type="file" accept="image/*" onChange={(e) => {
                if (!e.target.files) return; if (replaceIndex === null) return; handleFileChange(e.target.files, replaceIndex); setReplaceIndex(null);
              }} style={{ display: 'none' }} />

              {uploading && uploadProgress !== null ? (
                <div className="text-sm text-muted-foreground">Uploading: {uploadProgress}%</div>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={form.is_featured} onCheckedChange={(v) => setForm({ ...form, is_featured: v })} />
            <Label className="font-body">Featured Property</Label>
          </div>

          <Button type="submit" disabled={uploading} className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 font-body text-base">
            {uploading ? `Uploading... ${uploadProgress ?? 0}%` : (isEdit ? "Update Property" : "Add Property")}
          </Button>
        </form>
      </div>
      <Footer />
    </div>
  );
};

export default AddEditProperty;
