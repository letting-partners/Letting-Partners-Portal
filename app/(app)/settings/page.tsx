import type { Metadata } from "next";
import { pageAdmin } from "@/lib/auth/page-guard";
import Link from "next/link";
import { BadgePoundSterling, ScrollText, Users } from "lucide-react";
import { Card, DefinitionList, PageHeader } from "@/components/ui/layout";
import { formatDateTime } from "@/lib/dates";
import { formatRate } from "@/lib/money";
import { publicEnv } from "@/lib/env";
import {
  getAddressApiKey,
  getExchangeRateDetail,
  getSetting,
  SETTING_KEYS,
} from "@/services/settings";
import { isStorageConfigured, storageDriver } from "@/services/storage";
import CompanySettings from "./CompanySettings";
import AddressApiSettings, { ADDRESS_API_KEY_SETTING } from "./AddressApiSettings";

export const metadata: Metadata = { title: "System settings" };

export default async function SettingsPage() {
  await pageAdmin();

  /*
   * Both are read: one to know whether lookup works at all, the other to say
   * whether the key in use came from this screen or the environment.
   */
  const [addressKey, storedAddressKey] = await Promise.all([
    getAddressApiKey(),
    getSetting<string | null>(ADDRESS_API_KEY_SETTING, null),
  ]);

  const [companyName, companyPhone, companyEmail, rate] = await Promise.all([
    getSetting(SETTING_KEYS.companyName, "Letting Partners LTD"),
    getSetting(SETTING_KEYS.companyPhone, ""),
    getSetting(SETTING_KEYS.companyEmail, ""),
    getExchangeRateDetail(),
  ]);

  return (
    <>
      <PageHeader
        title="System settings"
        subtitle="Company details, integration configuration and where everything else is managed."
      />

      <div className="grid-sidebar">
        <div className="stack">
          <Card title="Company details">
            <CompanySettings
              initial={{
                name: String(companyName),
                phone: String(companyPhone),
                email: String(companyEmail),
              }}
            />
          </Card>

          <Card title="Website integration">
            <DefinitionList
              items={[
                { term: "Public website", value: publicEnv.NEXT_PUBLIC_SITE_URL },
                { term: "Portal", value: publicEnv.NEXT_PUBLIC_PORTAL_URL },
                {
                  term: "Property feed",
                  value: (
                    <code style={{ fontSize: "0.8rem" }}>
                      {publicEnv.NEXT_PUBLIC_PORTAL_URL}/api/website/properties
                    </code>
                  ),
                },
                {
                  term: "Authentication",
                  value: (
                    <>
                      Shared key sent as <code>x-website-api-key</code>
                    </>
                  ),
                },
              ]}
            />
            <p className="subtle small" style={{ marginTop: 12 }}>
              The key lives in the environment of both projects and must match exactly. It is
              never sent to the browser.
            </p>
          </Card>

          <Card title="Address lookup">
            <AddressApiSettings
              configured={Boolean(addressKey)}
              hint={addressKey ? addressKey.slice(-4) : null}
              fromEnvironment={!storedAddressKey && Boolean(addressKey)}
            />
          </Card>

          <Card title="Integrations">
            <DefinitionList
              items={[
                {
                  term: "File storage",
                  value: isStorageConfigured() ? (
                    <span className="badge badge--positive">{storageDriver()}</span>
                  ) : (
                    <span className="badge badge--warning">
                      Not configured - uploads are disabled
                    </span>
                  ),
                },
                {
                  term: "Email",
                  value: process.env.RESEND_API_KEY ? (
                    <span className="badge badge--positive">Configured</span>
                  ) : (
                    <span className="badge badge--warning">
                      Not configured - codes print to the server log
                    </span>
                  ),
                },
                {
                  term: "Image alt text",
                  value:
                    process.env.ALT_TEXT_PROVIDER === "anthropic" ? (
                      <span className="badge badge--positive">Vision model</span>
                    ) : (
                      <span className="badge badge--neutral">
                        Generated from property details
                      </span>
                    ),
                },
              ]}
            />
          </Card>
        </div>

        <div className="stack">
          <Card title="Commission">
            <DefinitionList
              items={[
                { term: "GBP to PKR", value: formatRate(rate.rateX100) },
                {
                  term: "Rate updated",
                  value: rate.updatedAt ? formatDateTime(rate.updatedAt) : "Using the default",
                },
              ]}
            />
            <Link
              href="/settings/commissions"
              className="btn btn--secondary btn--sm btn--block"
              style={{ marginTop: 12 }}
            >
              <BadgePoundSterling size={14} />
              Commission settings
            </Link>
          </Card>

          <Card title="Elsewhere">
            <div className="stack--sm stack">
              <Link href="/team/users" className="btn btn--secondary btn--sm btn--block">
                <Users size={14} />
                Manage users
              </Link>
              <Link href="/audit" className="btn btn--secondary btn--sm btn--block">
                <ScrollText size={14} />
                Audit log
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
