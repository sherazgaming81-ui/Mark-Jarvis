"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { BookingDialog } from "@/components/booking-dialog";
import { ChatWidget } from "@/components/chat-widget";
import { Brand, BrandMark, Contours, Icon, type IconName } from "@/components/icons";
import { Modal } from "@/components/modal";
import { business, faqs, projects, proofPoints, services, stats, steps } from "@/lib/site-data";
import { rv, useReveals, useScrollFx } from "@/lib/use-reveals";
import { CountUp } from "@/components/count-up";

const navigation = [
  { label: "Our services", href: "#services" },
  { label: "Why Aquifer Reach", href: "#why-aquifer" },
  { label: "How it works", href: "#process" },
  { label: "Our work", href: "#work" },
];

const promises: { icon: IconName; title: string; description: string }[] = [
  { icon: "shield", title: "Licensed and insured in Florida.", description: "Licensed, certified well contractors. The permits, the standards and the paperwork are handled by us — not passed on to you." },
  { icon: "home", title: "Family-owned and local since 2017.", description: "We live here, we drill here, and we know what Northeast Florida ground does. That knowledge goes into every depth and casing decision." },
  { icon: "check", title: "Satisfaction guaranteed on every job.", description: "Free on-site estimates with no obligation, modern equipment for efficient clean drilling, and a crew that stands behind what it leaves behind." },
];

export default function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingService, setBookingService] = useState("");
  const [selectedService, setSelectedService] = useState<(typeof services)[number] | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [legal, setLegal] = useState<"privacy" | "terms" | null>(null);
  const scrolled = useScrollFx();
  useReveals();

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [menuOpen]);

  function openBooking(service = "") {
    setSelectedService(null);
    setMenuOpen(false);
    setBookingService(service);
    setBookingOpen(true);
  }

  return <>
    <a href="#main-content" className="skip-link">Skip to content</a>
    <div id="top" />
    <header className={`site-header${scrolled ? " is-scrolled" : ""}`}>
      <div className="container header-inner">
        <Brand />
        <nav className="desktop-nav" aria-label="Main navigation">{navigation.map((item) => <a key={item.href} href={item.href}>{item.label}</a>)}</nav>
        <div className="header-actions"><a className="header-phone" href={business.phoneHref}><Icon name="phone" size={16} /><span>{business.phoneDisplay}</span></a><button className="button button-primary header-cta" onClick={() => openBooking()}><span className="desktop-label">Request a free estimate</span><span className="mobile-label">Estimate</span><Icon name="arrow-up-right" size={17} /></button><button className="menu-toggle icon-button" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen(!menuOpen)}><Icon name={menuOpen ? "close" : "menu"} size={24} /></button></div>
      </div>
      {menuOpen && <nav id="mobile-navigation" className="mobile-nav" aria-label="Mobile navigation">{navigation.map((item) => <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>{item.label}<Icon name="arrow-up-right" size={16} /></a>)}<a href="#faq" onClick={() => setMenuOpen(false)}>Questions, answered<Icon name="arrow-up-right" size={16} /></a><a href={business.phoneHref}><span><Icon name="phone" size={15} />{business.phoneDisplay}</span></a></nav>}
    </header>

    <main id="main-content">
      <section className="hero" aria-labelledby="hero-title">
        <div className="container hero-grid">
          <div className="hero-content">
            <p className="eyebrow eyebrow-line" {...rv(0)}>{business.name.toUpperCase()} · {business.region.toUpperCase()}</p>
            <h1 id="hero-title"><span {...rv(1)}>Your water.</span><span {...rv(2)}>Starts right</span><span className="text-blue" {...rv(3)}>here.</span></h1>
            <p className="hero-description" {...rv(4)}>Professional water well drilling, pump installation and maintenance for residential and commercial properties across Northeast Florida.</p>
            <div className="hero-actions" {...rv(5)}><button className="button button-primary" onClick={() => openBooking()}>Request your free estimate<Icon name="arrow-up-right" size={19} /></button><a href={business.phoneHref} className="process-link"><span className="play-circle"><Icon name="phone" size={13} /></span>Or call {business.phoneDisplay}</a></div>
            <div className="hero-reassurance" {...rv(6)}><Icon name="check" size={13} />No cost. No obligation. Straight answers from the rig.</div>
            <div className="hero-trust" {...rv(7)}><div className="avatar-stack">{projects.slice(1, 4).map((project) => <Image key={project.image} src={project.image} width={36} height={36} alt="" />)}</div><div><div className="hero-rating"><Icon name="shield" size={13} /><span><strong>{stats[0].value} years</strong> drilling {business.region}</span></div><p>{stats[1].value} wells drilled · licensed &amp; insured in the State of Florida.</p></div></div>
          </div>
          <div className="hero-visual" {...rv(2)}>
            <div className="hero-image"><Image src="/images/well-drilling-hero.jpg" alt="Two Aquifer Reach drilling rigs rigged up on a sand job site near Jacksonville, Florida" fill priority sizes="(max-width: 760px) 100vw, 50vw" /><div className="image-shade" /><span className="image-pill"><span />EXPERTS AT EVERY DEPTH</span><span className="image-caption">YOUR LAND.<br />OUR COMMITMENT.</span></div>
            <div className="hero-note"><span className="hero-note-icon"><Icon name="shield" size={27} /></span><div><strong>Deep roots. Higher standards.</strong><span>Good water. Done right. Since {business.established}.</span></div><span className="note-dot" /></div>
            <p className="photo-caption"><span />REAL WORK. FLORIDA GROUND.</p>
          </div>
        </div>
      </section>

      <section className="trust-bar" aria-label="Aquifer Reach at a glance">
        <div className="container trust-stats">
          <div className="trust-stat" {...rv(0)}><strong><CountUp to={8} suffix="+" aria-label="8+ years" /></strong><span>Years drilling<br />Northeast Florida</span></div>
          <div className="trust-stat" {...rv(1)}><strong><CountUp to={1000} suffix="s" aria-label="1,000s of wells" /></strong><span>Wells drilled for homes,<br />farms and businesses</span></div>
          <div className="trust-stat" {...rv(2)}><strong>Free</strong><span>On-site estimate.<br />No obligation at all.</span></div>
          <div className="trust-stat" {...rv(3)}><span className="stat-shield"><Icon name="shield" size={33} /></span><span><b>Licensed &amp; insured.</b><br />Certified Florida contractor.</span></div>
        </div>
      </section>

      <section id="services" className="section services-section" aria-labelledby="services-title">
        <div className="container">
          <div className="section-heading"><div {...rv(0)}><p className="eyebrow eyebrow-line">WHAT WE OFFER</p><h2 id="services-title">Every property is different.<br />Our commitment isn’t.</h2></div><p>From a single home to a commercial site,<br className="desktop-break" /> we go deeper to find the right solution.</p></div>
          <div className="services-grid">{services.map((service, index) => <article className="service-card" key={service.id} {...rv(index)}><div className="service-image"><Image src={service.image} alt={service.alt} fill sizes="(max-width: 760px) 100vw, 33vw" /><span className="service-number">{service.number} / OUR SERVICES</span></div><div className="service-content"><p className="service-category">{service.category}</p><h3>{service.title}</h3><p className="service-description">{service.description}</p><button className="service-link" onClick={() => setSelectedService(service)} aria-label={`Learn more about ${service.title.toLowerCase()}`}>{service.link}<span><Icon name="arrow-up-right" size={17} /></span></button></div></article>)}</div>
          <p className="services-footnote" {...rv(6)}><Icon name="shield" size={16} />Licensed in Florida. Permits handled. Built to last.</p>
        </div>
      </section>

      <section id="why-aquifer" className="difference-section" aria-labelledby="difference-title">
        <Contours className="difference-contours" />
        <div className="container difference-grid"><div className="difference-intro" {...rv(0)}><p className="eyebrow eyebrow-line">WHY CHOOSE US</p><h2 id="difference-title">Jacksonville’s most<br />trusted well<br /><span>drilling team.</span></h2><p>At {business.name}, we combine deep local knowledge of Florida’s aquifers with high-powered, tried-and-true equipment to tackle any drilling challenge. We’re proud to serve our fellow neighbours and Floridians across {business.region}.</p><ul className="proof-list">{proofPoints.map((point, index) => <li key={point} {...rv(index)}><Icon name="check" size={14} />{point}</li>)}</ul><div className="difference-signoff"><BrandMark /><span>More than a well.<br /><strong>A promise to do it right.</strong></span></div></div><div className="benefits">{promises.map((promise, index) => <div className="benefit" key={promise.title} {...rv(index)}><span className="benefit-icon"><Icon name={promise.icon} size={24} /></span><div><span className="benefit-number">0{index + 1} / OUR PROMISE</span><h3>{promise.title}</h3><p>{promise.description}</p></div></div>)}</div></div>
      </section>

      <section id="process" className="section process-section" aria-labelledby="process-title">
        <div className="container"><div className="center-heading" {...rv(0)}><p className="eyebrow">LESS GUESSWORK. MORE GOOD WATER.</p><h2 id="process-title">A simple start.<br />A well-informed decision.</h2><p>Big decisions feel smaller when you have the right people beside you.</p></div><div className="process-grid">{steps.map((step, index) => <article className="process-step" key={step.title} {...rv(index)}><div className="step-top"><span className="process-icon"><Icon name={step.icon} size={25} /></span><span className="step-line" /><span className="process-number">STEP 0{index + 1}</span></div><h3>{step.title}</h3><p>{step.description}</p></article>)}</div><div className="process-bottom"><button className="button button-primary" onClick={() => openBooking()}>Request my free estimate<Icon name="arrow-up-right" size={18} /></button><span><Icon name="clock" size={14} />Monday–Friday 8 am–6 pm · Saturday 8 am–12 pm</span></div></div>
      </section>

      <section id="work" className="reviews-section" aria-labelledby="work-title">
        <div className="container reviews-grid work-row"><div className="reviews-intro" {...rv(0)}><p className="eyebrow eyebrow-line">OUR WORK</p><h2 id="work-title">Real jobs.<br />Florida ground.</h2><p>Rigs up, casing in, water running. A look at recent drilling and pump work across Jacksonville and the surrounding communities.</p><div className="reviews-score"><strong>{stats[1].value}</strong><div><span>Licensed &amp; insured</span><span>Family-owned since {business.established}</span></div></div></div><div className="work-grid">{projects.map((project, index) => <figure className="work-tile" key={project.image} {...rv(index)}><Image src={project.image} alt={project.alt} fill sizes="(max-width: 760px) 100vw, 60vw" /><figcaption>{project.caption}</figcaption></figure>)}</div></div>
      </section>

      <section id="faq" className="section faq-section" aria-labelledby="faq-title"><div className="container faq-grid"><div {...rv(0)}><p className="eyebrow eyebrow-line">CLEAR ANSWERS. RIGHT HERE.</p><h2 id="faq-title">A few good<br />questions.</h2><p className="faq-intro">New to wells? You’re in good company.<br />Let’s get beneath the surface.</p><button className="inline-link" onClick={() => openBooking()}>Something not covered here? Ask us with your request<Icon name="arrow-up-right" size={16} /></button></div><div className="faq-list">{faqs.map((faq, index) => <article className={`faq-item ${openFaq === index ? "is-open" : ""}`} key={faq.question} {...rv(index)}><h3><button id={`faq-question-${index}`} aria-expanded={openFaq === index} aria-controls={`faq-answer-${index}`} onClick={() => setOpenFaq(openFaq === index ? null : index)}>{faq.question}<span><Icon name={openFaq === index ? "minus" : "plus"} size={17} /></span></button></h3><div id={`faq-answer-${index}`} role="region" aria-labelledby={`faq-question-${index}`} hidden={openFaq !== index}><p className="faq-answer">{faq.answer}</p></div></article>)}</div></div></section>

      <section className="final-cta" aria-labelledby="cta-title"><div className="container"><div className="cta-panel" {...rv(0)}><Contours className="cta-contours" /><div><p className="eyebrow">SERVING {business.region.toUpperCase()} SINCE {business.established}</p><h2 id="cta-title">Good water is closer<br />than you think.</h2></div><div className="cta-action"><button className="button button-white" onClick={() => openBooking()}>Request my free estimate<Icon name="arrow-up-right" size={19} /></button><p><Icon name="check" size={13} />On-site estimate. Zero obligation. Clear answers.</p></div></div></div></section>
    </main>

    <footer className="site-footer"><div className="container"><div className="footer-grid"><div className="footer-brand" {...rv(0)}><Brand /><p>Deep local knowledge. Honest work.<br />Good water for generations to come.</p><span className="footer-made"><span />FLORIDA GROUND. FLORIDA GRIT.</span></div><div className="footer-column" {...rv(1)}><h3>EXPLORE</h3>{navigation.slice(0, 3).map((item) => <a key={item.href} href={item.href}>{item.label}</a>)}<a href="#work">Our work</a><a href="#faq">FAQs</a></div><div className="footer-column" {...rv(2)}><h3>WHAT WE DO</h3>{services.map((service) => <button key={service.id} onClick={() => setSelectedService(service)}>{service.title}</button>)}<button onClick={() => openBooking()}>Free on-site estimates<Icon name="arrow-up-right" size={13} /></button></div><div className="footer-column footer-contact" {...rv(3)}><h3>LET’S TALK WATER</h3><a className="footer-phone" href={business.phoneHref}>{business.phoneDisplay}<Icon name="arrow-up-right" size={16} /></a><p className="footer-addr">{business.mailingAddress}<small>{business.mailingNote}</small></p><p className="footer-addr">{business.yardAddress}<small>{business.yardNote}</small></p>{business.hours.map((hour) => <p key={hour.days} className="footer-hours"><span>{hour.days}</span> {hour.time}</p>)}<button className="footer-book" onClick={() => openBooking()}>Request an estimate<Icon name="arrow-right" size={16} /></button></div></div><div className="footer-bottom"><p>© {new Date().getFullYear()} {business.name}. All rights reserved.</p><div><button onClick={() => setLegal("privacy")}>Privacy policy</button><button onClick={() => setLegal("terms")}>Terms of use</button><a href="#top">Back to top<Icon name="arrow-up-right" size={13} /></a></div></div><p className="site-legal-note">{business.name} is a licensed and insured well drilling contractor in the State of Florida. Yard visits are by appointment only. Well depths, yields and water quality vary by property and are confirmed on site during your free estimate.</p></div></footer>

    {bookingOpen && <BookingDialog initialService={bookingService} onClose={() => setBookingOpen(false)} />}
    <ChatWidget onBook={(serviceId) => openBooking(serviceId ?? "")} />
    {selectedService && <Modal onClose={() => setSelectedService(null)} labelledBy="service-dialog-title" className="service-modal"><div className="service-dialog-image"><Image src={selectedService.image} alt={selectedService.alt} fill sizes="680px" /></div><div className="service-dialog-content"><p className="eyebrow">{selectedService.category}</p><h2 id="service-dialog-title">{selectedService.title}</h2><p>{selectedService.detail}</p><h3>What working with us looks like</h3><ul>{selectedService.benefits.map((benefit) => <li key={benefit}><span><Icon name="check" size={14} /></span>{benefit}</li>)}</ul><button className="button button-primary" onClick={() => openBooking(selectedService.id)}>Request an estimate for this<Icon name="arrow-up-right" size={18} /></button><p className="service-dialog-note">Coverage, expected depth and site suitability are confirmed in person during your free estimate. No work begins until you approve a written estimate.</p></div></Modal>}
    {legal && <Modal onClose={() => setLegal(null)} labelledBy="legal-title" className="legal-modal"><p className="eyebrow">{business.name.toUpperCase()} · {legal === "privacy" ? "PRIVACY" : "TERMS"}</p><h2 id="legal-title">{legal === "privacy" ? "Your privacy matters." : "A few clear ground rules."}</h2>{legal === "privacy" ? <><p>The estimate request form collects only what we need to reply to you: name, email address, phone number, property ZIP code, the service you’re interested in, your preferred date and time, and any notes you choose to add.</p><h3>How your information is used</h3><p>Your request is used to contact you about your project and to prepare for the on-site visit. We do not sell it, share it with advertisers, or add you to a marketing list. This site carries no advertising trackers or analytics scripts.</p><h3>Where it is stored</h3><p>If the site owner has connected a lead inbox or storage service, requests are delivered there so a real person can follow up. Otherwise they are held only in the web server’s short-lived memory and disappear when it restarts. Please do not submit sensitive personal or financial information.</p><h3>Your choices</h3><p>Nothing is recorded until you press submit, and a partially completed form is never stored. To have a request deleted, call {business.phoneDisplay} and we will take care of it.</p></> : <><p>This website provides general information about {business.name} and the well drilling services we offer in {business.region}.</p><h3>Estimates, not contracts</h3><p>Anything you read or receive by email is an estimate of scope and cost, not a binding contract or a schedule. Work begins only after you approve a written estimate and any required permits are in place.</p><h3>Property-specific advice</h3><p>General information about wells is not a guarantee of water yield, quality, depth, cost, licensing or service availability. Every property is assessed on site, and Florida requires drilling by a licensed contractor under applicable permits.</p><h3>Availability</h3><p>Coverage and scheduling depend on crew availability, weather, ground conditions and city approvals. A submitted request confirms your interest, not a completed booking — we will call you to confirm the details.</p></>}<button className="button button-primary" onClick={() => setLegal(null)}>Got it<Icon name="check" size={17} /></button></Modal>}
  </>;
}
