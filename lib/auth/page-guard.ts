import "server-only";
import { forbidden, unauthorized } from "next/navigation";
import {
  getAccessContext,
  ForbiddenError,
  UnauthenticatedError,
  type AccessContext,
} from "@/services/permissions";

/**
 * Guards for pages, as opposed to the guards in `services/permissions.ts`
 * which are for server actions.
 *
 * The difference is how a denial should look. An action returns an error the
 * form displays; a page should render a real 403 or 401, not surface a server
 * error. These translate a permission failure into Next's `forbidden()` and
 * `unauthorized()` interrupts, which render forbidden.tsx / unauthorized.tsx
 * with the correct status code.
 */

export async function pageAccess(): Promise<AccessContext> {
  const context = await getAccessContext();
  if (!context) unauthorized();
  return context;
}

export async function pageAdmin(): Promise<AccessContext> {
  const context = await pageAccess();
  if (!context.isAdmin) forbidden();
  return context;
}

export async function pageAgentOrAdmin(): Promise<AccessContext> {
  const context = await pageAccess();
  if (!context.isAdmin && !context.isAgent) forbidden();
  return context;
}

/**
 * Runs a service call that may reject on ownership grounds and turns that
 * rejection into a 403 page. Anything else is rethrown, so a genuine fault
 * still surfaces as an error rather than being disguised as a denial.
 */
export async function orForbidden<T>(work: Promise<T>): Promise<T> {
  try {
    return await work;
  } catch (error) {
    if (error instanceof ForbiddenError) forbidden();
    if (error instanceof UnauthenticatedError) unauthorized();
    throw error;
  }
}
