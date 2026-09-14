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
