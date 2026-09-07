import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateCommission,
  CommissionError,
  resolveAgreedCommissionPence,
} from "../services/commission-engine";

const POUND = 100;

describe("commission engine - the agreed worked example", () => {
  it("reproduces the single-agent waterfall exactly", () => {
    const result = calculateCommission({
      grossCommissionPence: 1000 * POUND,
      fronterRule: { type: "PERCENTAGE", value: 1000 }, // 10%
      agentRule: { type: "PERCENTAGE", value: 5000 }, // 50% of the remainder
      crossSell: null,
      pkrRateX100: null,
    });

    assert.equal(result.fronter.amountPence, 100 * POUND);
    assert.equal(result.afterFronterPence, 900 * POUND);
    assert.equal(result.agentPool.amountPence, 450 * POUND);
    assert.equal(result.propertyAgent.amountPence, 450 * POUND);
    assert.equal(result.tenantAgent, null);
    assert.equal(result.companyRetainedPence, 450 * POUND);
  });

  it("reproduces the cross-sell 60/40 division of the agent pool", () => {
    const result = calculateCommission({
      grossCommissionPence: 1000 * POUND,
      fronterRule: { type: "PERCENTAGE", value: 1000 },
      agentRule: { type: "PERCENTAGE", value: 5000 },
      crossSell: { propertyAgentBp: 6000, tenantAgentBp: 4000 },
      pkrRateX100: null,
    });

    assert.equal(result.agentPool.amountPence, 450 * POUND);
    assert.equal(result.propertyAgent.amountPence, 270 * POUND);
    assert.equal(result.tenantAgent?.amountPence, 180 * POUND);
    assert.equal(result.companyRetainedPence, 450 * POUND);
    assert.equal(result.isCrossSell, true);
  });

  it("splits the agent pool, never the gross", () => {
    const result = calculateCommission({
      grossCommissionPence: 1000 * POUND,
      fronterRule: { type: "PERCENTAGE", value: 1000 },
      agentRule: { type: "PERCENTAGE", value: 5000 },
      crossSell: { propertyAgentBp: 6000, tenantAgentBp: 4000 },
      pkrRateX100: null,
    });

    // 60% of the gross would be 600.00 - that would be the classic mistake.
    assert.notEqual(result.propertyAgent.amountPence, 600 * POUND);
    assert.equal(
      result.propertyAgent.amountPence + (result.tenantAgent?.amountPence ?? 0),
      result.agentPool.amountPence,
    );
  });
});

describe("commission engine - rule types", () => {
  it("supports a fixed fronter amount", () => {
    const result = calculateCommission({
      grossCommissionPence: 1000 * POUND,
      fronterRule: { type: "FIXED", value: 150 * POUND },
      agentRule: { type: "PERCENTAGE", value: 5000 },
      crossSell: null,
      pkrRateX100: null,
    });

    assert.equal(result.fronter.amountPence, 150 * POUND);
    assert.equal(result.afterFronterPence, 850 * POUND);
    assert.equal(result.agentPool.amountPence, 425 * POUND);
    assert.equal(result.companyRetainedPence, 425 * POUND);
  });

  it("caps a fixed amount that exceeds the money available", () => {
    const result = calculateCommission({
      grossCommissionPence: 100 * POUND,
      fronterRule: { type: "FIXED", value: 500 * POUND },
      agentRule: null,
      crossSell: null,
      pkrRateX100: null,
    });

    assert.equal(result.fronter.amountPence, 100 * POUND);
    assert.equal(result.fronter.clamped, true);
    assert.equal(result.companyRetainedPence, 0);
    assert.ok(result.warnings.length > 0);
  });

  it("gives everything to the company when no rules exist", () => {
    const result = calculateCommission({
      grossCommissionPence: 500 * POUND,
      fronterRule: null,
      agentRule: null,
      crossSell: null,
      pkrRateX100: null,
    });

    assert.equal(result.fronter.amountPence, 0);
    assert.equal(result.agentPool.amountPence, 0);
    assert.equal(result.companyRetainedPence, 500 * POUND);
  });
});

describe("commission engine - integrity", () => {
  it("always balances back to the gross, including on awkward numbers", () => {
    const awkward = [1, 3, 7, 33, 101, 999, 12_345, 99_999, 1_000_003];

    for (const gross of awkward) {
      const result = calculateCommission({
        grossCommissionPence: gross,
        fronterRule: { type: "PERCENTAGE", value: 1000 },
        agentRule: { type: "PERCENTAGE", value: 3333 },
        crossSell: { propertyAgentBp: 6667, tenantAgentBp: 3333 },
        pkrRateX100: 36_900,
      });

      const distributed =
        result.fronter.amountPence +
        result.propertyAgent.amountPence +
        (result.tenantAgent?.amountPence ?? 0) +
        result.companyRetainedPence;

      assert.equal(distributed, gross, `did not balance for gross ${gross}`);
    }
  });

  it("rejects a cross-sell split that does not total 100%", () => {
    assert.throws(
      () =>
        calculateCommission({
          grossCommissionPence: 1000 * POUND,
          fronterRule: null,
          agentRule: { type: "PERCENTAGE", value: 5000 },
          crossSell: { propertyAgentBp: 6000, tenantAgentBp: 3000 },
          pkrRateX100: null,
        }),
      CommissionError,
    );
  });

  it("rejects a negative gross", () => {
    assert.throws(
      () =>
        calculateCommission({
          grossCommissionPence: -1,
          fronterRule: null,
          agentRule: null,
          crossSell: null,
          pkrRateX100: null,
        }),
      CommissionError,
    );
  });

  it("converts commission to PKR using the snapshotted rate", () => {
    const result = calculateCommission({
      grossCommissionPence: 1000 * POUND,
      fronterRule: { type: "PERCENTAGE", value: 1000 },
      agentRule: { type: "PERCENTAGE", value: 5000 },
      crossSell: null,
      pkrRateX100: 36_900, // 369.00 PKR per GBP
    });

    assert.equal(result.fronter.pkrAmount, 36_900);
    assert.equal(result.propertyAgent.pkrAmount, 166_050);
  });

  it("omits PKR entirely when no rate is available", () => {
    const result = calculateCommission({
      grossCommissionPence: 1000 * POUND,
      fronterRule: { type: "PERCENTAGE", value: 1000 },
      agentRule: null,
      crossSell: null,
      pkrRateX100: null,
    });

    assert.equal(result.fronter.pkrAmount, null);
    assert.equal(result.companyRetainedPkr, null);
  });
});

describe("agreed landlord commission", () => {
  it("takes a percentage of one month of rent", () => {
    assert.equal(resolveAgreedCommissionPence({ type: "PERCENTAGE", value: 10_000 }, 1300 * POUND), 1300 * POUND);
    assert.equal(resolveAgreedCommissionPence({ type: "PERCENTAGE", value: 5000 }, 1300 * POUND), 650 * POUND);
  });

  it("passes a fixed amount straight through", () => {
    assert.equal(resolveAgreedCommissionPence({ type: "FIXED", value: 900 * POUND }, 1300 * POUND), 900 * POUND);
  });

  it("is zero when nothing was agreed", () => {
    assert.equal(resolveAgreedCommissionPence(null, 1300 * POUND), 0);
  });
});
