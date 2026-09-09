import { config as loadEnv } from "dotenv";
import postgres from "postgres";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

/**
 * Three opening articles, so the blog is not launched empty.
 *
 * Written to be genuinely useful rather than filler: each answers a question
 * landlords and tenants actually ask, and each carries its own focus keyword,
 * meta title, meta description and FAQ schema.
 *
 *   node scripts/seed-blog.mjs           add any that are missing
 *   node scripts/seed-blog.mjs --force   rewrite them even if they exist
 */

const force = process.argv.includes("--force");

/** Unsplash, which the site already uses for photography elsewhere. */
const IMG = {
  compliance:
    "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=1600&q=80",
  hmo: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1600&q=80",
  deposit:
    "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1600&q=80",
};

function faqSchema(pairs) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: pairs.map(([question, answer]) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  });
}

const POSTS = [
  {
    slug: "landlord-legal-requirements-uk-checklist",
    title: "The Landlord Legal Requirements Checklist for 2026",
    focusKeyword: "landlord legal requirements",
    metaTitle: "Landlord Legal Requirements UK: 2026 Compliance Checklist",
    metaDescription:
      "Every certificate, deposit rule and document a UK landlord needs before a tenant moves in, and what happens to your notice if any of it is missing.",
    excerpt:
      "Gas, electrics, EPC, deposit protection and the documents that must be served before move-in. Miss one and a section 21 notice can be invalid for the length of the tenancy.",
    bannerImageUrl: IMG.compliance,
    bannerImageAlt: "A row of British terraced houses on a residential street",
    publishedAt: "2026-08-18T09:00:00.000Z",
    schema: faqSchema([
      [
        "What certificates does a UK landlord legally need?",
        "A valid Gas Safety Record renewed every 12 months, an Electrical Installation Condition Report renewed every five years, and an Energy Performance Certificate of band E or above. Copies of all three must be given to the tenant.",
      ],
      [
        "How long do I have to protect a tenancy deposit?",
        "Within 30 days of receiving it. The prescribed information must reach the tenant in the same 30 days. Missing the deadline can mean a penalty of one to three times the deposit and blocks a section 21 notice.",
      ],
      [
        "Can I serve a section 21 notice if paperwork is missing?",
        "No. If the gas record, EPC, How to Rent guide or deposit protection was not dealt with correctly, a section 21 notice is invalid until the failure is put right, and for the deposit that may mean returning it first.",
      ],
    ]),
    body: `
<p>Most landlord disputes we see do not start with a difficult tenant. They start with a document that was never served, noticed only when the landlord wants the property back and finds they cannot get it. Compliance is unglamorous, but it is the difference between a two-month possession process and a two-year one.</p>

<p>Here is what has to be in place before a tenant moves in.</p>

<h2>The three certificates</h2>

<p>Every tenancy needs the same three documents, and all three must be given to the tenant, not merely obtained.</p>

<ul>
<li><strong>Gas Safety Record.</strong> Renewed every 12 months by a Gas Safe registered engineer, covering every gas appliance and flue. The tenant gets a copy before they move in, and within 28 days of each new check.</li>
<li><strong>Electrical Installation Condition Report (EICR).</strong> Renewed every five years, or sooner if the report says so. Any C1 or C2 fault must be remedied within 28 days, with written confirmation to the tenant.</li>
<li><strong>Energy Performance Certificate (EPC).</strong> Valid for ten years, and must be band E or above to let the property at all. Advertising a property without displaying its rating is itself an offence.</li>
</ul>

<blockquote>An expired gas record is not a paperwork problem. It suspends your ability to use a section 21 notice until it is corrected.</blockquote>

<h2>The deposit</h2>

<p>A tenancy deposit must be protected in one of the three government-approved schemes within 30 days of receiving it. The same 30 days applies to serving the prescribed information, which tells the tenant which scheme holds the money and how to get it back.</p>

<p>Deposits are capped at five weeks' rent where the annual rent is under £50,000. Taking more is unlawful, and the excess must be returned before a section 21 notice can be served.</p>

<h2>The documents served at the start</h2>

<p>Alongside the certificates, three more items must reach the tenant before or at the start of the tenancy:</p>

<ol>
<li>The current <strong>How to Rent</strong> guide, in the edition that was live on the day the tenancy began.</li>
<li>Proof of <strong>deposit protection</strong> and the prescribed information.</li>
<li>A written <strong>tenancy agreement</strong>, which is not legally compulsory but is the only practical way to evidence what was agreed.</li>
</ol>

<h2>Right to Rent</h2>

<p>In England, you must check that every adult occupier has the right to rent before the tenancy starts. The check has to be done on the original documents or through the Home Office online service, and a copy kept for the length of the tenancy plus a year. Getting this wrong carries a civil penalty, and doing it selectively by nationality is discrimination.</p>

<h2>Licensing</h2>

<p>Many London boroughs operate additional or selective licensing, and almost every house in multiple occupation of five or more people needs a mandatory HMO licence. Letting an unlicensed property that needs a licence exposes you to a rent repayment order of up to 12 months' rent, and again blocks section 21.</p>

<p>Licensing is local, changes often, and is the requirement landlords most commonly miss. Check the borough directly rather than assuming.</p>

<h2>What we do about it</h2>

<p>On managed properties we track every certificate expiry and start the renewal before it lapses, keep the serving of documents evidenced, and check licensing whenever a property is onboarded. It is the least interesting part of the job and the part that protects everything else.</p>

<p>If you are not sure where your paperwork stands, <a href="/contact">ask us for a compliance review</a>. It takes an afternoon and it is a great deal cheaper than a failed possession claim.</p>
`,
  },
  {
    slug: "is-an-hmo-worth-it-for-landlords",
    title: "Is an HMO Worth It? The Honest Numbers for Landlords",
    focusKeyword: "HMO",
    metaTitle: "Is an HMO Worth It? Real Yields, Costs and Rules for Landlords",
    metaDescription:
      "HMO yields look far better than a single let until you price in licensing, bills, voids and management. Here is the honest arithmetic before you convert.",
    excerpt:
      "A room-by-room let can earn substantially more than a single tenancy. It also costs more to run, is regulated more heavily, and needs managing every week rather than every year.",
    bannerImageUrl: IMG.hmo,
    bannerImageAlt: "A bright shared living room in a house in multiple occupation",
    publishedAt: "2026-08-27T09:00:00.000Z",
    schema: faqSchema([
      [
        "Do all HMOs need a licence?",
        "Any property let to five or more people forming more than one household needs a mandatory HMO licence. Many councils also run additional licensing schemes covering smaller HMOs, so the local rules decide.",
      ],
      [
        "Is an HMO more profitable than a single let?",
        "Usually on gross yield, often by a wide margin, but the gap narrows once bills, licensing, higher management costs and room voids are counted. Compare net figures, not headline rents.",
      ],
      [
        "Can I convert any house into an HMO?",
        "No. Article 4 directions in many boroughs remove permitted development rights, meaning planning permission is required even for a small HMO. Room sizes, fire safety and amenity standards also apply.",
      ],
    ]),
    body: `
<p>A three-bedroom house in east London might let to a family for £1,800 a month. The same house, let room by room, might bring in £2,700. That gap is why landlords ask us about HMOs, and it is real. It is also not the whole picture.</p>

<h2>Where the extra money goes</h2>

<p>Gross rent rises. So does almost everything else.</p>

<ul>
<li><strong>Bills.</strong> Room rents are usually inclusive. Gas, electricity, water, broadband and a TV licence on a five-bed HMO commonly run to £350 to £500 a month.</li>
<li><strong>Licensing.</strong> A mandatory HMO licence typically costs several hundred to over a thousand pounds for five years, plus the works the council requires to grant it.</li>
<li><strong>Fire safety.</strong> Interlinked alarms, fire doors, emergency lighting and signage. On a conversion this is rarely under a few thousand pounds.</li>
<li><strong>Management.</strong> Five tenancies, five deposits, five move-ins and five sets of arrears to chase. Management fees are higher because the work genuinely is.</li>
<li><strong>Voids.</strong> A single let is either full or empty. An HMO is usually 80 to 100 per cent full, and that missing room is a permanent line in your budget.</li>
</ul>

<blockquote>Compare net yield against net yield. An HMO that beats a single let on gross rent and loses on net is a much busier way to earn the same money.</blockquote>

<h2>The rules that decide whether you can</h2>

<p>Three things determine whether a property can become an HMO at all:</p>

<ol>
<li><strong>Planning.</strong> Many boroughs have Article 4 directions removing the permitted development right to convert to a small HMO. Where one applies, you need planning permission, and it is not always granted.</li>
<li><strong>Licensing.</strong> Five or more occupiers forming more than one household means a mandatory licence. Additional licensing schemes catch smaller properties in many areas.</li>
<li><strong>Standards.</strong> Minimum room sizes, a set ratio of bathrooms and kitchen facilities to occupiers, and full fire safety provision. A room under 6.51 square metres cannot be let to an adult at all.</li>
</ol>

<h2>Who an HMO actually suits</h2>

<p>In our experience it works for landlords who want yield and accept involvement. It works badly for landlords who wanted a passive investment and were sold on the gross figure.</p>

<p>It also depends heavily on the property. A house with a second reception that can become a bedroom while leaving a communal space is a good candidate. A house where every room becomes a bedroom and tenants have nowhere to sit is a difficult property to keep let.</p>

<h2>The honest summary</h2>

<p>An HMO done properly, in the right area, with a landlord who is either hands-on or paying for proper management, earns meaningfully more than a single let. Done casually, it earns a little more and costs a great deal more attention.</p>

<p>If you are weighing a conversion, <a href="/landlord-services/property-management">talk to us before you commit</a>. We will run the net numbers on your actual property and tell you honestly if it is not worth it.</p>
`,
  },
  {
    slug: "tenancy-deposit-disputes-how-to-win",
    title: "Tenancy Deposit Disputes: What Actually Decides Them",
    focusKeyword: "tenancy deposit dispute",
    metaTitle: "Tenancy Deposit Disputes: What Adjudicators Actually Look For",
    metaDescription:
      "Most deposit deductions fail for the same reason: no evidence. What landlords and tenants each need to prove a claim, and what fair wear and tear really means.",
    excerpt:
      "Deposit adjudication is decided on evidence, not on who sounds more reasonable. Here is what counts as evidence, and why fair wear and tear defeats most claims.",
    bannerImageUrl: IMG.deposit,
    bannerImageAlt: "Keys and paperwork on a kitchen worktop at the end of a tenancy",
    publishedAt: "2026-09-03T09:00:00.000Z",
    schema: faqSchema([
      [
        "Who decides a tenancy deposit dispute?",
        "An independent adjudicator appointed by the deposit scheme protecting the money. The decision is based only on the written evidence both sides submit, and it is binding.",
      ],
      [
        "What is fair wear and tear?",
        "Deterioration from normal use over the length of the tenancy, taking account of how many people lived there. Faded paint, worn carpet in a hallway and minor scuffs are wear and tear. Burns, stains and holes are damage.",
      ],
      [
        "Can a landlord deduct the full cost of replacing a damaged item?",
        "Rarely. Adjudicators apply betterment: the landlord is compensated for the remaining life the item had, not the cost of a new one. A carpet damaged in year eight of a ten-year life attracts about a fifth of its replacement cost.",
      ],
    ]),
    body: `
<p>Deposit adjudication is not a negotiation and it is not a hearing. An independent adjudicator reads what both sides submit and decides. Nobody is interviewed, nobody visits the property, and nothing is taken on trust. Whoever evidenced their position wins.</p>

<h2>The inventory decides most cases</h2>

<p>A deposit claim is a comparison between the condition at the start and the condition at the end. Without a check-in inventory, there is nothing to compare to, and the adjudicator has no basis to award a deduction however obvious the damage looks.</p>

<p>A useful inventory is dated, detailed, photographed, and signed by the tenant. "Kitchen: good condition" evidences nothing. "Worktop: laminate, no chips or burns" with a photograph evidences a great deal.</p>

<blockquote>The single most common reason a landlord loses a deposit dispute is not unfairness. It is that they never documented the starting condition.</blockquote>

<h2>Fair wear and tear</h2>

<p>Tenants are not required to return a property in the condition they found it. They are required to return it in that condition <em>less</em> fair wear and tear, judged against how long they lived there and how many people lived with them.</p>

<p>Carpet worn along a hallway after three years with two children is wear and tear. A cigarette burn in that carpet is damage. Paint that has dulled is wear and tear. A wall repainted purple without permission is damage.</p>

<h2>Betterment</h2>

<p>Even with clear damage, a landlord is not entitled to a brand new replacement at the tenant's expense. Adjudicators reduce awards for the life the item had already used.</p>

<p>If a carpet has a ten-year life and is damaged beyond repair in year eight, the tenant is responsible for roughly the two years of life that were lost, not the full replacement cost. The same logic applies to appliances, decoration and furniture.</p>

<h2>What each side should keep</h2>

<p><strong>Landlords:</strong> a signed check-in inventory with dated photographs, a check-out report in the same format, receipts or written quotes for any work claimed, and a note of the age of anything being replaced.</p>

<p><strong>Tenants:</strong> your own dated photographs on the day you move in and the day you leave, every message where you reported a problem, and the check-in inventory you signed. Report faults in writing at the time, not at the end.</p>

<h2>Cleaning</h2>

<p>Cleaning remains the most disputed deduction of all. A tenancy agreement cannot require professional cleaning as a blanket condition, and has not been able to since the Tenant Fees Act. The property must be returned as clean as it was at the start, which is why the check-in evidence matters here too.</p>

<h2>Getting it right from the start</h2>

<p>Every property we manage gets a photographic inventory at check-in and a matching report at check-out. It is not there to catch tenants out. It is there so that whichever way a dispute goes, it goes on facts.</p>

<p>If you are letting a property and are not confident your inventory would stand up, <a href="/landlord-services/find-a-tenant">speak to us before the tenant moves in</a>. It is far easier to fix then than at the end.</p>
`,
  },
];

/* ------------------------------------------------------------------ run */

const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });

const [author] = await sql`
  select id, full_name from users
  where role = ${"SUPER_ADMIN"} and deleted_at is null
  order by created_at limit 1
`;

if (!author) {
  console.error("No super admin to author the articles.");
  await sql.end();
  process.exit(1);
}

let created = 0;
let updated = 0;
let skipped = 0;

for (const post of POSTS) {
  const [existing] = await sql`
    select id from blog_posts where slug = ${post.slug} and status <> ${"TRASHED"} limit 1
  `;

  if (existing && !force) {
    skipped += 1;
    console.log(`  skip    ${post.slug} (already there)`);
    continue;
  }

  const values = {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    body: post.body.trim(),
    banner_image_url: post.bannerImageUrl,
    banner_image_alt: post.bannerImageAlt,
    meta_title: post.metaTitle,
    meta_description: post.metaDescription,
    focus_keyword: post.focusKeyword,
    schema_json: post.schema,
    status: "PUBLISHED",
    published_at: post.publishedAt,
    author_id: author.id,
  };

  if (existing) {
    await sql`update blog_posts set ${sql(values)}, updated_at = now() where id = ${existing.id}`;
    updated += 1;
    console.log(`  update  ${post.slug}`);
  } else {
    await sql`insert into blog_posts ${sql(values)}`;
    created += 1;
    console.log(`  create  ${post.slug}`);
  }
}

console.log(
  `\n${created} created, ${updated} updated, ${skipped} left alone. Author: ${author.full_name}\n`,
);

await sql.end();
