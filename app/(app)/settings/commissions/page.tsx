import type { Metadata } from "next";
import { pageAdmin } from "@/lib/auth/page-guard";
import { Card, PageHeader } from "@/components/ui/layout";
import { Person } from "@/components/ui/Avatar";
import { formatGBP, formatPercent } from "@/lib/money";
import {
  getCrossSellSplit,
  getExchangeRateDetail,
  getGlobalCommissionRule,
} from "@/services/settings";
import { listUsers } from "@/services/users";
import { getEffectiveCommissionRule } from "@/services/settings";
import CommissionSettings from "./CommissionSettings";

export const metadata: Metadata = { title: "Commission settings" };

export default async function CommissionSettingsPage() {
  const context = await pageAdmin();

  const [fronterRule, agentRule, split, rate, staff] = await Promise.all([
    getGlobalCommissionRule("FRONTER"),
    getGlobalCommissionRule("AGENT"),
    getCrossSellSplit(),
    getExchangeRateDetail(),
    listUsers(context, { pageSize: 100 }),
  ]);

  // The rule that actually applies to each person, override or default.
  const effective = await Promise.all(
    staff.rows
      .filter((person) => person.role !== "SUPER_ADMIN" && !person.deletedAt)
      .map(async (person) => ({
        person,
        rule: await getEffectiveCommissionRule(
          person.id,
          person.role === "FRONTER" ? "FRONTER" : "AGENT",
        ),
      })),
  );

  return (
    <>
      <PageHeader
        title="Commission settings"
        subtitle="Defaults for the whole business. Changing these never alters a sale that has already closed."
        breadcrumbs={[{ label: "Settings", href: "/settings" }, { label: "Commissions" }]}
      />

      <div className="stack--lg stack">
        <CommissionSettings
          fronterRule={fronterRule}
          agentRule={agentRule}
          split={split}
          rateX100={rate.rateX100}
        />

        <Card title="Who is on what rate">
          <p className="muted small" style={{ marginBottom: 12 }}>
            An individual rate is set on the person&apos;s user record and takes precedence over
            the default above.
          </p>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Role</th>
                  <th>Effective rate</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {effective.map(({ person, rule }) => {
                  const globalRule = person.role === "FRONTER" ? fronterRule : agentRule;
                  const isOverride =
                    rule !== null &&
                    (rule.type !== globalRule.type || rule.value !== globalRule.value);

                  return (
                    <tr key={person.id}>
                      <td>
                        <Person name={person.fullName} src={person.avatarUrl} />
                      </td>
                      <td className="table-secondary">
                        {person.role === "FRONTER" ? "Fronter" : "Agent"}
                      </td>
                      <td className="numeric">
                        {rule === null
                          ? "-"
                          : rule.type === "PERCENTAGE"
                            ? formatPercent(rule.value)
                            : formatGBP(rule.value)}
                      </td>
                      <td>
                        {isOverride ? (
                          <span className="badge badge--accent">Individual override</span>
                        ) : (
                          <span className="badge badge--neutral">Default</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
