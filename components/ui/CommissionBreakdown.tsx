import { formatGBP, formatPKR, formatRate, penceToPkr } from "@/lib/money";
import type { CommissionBreakdown } from "@/services/commission-engine";

/**
 * The commission waterfall, shown exactly as the engine calculated it.
 *
 * PKR is shown only against commission figures, always labelled approximate,
 * and always at the rate that was live when the sale closed - never today's.
 */
export function CommissionBreakdownView({
  breakdown,
  showCompany = true,
}: {
  breakdown: CommissionBreakdown;
  showCompany?: boolean;
}) {
  const rate = breakdown.pkrRateX100;

  const lines = showCompany
    ? breakdown.lines
    : breakdown.lines.filter((line) => line.label !== "Company retained");

  return (
    <div className="stack--sm stack">
      <div className="commission-lines">
        {lines.map((line, index) => (
          <div
            key={`${line.label}-${index}`}
            className="commission-line"
            data-emphasis={line.emphasis}
            data-negative={line.negative}
          >
            <div>
              <div className="commission-line-label">{line.label}</div>
              {line.detail && <div className="commission-line-detail">{line.detail}</div>}
            </div>

            <div style={{ textAlign: "right" }}>
              <div className="commission-line-amount">
                {line.negative ? "-" : ""}
                {formatGBP(line.amountPence, { precise: true })}
              </div>
              {rate && line.amountPence > 0 && (
                <div className="pkr-note">
                  approx. {formatPKR(penceToPkr(line.amountPence, rate))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {rate && (
        <p className="pkr-note">
          PKR amounts are approximate, converted at the rate held when this sale closed
          ({formatRate(rate)}).
        </p>
      )}

      {breakdown.warnings.length > 0 && (
        <div className="alert alert--warning">
          <ul>
            {breakdown.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
