# Project Notes

This project combines the Letting Partners public website with the Letting Partners Portal.

- Public website routes stay at the root, including `/properties`.
- Portal property-management routes live under `/portal/properties` to avoid conflicting with the public listings page.
- The app is pinned to the portal-compatible Next.js 14 and React 18 baseline.
- Database credentials must come from environment variables; use `.env.example` as the placeholder template.
