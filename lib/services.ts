import { PAGE_BANNER_IMAGES } from "@/lib/images";

export type ServiceChildLink = {
  href: string;
  label: string;
  description: string;
  icon: string;
};

export type ServiceGroup = {
  href: string;
  label: string;
  eyebrow: string;
  description: string;
  overview: string;
  icon: string;
  image: string;
  ctaLabel: string;
  highlights: string[];
  items: ServiceChildLink[];
};

export type OtherServicePage = ServiceChildLink & {
  slug: string;
  ctaLabel: string;
  heroTitle: string;
  heroText: string;
  panelLabel: string;
  image: string;
  storyImage: string;
  overview: string;
  highlights: string[];
  support: Array<{ title: string; text: string }>;
  process: Array<{ title: string; text: string }>;
};

export type ComprehensiveServiceCard = {
  ctaLabel: string;
  href: string;
  icon: string;
  points: string[];
  text: string;
  title: string;
};

export const COMPREHENSIVE_PROPERTY_SERVICES: ComprehensiveServiceCard[] = [
  {
    icon: "home",
    title: "Property Letting",
    text: "Achieve the right rental figure with a structured, professional approach to letting.",
    points: [
      "Matched to qualified tenants from our pre-registered database",
      "Professional listing with compelling photography and accurate descriptions",
      "Prompt follow-up to minimise void periods and protect your rental income",
    ],
    href: "/landlord-services/property-letting",
    ctaLabel: "Start Letting",
  },
  {
    icon: "wrench",
    title: "Property Management",
    text: "Structured day-to-day management so your property runs smoothly without your constant involvement.",
    points: [
      "Dedicated point of contact managing your property from start to finish",
      "Coordinated maintenance and contractor oversight with quality checks",
      "Regular reporting so you remain fully informed at every stage",
    ],
    href: "/landlord-services/property-management",
    ctaLabel: "Explore Management",
  },
  {
    icon: "trending",
    title: "Rent to Rent",
    text: "Structured rent-to-rent solutions offering predictable income for landlords.",
    points: [
      "Guaranteed rental income with flexible arrangement terms",
      "We manage the sublet, maintenance, and occupancy on your behalf",
      "Sustainable returns from carefully selected and managed properties",
    ],
    href: "/landlord-services/rent-to-rent",
    ctaLabel: "Explore Rent To Rent",
  },
  {
    icon: "hammer",
    title: "Repair & Maintenance",
    text: "Prompt, professional repairs - coordinated so you never need to chase.",
    points: [
      "Rapid response to urgent maintenance callouts across all property types",
      "Vetted contractors delivering consistent, reliable workmanship",
      "End-to-end coordination keeping landlords and tenants updated throughout",
    ],
    href: "/other-services/repair-maintenance",
    ctaLabel: "Request Repairs",
  },
  {
    icon: "landmark",
    title: "Mortgage Consultancy",
    text: "Straightforward mortgage guidance for buyers, landlords, and property investors.",
    points: [
      "Tailored advice covering residential, buy-to-let, and portfolio products",
      "Access to competitive market rates through our network of advisers",
      "Support from initial enquiry through to mortgage offer and completion",
    ],
    href: "/other-services/mortgage-consultancy",
    ctaLabel: "Discuss Options",
  },
  {
    icon: "hardhat",
    title: "Construction & Development",
    text: "End-to-end support for extensions, conversions, and new-build projects.",
    points: [
      "Comprehensive project management from planning through to handover",
      "Competitive tendering without compromising on build quality or finish",
      "Expert guidance on permitted development rights and planning requirements",
    ],
    href: "/other-services/construction-development",
    ctaLabel: "Plan A Project",
  },
];

export const OTHER_SERVICE_PAGES: OtherServicePage[] = [
  {
    slug: "repair-maintenance",
    href: "/other-services/repair-maintenance",
    label: "Repair & Maintenance",
    description: "Prompt, professional repairs coordinated so you never have to chase.",
    icon: "hammer",
    ctaLabel: "Request Repair Support",
    heroTitle: "Reliable repair and maintenance - handled from start to finish.",
    heroText:
      "Letting Partners coordinates responsive repair and maintenance support for landlords and tenants across London and Birmingham. We take ownership of the process so issues move from reported to resolved without unnecessary delay.",
    panelLabel: "Responsive Property Care",
    image: PAGE_BANNER_IMAGES.repairMaintenance,
    storyImage: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=900&q=80",
    overview:
      "Whether you face an emergency callout or require routine maintenance scheduling, our approach is straightforward: understand the issue thoroughly, dispatch the right contractor promptly, and keep everyone informed until the work is signed off.",
    highlights: [
      "Rapid response to urgent maintenance callouts",
      "Vetted contractors delivering reliable, quality workmanship",
      "Full coordination so landlords never need to chase progress",
    ],
    support: [
      {
        title: "Emergency Repairs",
        text: "We prioritise genuine emergencies and coordinate immediate next steps with suitable contractors, keeping both landlord and tenant informed.",
      },
      {
        title: "Planned Maintenance",
        text: "Routine safety checks, EICR inspections, gas safety certificates, and improvement works are scheduled with clear timelines and advance notice.",
      },
      {
        title: "Transparent Updates",
        text: "Both landlord and tenant receive timely updates on access arrangements, progress, and completion so expectations are always managed.",
      },
    ],
    process: [
      {
        title: "Report the issue",
        text: "Share the property details, a clear description of the fault, any photographs available, and any access restrictions or preferred times.",
      },
      {
        title: "We co-ordinate the right contractor",
        text: "Our team assesses urgency, contacts a vetted tradesperson, and confirms the attendance window with all parties.",
      },
      {
        title: "Track progress to completion",
        text: "We follow up after the visit, confirm the repair is satisfactory, and provide any documentation needed for your records.",
      },
    ],
  },
  {
    slug: "mortgage-consultancy",
    href: "/other-services/mortgage-consultancy",
    label: "Mortgage Consultancy",
    description: "Straightforward mortgage guidance for buyers, landlords, and investors.",
    icon: "landmark",
    ctaLabel: "Discuss Mortgage Options",
    heroTitle: "Mortgage guidance that makes the path forward clearer.",
    heroText:
      "Letting Partners connects clients with experienced mortgage professionals who provide plain-English advice on residential, buy-to-let, and portfolio finance - helping you move forward with confidence.",
    panelLabel: "Practical Finance Guidance",
    image: PAGE_BANNER_IMAGES.mortgageConsultancy,
    storyImage: "https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=900&q=80",
    overview:
      "Whether you are purchasing your first home, reviewing an existing buy-to-let mortgage, or planning a property portfolio, we help you understand your options clearly and connect you with the right advice route.",
    highlights: [
      "Advice for first-time buyers, existing landlords, and portfolio investors",
      "Access to competitive products from across the broader mortgage market",
      "Support from initial enquiry through to full application and mortgage offer",
    ],
    support: [
      {
        title: "Residential Purchase Guidance",
        text: "Understand your borrowing capacity, deposit requirements, and the key stages of a residential mortgage application in plain, straightforward terms.",
      },
      {
        title: "Buy-to-Let Advice",
        text: "Review rental coverage calculations, available products, and the key considerations for landlords looking to purchase, refinance, or expand their portfolio.",
      },
      {
        title: "Application Support",
        text: "We guide you through lender requirements, supporting documentation, timescales, and the steps from application to formal mortgage offer.",
      },
    ],
    process: [
      {
        title: "Share your goal",
        text: "Tell us whether you are buying, remortgaging, investing, or simply exploring your current options.",
      },
      {
        title: "Review your position",
        text: "We help assess the key factors: income, deposit or equity, property type, preferred timescale, and the type of mortgage that may suit your circumstances.",
      },
      {
        title: "Move forward with clarity",
        text: "You receive practical next steps and continued support as your application progresses through to a formal mortgage offer.",
      },
    ],
  },
  {
    slug: "construction-development",
    href: "/other-services/construction-development",
    label: "Construction & Development",
    description: "End-to-end support for extensions, conversions, and new-build projects.",
    icon: "hardhat",
    ctaLabel: "Plan Your Project",
    heroTitle: "Construction and development delivered on time and on brief.",
    heroText:
      "Letting Partners supports property owners with extensions, conversions, loft developments, and new-build projects - combining reliable contractor coordination with clear communication throughout every stage.",
    panelLabel: "Build With Confidence",
    image: PAGE_BANNER_IMAGES.constructionDevelopment,
    storyImage: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=900&q=80",
    overview:
      "From initial planning conversations to contractor appointment and project handover, we help property owners shape quality development work without losing sight of budget, programme, or finish standard.",
    highlights: [
      "Comprehensive project management from planning application to handover",
      "Competitive tendering without compromising on build quality or specification",
      "Expert guidance on permitted development rights and planning requirements",
    ],
    support: [
      {
        title: "Extensions & Conversions",
        text: "Plan practical improvements - loft conversions, rear extensions, or outbuilding works - that add genuine value and improve the property's long-term rental or resale appeal.",
      },
      {
        title: "New-Build Development",
        text: "Co-ordinate the moving parts of a new-build project with clearer contractor communication, programme management, and regular progress reporting.",
      },
      {
        title: "Value-Led Planning",
        text: "Balance quality, cost, construction programme, and the property's rental or sale potential before a spade goes in the ground.",
      },
    ],
    process: [
      {
        title: "Define the scope",
        text: "Agree the property details, project objectives, specification, budget parameters, and any planning or permitted development considerations.",
      },
      {
        title: "Appoint and programme",
        text: "We assist with tendering, contractor selection, programme agreement, and setting up clear reporting milestones.",
      },
      {
        title: "Deliver and handover",
        text: "The build is tracked against programme and quality expectations, with a structured handover and snagging process at practical completion.",
      },
    ],
  },
];

export function getOtherServicePage(slug: string) {
  return OTHER_SERVICE_PAGES.find((page) => page.slug === slug);
}

export const SERVICE_GROUPS: ServiceGroup[] = [
  {
    href: "/tenant-services",
    label: "Tenant Services",
    eyebrow: "For Renters",
    description: "Practical support for every stage of your tenancy - from your first search to moving in and beyond.",
    overview:
      "Register your requirements, access our tenant guide, or explore student accommodation options with a team that genuinely supports renters.",
    icon: "key",
    image: "https://images.unsplash.com/photo-1536376072261-38c75010e6c9?w=600&q=80",
    ctaLabel: "View Tenant Services",
    highlights: [
      "Free tenant registration and property matching",
      "Student-friendly accommodation support",
      "Clear guidance on ASTs, deposits, and referencing",
    ],
    items: [
      {
        href: "/tenant-services/register-as-tenant",
        label: "Register As A Tenant",
        description: "Share your requirements and we will match you to available properties.",
        icon: "clipboard",
      },
      {
        href: "/tenant-services/student-accommodation",
        label: "Student Accommodation",
        description: "Rooms, studios, and shared houses suited to student life in London.",
        icon: "graduation",
      },
      {
        href: "/tenant-services/tenant-guide",
        label: "Tenant Guide",
        description: "Everything you need to know about ASTs, deposits, referencing, and your rights.",
        icon: "book",
      },
    ],
  },
  {
    href: "/landlord-services",
    label: "Landlord Services",
    eyebrow: "For Landlords",
    description: "Professional letting, management, and compliance support designed to protect your investment.",
    overview:
      "From tenant placement to full portfolio management, we handle the details so you can focus on what matters.",
    icon: "building",
    image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&q=80",
    ctaLabel: "View Landlord Services",
    highlights: [
      "Tenant placement and targeted marketing",
      "Full property management and maintenance coordination",
      "Transparent landlord guidance and compliance support",
    ],
    items: [
      {
        href: "/landlord-services/property-letting",
        label: "Property Letting",
        description: "List, market, and let your property with a professional, structured approach.",
        icon: "home",
      },
      {
        href: "/landlord-services/find-a-tenant",
        label: "Find A Tenant",
        description: "Reduce void periods with proactive listing and our pre-registered tenant pool.",
        icon: "user-plus",
      },
      {
        href: "/landlord-services/rent-to-rent",
        label: "Rent To Rent",
        description: "Explore guaranteed-income arrangements with structured sublet management.",
        icon: "trending",
      },
      {
        href: "/landlord-services/property-management",
        label: "Property Management",
        description: "Day-to-day management, maintenance co-ordination, and regular reporting.",
        icon: "wrench",
      },
      {
        href: "/landlord-services/landlord-guide",
        label: "Landlord Guide",
        description: "Read our guide to ASTs, deposits, compliance obligations, and service levels.",
        icon: "file",
      },
    ],
  },
  {
    href: "/specialist-legal-support",
    label: "Specialist Legal Support",
    eyebrow: "For Complex Situations",
    description: "Access to SRA-regulated legal specialists for disputes, rent arrears, and possession proceedings.",
    overview:
      "When a tenancy issue requires specialist attention, we connect you with trusted legal partners and remain your property point of contact throughout.",
    icon: "scale",
    image: "https://images.unsplash.com/photo-1505664194779-8beaceb93744?w=600&q=80",
    ctaLabel: "View Legal Support",
    highlights: [
      "Tenancy disputes and statutory notices",
      "Rent arrears recovery and possession proceedings",
      "Referral to SRA-regulated legal specialists",
    ],
    items: [
      {
        href: "/specialist-legal-support/disputes-notices",
        label: "Disputes & Legal Notices",
        description: "Section 8 and 21 notices, breach of tenancy, and deposit disputes.",
        icon: "file-check",
      },
      {
        href: "/specialist-legal-support/rent-arrears-possession",
        label: "Rent Arrears & Possession",
        description: "Arrears recovery strategies, possession proceedings, and court representation.",
        icon: "coins",
      },
      {
        href: "/specialist-legal-support/request-support",
        label: "Request Legal Support",
        description: "Complete a short form and we will connect you with the right specialist promptly.",
        icon: "headphones",
      },
    ],
  },
  {
    href: "/other-services",
    label: "Additional Services",
    eyebrow: "Property Extras",
    description: "Maintenance co-ordination, mortgage guidance, and construction support for property owners.",
    overview:
      "Complete your property plans with dependable maintenance co-ordination, plain-English mortgage guidance, and full construction oversight.",
    icon: "wrench",
    image: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=600&q=80",
    ctaLabel: "View Additional Services",
    highlights: [
      "Repair and maintenance co-ordination",
      "Mortgage consultancy and finance guidance",
      "Construction, conversion, and development support",
    ],
    items: OTHER_SERVICE_PAGES.map(({ href, label, description, icon }) => ({
      href,
      label,
      description,
      icon,
    })),
  },
];

export function isServiceHrefCurrent(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isServicesCurrent(pathname: string) {
  return pathname === "/services" || SERVICE_GROUPS.some((group) => isServiceHrefCurrent(pathname, group.href));
}
