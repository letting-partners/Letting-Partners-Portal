import type { Metadata } from "next";
import { pageAccess } from "@/lib/auth/page-guard";
import Link from "next/link";
import { Building2, Contact, Search, ShieldCheck, UsersRound } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui/layout";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { globalSearch, type SearchResult } from "@/services/search";

export const metadata: Metadata = { title: "Search" };

const KIND_LABELS: Record<SearchResult["kind"], string> = {
  landlord: "Landlords",
  property: "Properties",
  tenant: "Tenants",
  person: "Staff",
};

function iconFor(kind: SearchResult["kind"]) {
  if (kind === "landlord") return <Contact size={15} />;
  if (kind === "property") return <Building2 size={15} />;
  if (kind === "tenant") return <UsersRound size={15} />;
  return <ShieldCheck size={15} />;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const context = await pageAccess();
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const results = query ? await globalSearch(query, context) : [];

  const grouped = results.reduce<Record<string, SearchResult[]>>((accumulator, result) => {
    (accumulator[result.kind] ??= []).push(result);
    return accumulator;
  }, {});

  return (
    <>
      <PageHeader
        title={query ? `Results for "${query}"` : "Search"}
        subtitle={
          query
            ? `${results.length} result${results.length === 1 ? "" : "s"}`
            : "Search landlords, properties, tenants and phone numbers. Any UK phone format works."
        }
      />

      {results.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Search size={18} />}
            title={query ? "Nothing found" : "Start typing"}
            message={
              query
                ? "Try a different spelling, a phone number, a postcode or a property reference."
                : "Use the search box at the top of the page, or press Ctrl and K from anywhere."
            }
          />
        </div>
      ) : (
        <div className="stack">
          {(Object.keys(grouped) as SearchResult["kind"][]).map((kind) => (
            <section className="card" key={kind}>
              <div className="card-header">
                <span className="card-title">{KIND_LABELS[kind]}</span>
                <span className="subtle small">{grouped[kind].length}</span>
              </div>

              <ul>
                {grouped[kind].map((result) => (
                  <li key={`${result.kind}-${result.id}`} style={{ borderBottom: "1px solid var(--border)" }}>
                    <Link
                      href={result.href}
                      className="row row--between"
                      style={{ padding: "11px 16px" }}
                    >
                      <span className="row">
                        {iconFor(result.kind)}
                        <span>
                          <span className="table-primary">{result.title}</span>
                          <span className="table-secondary" style={{ display: "block" }}>
                            {result.subtitle}
                          </span>
                        </span>
                      </span>
                      {result.badge && <StatusBadge status={result.badge} />}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
