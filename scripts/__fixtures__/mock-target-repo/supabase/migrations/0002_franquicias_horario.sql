-- 0002_franquicias_horario.sql
-- Adds the weekly closing-day constraint to franquicias. This ALTER TABLE
-- statement is the fixture's one and only data CHECK constraint — every
-- other CHECK-shaped text in this migration set is a CREATE POLICY WITH
-- CHECK predicate (see 0001_init.sql), which must never be counted here.

ALTER TABLE franquicias ADD COLUMN dia_cierre smallint CHECK (dia_cierre BETWEEN 0 AND 6);
