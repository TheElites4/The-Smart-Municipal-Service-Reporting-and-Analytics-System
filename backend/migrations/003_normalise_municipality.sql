-- Migration 003: normalise municipality comparison.
--
-- Staff accounts are created through the admin dashboard's free-text
-- "Municipality" field, so the same municipality can be stored in several ways
-- ("sol plaatje municipality", "Sol Plaatje Local Municipality",
-- "City of Johannesburg", "Johannesburg"). The dashboard queries must compare
-- them loosely or staff sign in and see an empty queue.
--
-- This mirrors normaliseMunicipality() in src/server.js: lower-case, trim,
-- collapse whitespace, drop an optional "City of"/"Municipality of" prefix and
-- an optional trailing "Local/Metropolitan/District Municipality"/"Municipality"
-- suffix. The function is IMMUTABLE so it can be used in indexes later.

CREATE OR REPLACE FUNCTION normalise_municipality(value text)
RETURNS text AS $$
  SELECT regexp_replace(
           regexp_replace(
             regexp_replace(
               regexp_replace(
                 lower(btrim(coalesce(value, ''))),
                 '^(city|municipality|metro|metropolitan municipality) of\s+', ''
               ),
               '\s+(local|metropolitan|district)\s+municipality$', ''
             ),
             '\s+municipality$', ''
           ),
           '\s+', ' ', 'g'
         );
$$ LANGUAGE sql IMMUTABLE;

-- Convenience index so staff-scoped dashboard queries stay fast.
CREATE INDEX IF NOT EXISTS reports_municipality_norm_idx
  ON service_reports (normalise_municipality(municipality));