export type Area = {
  coverageLabel: string;
  description: string;
  focusPoints: string[];
  image: string;
  marketSummary: string;
  menuDescription: string;
  neighbourhoods: string[];
  overview: string;
  slug: string;
  stats: Array<{ label: string; value: string }>;
  title: string;
  seoTitle: string;
  seoDescription: string;
  tenantHighlights: string[];
  landlordHighlights: string[];
  faqs: Array<{ question: string; answer: string }>;
};

export const AREAS: Area[] = [
  {
    slug: "ilford",
    title: "Ilford",
    coverageLabel: "East London Hub",
    description: "Thriving rental market in the heart of East London.",
    image: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=900&q=80",
    menuDescription: "One of East London's busiest rental corridors with excellent Crossrail and Tube connections.",
    overview:
      "Ilford sits at the centre of East London's most active rental corridor, drawing a diverse mix of commuters, families, and young professionals. Letting Partners helps landlords and tenants navigate this fast-moving market with clear guidance and reliable, hands-on support.",
    marketSummary:
      "With the Elizabeth line significantly cutting journey times into Central London, demand for well-presented properties in Ilford continues to grow. Landlords benefit from strong occupancy rates, while tenants gain access to a genuinely competitive range of options.",
    focusPoints: [
      "Exceptional Elizabeth line access reducing commute times to central London.",
      "Strong demand across studio flats, one-bed apartments, and family houses.",
      "A diverse, vibrant community that attracts a broad range of renters.",
    ],
    neighbourhoods: ["Ilford town centre", "Seven Kings", "Barkingside", "Valentines Park area"],
    stats: [
      { value: "Elizabeth", label: "line connectivity" },
      { value: "High", label: "tenant demand" },
      { value: "Diverse", label: "property range" },
    ],
    seoTitle: "Property Letting & Rentals in Ilford, East London | Letting Partners",
    seoDescription:
      "Find rental properties and landlord services in Ilford with Letting Partners. Expert letting, management, and tenant support across East London's thriving rental market.",
    tenantHighlights: [
      "Access a wide range of Ilford rentals from studios to family homes.",
      "Elizabeth line links offering fast, reliable commutes into the City and West End.",
      "Guided support through your tenancy from referencing to move-in day.",
    ],
    landlordHighlights: [
      "High occupancy rates driven by consistent Elizabeth line commuter demand.",
      "Proactive tenant matching and marketing across Ilford's active rental market.",
      "Full property management and maintenance coordination for Ilford landlords.",
    ],
    faqs: [
      {
        question: "Why is Ilford a strong location for rental investment?",
        answer:
          "Ilford benefits from direct Elizabeth line access, improving commute times considerably. This drives sustained tenant demand, strong rental yields, and low void periods for well-presented properties.",
      },
      {
        question: "What types of property does Letting Partners handle in Ilford?",
        answer:
          "We handle a full range — studios, one- and two-bed apartments, rooms, and family houses. Whether you are a landlord with a single let or a growing portfolio, we can support you.",
      },
      {
        question: "How do tenants register for Ilford properties?",
        answer:
          "Register your requirements online or get in touch directly. We match registered tenants to available Ilford properties based on budget, bedroom requirement, and preferred move-in date.",
      },
      {
        question: "Can Letting Partners manage my Ilford property fully?",
        answer:
          "Yes. Our full management service covers tenant placement, monthly rent collection, maintenance coordination, and regular property updates so you remain fully informed without day-to-day involvement.",
      },
    ],
  },
  {
    slug: "redbridge",
    title: "Redbridge",
    coverageLabel: "Vibrant East London",
    description: "A sought-after borough with excellent transport links.",
    image: "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=900&q=80",
    menuDescription: "Popular east London borough combining residential appeal with strong transport connections.",
    overview:
      "Redbridge combines leafy residential streets with excellent Central line and Elizabeth line connections, making it one of East London's most appealing boroughs for both tenants seeking value and landlords seeking reliable demand. Letting Partners brings local knowledge and dependable service to every instruction in this area.",
    marketSummary:
      "The borough's mix of well-maintained housing stock, good schools, and straightforward connections into the City makes Redbridge particularly attractive to families and professionals. Demand consistently outpaces supply in desirable pockets, creating favourable conditions for landlords.",
    focusPoints: [
      "Strong demand from families attracted by schools and green space.",
      "Central line access making London-wide commuting straightforward.",
      "A stable, long-term tenant base that reduces costly void periods.",
    ],
    neighbourhoods: ["Woodford", "Wanstead", "South Woodford", "Gants Hill"],
    stats: [
      { value: "Stable", label: "tenant demand" },
      { value: "Family", label: "friendly borough" },
      { value: "Strong", label: "rental yields" },
    ],
    seoTitle: "Property Letting & Rentals in Redbridge | Letting Partners",
    seoDescription:
      "Rental properties and landlord services across Redbridge with Letting Partners. Dependable letting, management, and tenant support in this sought-after East London borough.",
    tenantHighlights: [
      "Browse Redbridge rentals across leafy residential streets and well-connected areas.",
      "Practical guidance from first enquiry right through to moving in.",
      "Straightforward support for referencing, deposits, and tenancy agreements.",
    ],
    landlordHighlights: [
      "Consistent Redbridge tenant demand with a stable, long-term renter profile.",
      "Professional property marketing and tenant matching to minimise void periods.",
      "Comprehensive management support for Redbridge landlords seeking peace of mind.",
    ],
    faqs: [
      {
        question: "Is Redbridge popular with families renting?",
        answer:
          "Yes. Redbridge is known for its good schools, parks, and quieter residential feel while remaining well connected. This draws families who tend to stay longer, which is positive for landlords seeking stable occupancy.",
      },
      {
        question: "What transport links does Redbridge offer?",
        answer:
          "The Central line serves Woodford, South Woodford, Wanstead, and Gants Hill. The Elizabeth line also runs through parts of the borough, with multiple bus routes filling the gaps.",
      },
      {
        question: "How quickly can Letting Partners find a tenant in Redbridge?",
        answer:
          "In active pockets like South Woodford and Wanstead, well-priced properties typically attract interest within days. Our proactive approach and established tenant network helps reduce void periods significantly.",
      },
      {
        question: "Does Letting Partners cover the whole of Redbridge?",
        answer:
          "Yes. We cover the entire borough including Woodford, Wanstead, South Woodford, Gants Hill, and Barkingside. Contact us to discuss your specific road or area.",
      },
    ],
  },
  {
    slug: "stratford",
    title: "Stratford",
    coverageLabel: "Regeneration Hotspot",
    description: "East London's most transformed rental destination.",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/London_Queen_Elizabeth_Olympic_Park.jpg/1280px-London_Queen_Elizabeth_Olympic_Park.jpg",
    menuDescription: "Post-Olympic regeneration area with new-build demand and exceptional transport links.",
    overview:
      "Stratford has undergone one of London's most dramatic regenerations, driven by the 2012 Olympics and substantial ongoing investment. Today it attracts young professionals, international tenants, and investors drawn by its connectivity, modern housing stock, and thriving local economy. Letting Partners helps clients make the most of this dynamic market.",
    marketSummary:
      "The Westfield Stratford shopping centre, Queen Elizabeth Olympic Park, and some of London's best transport links — including Jubilee, Central, DLR, and Elizabeth line — make this one of the capital's most competitive rental zones for tenants and one of the most rewarding for landlords.",
    focusPoints: [
      "Exceptional multi-line transport including Jubilee, Central, DLR, and Elizabeth line.",
      "Strong new-build stock attracting corporate and professional tenants.",
      "Growing food, culture, and leisure scene increasing lifestyle appeal.",
    ],
    neighbourhoods: ["Stratford International", "Olympic Park", "Maryland", "Forest Gate borders"],
    stats: [
      { value: "Multi-line", label: "transport hub" },
      { value: "New-build", label: "focused stock" },
      { value: "High", label: "rental demand" },
    ],
    seoTitle: "Property Letting & Rentals in Stratford, East London | Letting Partners",
    seoDescription:
      "Find rental properties and landlord services in Stratford with Letting Partners. Expert letting and management in East London's fastest-growing rental destination.",
    tenantHighlights: [
      "Access modern Stratford rentals near the Olympic Park and Westfield.",
      "Unmatched transport connections making the whole of London easily reachable.",
      "Expert guidance through referencing, deposits, and your Stratford move-in.",
    ],
    landlordHighlights: [
      "New-build and purpose-built stock commanding premium rents in Stratford.",
      "Professional tenant placement drawing from a pool of corporate and professional renters.",
      "Full management services for Stratford landlords seeking hands-off oversight.",
    ],
    faqs: [
      {
        question: "Why is Stratford one of East London's best rental investments?",
        answer:
          "Stratford combines five tube and rail lines, a major shopping destination, the Olympic Park, and ongoing regeneration. This drives sustained tenant demand and strong capital growth prospects.",
      },
      {
        question: "What type of tenants typically look in Stratford?",
        answer:
          "Stratford attracts a mix of young professionals working in the City or Canary Wharf, international tenants, and couples looking for modern living at a more accessible price point than Zone 1 and 2.",
      },
      {
        question: "Are there good rental options for tenants on different budgets?",
        answer:
          "Yes. Stratford offers everything from shared rooms to luxury new-build apartments. We can help match you to properties that suit your budget and lifestyle.",
      },
      {
        question: "Does Letting Partners handle new-build lettings in Stratford?",
        answer:
          "Yes. We work with both individual landlords and developers, handling everything from professional photography and listing to full ongoing management.",
      },
    ],
  },
  {
    slug: "barking",
    title: "Barking",
    coverageLabel: "Affordable East London",
    description: "Great-value rents with excellent transport access.",
    image: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=900&q=80",
    menuDescription: "Affordable and well-connected east London area popular with value-conscious renters.",
    overview:
      "Barking offers some of East London's most competitive rental prices while maintaining strong transport links into the City and central London. For landlords, this translates into consistent demand from a wide tenant pool; for renters, it represents genuine value in a well-served location. Letting Partners brings a professional approach to every instruction in Barking.",
    marketSummary:
      "With the District line, Overground, and Elizabeth line accessible within the area, Barking draws renters who prioritise affordability without compromising on connectivity. New developments are steadily upgrading the housing stock, making this a market worth watching closely.",
    focusPoints: [
      "Some of East London's most competitive rental prices for tenants and strong yields for landlords.",
      "District and Hammersmith & City line connections for straightforward City commutes.",
      "Growing local amenities and regeneration improving long-term appeal.",
    ],
    neighbourhoods: ["Barking town centre", "Longbridge Road area", "Thames View", "Gascoigne Estate"],
    stats: [
      { value: "Affordable", label: "rental prices" },
      { value: "District", label: "line access" },
      { value: "Growing", label: "regeneration" },
    ],
    seoTitle: "Property Letting & Rentals in Barking | Letting Partners",
    seoDescription:
      "Find affordable rental properties and landlord services in Barking with Letting Partners. Reliable letting and management across East London's most accessible rental market.",
    tenantHighlights: [
      "Excellent value rentals with direct District and Hammersmith & City line access.",
      "A welcoming, diverse community with improving local amenities.",
      "Clear guidance from registration through to securing your Barking tenancy.",
    ],
    landlordHighlights: [
      "Strong and consistent tenant demand driven by affordability in East London.",
      "Competitive yields with reliable occupancy across studios, rooms, and flats.",
      "End-to-end letting and management services for Barking landlords.",
    ],
    faqs: [
      {
        question: "Is Barking a good area for first-time renters?",
        answer:
          "Yes. Barking's lower rent levels make it one of London's most accessible markets for first-time renters and those on tighter budgets who still need good transport links.",
      },
      {
        question: "What tube and rail lines serve Barking?",
        answer:
          "Barking station is served by the District, Hammersmith & City, and Overground lines. The Elizabeth line is also accessible nearby, making City and Canary Wharf commutes straightforward.",
      },
      {
        question: "Are rents in Barking increasing?",
        answer:
          "Yes. Regeneration investment and improving transport links are gradually pushing rents upward, though Barking remains considerably more affordable than many comparable East London areas.",
      },
      {
        question: "Can Letting Partners help with furnished and unfurnished lets in Barking?",
        answer:
          "Yes. We handle furnished and unfurnished lets across all property types in Barking. Let us know your specific requirements and we will advise accordingly.",
      },
    ],
  },
  {
    slug: "walthamstow",
    title: "Walthamstow",
    coverageLabel: "Creative East London",
    description: "One of London's most in-demand and vibrant areas.",
    image: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=900&q=80",
    menuDescription: "Hugely popular east London area with a creative scene and strong Victoria line access.",
    overview:
      "Walthamstow has firmly established itself as one of London's most desirable rental destinations, combining an independent food and arts scene with fast Victoria line access into the City. Letting Partners understands both sides of this thriving market — helping landlords achieve strong, consistent returns and tenants find exactly the right home.",
    marketSummary:
      "Demand in Walthamstow remains intense, driven by renters priced out of neighbouring Hackney and Stoke Newington but unwilling to compromise on culture, community, or connectivity. Properties here let quickly and consistently, making strong presentation and fast follow-up essential.",
    focusPoints: [
      "Direct Victoria line access to Oxford Circus in under 20 minutes.",
      "Thriving independent food, arts, and social scene attracting creative professionals.",
      "Intense rental demand keeping void periods low for landlords.",
    ],
    neighbourhoods: ["Walthamstow Village", "Wood Street", "Highams Park border", "St James Street"],
    stats: [
      { value: "Victoria", label: "line access" },
      { value: "Creative", label: "community hub" },
      { value: "Low", label: "void periods" },
    ],
    seoTitle: "Property Letting & Rentals in Walthamstow | Letting Partners",
    seoDescription:
      "Find rental properties and landlord services in Walthamstow with Letting Partners. Expert letting and management in one of East London's most sought-after rental markets.",
    tenantHighlights: [
      "Access some of London's most sought-after rentals in a vibrant, creative community.",
      "Victoria line connections making central London a swift, straightforward commute.",
      "Professional support through your entire Walthamstow tenancy journey.",
    ],
    landlordHighlights: [
      "Intense Walthamstow demand keeps properties occupied with quality tenants.",
      "High-quality marketing and presentation to attract motivated, reliable renters.",
      "Comprehensive property management for Walthamstow landlords seeking less involvement.",
    ],
    faqs: [
      {
        question: "How competitive is the Walthamstow rental market?",
        answer:
          "Very. Properties in popular pockets like Walthamstow Village and Wood Street regularly attract multiple applicants within days of listing. Professional presentation and fast follow-up are essential.",
      },
      {
        question: "What is the typical commute from Walthamstow to Central London?",
        answer:
          "The Victoria line from Walthamstow Central reaches Oxford Circus in around 18 minutes, making it one of East London's fastest connections to the West End and City.",
      },
      {
        question: "Is Walthamstow suitable for families renting?",
        answer:
          "Yes. The area offers good schools, Victoria Park proximity, and a strong sense of community. Families regularly choose Walthamstow for its combination of culture, green space, and connectivity.",
      },
      {
        question: "Does Letting Partners cover all of Walthamstow?",
        answer:
          "Yes. We cover Walthamstow Central, Walthamstow Village, Wood Street, St James Street, and surrounding streets. Contact us to discuss your particular road or property.",
      },
    ],
  },
  {
    slug: "croydon",
    title: "Croydon",
    coverageLabel: "South London Hub",
    description: "South London's largest borough with strong rental demand.",
    image: "https://images.unsplash.com/photo-1567496898669-ee935f5f647a?w=900&q=80",
    menuDescription: "South London's major commercial and residential hub with fast central London rail links.",
    overview:
      "Croydon is South London's largest and most active commercial centre, offering some of the region's most competitive property prices alongside fast rail connections into London Bridge and Victoria. Letting Partners supports both landlords and tenants here with structured, responsive service and genuine local expertise.",
    marketSummary:
      "Ongoing regeneration, a growing professional population, and strong transport infrastructure have positioned Croydon as a compelling choice for value-conscious renters and yield-focused landlords. The Thameslink and Southern services, combined with the Tramlink network, make the whole of South London accessible.",
    focusPoints: [
      "Fast rail services reaching London Bridge in under 15 minutes.",
      "Lower rental prices than comparable Zone 3 South London areas.",
      "Active regeneration improving the commercial and residential environment.",
    ],
    neighbourhoods: ["Central Croydon", "Purley", "South Croydon", "Norbury borders"],
    stats: [
      { value: "15 min", label: "to London Bridge" },
      { value: "Competitive", label: "rent levels" },
      { value: "Regenerating", label: "town centre" },
    ],
    seoTitle: "Property Letting & Rentals in Croydon | Letting Partners",
    seoDescription:
      "Find rental properties and landlord services in Croydon with Letting Partners. Professional letting, management, and tenant support across South London's largest borough.",
    tenantHighlights: [
      "Access competitive Croydon rentals with excellent rail links into the City.",
      "A wide range of property types from studios to spacious family homes.",
      "Professional support guiding you through your South London tenancy.",
    ],
    landlordHighlights: [
      "Steady Croydon tenant demand driven by value-seeking commuters and families.",
      "Proactive marketing and tenant matching to keep your property occupied.",
      "Full property management for Croydon landlords who want less day-to-day involvement.",
    ],
    faqs: [
      {
        question: "Is Croydon a good area for rental investment?",
        answer:
          "Croydon offers strong rental yields relative to its property prices, particularly in central areas. Ongoing regeneration and improving transport links make it a market worth considering for medium to long-term investment.",
      },
      {
        question: "What transport options are available in Croydon?",
        answer:
          "Croydon is exceptionally well served. Thameslink and Southern rail connect to London Bridge, Victoria, and Gatwick. The Tramlink network links Croydon to Wimbledon and Beckenham, while multiple bus routes extend coverage across the borough.",
      },
      {
        question: "Can Letting Partners find tenants for HMOs in Croydon?",
        answer:
          "Yes. We handle single lets, HMO rooms, and multi-unit portfolios across Croydon. Please contact us to discuss your specific property type and licensing requirements.",
      },
      {
        question: "How long does it typically take to let a Croydon property?",
        answer:
          "Well-priced and well-presented properties in Central Croydon and South Croydon regularly find tenants within one to two weeks of listing. Our proactive approach and tenant network help keep void periods short.",
      },
    ],
  },
  {
    slug: "hounslow",
    title: "Hounslow",
    coverageLabel: "West London Gateway",
    description: "West London's best-connected area near Heathrow.",
    image: "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=900&q=80",
    menuDescription: "Well-connected west London area with Piccadilly line access and strong airport-linked demand.",
    overview:
      "Hounslow occupies a unique position in West London — easily accessible via the Piccadilly line, close to Heathrow Airport, and offering genuinely competitive rents compared to neighbouring Chiswick and Richmond. Letting Partners helps landlords and tenants in Hounslow navigate a market shaped by international demand, good schools, and strong transport infrastructure.",
    marketSummary:
      "The borough's proximity to Heathrow creates a distinctive tenant pool that includes airline crew, airport professionals, and international families. Combined with Piccadilly line access to central London, this generates consistent, year-round rental demand that benefits well-managed properties.",
    focusPoints: [
      "Piccadilly line direct to central London and Heathrow Airport.",
      "Distinctive tenant pool including aviation professionals and international families.",
      "More competitive rents than neighbouring Chiswick and Richmond.",
    ],
    neighbourhoods: ["Hounslow town centre", "Isleworth", "Heston", "Osterley"],
    stats: [
      { value: "Piccadilly", label: "line access" },
      { value: "Heathrow", label: "proximity" },
      { value: "Diverse", label: "tenant pool" },
    ],
    seoTitle: "Property Letting & Rentals in Hounslow | Letting Partners",
    seoDescription:
      "Find rental properties and landlord services in Hounslow with Letting Partners. Expert letting and property management in West London's most connected borough.",
    tenantHighlights: [
      "Access affordable Hounslow rentals with direct Piccadilly line connections.",
      "A well-served borough with excellent schools and local amenities.",
      "Professional support through your entire Hounslow tenancy from start to finish.",
    ],
    landlordHighlights: [
      "Consistent Hounslow demand from aviation professionals and international tenants.",
      "Competitive yields in a borough offering more value than neighbouring areas.",
      "Full property management and maintenance coordination for Hounslow landlords.",
    ],
    faqs: [
      {
        question: "Who typically rents in Hounslow?",
        answer:
          "Hounslow attracts a particularly diverse mix including aviation crew based at Heathrow, international families relocating to the UK, NHS staff from West Middlesex Hospital, and professionals commuting via the Piccadilly line.",
      },
      {
        question: "Is Hounslow well served by public transport?",
        answer:
          "Yes. The Piccadilly line provides direct access to central London. Multiple bus routes and proximity to the A4 and M4 also make Hounslow one of West London's most practically connected boroughs.",
      },
      {
        question: "Are there family-sized rentals available in Hounslow?",
        answer:
          "Yes. Hounslow has a good selection of three- and four-bedroom houses, particularly in Isleworth and Heston, suitable for families seeking space at competitive West London prices.",
      },
      {
        question: "Does Letting Partners handle HMO management in Hounslow?",
        answer:
          "Yes. We manage individual lets and larger HMOs across Hounslow, including compliance advice around licencing requirements. Contact us to discuss your specific property.",
      },
    ],
  },
  {
    slug: "birmingham",
    title: "Birmingham",
    coverageLabel: "UK's Second City",
    description: "The Midlands' powerhouse rental market.",
    image: "https://images.unsplash.com/photo-1520450202524-87e5dd06a74b?w=900&q=80",
    menuDescription: "UK's second city offering diverse rental opportunities with strong occupancy across the Midlands.",
    overview:
      "Birmingham is one of the UK's most dynamic rental markets, combining a large and growing population, a thriving student and graduate community, and a diverse economy spanning finance, manufacturing, and professional services. Letting Partners brings the same standard of professional letting and management to Birmingham that our London clients benefit from.",
    marketSummary:
      "With the Commonwealth Games legacy, ongoing HS2 development, and significant inward investment, Birmingham's rental market continues to strengthen. Strong yields and consistent occupancy make the city attractive for both portfolio landlords and those entering the market for the first time.",
    focusPoints: [
      "Strong rental yields compared to the capital with consistent tenant demand.",
      "Large student and graduate population supporting diverse property types.",
      "Continued regeneration and infrastructure investment improving long-term value.",
    ],
    neighbourhoods: ["City Centre", "Digbeth", "Harborne", "Edgbaston"],
    stats: [
      { value: "Strong", label: "rental yields" },
      { value: "Diverse", label: "tenant profile" },
      { value: "Growing", label: "investment case" },
    ],
    seoTitle: "Property Letting & Rentals in Birmingham | Letting Partners",
    seoDescription:
      "Find rental properties and landlord services in Birmingham with Letting Partners. Professional letting, management, and tenant support across the UK's second city.",
    tenantHighlights: [
      "Browse a wide range of Birmingham rentals from city-centre apartments to suburban homes.",
      "A genuinely diverse city offering culture, employment, and community in equal measure.",
      "Practical support through referencing, tenancy agreements, and your Birmingham move.",
    ],
    landlordHighlights: [
      "Strong Birmingham yields underpinned by consistent occupancy across property types.",
      "Proactive marketing and tenant placement to keep your property earning.",
      "Full property management for Birmingham landlords who want structured, remote oversight.",
    ],
    faqs: [
      {
        question: "Why invest in Birmingham's rental market?",
        answer:
          "Birmingham combines strong yields, a growing population, significant regeneration investment, and lower entry prices than London. The HS2 connection, when complete, will further improve the city's connectivity and appeal.",
      },
      {
        question: "What areas of Birmingham does Letting Partners cover?",
        answer:
          "We cover Birmingham city centre, Digbeth, Harborne, Edgbaston, and key surrounding suburbs. Get in touch to discuss your specific location or portfolio.",
      },
      {
        question: "Is Birmingham a good market for HMO investment?",
        answer:
          "Yes. Birmingham's large student and young professional population makes HMO investment attractive in the right locations. We advise on licencing requirements and can manage HMOs across the city.",
      },
      {
        question: "How does Letting Partners manage properties remotely in Birmingham?",
        answer:
          "We provide regular property updates, digital reporting, and direct communication so landlords based elsewhere in the UK can manage their Birmingham portfolios with confidence.",
      },
    ],
  },
];

export function getAreaHref(slug: string) {
  return `/areas/${slug}`;
}

export function getAreaPropertiesHref(slug: string) {
  const area = AREAS.find((a) => a.slug === slug);
  return `/properties?area=${encodeURIComponent(area?.title ?? slug)}`;
}

export function getAreaBySlug(slug: string) {
  return AREAS.find((area) => area.slug === slug) || null;
}
