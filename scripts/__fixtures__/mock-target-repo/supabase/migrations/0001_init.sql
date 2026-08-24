-- 0001_init.sql
-- Fixture migration mixing real column CHECK constraints with CREATE POLICY
-- WITH CHECK predicates in one file, used by scripts/discover-schema.test.mjs
-- and scripts/discovery.e2e.test.mjs to prove the disambiguation rule (see
-- 03-RESEARCH.md Pattern 3).

/* Role enum, cross-referenced by usuarios.rol below. */
CREATE TYPE rol_usuario AS ENUM ('admin', 'franquiciado');

CREATE TABLE tenants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text NOT NULL,
  creado_en   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE usuarios (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email       text NOT NULL,
  nombre      text NOT NULL,
  rol         rol_usuario NOT NULL,
  activo      boolean NOT NULL DEFAULT true
);

CREATE TABLE categorias (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre  text NOT NULL UNIQUE,
  tipo    text NOT NULL
);

CREATE TABLE franquicias (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre  text NOT NULL
);

-- Row-level security: only an admin belonging to the same tenant may insert
-- into usuarios, categorias or franquicias. These WITH CHECK predicates must
-- never be read as data constraints — see the disambiguation rule discover-
-- schema.mjs implements.
CREATE POLICY usuarios_insert_admin ON usuarios
  FOR INSERT
  WITH CHECK (rol_actual() = 'admin' AND tenant_id = tenant_actual());

CREATE POLICY categorias_insert_admin ON categorias
  FOR INSERT
  WITH CHECK (rol_actual() = 'admin');

CREATE POLICY franquicias_insert_admin ON franquicias
  FOR INSERT
  WITH CHECK (rol_actual() = 'admin' AND tenant_actual() IS NOT NULL);
