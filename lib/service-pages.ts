import type { LPIconName } from "@/components/LPIcon";
import { PAGE_BANNER_IMAGES } from "@/lib/images";

export type ServicePoint = {
  icon: LPIconName;
  title: string;
  text: string;
};

export type ServiceStep = {
  title: string;
  text: string;
};

export type ServiceFaq = {
  question: string;
  answer: string;
};

export type ServiceCta = {
  label: string;
  href: string;
};

export type ServiceDetailPageData = {
  href: string;
  slug: string;
  eyebrow: string;
  title: string;
  heroTitle: string;
  heroText: string;
  image: string;
  introTitle: string;
  introText: string;
  benefits: ServicePoint[];
  process: ServiceStep[];
  whyTitle: string;
  whyLead: string;
  why: ServicePoint[];
  faqs: ServiceFaq[];
  primaryCta: ServiceCta;
  secondaryCta?: ServiceCta;
  ctaTitle: string;
  ctaText: string;
  seoTitle: string;
  seoDescription: string;
  keywords: string[];
};

export const SERVICE_DETAIL_PAGES: ServiceDetailPageData[] = [
  {
    href: "/landlord-services/property-letting",
    slug: "property-letting",
    eyebrow: "For Landlords",
    title: "Property Letting",
    heroTitle: "Let your property with confidence, speed, and proper compliance.",
    heroText:
      "A complete property letting service for London and Birmingham landlords, covering valuation, marketing, viewings, tenant checks, tenancy paperwork, and move-in.",
    image: PAGE_BANNER_IMAGES.propertyLetting,
    introTitle: "A better route from empty property to reliable tenancy.",
    introText:
      "Letting Partners combines careful pricing, professional presentation, and structured tenant qualification so your property reaches the right renters quickly without cutting corners on compliance.",
    benefits: [
      { icon: "trending", title: "Market-led rental valuation", text: "We assess demand, local comparables, property condition, and tenant profile before recommending a rental figure." },
      { icon: "sparkles", title: "Polished property marketing", text: "Clear descriptions, strong imagery, and portal-ready copy position your rental correctly from day one." },
      { icon: "clipboard", title: "Tenant checks handled", text: "Referencing, Right to Rent checks, affordability review, and move-in documentation are coordinated carefully." },
      { icon: "shield", title: "Compliance-first letting", text: "Deposit protection, prescribed information, safety documents, and tenancy paperwork are kept front and centre." },
    ],
    process: [
      { title: "Value and prepare", text: "We review the property, advise on presentation, confirm compliance documents, and agree the correct rental strategy." },
      { title: "Launch and qualify", text: "Your property is promoted to active applicants and portals, with enquiries filtered against budget, timing, and suitability." },
      { title: "View and reference", text: "We arrange viewings, manage offers, complete referencing, and keep you updated before any tenancy is agreed." },
      { title: "Sign and move in", text: "The AST, deposit protection, inventory arrangements, and key handover are coordinated into a clean move-in." },
    ],
    whyTitle: "Why choose our property letting service?",
    whyLead:
      "Property letting needs momentum, judgement, and legal discipline. Our process is designed to reduce void time while protecting your long-term position.",
    why: [
      { icon: "clock", title: "Built to reduce voids", text: "Fast enquiry handling and pre-qualified renter matching help prevent good applicants going elsewhere." },
      { icon: "home", title: "Presentation that earns trust", text: "We make the property feel credible and well managed before a tenant ever books a viewing." },
      { icon: "file-check", title: "Paperwork is not an afterthought", text: "The tenancy is only useful if the setup is correct, documented, and ready for future renewals or notices." },
      { icon: "handshake", title: "Balanced landlord and tenant experience", text: "Clear expectations at the start usually mean fewer disputes later." },
    ],
    faqs: [
      { question: "How quickly can you let my property?", answer: "Timing depends on the property, rent, condition, and local demand. Well-presented homes priced correctly in active areas can often receive strong interest within days." },
      { question: "Do you help with compliance documents?", answer: "Yes. We flag the documents needed before marketing and can coordinate safety certificates where required." },
      { question: "Will you reference tenants?", answer: "Yes. Referencing includes identity, Right to Rent, affordability, employment or income, credit, and previous tenancy checks where applicable." },
      { question: "Can you manage the property after letting it?", answer: "Yes. You can move from let-only into full property management if you want ongoing rent collection, maintenance coordination, and tenancy support." },
    ],
    primaryCta: { label: "Request a Valuation", href: "/contact" },
    secondaryCta: { label: "Explore Management", href: "/landlord-services/property-management" },
    ctaTitle: "Ready to put your property on the market?",
    ctaText: "Tell us about the property and we will advise on rent, preparation, compliance, and launch timing.",
    seoTitle: "Property Letting Services in London & Birmingham | Letting Partners",
    seoDescription:
      "Professional property letting services across London and Birmingham, including valuation, marketing, tenant referencing, AST setup, and move-in coordination.",
    keywords: ["property letting London", "letting agents Birmingham", "let my property", "tenant referencing London"],
  },
  {
    href: "/landlord-services/property-management",
    slug: "property-management",
    eyebrow: "For Landlords",
    title: "Property Management",
    heroTitle: "Hands-off property management with clear updates and fewer surprises.",
    heroText:
      "Full management for landlords who want rent collection, maintenance coordination, compliance tracking, inspections, tenant support, and structured reporting handled properly.",
    image: PAGE_BANNER_IMAGES.propertyManagement,
    introTitle: "Protect the property, protect the income, keep communication clear.",
    introText:
      "Our management service is built around disciplined follow-up. Tenants know where to report issues, landlords know what is happening, and maintenance is coordinated before small problems become expensive ones.",
    benefits: [
      { icon: "headphones", title: "Tenant communication", text: "We handle daily tenant queries, repair reports, access arrangements, and tenancy admin." },
      { icon: "coins", title: "Rent collection", text: "Rent is monitored, statements are prepared, and arrears are flagged early." },
      { icon: "wrench", title: "Maintenance coordination", text: "Repairs are triaged, contractors are coordinated, and updates are shared through to completion." },
      { icon: "shield", title: "Compliance reminders", text: "Safety documents, renewal points, and tenancy requirements are tracked with proper records." },
    ],
    process: [
      { title: "Onboard the property", text: "We review tenancy status, certificates, contractor history, tenant details, keys, and reporting preferences." },
      { title: "Set service standards", text: "Tenants receive clear reporting channels and landlords receive a management route with agreed escalation points." },
      { title: "Manage day to day", text: "Rent, repairs, tenancy queries, inspections, and renewals are handled with documented updates." },
      { title: "Review and improve", text: "We use inspections and maintenance history to advise on practical improvements and future-proofing." },
    ],
    whyTitle: "Why choose our property management service?",
    whyLead:
      "Good management is calm, documented, and responsive. We focus on keeping tenancies stable while making landlord decisions easier.",
    why: [
      { icon: "clipboard", title: "Structured records", text: "Maintenance, tenancy updates, and compliance points are documented so decisions are traceable." },
      { icon: "hammer", title: "Contractor coordination", text: "We coordinate trusted trades and help keep works proportionate to the issue." },
      { icon: "calendar", title: "Renewal discipline", text: "Tenancy milestones are tracked early so renewals, rent reviews, and notices are not rushed." },
      { icon: "award", title: "Designed for distance landlords", text: "Clear reporting supports landlords who are busy, overseas, or managing portfolios remotely." },
    ],
    faqs: [
      { question: "What does full management include?", answer: "It can include rent collection, maintenance coordination, tenant communication, inspections, renewal support, compliance tracking, and landlord reporting." },
      { question: "Do I approve repairs?", answer: "Non-emergency works are usually approved by the landlord first. Emergency repairs are handled quickly to protect the tenant and property." },
      { question: "Can you manage a property with an existing tenant?", answer: "Yes. We can onboard an already-let property after reviewing the tenancy documents, certificates, tenant contact details, and current condition." },
      { question: "Do you manage HMOs?", answer: "We can discuss HMO management and licensing requirements based on the property type, area, and existing setup." },
    ],
    primaryCta: { label: "Discuss Management", href: "/contact" },
    secondaryCta: { label: "Request Maintenance Support", href: "/other-services/repair-maintenance" },
    ctaTitle: "Want your property managed properly?",
    ctaText: "Share the property details and we will outline a management route that fits your tenancy and risk profile.",
    seoTitle: "Property Management in London & Birmingham | Letting Partners",
    seoDescription:
      "Full property management for landlords across London and Birmingham, covering rent collection, maintenance, compliance, tenant communication, and inspections.",
    keywords: ["property management London", "managed letting agent", "landlord property management", "property management Birmingham"],
  },
  {
    href: "/landlord-services/find-a-tenant",
    slug: "find-a-tenant",
    eyebrow: "Tenant Find",
    title: "Find a Tenant",
    heroTitle: "Find the right tenant faster without lowering your standards.",
    heroText:
      "A focused tenant-find service for landlords who want professional marketing, rapid applicant follow-up, careful referencing, and clean tenancy setup.",
    image: PAGE_BANNER_IMAGES.findTenant,
    introTitle: "Tenant placement that values speed and suitability.",
    introText:
      "A quick let only works when the tenant is suitable. We combine active applicant matching with clear qualification so you avoid unnecessary viewings and weak applications.",
    benefits: [
      { icon: "user-plus", title: "Applicant matching", text: "Your property is matched to active renters whose budget, timing, and property needs fit." },
      { icon: "search", title: "Qualified enquiries", text: "We filter early so viewings are reserved for credible applicants." },
      { icon: "file-check", title: "Referencing support", text: "Identity, income, tenancy history, and Right to Rent checks are coordinated before move-in." },
      { icon: "key", title: "Move-in ready", text: "Once approved, we help move the tenancy from offer to signed agreement and handover." },
    ],
    process: [
      { title: "Confirm the rental brief", text: "We define the ideal tenant profile, rent, move-in date, furnishing position, and viewing availability." },
      { title: "Market and match", text: "The property is promoted and cross-matched against registered tenant requirements." },
      { title: "Qualify and view", text: "Applicants are screened before viewings so your time is spent on serious renters." },
      { title: "Reference and agree", text: "The preferred applicant is referenced, terms are agreed, and the tenancy is prepared." },
    ],
    whyTitle: "Why choose our tenant-find service?",
    whyLead:
      "Tenant-find work succeeds when marketing, response speed, and referencing all pull in the same direction.",
    why: [
      { icon: "clock", title: "Fast applicant follow-up", text: "Tenant interest is time-sensitive, so we keep communication moving." },
      { icon: "shield", title: "No shortcut on checks", text: "A quick placement still needs robust checks before keys are released." },
      { icon: "home", title: "Better first impressions", text: "Strong listings and organised viewings help applicants trust the property and the process." },
      { icon: "trending", title: "Pricing feedback", text: "We use enquiry quality and viewing response to adjust advice before the listing goes stale." },
    ],
    faqs: [
      { question: "Is this different from full management?", answer: "Yes. Tenant find focuses on marketing, applicant selection, referencing, and tenancy setup. Full management continues after move-in." },
      { question: "Can you help if my current advert is not working?", answer: "Yes. We can review presentation, rent, description, photographs, and enquiry handling to improve response." },
      { question: "Do you show the property?", answer: "We can coordinate viewings depending on access, location, and service arrangement." },
      { question: "What happens after the tenant moves in?", answer: "You can either self-manage or move into our full management service for rent collection, maintenance, and tenancy support." },
    ],
    primaryCta: { label: "Find a Tenant", href: "/contact" },
    secondaryCta: { label: "List Your Property", href: "/landlord-services/property-letting" },
    ctaTitle: "Need a reliable tenant?",
    ctaText: "Send us the property details and we will advise on positioning, launch timing, and next steps.",
    seoTitle: "Find a Tenant in London & Birmingham | Letting Partners",
    seoDescription:
      "Tenant-find service for landlords across London and Birmingham, including property marketing, applicant matching, referencing, and tenancy setup.",
    keywords: ["find a tenant London", "tenant find service", "letting agent find tenant", "landlord tenant matching"],
  },
  {
    href: "/landlord-services/rent-to-rent",
    slug: "rent-to-rent",
    eyebrow: "Guaranteed Income",
    title: "Rent to Rent",
    heroTitle: "A structured rent-to-rent route for predictable landlord income.",
    heroText:
      "For suitable properties, we explore rent-to-rent arrangements that provide a fixed monthly income while occupation, maintenance, and tenant coordination are managed professionally.",
    image: PAGE_BANNER_IMAGES.rentToRent,
    introTitle: "Predictable income needs a careful agreement.",
    introText:
      "Rent to rent is not right for every property. We review suitability, compliance, demand, and management responsibilities before recommending an arrangement.",
    benefits: [
      { icon: "banknote", title: "Fixed monthly rent", text: "Suitable arrangements can provide predictable income on agreed terms." },
      { icon: "shield", title: "Formal agreement", text: "Responsibilities, access, maintenance, standards, and review points are clearly documented." },
      { icon: "home", title: "Occupancy management", text: "The property is managed to maintain occupancy while respecting agreed use and legal requirements." },
      { icon: "clipboard", title: "Condition updates", text: "Regular updates help landlords stay informed about property condition and performance." },
    ],
    process: [
      { title: "Assess suitability", text: "We review location, layout, licensing, demand, condition, and potential rental model." },
      { title: "Agree terms", text: "Rent, responsibilities, access, maintenance limits, and review dates are set out clearly." },
      { title: "Prepare the property", text: "Any agreed safety, furnishing, or presentation works are completed before launch." },
      { title: "Manage and report", text: "The arrangement is managed with regular communication and condition reporting." },
    ],
    whyTitle: "Why choose our rent-to-rent support?",
    whyLead:
      "Rent to rent only works when the numbers are realistic and the management standards are strong.",
    why: [
      { icon: "scale", title: "Suitability-first advice", text: "We will not force a model where the property, location, or compliance position does not support it." },
      { icon: "file-check", title: "Clear responsibilities", text: "A good agreement prevents confusion over maintenance, access, standards, and payments." },
      { icon: "wrench", title: "Maintenance visibility", text: "Property care stays central because predictable income is only valuable if the asset is protected." },
      { icon: "trending", title: "Demand-aware setup", text: "We consider local renter demand before committing to an arrangement." },
    ],
    faqs: [
      { question: "Is rent to rent guaranteed rent?", answer: "It can provide fixed monthly income under an agreed arrangement, but the exact terms depend on property suitability and the agreement in place." },
      { question: "Does every property qualify?", answer: "No. We assess location, condition, layout, licensing, demand, and compliance before recommending rent to rent." },
      { question: "Who handles maintenance?", answer: "The agreement sets out who handles which maintenance items, approval limits, and emergency procedures." },
      { question: "Can I inspect the property?", answer: "Inspection access and reporting should be agreed as part of the arrangement so landlords retain visibility." },
    ],
    primaryCta: { label: "Discuss Rent to Rent", href: "/contact" },
    secondaryCta: { label: "Compare Letting Options", href: "/landlord-services/property-letting" },
    ctaTitle: "Want to explore guaranteed income?",
    ctaText: "Tell us about the property and we will advise whether a rent-to-rent model is suitable.",
    seoTitle: "Rent to Rent Services in London & Birmingham | Letting Partners",
    seoDescription:
      "Structured rent-to-rent support for suitable landlord properties, including suitability assessment, agreement setup, occupancy management, and reporting.",
    keywords: ["rent to rent London", "guaranteed rent landlord", "rent to rent Birmingham", "fixed rental income"],
  },
  {
    href: "/tenant-services",
    slug: "tenant-services",
    eyebrow: "For Renters",
    title: "Tenant Services",
    heroTitle: "Find, apply, and move with clearer support at every stage.",
    heroText:
      "Tenant services for renters across London and Birmingham, including property matching, registration, student accommodation support, tenancy guidance, and move-in help.",
    image: PAGE_BANNER_IMAGES.tenantServices,
    introTitle: "A more straightforward way to rent.",
    introText:
      "Renting can move quickly. We help tenants understand what is needed, register their requirements, and respond to suitable homes with confidence.",
    benefits: [
      { icon: "clipboard", title: "Tenant registration", text: "Share budget, area, property type, and move date so we can match you to suitable homes." },
      { icon: "search", title: "Property matching", text: "We compare your requirements against available and upcoming listings." },
      { icon: "file-check", title: "Clear application guidance", text: "Referencing, deposits, ASTs, and move-in steps are explained before you commit." },
      { icon: "graduation", title: "Student-friendly support", text: "Students can get guidance on guarantors, shared homes, and well-connected areas." },
    ],
    process: [
      { title: "Register your search", text: "Tell us where you want to live, your budget, timing, household size, and any must-haves." },
      { title: "Review suitable options", text: "We contact you when a property aligns with your requirements." },
      { title: "View and apply", text: "Viewings, application forms, referencing, and holding deposit steps are explained clearly." },
      { title: "Move in confidently", text: "We help coordinate signing, deposit protection information, inventory, and key collection." },
    ],
    whyTitle: "Why choose our tenant services?",
    whyLead:
      "Good tenant support is practical: quick matching, honest information, and clear steps before money changes hands.",
    why: [
      { icon: "shield", title: "Transparent costs", text: "We explain permitted payments, deposits, and application requirements clearly." },
      { icon: "headphones", title: "Responsive communication", text: "You know what stage you are at and what is needed next." },
      { icon: "home", title: "Area-aware guidance", text: "We understand the differences between Ilford, Stratford, Croydon, Birmingham, and the other areas we cover." },
      { icon: "key", title: "Move-in support", text: "The final stage is coordinated so paperwork, payments, and keys line up." },
    ],
    faqs: [
      { question: "Is tenant registration free?", answer: "Yes. Registration is free and helps us match you to suitable properties." },
      { question: "What information should I provide?", answer: "Preferred area, budget, property type, move date, household size, employment or student status, and any essential requirements." },
      { question: "Do you charge tenant fees?", answer: "Tenant charges in England are limited by the Tenant Fees Act 2019. We explain permitted payments before you proceed." },
      { question: "Can students register?", answer: "Yes. Students can register and should mention guarantor availability, university location, group size, and preferred transport links." },
    ],
    primaryCta: { label: "Register as a Tenant", href: "/tenant-services/register-as-tenant" },
    secondaryCta: { label: "Browse Properties", href: "/properties" },
    ctaTitle: "Ready to start your rental search?",
    ctaText: "Register your requirements and we will contact you when suitable homes become available.",
    seoTitle: "Tenant Services in London & Birmingham | Letting Partners",
    seoDescription:
      "Tenant services from Letting Partners, including tenant registration, property matching, student accommodation support, and plain-English renting guidance.",
    keywords: ["tenant services London", "register as tenant", "rental property matching", "student accommodation London"],
  },
  {
    href: "/tenant-services/student-accommodation",
    slug: "student-accommodation",
    eyebrow: "For Students",
    title: "Student Accommodation",
    heroTitle: "Student accommodation that is well connected, clear, and properly managed.",
    heroText:
      "Support for students looking for rooms, studios, and shared houses in London locations with strong transport links and practical tenancy guidance.",
    image: PAGE_BANNER_IMAGES.studentAccommodation,
    introTitle: "Student renting should feel manageable, not mysterious.",
    introText:
      "We help students understand guarantors, referencing, deposits, shared-house responsibilities, and location trade-offs before they commit.",
    benefits: [
      { icon: "graduation", title: "Student-aware referencing", text: "We guide applicants through guarantor and student-specific referencing requirements." },
      { icon: "train", title: "Transport-led matching", text: "Area advice considers university access, rail links, Tube lines, and late travel practicality." },
      { icon: "home", title: "Rooms and shared homes", text: "We support room searches, studios, and group lets where available." },
      { icon: "file", title: "Tenancy clarity", text: "ASTs, deposits, house rules, and move-in responsibilities are explained in plain English." },
    ],
    process: [
      { title: "Share your study and living needs", text: "Tell us university location, budget, group size, move date, guarantor position, and preferred areas." },
      { title: "Shortlist suitable options", text: "We focus on homes that match transport, budget, and tenancy practicality." },
      { title: "Apply with the right documents", text: "We guide you through identity, student status, guarantor, and referencing information." },
      { title: "Move in and settle", text: "We help coordinate agreement signing, deposit information, inventory, and reporting channels." },
    ],
    whyTitle: "Why choose our student accommodation support?",
    whyLead:
      "Student lettings need clear expectations around guarantors, shared living, deposits, and timing.",
    why: [
      { icon: "clock", title: "Term-time urgency understood", text: "Student searches often have fixed deadlines, so we prioritise practical next steps." },
      { icon: "shield", title: "No unclear fee surprises", text: "Permitted payments and deposit rules are explained before applications progress." },
      { icon: "map-pin", title: "Commute-aware area advice", text: "A cheaper room is not always better if the journey is unrealistic." },
      { icon: "handshake", title: "Shared-house expectations", text: "We help clarify group responsibilities before a tenancy starts." },
    ],
    faqs: [
      { question: "Do students need a guarantor?", answer: "Many landlords ask for a UK guarantor for student applicants. If that applies, we will explain what is needed." },
      { question: "Can groups register together?", answer: "Yes. Share the full group size, budget, preferred move date, and whether you need individual rooms or a whole property." },
      { question: "Are bills included?", answer: "It depends on the property. We will make clear what is and is not included before you apply." },
      { question: "Can international students apply?", answer: "Yes. Referencing requirements may differ, so provide details early and we will advise on the expected documents." },
    ],
    primaryCta: { label: "Register Student Requirements", href: "/tenant-services/register-as-tenant" },
    secondaryCta: { label: "Read Tenant Guide", href: "/tenant-services/tenant-guide" },
    ctaTitle: "Looking for student accommodation?",
    ctaText: "Register your requirements and tell us about your course location, budget, and move-in timing.",
    seoTitle: "Student Accommodation in London | Letting Partners",
    seoDescription:
      "Student accommodation support in London, including rooms, studios, shared houses, guarantor guidance, and student-friendly tenancy support.",
    keywords: ["student accommodation London", "student rooms London", "student housing East London", "student letting agent"],
  },
  {
    href: "/tenant-services/tenant-guide",
    slug: "tenant-guide",
    eyebrow: "Renting Guide",
    title: "Tenant Guide",
    heroTitle: "A plain-English guide to renting in England.",
    heroText:
      "Understand ASTs, referencing, deposits, permitted payments, repairs, and ending a tenancy before you sign.",
    image: PAGE_BANNER_IMAGES.tenantGuide,
    introTitle: "Know the process before the pressure starts.",
    introText:
      "The best rental decisions are made when tenants understand the documents, checks, payments, and responsibilities involved.",
    benefits: [
      { icon: "file", title: "AST basics", text: "Understand fixed terms, periodic tenancies, obligations, and what the agreement should cover." },
      { icon: "clipboard", title: "Referencing explained", text: "Know which documents may be requested and why landlords review affordability." },
      { icon: "shield", title: "Deposit protection", text: "Learn how tenancy deposits should be protected and what prescribed information means." },
      { icon: "wrench", title: "Repairs and maintenance", text: "Understand how to report issues and what landlords are generally responsible for." },
    ],
    process: [
      { title: "Before you view", text: "Set your budget, area priorities, move date, and essential documents." },
      { title: "Before you apply", text: "Check the rent, deposit, holding deposit, bills, furnishing, and tenancy term." },
      { title: "Before you sign", text: "Read the AST, confirm deposit protection, inventory arrangements, and move-in date." },
      { title: "During the tenancy", text: "Report maintenance in writing, keep records, and understand notice requirements." },
    ],
    whyTitle: "Why use our tenant guide?",
    whyLead:
      "Renting is easier when the rules are explained without jargon and without pressure.",
    why: [
      { icon: "book", title: "Practical, not theoretical", text: "The guide focuses on what tenants actually need during search, application, and move-in." },
      { icon: "scale", title: "UK-specific context", text: "The content is written around private renting in England and common AST arrangements." },
      { icon: "check-circle", title: "Better questions", text: "Knowing the basics helps you ask the right questions before paying a holding deposit." },
      { icon: "home", title: "Confidence at move-in", text: "Clear preparation makes the move-in process less stressful." },
    ],
    faqs: [
      { question: "What is an AST?", answer: "An Assured Shorthold Tenancy is the most common private residential tenancy in England. It sets out rent, term, obligations, and possession rules." },
      { question: "How much can a deposit be?", answer: "For most assured shorthold tenancies in England, the security deposit is capped at five weeks rent where annual rent is below the statutory threshold." },
      { question: "What is a holding deposit?", answer: "A holding deposit reserves a property while checks are completed. It is capped at one weeks rent and should be handled under Tenant Fees Act rules." },
      { question: "Who handles repairs?", answer: "Landlords generally handle structure, exterior, heating, hot water, gas, and electrical installations, but tenants should report issues promptly and allow reasonable access." },
    ],
    primaryCta: { label: "Register as a Tenant", href: "/tenant-services/register-as-tenant" },
    secondaryCta: { label: "Browse Properties", href: "/properties" },
    ctaTitle: "Want help finding your next rental?",
    ctaText: "Register your requirements and we will match you with suitable homes across our coverage areas.",
    seoTitle: "Tenant Guide for Renting in England | Letting Partners",
    seoDescription:
      "A tenant guide covering ASTs, referencing, deposit protection, permitted payments, repairs, and tenancy responsibilities in England.",
    keywords: ["tenant guide UK", "AST guide tenant", "deposit protection tenant", "renting guide England"],
  },
  {
    href: "/specialist-legal-support",
    slug: "specialist-legal-support",
    eyebrow: "Legal Coordination",
    title: "Specialist Legal Support",
    heroTitle: "Property legal issues need calm coordination and specialist advice.",
    heroText:
      "We help landlords and tenants identify the right support route for disputes, notices, rent arrears, possession, and tenancy paperwork issues.",
    image: PAGE_BANNER_IMAGES.specialistLegal,
    introTitle: "The right specialist, the right documents, the right next step.",
    introText:
      "Letting Partners coordinates property context and connects you with appropriate SRA-regulated legal specialists where formal advice or proceedings are required.",
    benefits: [
      { icon: "scale", title: "Specialist route finding", text: "We help identify whether the issue needs notices, negotiation, arrears action, or formal advice." },
      { icon: "file-check", title: "Document readiness", text: "Tenancy agreements, notices, arrears schedules, and communication history are organised before referral." },
      { icon: "headphones", title: "Property point of contact", text: "We stay involved as the property coordination point while legal specialists advise." },
      { icon: "shield", title: "Compliance awareness", text: "Legal process is treated carefully because small errors can create delays or weaken a case." },
    ],
    process: [
      { title: "Explain the situation", text: "You share the tenancy type, timeline, documents, arrears position, and what outcome you need." },
      { title: "Review the route", text: "We assess whether the matter aligns with disputes, notices, arrears, possession, or another specialist route." },
      { title: "Prepare the file", text: "Relevant tenancy documents and supporting records are gathered for the specialist." },
      { title: "Coordinate next steps", text: "We connect you with the appropriate specialist and continue supporting property-side communication." },
    ],
    whyTitle: "Why choose our specialist legal support coordination?",
    whyLead:
      "Legal issues move better when the facts are organised before formal advice begins.",
    why: [
      { icon: "clipboard", title: "Cleaner case handover", text: "A well-prepared bundle saves time and helps specialists assess the issue faster." },
      { icon: "scale", title: "Appropriate referral", text: "Different issues need different routes; we help avoid sending matters down the wrong path." },
      { icon: "shield", title: "Less procedural guesswork", text: "Notices and possession routes have strict requirements, so we avoid casual assumptions." },
      { icon: "handshake", title: "Practical communication", text: "We keep the property management context clear while specialists handle legal advice." },
    ],
    faqs: [
      { question: "Do you provide legal advice directly?", answer: "We coordinate support and connect clients with SRA-regulated legal specialists where legal advice is required." },
      { question: "What documents should I prepare?", answer: "AST, deposit information, safety certificates, arrears schedule, notices served, and written communication are useful starting points." },
      { question: "Can tenants request support?", answer: "Yes. Tenants can request support where they need guidance on a tenancy dispute or property-related legal issue." },
      { question: "How quickly should I act?", answer: "As early as possible. Delay can reduce options, especially in arrears, notices, or possession matters." },
    ],
    primaryCta: { label: "Get Legal Support", href: "/specialist-legal-support/request-support" },
    secondaryCta: { label: "Disputes & Notices", href: "/specialist-legal-support/disputes-notices" },
    ctaTitle: "Need help with a property legal issue?",
    ctaText: "Send a short summary and we will help identify the right specialist support route.",
    seoTitle: "Specialist Legal Support for Property Matters | Letting Partners",
    seoDescription:
      "Specialist legal support coordination for tenancy disputes, Section 8 and Section 21 notices, rent arrears, and possession proceedings.",
    keywords: ["property legal support", "tenancy dispute solicitor", "Section 8 notice", "Section 21 notice"],
  },
  {
    href: "/specialist-legal-support/disputes-notices",
    slug: "disputes-notices",
    eyebrow: "Legal Notices",
    title: "Disputes & Legal Notices",
    heroTitle: "Tenancy disputes and notices handled with precision.",
    heroText:
      "Support coordination for Section 8 notices, Section 21 notices, breach of tenancy issues, deposit disputes, and formal tenancy communication.",
    image: PAGE_BANNER_IMAGES.disputesNotices,
    introTitle: "Correct notice work starts with the facts.",
    introText:
      "We help organise the tenancy background, communications, certificates, and relevant evidence before a formal notice or dispute route is progressed.",
    benefits: [
      { icon: "file", title: "Section 8 and 21 routes", text: "We help identify the likely notice route before referring to the right specialist." },
      { icon: "scale", title: "Dispute framing", text: "Breach, deposit, access, and tenancy disagreements are framed around facts and documents." },
      { icon: "shield", title: "Procedural care", text: "Notice validity can depend on form, timing, service, and supporting documentation." },
      { icon: "headphones", title: "Clear coordination", text: "You know what information is needed and what happens next." },
    ],
    process: [
      { title: "Gather tenancy records", text: "AST, certificates, deposit details, communications, and previous notices are reviewed." },
      { title: "Identify the issue", text: "We distinguish arrears, breach, possession, deposit, or general dispute routes." },
      { title: "Prepare for specialist input", text: "Relevant facts are organised for solicitor review or formal action." },
      { title: "Coordinate follow-through", text: "We support communication and property records while the specialist advises." },
    ],
    whyTitle: "Why choose this disputes and notices support?",
    whyLead:
      "Disputes often escalate because early steps are unclear. We help bring structure before formal action begins.",
    why: [
      { icon: "file-check", title: "Notice-sensitive setup", text: "We focus on the documents and dates that can affect notice validity." },
      { icon: "clipboard", title: "Evidence-led approach", text: "Decisions are based on written records, not memory or assumptions." },
      { icon: "shield", title: "Reduced avoidable delay", text: "A badly prepared notice can cost weeks or months; preparation matters." },
      { icon: "handshake", title: "Measured escalation", text: "Where possible, we help clarify whether resolution is possible before proceedings." },
    ],
    faqs: [
      { question: "What is a Section 8 notice?", answer: "A Section 8 notice is used where specific statutory grounds apply, such as rent arrears or breach of tenancy. It must be prepared and served correctly." },
      { question: "What is a Section 21 notice?", answer: "A Section 21 notice is a no-fault possession notice for certain AST situations, subject to strict procedural requirements." },
      { question: "Can you help with deposit disputes?", answer: "Yes. We can help organise the evidence and guide the matter toward the relevant deposit scheme or specialist support." },
      { question: "Should I serve a notice myself?", answer: "Notice errors can cause delay. It is sensible to obtain specialist input where possession or formal dispute steps are involved." },
    ],
    primaryCta: { label: "Get Legal Support", href: "/specialist-legal-support/request-support" },
    secondaryCta: { label: "Rent Arrears Help", href: "/specialist-legal-support/rent-arrears-possession" },
    ctaTitle: "Need help with a notice or dispute?",
    ctaText: "Share the timeline and tenancy documents so the right support route can be identified.",
    seoTitle: "Disputes & Legal Notices for Tenancies | Letting Partners",
    seoDescription:
      "Support for tenancy disputes, Section 8 notices, Section 21 notices, breach of tenancy issues, and deposit disputes.",
    keywords: ["Section 8 notice London", "Section 21 notice", "tenancy dispute", "deposit dispute tenancy"],
  },
  {
    href: "/specialist-legal-support/rent-arrears-possession",
    slug: "rent-arrears-possession",
    eyebrow: "Arrears & Possession",
    title: "Rent Arrears & Possession",
    heroTitle: "Act early on rent arrears before the options narrow.",
    heroText:
      "Support coordination for arrears recovery, possession routes, payment plans, notices, and specialist legal referrals where formal action is required.",
    image: PAGE_BANNER_IMAGES.rentArrears,
    introTitle: "Arrears need structure, speed, and documentation.",
    introText:
      "We help landlords organise the arrears position, communication history, tenancy documents, and next-step options so action is taken with clarity.",
    benefits: [
      { icon: "coins", title: "Arrears schedule", text: "Rent due, payments received, and outstanding balance are organised into a clear timeline." },
      { icon: "file-check", title: "Notice route support", text: "The appropriate arrears or possession route is identified for specialist review." },
      { icon: "handshake", title: "Payment-plan context", text: "Where viable, practical repayment routes can be considered before escalation." },
      { icon: "scale", title: "Specialist referral", text: "Formal possession or court action is routed to appropriate legal specialists." },
    ],
    process: [
      { title: "Review the arrears", text: "We confirm amounts, dates, tenancy status, communication, and any existing repayment arrangement." },
      { title: "Assess recovery options", text: "Payment plans, formal notices, or specialist legal action are considered based on facts." },
      { title: "Prepare the evidence", text: "Arrears schedules, AST, deposit details, certificates, and correspondence are organised." },
      { title: "Coordinate action", text: "We connect with specialists where required and keep the property context clear." },
    ],
    whyTitle: "Why choose this rent arrears and possession support?",
    whyLead:
      "Arrears are stressful, but decisions should still be calm and evidence-led.",
    why: [
      { icon: "clock", title: "Early action focus", text: "The earlier arrears are addressed, the more recovery routes are usually available." },
      { icon: "clipboard", title: "Clear arrears evidence", text: "A clean schedule is essential for negotiation, notices, and proceedings." },
      { icon: "scale", title: "Possession-route awareness", text: "Possession action has procedural requirements that should not be guessed." },
      { icon: "shield", title: "Income and asset protection", text: "The goal is to protect rental income while taking lawful, proportionate steps." },
    ],
    faqs: [
      { question: "When should I act on arrears?", answer: "Act as soon as rent is missed. Early communication and record-keeping can prevent the matter becoming harder to recover." },
      { question: "Can a payment plan help?", answer: "Sometimes. A realistic written repayment plan can resolve issues without proceedings, but it depends on the tenant's position and payment history." },
      { question: "What evidence is useful?", answer: "AST, rent schedule, payment records, messages, bank statements, notices, and safety/compliance documents are useful." },
      { question: "Can you help with possession proceedings?", answer: "We coordinate the property-side information and refer formal proceedings to suitable SRA-regulated legal specialists." },
    ],
    primaryCta: { label: "Request Support", href: "/specialist-legal-support/request-support" },
    secondaryCta: { label: "Disputes & Notices", href: "/specialist-legal-support/disputes-notices" },
    ctaTitle: "Facing rent arrears?",
    ctaText: "Send the tenancy timeline and arrears position so we can help route the next step.",
    seoTitle: "Rent Arrears & Possession Support | Letting Partners",
    seoDescription:
      "Rent arrears and possession support coordination for landlords, including arrears schedules, notices, payment plan context, and legal specialist referrals.",
    keywords: ["rent arrears recovery", "possession proceedings landlord", "eviction solicitor", "Section 8 arrears"],
  },
  {
    href: "/other-services/repair-maintenance",
    slug: "repair-maintenance",
    eyebrow: "Property Care",
    title: "Repair & Maintenance",
    heroTitle: "Responsive maintenance coordination that keeps properties moving.",
    heroText:
      "Repair and maintenance support for landlords and tenants, covering urgent issues, planned works, contractor coordination, access, and completion updates.",
    image: PAGE_BANNER_IMAGES.repairMaintenance,
    introTitle: "Repairs should be clear, tracked, and closed properly.",
    introText:
      "We coordinate repair reports from issue to outcome, keeping tenants informed and landlords updated while using suitable contractors for the job.",
    benefits: [
      { icon: "hammer", title: "Urgent repairs", text: "Issues are triaged by urgency so genuine emergencies are escalated quickly." },
      { icon: "wrench", title: "Trusted contractors", text: "Suitable trades are coordinated for plumbing, electrics, heating, general repair, and planned works." },
      { icon: "headphones", title: "Tenant updates", text: "Access, attendance windows, and progress updates are communicated clearly." },
      { icon: "clipboard", title: "Completion tracking", text: "Repairs are followed through so jobs do not disappear after the first visit." },
    ],
    process: [
      { title: "Report the issue", text: "Share the fault, photos where possible, access details, and any immediate safety concerns." },
      { title: "Triage and approve", text: "Urgency is assessed and landlord approval is sought where required." },
      { title: "Coordinate attendance", text: "The right contractor is booked and access arrangements are confirmed." },
      { title: "Close and document", text: "Completion is checked and any follow-up recommendations are shared." },
    ],
    whyTitle: "Why choose our repair and maintenance support?",
    whyLead:
      "Maintenance is one of the biggest drivers of tenant satisfaction and landlord risk. We keep it organised.",
    why: [
      { icon: "clock", title: "Quicker triage", text: "The right urgency decision helps prevent panic for minor issues and delay for serious ones." },
      { icon: "shield", title: "Property protection", text: "Small leaks, heating issues, and electrical faults are tracked before they become larger problems." },
      { icon: "handshake", title: "Less chasing", text: "Tenants and landlords receive clearer updates, reducing repeated follow-up calls." },
      { icon: "file-check", title: "Better records", text: "Maintenance history supports future decisions, renewals, and end-of-tenancy discussions." },
    ],
    faqs: [
      { question: "Can tenants request maintenance support?", answer: "Yes. Tenants can report issues, and we will coordinate next steps according to the management arrangement." },
      { question: "Do landlords approve repair costs?", answer: "Non-emergency costs are usually approved before work proceeds. Emergency action may be taken to protect safety or the property." },
      { question: "Do you handle safety certificates?", answer: "We can coordinate gas safety, EICR, EPC, smoke alarm, and other compliance-related appointments where required." },
      { question: "Can you manage planned improvement works?", answer: "Yes. We can help coordinate planned repairs, minor refurbishments, and improvement works." },
    ],
    primaryCta: { label: "Request Maintenance Support", href: "/contact" },
    secondaryCta: { label: "Property Management", href: "/landlord-services/property-management" },
    ctaTitle: "Need a repair handled?",
    ctaText: "Tell us what has happened, where the property is, and how urgent the issue is.",
    seoTitle: "Repair & Maintenance Support | Letting Partners",
    seoDescription:
      "Repair and maintenance coordination for rental properties across London and Birmingham, including urgent repairs, contractor coordination, and planned works.",
    keywords: ["property maintenance London", "rental repair support", "landlord maintenance", "repair coordination"],
  },
  {
    href: "/other-services/mortgage-consultancy",
    slug: "mortgage-consultancy",
    eyebrow: "Finance Guidance",
    title: "Mortgage Consultancy",
    heroTitle: "Mortgage guidance for buyers, landlords, and property investors.",
    heroText:
      "Plain-English mortgage support for residential purchases, buy-to-let lending, remortgages, and portfolio planning through experienced mortgage professionals.",
    image: PAGE_BANNER_IMAGES.mortgageConsultancy,
    introTitle: "Understand the numbers before you make the property decision.",
    introText:
      "We help clients clarify goals, documentation, affordability, rental coverage, and next steps before connecting them with suitable mortgage guidance.",
    benefits: [
      { icon: "landmark", title: "Residential mortgages", text: "Support for first-time buyers, movers, and remortgage conversations." },
      { icon: "building", title: "Buy-to-let guidance", text: "Rental coverage, deposit, lender criteria, and investor considerations explained clearly." },
      { icon: "trending", title: "Portfolio planning", text: "Landlords can review finance options in the context of yield, rent, and long-term strategy." },
      { icon: "file-check", title: "Application readiness", text: "Income, deposit, identity, property, and supporting documents are prepared in advance." },
    ],
    process: [
      { title: "Clarify your goal", text: "Buying, remortgaging, investing, refinancing, or reviewing a portfolio position." },
      { title: "Review your position", text: "Income, deposit, equity, credit profile, property type, rent expectations, and timescale are discussed." },
      { title: "Compare routes", text: "Suitable mortgage types and application considerations are explained in plain English." },
      { title: "Move to application", text: "You are guided on documents, lender requirements, valuation, offer, and completion steps." },
    ],
    whyTitle: "Why choose our mortgage consultancy support?",
    whyLead:
      "Property decisions are stronger when finance is understood early, not after an offer has been made.",
    why: [
      { icon: "banknote", title: "Numbers before emotion", text: "Borrowing position and affordability are clarified before you overcommit." },
      { icon: "home", title: "Property-aware guidance", text: "Mortgage advice is considered alongside rental demand, property type, and investment goals." },
      { icon: "clipboard", title: "Document preparation", text: "Early document checks reduce application friction later." },
      { icon: "shield", title: "Risk-aware planning", text: "Rate changes, stress testing, deposit levels, and rental coverage are discussed clearly." },
    ],
    faqs: [
      { question: "Can you help first-time buyers?", answer: "Yes. We can help explain deposit, affordability, lender documents, and the route to mortgage offer." },
      { question: "Do you handle buy-to-let mortgages?", answer: "We can connect landlords and investors with advisers who understand buy-to-let and portfolio lending." },
      { question: "What documents are usually needed?", answer: "ID, proof of income, bank statements, deposit evidence, property details, and sometimes rental information for buy-to-let." },
      { question: "Can I discuss options before finding a property?", answer: "Yes. Early guidance can help set a realistic budget and search strategy." },
    ],
    primaryCta: { label: "Discuss Mortgage Options", href: "/contact" },
    secondaryCta: { label: "Plan a Letting Strategy", href: "/landlord-services/property-letting" },
    ctaTitle: "Planning a purchase or refinance?",
    ctaText: "Tell us your goal and we will help you understand the practical next steps.",
    seoTitle: "Mortgage Consultancy for Buyers & Landlords | Letting Partners",
    seoDescription:
      "Mortgage consultancy support for residential buyers, landlords, buy-to-let investors, remortgages, and portfolio finance planning.",
    keywords: ["mortgage consultancy London", "buy to let mortgage", "landlord mortgage advice", "property finance guidance"],
  },
  {
    href: "/other-services/construction-development",
    slug: "construction-development",
    eyebrow: "Build & Improve",
    title: "Construction & Development",
    heroTitle: "Construction and development support from idea to handover.",
    heroText:
      "Support for extensions, conversions, refurbishment, and development projects where planning, contractor coordination, quality, and rental value all matter.",
    image: PAGE_BANNER_IMAGES.constructionDevelopment,
    introTitle: "Build work should improve the asset, not just change the building.",
    introText:
      "We help property owners consider scope, rental value, planning, programme, contractor options, and practical handover before work starts.",
    benefits: [
      { icon: "hardhat", title: "Project scope", text: "Clarify what is being built, why it matters, and what constraints apply." },
      { icon: "clipboard", title: "Contractor coordination", text: "Tendering, access, programme, and communication are coordinated more clearly." },
      { icon: "home", title: "Rental value lens", text: "Improvements are considered in terms of tenant appeal, durability, and income potential." },
      { icon: "shield", title: "Quality and handover", text: "Snagging, completion records, and property readiness are treated as part of the project." },
    ],
    process: [
      { title: "Define the brief", text: "Goals, budget, property type, planning context, desired finish, and rental or resale objectives are agreed." },
      { title: "Plan the route", text: "Permissions, contractor options, programme, risk points, and sequencing are considered." },
      { title: "Coordinate delivery", text: "Works progress, access, communication, and quality expectations are tracked." },
      { title: "Handover and let-ready", text: "Snagging, certificates, cleaning, photography readiness, and letting preparation are completed." },
    ],
    whyTitle: "Why choose our construction and development support?",
    whyLead:
      "Development decisions should connect design, build quality, cost, and the rental market.",
    why: [
      { icon: "trending", title: "Value-led thinking", text: "We consider whether the project improves rentability, yield, or long-term asset appeal." },
      { icon: "hardhat", title: "Practical build oversight", text: "Better coordination helps reduce confusion between owner, contractor, and occupier." },
      { icon: "wrench", title: "Durable rental finishes", text: "A rental property needs materials and layouts that can handle real occupancy." },
      { icon: "key", title: "Let-ready finish", text: "The project ends with a usable, marketable property rather than loose ends." },
    ],
    faqs: [
      { question: "Can you help before planning permission?", answer: "Yes. We can help shape the brief and identify planning or permitted development considerations before formal steps." },
      { question: "Do you manage contractors?", answer: "We can support contractor coordination, communication, programme tracking, and handover expectations." },
      { question: "Can you advise on rental potential after works?", answer: "Yes. We can consider likely tenant demand, finish level, layout, and local rental positioning." },
      { question: "Do you support small refurbishments?", answer: "Yes. Smaller refurbishments, upgrades, and let-ready improvement works can also be discussed." },
    ],
    primaryCta: { label: "Plan Your Project", href: "/contact" },
    secondaryCta: { label: "Request a Letting View", href: "/landlord-services/property-letting" },
    ctaTitle: "Planning work on a rental property?",
    ctaText: "Tell us the property, scope, and goal so we can help shape a practical route.",
    seoTitle: "Construction & Development Support | Letting Partners",
    seoDescription:
      "Construction and development support for extensions, conversions, refurbishments, and rental property improvement projects.",
    keywords: ["construction development property", "rental property refurbishment", "property development London", "landlord refurbishment"],
  },
];

export function getServiceDetailByHref(href: string) {
  return SERVICE_DETAIL_PAGES.find((service) => service.href === href);
}

export function getServiceDetailBySlug(slug: string) {
  return SERVICE_DETAIL_PAGES.find((service) => service.slug === slug);
}
