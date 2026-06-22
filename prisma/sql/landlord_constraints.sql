-- Landlord identity constraint:
-- exactly one landlord record per normalized UK phone-last-10 key.
CREATE UNIQUE INDEX IF NOT EXISTS "Landlord_phoneLast10_key"
ON "Landlord" ("phoneLast10");
