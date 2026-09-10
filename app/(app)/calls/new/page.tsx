import { redirect } from "next/navigation";

/**
 * The old start-call address.
 *
 * Calls are now made in a popup over whatever you were looking at, so this
 * route no longer has a page of its own. Anything still pointing here - a
 * bookmark, an old link in a notification - lands on the call list with the
 * popup already open, carrying the number it was given.
 */
export default async function NewCallPage({
  searchParams,
}: {
  searchParams: Promise<{ phone?: string; followUpId?: string }>;
}) {
  const params = await searchParams;

  const query = new URLSearchParams({ call: "1" });
  if (params.phone) query.set("phone", params.phone);
  if (params.followUpId) query.set("followUpId", params.followUpId);

  redirect(`/calls?${query.toString()}`);
}
