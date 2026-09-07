import { applyBasisPoints, penceToPkr, splitPence } from "@/lib/money";

/**
 * The single source of truth for money. Nothing else in the portal - server or
 * client - is allowed to derive a commission figure; the UI renders what this
 * returns.
 *
 * There are three separate commission concepts and they must never be mixed:
 *
 *   A. Landlord -> Company   the gross commission earned on the deal
 *   B. Company  -> Fronter   reward for acquiring the property
 *   C. Company  -> Agent     the agent share, split on a cross-sell
 *
 * The waterfall, matching the agreed worked example:
 *
 *   gross                    1,000.00
 *   fronter (10% of gross)    -100.00
 *   remaining                  900.00
 *   agent pool (50% of rem.)   450.00   -> property agent 60% = 270.00
 *                                       -> tenant   agent 40% = 180.00
 *   company retained           450.00
 *
 * Note that the cross-sell split applies to the agent pool only, never to the
 * gross figure.
 */

export type CommissionRuleSnapshot = {
  type: "PERCENTAGE" | "FIXED";
  /** Basis points when PERCENTAGE (1000 = 10.00%), pence when FIXED. */
  value: number;
};

export type CrossSellSplitSnapshot = {
  propertyAgentBp: number;
  tenantAgentBp: number;
};

export type CommissionInput = {
  /** What the landlord agreed to pay the company, in pence. */
  grossCommissionPence: number;
  /** Null when no fronter originated the property (e.g. a manual admin add). */
  fronterRule: CommissionRuleSnapshot | null;
  /** Null falls back to zero agent pool, leaving everything with the company. */
  agentRule: CommissionRuleSnapshot | null;
  /** Present only when the deal is a cross-sell collaboration. */
  crossSell: CrossSellSplitSnapshot | null;
  /** GBP -> PKR rate x100, snapshotted at closing. */
  pkrRateX100: number | null;
};

export type CommissionShare = {
  amountPence: number;
  /** The amount this share was calculated from. */
  basisPence: number;
  rule: CommissionRuleSnapshot | null;
  /** Set when a fixed rule was larger than the money available. */
  clamped: boolean;
  pkrAmount: number | null;
};

export type CommissionBreakdown = {
  grossCommissionPence: number;
  fronter: CommissionShare;
  afterFronterPence: number;
  agentPool: CommissionShare;
  propertyAgent: CommissionShare & { splitBp: number };
  tenantAgent: (CommissionShare & { splitBp: number }) | null;
  companyRetainedPence: number;
  companyRetainedPkr: number | null;
  isCrossSell: boolean;
  pkrRateX100: number | null;
  /** Ordered rows for the transparent breakdown shown on a sale. */
  lines: CommissionLine[];
  warnings: string[];
};

export type CommissionLine = {
  label: string;
  detail: string | null;
  amountPence: number;
  /** Rendered as a deduction in the UI. */
  negative: boolean;
  emphasis: boolean;
};

export class CommissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommissionError";
  }
}

function describeRule(rule: CommissionRuleSnapshot | null): string | null {
  if (!rule) return null;
  if (rule.type === "PERCENTAGE") {
    const percent = rule.value / 100;
    return `${Number.isInteger(percent) ? percent : percent.toFixed(2)}% of basis`;
  }
  return "fixed amount";
}

/**
 * Apply one rule to a basis. A fixed amount larger than the basis is clamped:
 * the company never pays out more than it earned.
 */
function applyRule(
  basisPence: number,
  rule: CommissionRuleSnapshot | null,
  pkrRateX100: number | null,
): CommissionShare {
  if (!rule || basisPence <= 0) {
    return {
      amountPence: 0,
      basisPence: Math.max(0, basisPence),
      rule,
      clamped: false,
      pkrAmount: pkrRateX100 ? 0 : null,
    };
  }

  const raw =
    rule.type === "PERCENTAGE" ? applyBasisPoints(basisPence, rule.value) : Math.round(rule.value);

  const amountPence = Math.max(0, Math.min(raw, basisPence));

  return {
    amountPence,
    basisPence,
    rule,
    clamped: amountPence !== raw,
    pkrAmount: pkrRateX100 ? penceToPkr(amountPence, pkrRateX100) : null,
  };
}

export function calculateCommission(input: CommissionInput): CommissionBreakdown {
  const gross = Math.round(input.grossCommissionPence);
  const rate = input.pkrRateX100 ?? null;
  const warnings: string[] = [];

  if (!Number.isFinite(gross) || gross < 0) {
    throw new CommissionError("Gross commission must be a positive amount.");
  }

  if (input.crossSell) {
    const total = input.crossSell.propertyAgentBp + input.crossSell.tenantAgentBp;
    if (total !== 10_000) {
      throw new CommissionError(
        `Cross-sell split must total 100%. Received ${(total / 100).toFixed(2)}%.`,
      );
    }
  }

  /* 1. Fronter, taken from the gross. */
  const fronter = applyRule(gross, input.fronterRule, rate);
  if (fronter.clamped) {
    warnings.push("The fronter fixed commission exceeded the gross and was capped.");
  }

  const afterFronterPence = gross - fronter.amountPence;

  /* 2. Agent pool, taken from what remains after the fronter. */
  const agentPool = applyRule(afterFronterPence, input.agentRule, rate);
  if (agentPool.clamped) {
    warnings.push("The agent fixed commission exceeded the remaining amount and was capped.");
  }

  const companyRetainedPence = afterFronterPence - agentPool.amountPence;

  /* 3. Divide the agent pool. */
  const isCrossSell = Boolean(input.crossSell);
  const propertySplitBp = input.crossSell ? input.crossSell.propertyAgentBp : 10_000;
  const tenantSplitBp = input.crossSell ? input.crossSell.tenantAgentBp : 0;

  // Split with the largest-remainder method so the two shares always add back
  // up to the pool exactly - no stray penny appearing or disappearing.
  const [propertyAmount, tenantAmount] = splitPence(agentPool.amountPence, [
    propertySplitBp,
    tenantSplitBp,
  ]);

  const propertyAgent = {
    amountPence: propertyAmount,
    basisPence: agentPool.amountPence,
    rule: null,
    clamped: false,
    pkrAmount: rate ? penceToPkr(propertyAmount, rate) : null,
    splitBp: propertySplitBp,
  };

  const tenantAgent = isCrossSell
    ? {
        amountPence: tenantAmount,
        basisPence: agentPool.amountPence,
        rule: null,
        clamped: false,
        pkrAmount: rate ? penceToPkr(tenantAmount, rate) : null,
        splitBp: tenantSplitBp,
      }
    : null;

  const lines: CommissionLine[] = [
    {
      label: "Gross company commission",
      detail: null,
      amountPence: gross,
      negative: false,
      emphasis: true,
    },
    {
      label: "Fronter commission",
      detail: describeRule(input.fronterRule),
      amountPence: fronter.amountPence,
      negative: true,
      emphasis: false,
    },
    {
      label: "Remaining after fronter",
      detail: null,
      amountPence: afterFronterPence,
      negative: false,
      emphasis: false,
    },
    {
      label: "Agent commission pool",
      detail: describeRule(input.agentRule),
      amountPence: agentPool.amountPence,
      negative: false,
      emphasis: false,
    },
  ];

  if (isCrossSell) {
    lines.push({
      label: "Property agent",
      detail: `${(propertySplitBp / 100).toFixed(0)}% of agent pool`,
      amountPence: propertyAgent.amountPence,
      negative: false,
      emphasis: false,
    });
    lines.push({
      label: "Tenant agent",
      detail: `${(tenantSplitBp / 100).toFixed(0)}% of agent pool`,
      amountPence: tenantAgent?.amountPence ?? 0,
      negative: false,
      emphasis: false,
    });
  } else {
    lines.push({
      label: "Property agent",
      detail: "full agent pool",
      amountPence: propertyAgent.amountPence,
      negative: false,
      emphasis: false,
    });
  }

  lines.push({
    label: "Company retained",
    detail: null,
    amountPence: companyRetainedPence,
    negative: false,
    emphasis: true,
  });

  const breakdown: CommissionBreakdown = {
    grossCommissionPence: gross,
    fronter,
    afterFronterPence,
    agentPool,
    propertyAgent,
    tenantAgent,
    companyRetainedPence,
    companyRetainedPkr: rate ? penceToPkr(companyRetainedPence, rate) : null,
    isCrossSell,
    pkrRateX100: rate,
    lines,
    warnings,
  };

  assertBalanced(breakdown);
  return breakdown;
}

/**
 * Every penny of the gross must land somewhere. This runs on every calculation
 * rather than only in tests, because a silent rounding leak in a financial
 * system is far worse than a loud failure.
 */
export function assertBalanced(breakdown: CommissionBreakdown): void {
  const distributed =
    breakdown.fronter.amountPence +
    breakdown.propertyAgent.amountPence +
    (breakdown.tenantAgent?.amountPence ?? 0) +
    breakdown.companyRetainedPence;

  if (distributed !== breakdown.grossCommissionPence) {
    throw new CommissionError(
      `Commission does not balance: ${distributed} distributed against a gross of ${breakdown.grossCommissionPence}.`,
    );
  }
}

/**
 * Resolve the commission a landlord agreed on a property or room into pence.
 * A percentage is taken of the first month of rent, which is how the agreed
 * fee is quoted in the letting agreement.
 */
export function resolveAgreedCommissionPence(
  agreed: { type: "PERCENTAGE" | "FIXED"; value: number } | null,
  monthlyRentPence: number | null,
): number {
  if (!agreed) return 0;
  if (agreed.type === "FIXED") return Math.max(0, Math.round(agreed.value));
  if (!monthlyRentPence || monthlyRentPence <= 0) return 0;
  return Math.max(0, applyBasisPoints(monthlyRentPence, agreed.value));
}
