-- Human-readable references (LP-0001, LPS-0001).
-- Sequences rather than counting rows, so two concurrent inserts can never
-- produce the same reference.

CREATE SEQUENCE IF NOT EXISTS property_reference_seq START WITH 1000 INCREMENT BY 1;
--> statement-breakpoint
CREATE SEQUENCE IF NOT EXISTS sale_reference_seq START WITH 1 INCREMENT BY 1;
