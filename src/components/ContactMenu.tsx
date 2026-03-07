import React from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";

function normalizeNumber(n?: string) {
  if (!n) return "";
  return n.replace(/[^0-9]/g, "");
}

export default function ContactMenu({ phone, children, className }: { phone?: string; children?: React.ReactNode; className?: string }) {
  const num = normalizeNumber(phone || "");
  const handleCall = () => {
    if (!num) return;
    window.location.href = `tel:${num}`;
  };
  const handleWhatsApp = () => {
    if (!num) return;
    const wa = `https://wa.me/${num}`;
    window.open(wa, "_blank");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className={className}>{children}</div>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={handleCall}>Call</DropdownMenuItem>
        <DropdownMenuItem onSelect={handleWhatsApp}>WhatsApp</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
