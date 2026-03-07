import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, Phone, Building2, LogIn, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import ContactMenu from "@/components/ContactMenu";
import { PHONE_NUMBER } from "@/lib/data";
import { useAuth } from "@/hooks/useAuth";

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin, signOut } = useAuth();

  const navLinks = [
    { to: "/", label: "Home" },
    { to: "/about", label: "About" },
    { to: "/properties", label: "Properties" },
    { to: "/inquiry", label: "Quick Inquiry" },
    ...(user ? [{ to: "/my-bookings", label: "My Bookings" }] : []),
    ...(isAdmin ? [{ to: "/dashboard", label: "Dashboard" }] : []),
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    setLogoError(false);
  }, []);

  return (
    <nav className="sticky top-0 z-50 bg-primary shadow-lg">
      <div className="container mx-auto flex items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          {!logoError ? (
            <img src="/logo.png" alt="A TO Z Properties" className="h-10 w-auto object-contain" onError={() => setLogoError(true)} />
          ) : (
            <>
              <Building2 className="h-8 w-8 text-secondary" />
              <div>
                <span className="text-xl font-display font-bold text-primary-foreground">A TO Z</span>
                <span className="ml-1 text-sm font-body text-secondary">Properties</span>
              </div>
            </>
          )}
        </Link>

        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`font-body text-sm font-medium transition-colors hover:text-secondary ${
                location.pathname === link.to ? "text-secondary" : "text-primary-foreground/80"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <ContactMenu phone={PHONE_NUMBER} className="inline-block">
            <Button size="sm" variant="outline" className="bg-transparent border-primary-foreground/30 text-primary-foreground font-body">
              <Phone className="h-4 w-4 mr-1" /> Call
            </Button>
          </ContactMenu>
          {user ? (
            <Button size="sm" variant="ghost" onClick={handleSignOut} className="text-primary-foreground/80 hover:text-primary-foreground font-body">
              <LogOut className="h-4 w-4 mr-1" /> Sign Out
            </Button>
          ) : (
            <Link to="/auth">
              <Button size="sm" variant="ghost" className="text-primary-foreground/80 hover:text-primary-foreground font-body">
                <LogIn className="h-4 w-4 mr-1" /> Sign In
              </Button>
            </Link>
          )}
        </div>

        <button className="md:hidden text-primary-foreground" onClick={() => setOpen(!open)}>
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden bg-primary border-t border-sidebar-border px-4 pb-4">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setOpen(false)}
              className={`block py-2 font-body text-sm transition-colors ${
                location.pathname === link.to ? "text-secondary" : "text-primary-foreground/80"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <ContactMenu phone={PHONE_NUMBER} className="block mt-2">
            <Button size="sm" variant="outline" className="w-full bg-transparent border-primary-foreground/30 text-primary-foreground font-body">
              <Phone className="h-4 w-4 mr-1" /> Call <span className="ml-2">{PHONE_NUMBER}</span>
            </Button>
          </ContactMenu>
          {user ? (
            <Button size="sm" variant="ghost" onClick={() => { handleSignOut(); setOpen(false); }}
              className="w-full mt-2 text-primary-foreground/80 hover:text-primary-foreground font-body">
              <LogOut className="h-4 w-4 mr-1" /> Sign Out
            </Button>
          ) : (
            <Link to="/auth" onClick={() => setOpen(false)} className="block mt-2">
              <Button size="sm" variant="ghost" className="w-full text-primary-foreground/80 hover:text-primary-foreground font-body">
                <LogIn className="h-4 w-4 mr-1" /> Sign In
              </Button>
            </Link>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
