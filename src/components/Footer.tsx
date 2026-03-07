import { Building2, Phone, MapPin, Mail } from "lucide-react";
import { PHONE_NUMBER } from "@/lib/data";
import ContactMenu from "@/components/ContactMenu";
import { Button } from "@/components/ui/button";

const Footer = () => (
  <footer className="bg-primary text-primary-foreground">
    <div className="container mx-auto px-4 py-12">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="h-7 w-7 text-secondary" />
            <span className="text-xl font-display font-bold">A TO Z Properties</span>
          </div>
          <p className="text-primary-foreground/70 font-body text-sm leading-relaxed">
            Your trusted real estate partner in Rajkot. We help you find the perfect property — from flats and bungalows to commercial spaces and plots.
          </p>
        </div>
        <div>
          <h4 className="text-secondary font-display text-lg font-semibold mb-4">Quick Links</h4>
          <ul className="space-y-2 font-body text-sm text-primary-foreground/70">
            <li><a href="/" className="hover:text-secondary transition-colors">Home</a></li>
            <li><a href="/properties" className="hover:text-secondary transition-colors">All Properties</a></li>
            <li><a href="/dashboard" className="hover:text-secondary transition-colors">Dashboard</a></li>
          </ul>
        </div>
        <div>
          <h4 className="text-secondary font-display text-lg font-semibold mb-4">Contact Us</h4>
          <ul className="space-y-3 font-body text-sm text-primary-foreground/70">
            <li className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-secondary" />
              <ContactMenu phone={PHONE_NUMBER} className="inline-block hover:text-secondary transition-colors">
                <Button variant="ghost">{PHONE_NUMBER}</Button>
              </ContactMenu>
            </li>
            <li className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-secondary" />
              Rajkot, Gujarat, India
            </li>
            <li className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-secondary" />
              <a href="mailto:atozpropertiesrajkot@gmail.com" className="hover:text-secondary transition-colors">
                atozpropertiesrajkot@gmail.com
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-primary-foreground/10 mt-8 pt-6 text-center text-xs text-primary-foreground/50 font-body">
        © {new Date().getFullYear()} A TO Z Properties, Rajkot. All rights reserved.
        <div className="mt-2 text-primary-foreground/70">Developed by Rachit Dudhaiya</div>
      </div>
    </div>
  </footer>
);

export default Footer;
