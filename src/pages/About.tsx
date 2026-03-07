import React from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function About() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-16 max-w-3xl">
        <h1 className="text-3xl md:text-4xl font-display font-bold mb-4">Our Legacy</h1>

        <blockquote className="border-l-4 border-secondary pl-4 italic text-lg text-muted-foreground mb-6">
          "Your property journey, from A to Z, is our responsibility."
        </blockquote>

        <p className="text-base text-foreground leading-relaxed mb-4">
          Founded on principles of transparency, A To Z Properties has been a cornerstone of Rajkot real
          estate for 18 years. Based at Goverdhan Chowk, we manage everything from student housing at
          Atmiya University to luxury hospitality deals in Ahmedabad and Mumbai.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-2">Our Mission</h2>
        <p className="text-base text-foreground leading-relaxed mb-4">
          To provide transparent, tech-driven real estate
          consultancy with 100% integrity.
        </p>

        <h2 className="text-2xl font-semibold mt-6 mb-2">Our Vision</h2>
        <p className="text-base text-foreground leading-relaxed">
          To be the most trusted property brand in Gujarat
          through wisdom and innovation.
        </p>
      </div>
      <Footer />
    </div>
  );
}
