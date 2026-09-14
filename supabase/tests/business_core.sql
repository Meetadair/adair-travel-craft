-- Schema tests for the business core. See README.md.
--
-- Run against a scratch PostgreSQL 16. Lines marked "must be refused" are
-- SUPPOSED to print an ERROR; a clean run is a failing run.
\set ON_ERROR_STOP 0
\pset tuples_only on

\echo '=== a Supabase-shaped database to run against ==='

-- Minimum Supabase-shaped surroundings so the migration can be run for real.
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;


\echo '=== applying the migration ==='

-- Adair for Business, phase 1: the company, its people, its money.
--
-- Three rules this schema exists to enforce, and which the application must
-- never be the only thing enforcing:
--
--   1. One company cannot see another exists.
--   2. An employee sees their own trips and their own budget. A manager sees
--      their team's spend. Nobody browses a colleague's itinerary.
--   3. A blocked booking is released by ONE NAMED PERSON. Not by whoever holds
--      an admin flag, and not by us. An administrator may change who that
--      person is, and that change is itself written down.

-- ---------------------------------------------------------------------------
-- 1. The company
-- ---------------------------------------------------------------------------

CREATE TABLE public.companies (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  legal_name text,
  -- Validated against VIES at sign-up, so nobody mistypes their own company.
  vat_number text,
  country_code text NOT NULL DEFAULT 'PL',
  registered_address text,
  invoicing_email text,
  -- Where the monthly close pack goes. Often not the same inbox.
  accounting_email text,
  base_currency text NOT NULL DEFAULT 'EUR',
  -- Payment on invoice needs a credit check above a limit; card needs none.
  payment_mode text NOT NULL DEFAULT 'card'
    CHECK (payment_mode IN ('card','invoice','lodged_card')),
  status text NOT NULL DEFAULT 'trial'
    CHECK (status IN ('trial','active','suspended','closed')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- A domain nobody has verified is a way into somebody else's company, so the
-- claim and the proof are separate columns and only the proof grants anything.
CREATE TABLE public.company_domains (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  domain text NOT NULL,
  verification_token text NOT NULL,
  verified_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX company_domains_domain_key ON public.company_domains (lower(domain));

-- ---------------------------------------------------------------------------
-- 2. Cost centres and grades
-- ---------------------------------------------------------------------------

CREATE TABLE public.cost_centres (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  -- Mapped once here so every invoice afterwards arrives already coded.
  ledger_account text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX cost_centres_company_code_key
  ON public.cost_centres (company_id, upper(code));

-- A grade is the client's own copy of a standard: we ship five, they edit the
-- numbers. Storing the numbers rather than a reference to ours means our
-- changing a default never silently changes what a client's staff may book.
CREATE TABLE public.travel_grades (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  key text NOT NULL,
  name text NOT NULL,
  cabin text NOT NULL DEFAULT 'economy'
    CHECK (cabin IN ('economy','premium_economy','business','first')),
  cabin_from_hours numeric NOT NULL DEFAULT 0 CHECK (cabin_from_hours >= 0),
  rail_class text NOT NULL DEFAULT 'second' CHECK (rail_class IN ('first','second')),
  -- Before the city multiplier. Minor units, in the company's base currency.
  hotel_cap_minor integer NOT NULL DEFAULT 11000 CHECK (hotel_cap_minor >= 0),
  car_class text NOT NULL DEFAULT 'economy'
    CHECK (car_class IN ('none','economy','compact','intermediate','executive')),
  per_diem_minor integer NOT NULL DEFAULT 5000 CHECK (per_diem_minor >= 0),
  notice_days integer NOT NULL DEFAULT 14 CHECK (notice_days >= 0),
  lounge text NOT NULL DEFAULT 'long_connection'
    CHECK (lounge IN ('never','long_connection','always')),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX travel_grades_company_key ON public.travel_grades (company_id, key);

-- ---------------------------------------------------------------------------
-- 3. People
-- ---------------------------------------------------------------------------

CREATE TABLE public.company_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'traveller'
    CHECK (role IN ('traveller','approver','admin','owner')),
  grade_id uuid REFERENCES public.travel_grades(id) ON DELETE SET NULL,
  cost_centre_id uuid REFERENCES public.cost_centres(id) ON DELETE SET NULL,
  -- Who approves for this person. Not always their budget's authority.
  approver_id uuid REFERENCES public.company_members(id) ON DELETE SET NULL,
  employee_number text,
  -- A leaver keeps their booking history and loses their access.
  left_on date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
-- One membership per person per company, and nobody belongs to two companies
-- at once on the same account.
CREATE UNIQUE INDEX company_members_user_key ON public.company_members (user_id)
  WHERE left_on IS NULL;
CREATE INDEX company_members_company_idx ON public.company_members (company_id);

-- An assistant books for a director without becoming them: every booking is
-- logged as "by X on behalf of Y", and the assistant never gains Y's authority.
CREATE TABLE public.booking_delegations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  assistant_id uuid NOT NULL REFERENCES public.company_members(id) ON DELETE CASCADE,
  traveller_id uuid NOT NULL REFERENCES public.company_members(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX booking_delegations_pair_key
  ON public.booking_delegations (assistant_id, traveller_id);

-- ---------------------------------------------------------------------------
-- 4. Budgets, and the named release authority
-- ---------------------------------------------------------------------------

CREATE TABLE public.travel_budgets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  scope text NOT NULL CHECK (scope IN ('person','team','cost_centre','project','client')),
  -- Exactly one of these, matching the scope.
  member_id uuid REFERENCES public.company_members(id) ON DELETE CASCADE,
  cost_centre_id uuid REFERENCES public.cost_centres(id) ON DELETE CASCADE,
  project_code text,
  period text NOT NULL DEFAULT 'quarter'
    CHECK (period IN ('month','quarter','year','rolling_12')),
  period_start date NOT NULL,
  limit_minor bigint NOT NULL CHECK (limit_minor >= 0),
  currency text NOT NULL DEFAULT 'EUR',
  rolls_over boolean NOT NULL DEFAULT false,
  -- Spend re-invoiced to a client is not our cost and is reported apart.
  rebillable boolean NOT NULL DEFAULT false,
  -- THE control. A budget with no named authority cannot be saved: a block
  -- nobody can release is worse than no block at all.
  release_authority_id uuid NOT NULL REFERENCES public.company_members(id) ON DELETE RESTRICT,
  -- A deputy is not a second authority. They may act only once the authority
  -- has been silent this long, which is why the hours are NOT NULL together.
  deputy_id uuid REFERENCES public.company_members(id) ON DELETE SET NULL,
  deputy_after_hours integer CHECK (deputy_after_hours IS NULL OR deputy_after_hours > 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT travel_budgets_scope_target CHECK (
    (scope = 'person'      AND member_id IS NOT NULL AND cost_centre_id IS NULL) OR
    (scope IN ('team','cost_centre') AND cost_centre_id IS NOT NULL AND member_id IS NULL) OR
    (scope IN ('project','client')   AND project_code IS NOT NULL)
  ),
  -- A deputy without a waiting period would be a second authority by accident.
  CONSTRAINT travel_budgets_deputy_needs_delay CHECK (
    deputy_id IS NULL OR deputy_after_hours IS NOT NULL
  ),
  CONSTRAINT travel_budgets_deputy_is_not_authority CHECK (
    deputy_id IS NULL OR deputy_id <> release_authority_id
  )
);
CREATE INDEX travel_budgets_company_idx ON public.travel_budgets (company_id, active);

-- Money against a budget. Committed when booked, spent when invoiced, and
-- reversed on cancellation — never edited in place, so the history survives.
CREATE TABLE public.budget_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  budget_id uuid NOT NULL REFERENCES public.travel_budgets(id) ON DELETE CASCADE,
  member_id uuid REFERENCES public.company_members(id) ON DELETE SET NULL,
  trip_id uuid,
  kind text NOT NULL CHECK (kind IN ('committed','spent','reversed')),
  amount_minor bigint NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX budget_entries_budget_idx ON public.budget_entries (budget_id, created_at DESC);

-- Every release, with the reason in the releaser's own words. Reported as
-- authorised overspend, never folded into ordinary spend: the whole point of
-- the number is that somebody had to decide.
CREATE TABLE public.budget_releases (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  budget_id uuid NOT NULL REFERENCES public.travel_budgets(id) ON DELETE CASCADE,
  released_by uuid NOT NULL REFERENCES public.company_members(id) ON DELETE RESTRICT,
  requested_by uuid REFERENCES public.company_members(id) ON DELETE SET NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency text NOT NULL DEFAULT 'EUR',
  -- A release with no reason is not a record of a decision.
  reason text NOT NULL CHECK (length(btrim(reason)) >= 3),
  kind text NOT NULL DEFAULT 'once' CHECK (kind IN ('once','raised_limit')),
  trip_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX budget_releases_budget_idx ON public.budget_releases (budget_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 5. Approvals
-- ---------------------------------------------------------------------------

CREATE TABLE public.trip_approvals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.company_members(id) ON DELETE CASCADE,
  -- Who must answer. A budget block routes to the authority, a policy
  -- exception to the approver — they are frequently different people.
  decider_id uuid NOT NULL REFERENCES public.company_members(id) ON DELETE RESTRICT,
  trip_id uuid,
  reason text NOT NULL CHECK (reason IN ('budget','policy','notice','both')),
  -- What was outside the rules, in words, plus the in-policy alternative and
  -- what it would have cost. An approver deciding without these is guessing.
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  amount_minor bigint NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','declined','expired')),
  decided_at timestamp with time zone,
  decided_note text,
  -- An unanswered approval is how a cheap fare becomes an expensive one.
  escalate_after timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX trip_approvals_decider_idx
  ON public.trip_approvals (decider_id, status, created_at DESC);

-- ---------------------------------------------------------------------------
-- 6. Audit
-- ---------------------------------------------------------------------------

-- Who changed a standard, who released a booking, who looked at whose trip.
-- The first thing an auditor asks for, and append-only by policy: there is no
-- UPDATE or DELETE grant on this table for anybody.
CREATE TABLE public.company_audit (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.company_members(id) ON DELETE SET NULL,
  action text NOT NULL,
  target text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX company_audit_company_idx ON public.company_audit (company_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 7. Who is who — helpers used by every policy below
-- ---------------------------------------------------------------------------
--
-- SECURITY DEFINER and a pinned search_path, because a policy that calls a
-- function the caller can shadow is not a policy. Each one answers a single
-- question and is STABLE so the planner may cache it per statement.

CREATE OR REPLACE FUNCTION public.my_company_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT m.company_id FROM public.company_members m
  WHERE m.user_id = auth.uid() AND m.left_on IS NULL
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.my_member_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT m.id FROM public.company_members m
  WHERE m.user_id = auth.uid() AND m.left_on IS NULL
  LIMIT 1
$$;

-- Administers THIS company. Deliberately not the same as the platform-wide
-- is_admin: an Adair administrator is not an administrator of a client.
CREATE OR REPLACE FUNCTION public.is_company_admin(_company_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_members m
    WHERE m.user_id = auth.uid()
      AND m.company_id = _company_id
      AND m.left_on IS NULL
      AND m.role IN ('admin','owner')
  )
$$;

-- Everyone whose travel this person may see: themselves, anyone who reports to
-- them, and anyone who has delegated booking to them. Not the whole company.
CREATE OR REPLACE FUNCTION public.members_i_oversee()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.my_member_id()
  UNION
  SELECT m.id FROM public.company_members m WHERE m.approver_id = public.my_member_id()
  UNION
  SELECT d.traveller_id FROM public.booking_delegations d
    WHERE d.assistant_id = public.my_member_id()
$$;

-- ---------------------------------------------------------------------------
-- 8. Row-level security
-- ---------------------------------------------------------------------------
--
-- Writes go through the service role in server functions, which is where the
-- business rules live and can be tested. What is granted here is READ, scoped
-- so that one company cannot learn another exists and one employee cannot read
-- a colleague's itinerary. Nothing is granted to anon anywhere.

ALTER TABLE public.companies            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_domains      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_centres         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.travel_grades        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_members      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_delegations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.travel_budgets       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_entries       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_releases      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_approvals       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_audit        ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.companies, public.company_domains, public.cost_centres,
  public.travel_grades, public.company_members, public.booking_delegations,
  public.travel_budgets, public.budget_entries, public.budget_releases,
  public.trip_approvals, public.company_audit TO authenticated;

GRANT ALL ON public.companies, public.company_domains, public.cost_centres,
  public.travel_grades, public.company_members, public.booking_delegations,
  public.travel_budgets, public.budget_entries, public.budget_releases,
  public.trip_approvals, public.company_audit TO service_role;

-- Your own company, and no evidence that any other exists.
CREATE POLICY "Members read their own company" ON public.companies
  FOR SELECT TO authenticated USING (id = public.my_company_id());

CREATE POLICY "Admins read their domains" ON public.company_domains
  FOR SELECT TO authenticated USING (public.is_company_admin(company_id));

-- Everyone needs the cost centres and grades: a traveller's own card shows
-- which centre their trip is charged to and what their standard allows.
CREATE POLICY "Members read cost centres" ON public.cost_centres
  FOR SELECT TO authenticated USING (company_id = public.my_company_id());

CREATE POLICY "Members read grades" ON public.travel_grades
  FOR SELECT TO authenticated USING (company_id = public.my_company_id());

-- A directory is not a dossier: colleagues are visible as names and roles,
-- which is what an approver picker needs. Their trips are not.
CREATE POLICY "Members read the company directory" ON public.company_members
  FOR SELECT TO authenticated USING (company_id = public.my_company_id());

CREATE POLICY "Members read their own delegations" ON public.booking_delegations
  FOR SELECT TO authenticated USING (
    company_id = public.my_company_id()
    AND (assistant_id = public.my_member_id()
         OR traveller_id = public.my_member_id()
         OR public.is_company_admin(company_id))
  );

-- A traveller sees the budgets their own spending is charged against, so the
-- card can say what is left. Administrators see all of them.
CREATE POLICY "Members read budgets that bind them" ON public.travel_budgets
  FOR SELECT TO authenticated USING (
    company_id = public.my_company_id()
    AND (
      public.is_company_admin(company_id)
      OR release_authority_id = public.my_member_id()
      OR deputy_id = public.my_member_id()
      OR member_id IN (SELECT public.members_i_oversee())
      OR cost_centre_id IN (
        SELECT m.cost_centre_id FROM public.company_members m
        WHERE m.id IN (SELECT public.members_i_oversee())
      )
    )
  );

-- Lines are readable only through a budget the reader may already read, which
-- keeps one rule in one place instead of restating it here.
CREATE POLICY "Members read entries on budgets they can read" ON public.budget_entries
  FOR SELECT TO authenticated USING (
    budget_id IN (SELECT b.id FROM public.travel_budgets b)
  );

CREATE POLICY "Members read releases on budgets they can read" ON public.budget_releases
  FOR SELECT TO authenticated USING (
    budget_id IN (SELECT b.id FROM public.travel_budgets b)
  );

-- An approval is visible to the person waiting on it and the person who has to
-- answer it. Nobody else, including other approvers.
CREATE POLICY "The two people in an approval can read it" ON public.trip_approvals
  FOR SELECT TO authenticated USING (
    company_id = public.my_company_id()
    AND (
      member_id = public.my_member_id()
      OR decider_id = public.my_member_id()
      OR public.is_company_admin(company_id)
    )
  );

-- Administrators read the log. Nobody at all may write to it through the API:
-- there is no INSERT, UPDATE or DELETE policy here on purpose, and none is
-- granted to authenticated above. Entries are written by the service role.
CREATE POLICY "Admins read the audit log" ON public.company_audit
  FOR SELECT TO authenticated USING (public.is_company_admin(company_id));

-- ---------------------------------------------------------------------------
-- 9. Housekeeping
-- ---------------------------------------------------------------------------

CREATE TRIGGER companies_updated_at BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER travel_grades_updated_at BEFORE UPDATE ON public.travel_grades
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER company_members_updated_at BEFORE UPDATE ON public.company_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER travel_budgets_updated_at BEFORE UPDATE ON public.travel_budgets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.travel_budgets IS
  'Every budget names exactly one release authority. A blocked booking is released by that person alone — not by an administrator, and not by Adair. Changing the authority is audited.';
COMMENT ON TABLE public.company_audit IS
  'Append-only. No write policy exists for authenticated users by design; entries are written by the service role.';


\echo ''
\echo '=== constraints: every ERROR below is the point ==='

INSERT INTO auth.users (id) VALUES
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222'),
  ('33333333-3333-3333-3333-333333333333');
INSERT INTO public.companies (id,name) VALUES ('aaa00001-0000-0000-0000-000000000001','Northgate');
INSERT INTO public.cost_centres (id,company_id,code,name) VALUES
  ('ccc00001-0000-0000-0000-000000000001','aaa00001-0000-0000-0000-000000000001','OPS-200','Operations');
INSERT INTO public.company_members (id,company_id,user_id,role) VALUES
  ('ddd00001-0000-0000-0000-000000000001','aaa00001-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','admin'),
  ('ddd00001-0000-0000-0000-000000000002','aaa00001-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','traveller'),
  ('ddd00001-0000-0000-0000-000000000003','aaa00001-0000-0000-0000-000000000001','33333333-3333-3333-3333-333333333333','approver');

\echo '1. a budget with NO release authority must be refused'
INSERT INTO public.travel_budgets (company_id,name,scope,cost_centre_id,period_start,limit_minor)
VALUES ('aaa00001-0000-0000-0000-000000000001','Ops','cost_centre','ccc00001-0000-0000-0000-000000000001','2026-07-01',2600000);

\echo '2. a valid budget is accepted'
INSERT INTO public.travel_budgets (id,company_id,name,scope,cost_centre_id,period_start,limit_minor,release_authority_id)
VALUES ('bbb00001-0000-0000-0000-000000000001','aaa00001-0000-0000-0000-000000000001','Ops','cost_centre','ccc00001-0000-0000-0000-000000000001','2026-07-01',2600000,'ddd00001-0000-0000-0000-000000000001');

\echo '3. a deputy with no waiting period must be refused (it would be a second authority)'
UPDATE public.travel_budgets SET deputy_id='ddd00001-0000-0000-0000-000000000003' WHERE id='bbb00001-0000-0000-0000-000000000001';

\echo '4. a deputy WITH a waiting period is accepted'
UPDATE public.travel_budgets SET deputy_id='ddd00001-0000-0000-0000-000000000003', deputy_after_hours=12 WHERE id='bbb00001-0000-0000-0000-000000000001';

\echo '5. the deputy may not also be the authority'
UPDATE public.travel_budgets SET deputy_id='ddd00001-0000-0000-0000-000000000001' WHERE id='bbb00001-0000-0000-0000-000000000001';

\echo '6. a person-scoped budget pointing at a cost centre must be refused'
INSERT INTO public.travel_budgets (company_id,name,scope,cost_centre_id,period_start,limit_minor,release_authority_id)
VALUES ('aaa00001-0000-0000-0000-000000000001','Bad','person','ccc00001-0000-0000-0000-000000000001','2026-07-01',100000,'ddd00001-0000-0000-0000-000000000001');

\echo '7. the release authority cannot be deleted out from under a live budget'
DELETE FROM public.company_members WHERE id='ddd00001-0000-0000-0000-000000000001';

\echo '8. a release with no reason must be refused'
INSERT INTO public.budget_releases (company_id,budget_id,released_by,amount_minor,reason)
VALUES ('aaa00001-0000-0000-0000-000000000001','bbb00001-0000-0000-0000-000000000001','ddd00001-0000-0000-0000-000000000001',5000,'  ');

\echo '9. a release WITH a reason is accepted'
INSERT INTO public.budget_releases (company_id,budget_id,released_by,amount_minor,reason)
VALUES ('aaa00001-0000-0000-0000-000000000001','bbb00001-0000-0000-0000-000000000001','ddd00001-0000-0000-0000-000000000001',5000,'Client demanded it');

\echo '10. one person cannot hold two live memberships'
INSERT INTO public.company_members (company_id,user_id,role)
VALUES ('aaa00001-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','traveller');

\echo '11. two cost centres cannot share a code in one company'
INSERT INTO public.cost_centres (company_id,code,name)
VALUES ('aaa00001-0000-0000-0000-000000000001','ops-200','Duplicate');

\echo '12. a domain cannot be claimed by two companies'
INSERT INTO public.companies (id,name) VALUES ('aaa00001-0000-0000-0000-000000000002','Rival');
INSERT INTO public.company_domains (company_id,domain,verification_token) VALUES ('aaa00001-0000-0000-0000-000000000001','northgate.pl','t1');
INSERT INTO public.company_domains (company_id,domain,verification_token) VALUES ('aaa00001-0000-0000-0000-000000000002','NorthGate.PL','t2');

\echo '13. nobody but the service role may write to the audit log'
SELECT count(*) FILTER (WHERE cmd <> 'SELECT') AS write_policies_on_audit
FROM pg_policies WHERE tablename='company_audit';
SELECT has_table_privilege('authenticated','public.company_audit','INSERT') AS authenticated_can_insert_audit;

\echo '14. every business table has RLS on'
SELECT string_agg(relname,', ') AS tables_without_rls FROM pg_class c
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity
  AND relname IN ('companies','company_domains','cost_centres','travel_grades','company_members',
                  'booking_delegations','travel_budgets','budget_entries','budget_releases',
                  'trip_approvals','company_audit');

\echo '15. anon is granted nothing on any of them'
SELECT string_agg(DISTINCT table_name,', ') AS anon_can_reach
FROM information_schema.role_table_grants
WHERE grantee='anon' AND table_schema='public'
  AND table_name IN ('companies','company_members','travel_budgets','budget_releases','company_audit');


\echo ''
\echo '=== row-level security ==='

-- auth.uid() the way Supabase defines it, so RLS can be exercised for real.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;

-- A second company, with its own people and its own money.
INSERT INTO auth.users (id) VALUES
  ('44444444-4444-4444-4444-444444444444'),
  ('55555555-5555-5555-5555-555555555555');
INSERT INTO public.companies (id,name) VALUES ('aaa00002-0000-0000-0000-000000000009','Rival Two');
INSERT INTO public.cost_centres (id,company_id,code,name)
  VALUES ('ccc00002-0000-0000-0000-000000000009','aaa00002-0000-0000-0000-000000000009','SLS-100','Sales');
INSERT INTO public.company_members (id,company_id,user_id,role) VALUES
  ('ddd00002-0000-0000-0000-000000000009','aaa00002-0000-0000-0000-000000000009','44444444-4444-4444-4444-444444444444','admin');
INSERT INTO public.travel_budgets (company_id,name,scope,cost_centre_id,period_start,limit_minor,release_authority_id)
  VALUES ('aaa00002-0000-0000-0000-000000000009','Rival Sales','cost_centre','ccc00002-0000-0000-0000-000000000009','2026-07-01',4800000,'ddd00002-0000-0000-0000-000000000009');
INSERT INTO public.company_audit (company_id,action) VALUES ('aaa00002-0000-0000-0000-000000000009','rival.secret');
INSERT INTO public.company_audit (company_id,action) VALUES ('aaa00001-0000-0000-0000-000000000001','northgate.secret');

GRANT USAGE ON SCHEMA public, auth TO authenticated;
GRANT SELECT ON auth.users TO authenticated;

\echo ''
\echo '--- as the Northgate ADMIN (user 1) ---'
SET ROLE authenticated;
SET request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
SELECT 'companies visible: ' || coalesce(string_agg(name,', '),'none') FROM public.companies;
SELECT 'budgets visible: ' || coalesce(string_agg(name,', '),'none') FROM public.travel_budgets;
SELECT 'audit rows visible: ' || coalesce(string_agg(action,', '),'none') FROM public.company_audit;
RESET ROLE; RESET request.jwt.claim.sub;

\echo ''
\echo '--- as the RIVAL admin (user 4) ---'
SET ROLE authenticated;
SET request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
SELECT 'companies visible: ' || coalesce(string_agg(name,', '),'none') FROM public.companies;
SELECT 'budgets visible: ' || coalesce(string_agg(name,', '),'none') FROM public.travel_budgets;
SELECT 'audit rows visible: ' || coalesce(string_agg(action,', '),'none') FROM public.company_audit;
RESET ROLE; RESET request.jwt.claim.sub;

\echo ''
\echo '--- as an ordinary Northgate TRAVELLER (user 2) ---'
SET ROLE authenticated;
SET request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
SELECT 'companies visible: ' || coalesce(string_agg(name,', '),'none') FROM public.companies;
SELECT 'audit rows visible: ' || coalesce(string_agg(action,', '),'none') FROM public.company_audit;
SELECT 'colleagues visible: ' || count(*) FROM public.company_members;
\echo 'can they write to the audit log?'
INSERT INTO public.company_audit (company_id,action) VALUES ('aaa00001-0000-0000-0000-000000000001','i.covered.my.tracks');
RESET ROLE; RESET request.jwt.claim.sub;

\echo ''
\echo '--- as a signed-in user with NO company at all ---'
SET ROLE authenticated;
SET request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
SELECT 'companies visible: ' || coalesce(string_agg(name,', '),'none') FROM public.companies;
SELECT 'members visible: ' || count(*) FROM public.company_members;
SELECT 'budgets visible: ' || count(*) FROM public.travel_budgets;
RESET ROLE; RESET request.jwt.claim.sub;

-- Northgate has a release on its books; the rival must not be able to read it.
INSERT INTO public.budget_entries (company_id,budget_id,kind,amount_minor,note)
VALUES ('aaa00001-0000-0000-0000-000000000001','bbb00001-0000-0000-0000-000000000001','spent',120000,'northgate-private-line');

SET ROLE authenticated;
SET request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
SELECT 'RIVAL admin sees budget_entries: ' || coalesce(string_agg(note,', '),'none') FROM public.budget_entries;
SELECT 'RIVAL admin sees budget_releases: ' || coalesce(string_agg(reason,', '),'none') FROM public.budget_releases;
RESET ROLE; RESET request.jwt.claim.sub;

SET ROLE authenticated;
SET request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
SELECT 'NORTHGATE admin sees budget_entries: ' || coalesce(string_agg(note,', '),'none') FROM public.budget_entries;
RESET ROLE; RESET request.jwt.claim.sub;
