import { Link } from "react-router-dom";
import { MapPin, BedDouble, Bath, Maximize, ZoomIn, ZoomOut, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from "@/components/ui/carousel";
import { formatPrice } from "@/lib/data";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import PropertyModal from "@/components/PropertyModal";
import React, { useState, useEffect, useRef } from "react";

interface PropertyData {
  id: string;
  title: string;
  type: string;
  status: string;
  price: number;
  area: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  location: string | null;
  is_featured: boolean | null;
}

interface Props {
  property: PropertyData;
  index?: number;
}

const PropertyCard = ({ property, index = 0 }: Props) => {
  const [imgError, setImgError] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const isPanningRef = useRef(false);
  const [isPanning, setIsPanning] = useState(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef<number | null>(null);
  const pinchStartPanXRef = useRef<number | null>(null);
  const pinchStartPanYRef = useRef<number | null>(null);
  const pinchCenterRef = useRef<{ x: number; y: number } | null>(null);
  const lastTapRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);

  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

  const getMaxPan = () => {
    const c = containerRef.current;
    const img = imgRef.current;
    if (!c || !img || !naturalSize) return { maxX: 0, maxY: 0 };
    const cw = c.clientWidth;
    const ch = c.clientHeight;
    const nw = naturalSize.w;
    const nh = naturalSize.h;
    // base fit scale (object-contain)
    const baseScale = Math.min(cw / nw, ch / nh);
    const baseW = nw * baseScale;
    const baseH = nh * baseScale;
    const scaledW = baseW * zoom;
    const scaledH = baseH * zoom;
    const maxX = Math.max(0, (scaledW - cw) / 2);
    const maxY = Math.max(0, (scaledH - ch) / 2);
    return { maxX, maxY };
  };

  const images: string[] = Array.isArray(property.images) && property.images.length > 0
    ? property.images
    : property.image_url
      ? [property.image_url]
      : [];

  const getImageSrc = (p: any) => {
    if (!p) return null;
    const candidates = [p.image_url, p.image, p.images?.[0], p.photos?.[0], p.photo_url, p.gallery?.[0]];
    for (const c of candidates) {
      if (c && typeof c === "string" && c.trim() !== "") return c;
    }
    return null;
  };

  const imgSrc = getImageSrc(property);

  // keyboard navigation for viewer must be a top-level hook (not conditional)
  useEffect(() => {
    if (!viewerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setViewerOpen(false);
      }
      if (e.key === 'ArrowLeft' && images.length > 1) {
        e.preventDefault();
        setViewerIndex((i) => (i - 1 + images.length) % images.length);
      }
      if (e.key === 'ArrowRight' && images.length > 1) {
        e.preventDefault();
        setViewerIndex((i) => (i + 1) % images.length);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewerOpen, images.length]);

  // reset zoom when opening viewer or changing image
  useEffect(() => {
    if (viewerOpen) setZoom(1);
    setPanX(0);
    setPanY(0);
    isPanningRef.current = false;
    setIsPanning(false);
  }, [viewerOpen, viewerIndex]);

  // clamp pan when zoom or measurements change
  useEffect(() => {
    const { maxX, maxY } = getMaxPan();
    setPanX((px) => clamp(px, -maxX, maxX));
    setPanY((py) => clamp(py, -maxY, maxY));
  }, [zoom, naturalSize]);

  return (
  <motion.div
    initial={{ opacity: 0, y: 24 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.08, duration: 0.5 }}
  >
    <div className="group">
      <div className="bg-card rounded-lg overflow-hidden shadow-card hover:shadow-card-hover transition-all duration-300 group-hover:-translate-y-1">
        <div className="relative h-48 bg-muted flex items-center justify-center overflow-hidden">
          {Array.isArray(property.images) && property.images.length > 1 ? (
            <Carousel className="h-full">
              <CarouselPrevious />
              <CarouselNext />
              <CarouselContent className="h-full">
                {property.images.map((src: string, i: number) => (
                  <CarouselItem key={i} className="h-48">
                    {src ? (
                      <img src={src} alt={`${property.title}-${i}`} className="w-full h-48 object-cover" loading="lazy" />
                    ) : (
                      <div className="h-48 bg-hero opacity-20 flex items-center justify-center text-muted-foreground">No image</div>
                    )}
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>
          ) : (imgSrc && !imgError ? (
            <img src={imgSrc} alt={property.title} className="absolute inset-0 w-full h-full object-cover" loading="lazy" onError={() => setImgError(true)} />
          ) : (
            <div className="absolute inset-0 bg-hero opacity-20 flex items-center justify-center text-muted-foreground">No image</div>
          ))}
          <div className="absolute top-1 left-1 sm:top-3 sm:left-3 flex gap-2 z-40">
            <Badge className="bg-secondary text-secondary-foreground font-body text-xs">{property.status}</Badge>
            <Badge variant="outline" className="bg-card/80 font-body text-xs">{property.type}</Badge>
          </div>
          {property.is_featured && (
            <Badge className="absolute top-3 right-3 bg-accent text-accent-foreground font-body text-xs">Featured</Badge>
          )}
          <div className="absolute bottom-3 left-3 bg-black/60 text-white px-3 py-1 rounded text-lg font-semibold">
            {formatPrice(property.price)}
          </div>
          {/* agent avatar overlay + view button */}
          <div className="absolute bottom-1 right-1 sm:bottom-3 sm:right-3 flex items-center gap-2 z-40">
            <button onClick={() => { setViewerIndex(0); setViewerOpen(true); }} className="bg-white/90 p-2 sm:p-2 rounded text-sm" aria-label="View images">
              <Maximize className="h-4 w-4" />
            </button>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full overflow-hidden bg-muted flex items-center justify-center">
              {property.agent_avatar ? (
                <img src={property.agent_avatar} alt={property.agent_name || 'ATOZ PROPERTIES'} className="w-full h-full object-cover" />
              ) : (
                <div className="text-xs text-muted-foreground">AZ</div>
              )}
            </div>
          </div>
        </div>
        <div className="p-4">
          <h3 className="font-display text-lg font-semibold text-card-foreground line-clamp-1 group-hover:text-secondary transition-colors">
            {property.title}
          </h3>
          {property.location && (
            <div className="flex items-center gap-1 mt-1 text-muted-foreground text-sm font-body">
              <MapPin className="h-3.5 w-3.5" /> {property.location}
            </div>
          )}
          <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground font-body">
            {property.bedrooms && (
              <span className="flex items-center gap-1"><BedDouble className="h-4 w-4" /> {property.bedrooms} BHK</span>
            )}
            {property.bathrooms && (
              <span className="flex items-center gap-1"><Bath className="h-4 w-4" /> {property.bathrooms}</span>
            )}
            {/* removed super built-up / area display as requested */}
          </div>
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
            <span className="text-lg font-display font-bold text-secondary">
              {formatPrice(property.price)}
              {property.status === "For Rent" && <span className="text-sm font-body text-muted-foreground">/mo</span>}
            </span>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
              <div className="text-sm text-muted-foreground">ATOZ PROPERTIES</div>
              <PropertyModal propertyId={property.id} trigger={<Button size="sm" variant="ghost" className="w-full sm:w-auto">Fully Detail</Button>} />
              <Link to={`/book?propertyId=${property.id}`}><Button size="sm" variant="outline" className="w-full sm:w-auto">Book Slot</Button></Link>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Image viewer modal (lightbox) */}
    {viewerOpen && images.length > 0 && (
      <motion.div className="fixed inset-0 z-50 flex items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <div className="absolute inset-0 bg-black/70" onClick={() => setViewerOpen(false)} />
        <motion.div className="relative z-10 mx-4 w-full max-w-5xl" initial={{ scale: 0.95 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }}>
          <div className="bg-black rounded-lg overflow-hidden shadow-2xl">
              <div className="relative">
              <div
                className={`w-full max-h-[80vh] bg-black rounded-md overflow-hidden`}
                ref={containerRef}
                style={{ touchAction: 'none', cursor: zoom > 1 ? (isPanning ? 'grabbing' : 'grab') : 'zoom-in' }}
                onWheel={(e) => {
                  if (e.ctrlKey) return; // allow browser zoom
                  if (!viewerOpen) return;
                  e.preventDefault();
                  const delta = -e.deltaY;
                  if (Math.abs(delta) < 1) return;
                  const step = 0.15;
                  if (delta > 0) setZoom((z) => Math.min(3, +(z + step).toFixed(2)));
                  else setZoom((z) => Math.max(1, +(z - step).toFixed(2)));
                }}
                onPointerDown={(e) => {
                  // start panning only for mouse/pointer when zoomed
                  if (zoom <= 1) return;
                  isPanningRef.current = true;
                  setIsPanning(true);
                  lastPosRef.current = { x: e.clientX, y: e.clientY };
                  try { (e.target as Element).setPointerCapture?.(e.pointerId); } catch {}
                }}
                onTouchStart={(e) => {
                  // record touch start for swipe detection (only when not zoomed)
                  if (e.touches.length === 2) {
                    // start pinch
                    const a = e.touches[0];
                    const b = e.touches[1];
                    const dx = b.clientX - a.clientX;
                    const dy = b.clientY - a.clientY;
                    pinchStartDistRef.current = Math.hypot(dx, dy);
                    pinchStartZoomRef.current = zoom;
                    pinchStartPanXRef.current = panX;
                    pinchStartPanYRef.current = panY;
                    // center in container coordinates
                    const rect = containerRef.current?.getBoundingClientRect();
                    if (rect) {
                      pinchCenterRef.current = { x: (a.clientX + b.clientX) / 2 - rect.left, y: (a.clientY + b.clientY) / 2 - rect.top };
                    } else pinchCenterRef.current = null;
                    // clear single-touch swipe start
                    touchStartRef.current = null;
                    return;
                  }
                  if (zoom > 1) return;
                  const t = e.touches[0];
                  touchStartRef.current = { x: t.clientX, y: t.clientY };
                }}
                onTouchMove={(e) => {
                  if (e.touches.length === 2 && pinchStartDistRef.current && pinchStartZoomRef.current) {
                    // pinch-to-zoom
                    const a = e.touches[0];
                    const b = e.touches[1];
                    const dx = b.clientX - a.clientX;
                    const dy = b.clientY - a.clientY;
                    const dist = Math.hypot(dx, dy);
                    const startDist = pinchStartDistRef.current;
                    if (startDist === 0) return;
                    const scale = dist / startDist;
                    const newZoom = Math.max(1, Math.min(3, +(pinchStartZoomRef.current! * scale).toFixed(3)));
                    // adjust pan so the pinch center stays focused
                    const rect = containerRef.current?.getBoundingClientRect();
                    const center = pinchCenterRef.current;
                    const startPanX = pinchStartPanXRef.current ?? 0;
                    const startPanY = pinchStartPanYRef.current ?? 0;
                    if (rect && center) {
                      const ratio = newZoom / (pinchStartZoomRef.current ?? 1);
                      const cx = center.x;
                      const cy = center.y;
                      const candidateX = ratio * startPanX + (1 - ratio) * cx;
                      const candidateY = ratio * startPanY + (1 - ratio) * cy;
                      const { maxX, maxY } = getMaxPan();
                      setPanX(clamp(candidateX, -maxX, maxX));
                      setPanY(clamp(candidateY, -maxY, maxY));
                    }
                    setZoom(newZoom);
                    e.preventDefault();
                  }
                }}
                onTouchCancel={() => {
                  pinchStartDistRef.current = null;
                  pinchStartZoomRef.current = null;
                  pinchStartPanXRef.current = null;
                  pinchStartPanYRef.current = null;
                  pinchCenterRef.current = null;
                  touchStartRef.current = null;
                }}
                onTouchEnd={(e) => {
                  // if a pinch was active, clear pinch state
                  if (pinchStartDistRef.current) {
                    pinchStartDistRef.current = null;
                    pinchStartZoomRef.current = null;
                    pinchStartPanXRef.current = null;
                    pinchStartPanYRef.current = null;
                    pinchCenterRef.current = null;
                    touchStartRef.current = null;
                    return;
                  }
                  // double-tap to reset on small devices
                  if (typeof window !== 'undefined' && window.innerWidth < 640) {
                    const now = Date.now();
                    if (lastTapRef.current && (now - lastTapRef.current) < 300) {
                      // double tap detected -> reset
                      setZoom(1);
                      setPanX(0);
                      setPanY(0);
                      lastTapRef.current = null;
                      touchStartRef.current = null;
                      e.preventDefault?.();
                      return;
                    }
                    lastTapRef.current = now;
                  }
                  if (zoom > 1) return;
                  if (!touchStartRef.current) return;
                  // Only enable swipe on small screens
                  if (typeof window !== 'undefined' && window.innerWidth >= 640) {
                    touchStartRef.current = null;
                    return;
                  }
                  const t = e.changedTouches[0];
                  const dx = t.clientX - touchStartRef.current.x;
                  const dy = t.clientY - touchStartRef.current.y;
                  touchStartRef.current = null;
                  const absX = Math.abs(dx);
                  const absY = Math.abs(dy);
                  const threshold = 50; // px
                  if (absX > threshold && absX > absY) {
                    if (dx < 0 && images.length > 1) {
                      // swipe left -> next
                      setViewerIndex((i) => (i + 1) % images.length);
                    } else if (dx > 0 && images.length > 1) {
                      // swipe right -> prev
                      setViewerIndex((i) => (i - 1 + images.length) % images.length);
                    }
                  }
                }}
                onPointerMove={(e) => {
                  if (!isPanningRef.current || !lastPosRef.current) return;
                  const dx = e.clientX - lastPosRef.current.x;
                  const dy = e.clientY - lastPosRef.current.y;
                  lastPosRef.current = { x: e.clientX, y: e.clientY };
                  const { maxX, maxY } = getMaxPan();
                  setPanX((px) => clamp(px + dx, -maxX, maxX));
                  setPanY((py) => clamp(py + dy, -maxY, maxY));
                }}
                onPointerUp={(e) => {
                  if (!isPanningRef.current) return;
                  isPanningRef.current = false;
                  setIsPanning(false);
                  lastPosRef.current = null;
                  try { (e.target as Element).releasePointerCapture?.(e.pointerId); } catch {}
                }}
                onPointerCancel={() => { isPanningRef.current = false; setIsPanning(false); lastPosRef.current = null; }}
              >
                <img
                  ref={imgRef}
                  src={images[viewerIndex]}
                  alt={`property-view-${viewerIndex}`}
                  className="w-full object-contain"
                  onLoad={(e) => {
                    const el = e.currentTarget;
                    if (el && el.naturalWidth && el.naturalHeight) setNaturalSize({ w: el.naturalWidth, h: el.naturalHeight });
                  }}
                  style={{ transform: `translate(${panX}px, ${panY}px) scale(${zoom})`, transformOrigin: 'center', transition: isPanning ? 'none' : 'transform 120ms', cursor: zoom > 1 ? (isPanning ? 'grabbing' : 'grab') : 'zoom-in' }}
                />
              </div>
              <div className="absolute left-4 bottom-4 bg-black/60 text-white px-3 py-2 rounded-md z-40">
                <div className="text-sm font-semibold">{property.title}</div>
                <div className="text-xs opacity-80">Image {viewerIndex + 1} of {images.length}</div>
              </div>
              <div className="hidden sm:flex absolute top-1 left-1 sm:top-3 sm:left-3 flex items-center gap-2 z-50">
                <button onClick={() => setZoom((z) => Math.max(1, +(z - 0.25).toFixed(2)))} className="bg-white/90 text-black p-2 rounded shadow"> <ZoomOut className="h-4 w-4" /></button>
                <button onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))} className="bg-white/90 text-black p-2 rounded shadow"> <ZoomIn className="h-4 w-4" /></button>
                <button onClick={() => { setZoom(1); setPanX(0); setPanY(0); setIsPanning(false); }} className="bg-white/90 text-black p-2 rounded shadow"> <RefreshCw className="h-4 w-4" /></button>
              </div>
              <div className="absolute left-4 bottom-4 bg-black/60 text-white px-3 py-2 rounded-md">
                <div className="text-sm font-semibold">{property.title}</div>
                <div className="text-xs opacity-80">Image {viewerIndex + 1} of {images.length}</div>
              </div>
              <button onClick={() => setViewerOpen(false)} className="absolute top-1 right-1 sm:top-3 sm:right-3 bg-white/90 text-black px-2 py-1 rounded text-sm z-50">Close</button>
              {images.length > 1 && (
                  <>
                  <button onClick={() => setViewerIndex((i) => (i - 1 + images.length) % images.length)} className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 bg-white/90 text-black px-4 py-2 rounded-full shadow">‹</button>
                  <button onClick={() => setViewerIndex((i) => (i + 1) % images.length)} className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 bg-white/90 text-black px-4 py-2 rounded-full shadow">›</button>
                </>
              )}
            </div>
            {images.length > 1 && (
              <div className="hidden sm:flex items-center gap-2 p-3 bg-gradient-to-t from-black/60 to-transparent">
                <div className="flex gap-2 overflow-x-auto w-full py-1">
                  {images.map((thumb, ti) => (
                    <button key={ti} onClick={() => setViewerIndex(ti)} className={`flex-none rounded-md overflow-hidden border ${ti === viewerIndex ? 'border-rose-500' : 'border-transparent'} hover:scale-105 transition-transform`}>
                      <img src={thumb} alt={`thumb-${ti}`} className="w-20 h-12 object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    )}

    {/* keyboard navigation handled via top-level useEffect */}

  </motion.div>
  );
};

export default PropertyCard;
