-- Remove the legacy passive-lock trigger that still references the deleted
-- Landlord.status / Landlord.lockedAt columns and breaks every landlord update.
DROP TRIGGER IF EXISTS "trg_landlord_passive_lock" ON "Landlord";

DROP FUNCTION IF EXISTS enforce_landlord_passive_lock();
