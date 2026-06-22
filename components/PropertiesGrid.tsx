"use client";

import { useEffect, useState } from "react";
import LPIcon from "@/components/LPIcon";
import WebsitePropertyCard, { WebsiteProperty } from "@/components/WebsitePropertyCard";
import { getWebsiteApiJson, WebsiteApiEnvelope } from "@/lib/website-api";

type ApiResponse = WebsiteApiEnvelope & {
  properties?: WebsiteProperty[];
};

type Props = {
  limit?: number;
  area?: string;
  showSearch?: boolean;
};

export default function PropertiesGrid({ limit, area, showSearch }: Props) {
  const [properties, setProperties] = useState<WebsiteProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");

    const params = new URLSearchParams();
    if (limit) params.set("limit", String(limit));
    if (area) params.set("area", area);

    getWebsiteApiJson<ApiResponse>(`/properties?${params}`, controller.signal)
      .then((data) => {
        setProperties(data?.properties ?? []);
        setLoading(false);
      })
      .catch((err) => {
        if (err?.name !== "AbortError") {
          setError("Unable to load properties at this time.");
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [limit, area]);

  const filtered = search
    ? properties.filter((property) => {
        const value = search.toLowerCase();
        return (
          property.title?.toLowerCase().includes(value) ||
          property.address?.toLowerCase().includes(value) ||
          property.area?.toLowerCase().includes(value)
        );
      })
    : properties;

  if (loading) {
    return (
      <div className="lp-properties-grid">
        {Array.from({ length: limit ?? 6 }).map((_, index) => (
          <div key={index} className="lp-skeleton lp-skeleton--card" aria-hidden="true" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="lp-empty-state">
        <LPIcon name="alert" className="lp-empty-icon" size={48} />
        <p>{error}</p>
      </div>
    );
  }

  return (
    <>
      {showSearch && (
        <div className="lp-properties-search-bar">
          <div className="lp-properties-search-input-wrap">
            <LPIcon name="search" size={18} />
            <input
              type="search"
              className="lp-form-input"
              placeholder="Search by title, address, or area..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search properties"
            />
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="lp-empty-state">
          <LPIcon name="home" className="lp-empty-icon" size={48} />
          <h3>No properties found</h3>
          <p>Check back soon. We are regularly adding new listings.</p>
        </div>
      ) : (
        <div className="lp-properties-grid">
          {filtered.map((property) => (
            <WebsitePropertyCard key={property.id} property={property} />
          ))}
        </div>
      )}
    </>
  );
}
