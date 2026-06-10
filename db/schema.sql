-- Oakstone Bank — PostgreSQL Schema
-- Run: psql -U oakstone -d oakstone_bank -f schema.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── ENUMS ───────────────────────────────────────────────────
CREATE TYPE user_role       AS ENUM ('customer','admin','super_admin');
CREATE TYPE kyc_status      AS ENUM ('pending','under_review','approved','rejected');
CREATE TYPE account_type    AS ENUM ('checking','savings','money_market');
CREATE TYPE account_status  AS ENUM ('pending','active','frozen','closed');
CREATE TYPE tx_type         AS ENUM ('deposit','withdrawal','transfer','payment','fee','wire','ach','zelle');
CREATE TYPE tx_status       AS ENUM ('pending','processing','completed','failed','reversed');
CREATE TYPE card_type       AS ENUM ('classic','gold','platinum');
CREATE TYPE card_app_status AS ENUM ('pending_fee','fee_paid','under_review','approved','rejected');
CREATE TYPE card_status     AS ENUM ('active','frozen','cancelled');
CREATE TYPE loan_type       AS ENUM ('personal','auto','mortgage','business');
CREATE TYPE loan_status     AS ENUM ('draft','submitted','under_review','approved','rejected','active','paid_off');
CREATE TYPE alert_severity  AS ENUM ('low','medium','high','critical');

-- ─── USERS ───────────────────────────────────────────────────
CREATE TABLE users (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email                 TEXT UNIQUE NOT NULL,
  phone                 TEXT UNIQUE,
  password_hash         TEXT NOT NULL,
  role                  user_role NOT NULL DEFAULT 'customer',
  first_name            TEXT NOT NULL,
  last_name             TEXT NOT NULL,
  date_of_birth         DATE,
  address_line1         TEXT,
  city                  TEXT,
  state                 CHAR(2),
  zip                   TEXT,
  kyc_status            kyc_status NOT NULL DEFAULT 'pending',
  kyc_reviewed_at       TIMESTAMPTZ,
  kyc_reviewed_by       UUID REFERENCES users(id),
  mfa_enabled           BOOLEAN NOT NULL DEFAULT FALSE,
  mfa_secret            TEXT,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  failed_login_attempts INT NOT NULL DEFAULT 0,
  locked_until          TIMESTAMPTZ,
  last_login_at         TIMESTAMPTZ,
  last_login_ip         INET,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email  ON users(email);
CREATE INDEX idx_users_phone  ON users(phone);
CREATE INDEX idx_users_role   ON users(role);
CREATE INDEX idx_users_kyc    ON users(kyc_status);

-- ─── SESSIONS ────────────────────────────────────────────────
CREATE TABLE sessions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_hash  TEXT UNIQUE NOT NULL,
  ip_address    INET,
  user_agent    TEXT,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON sessions(user_id);

-- ─── ACCOUNTS ────────────────────────────────────────────────
CREATE TABLE accounts (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_number    TEXT UNIQUE NOT NULL,
  routing_number    TEXT NOT NULL DEFAULT '021000021',
  account_type      account_type NOT NULL DEFAULT 'checking',
  status            account_status NOT NULL DEFAULT 'pending',
  balance           NUMERIC(18,2) NOT NULL DEFAULT 0.00,
  available_balance NUMERIC(18,2) NOT NULL DEFAULT 0.00,
  daily_limit       NUMERIC(18,2) NOT NULL DEFAULT 2500.00,
  nickname          TEXT,
  opened_at         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_accounts_user   ON accounts(user_id);
CREATE INDEX idx_accounts_number ON accounts(account_number);
CREATE INDEX idx_accounts_status ON accounts(status);

-- ─── TRANSACTIONS ─────────────────────────────────────────────
CREATE TABLE transactions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference_id    TEXT UNIQUE NOT NULL,
  from_account_id UUID REFERENCES accounts(id),
  to_account_id   UUID REFERENCES accounts(id),
  tx_type         tx_type NOT NULL,
  status          tx_status NOT NULL DEFAULT 'pending',
  amount          NUMERIC(18,2) NOT NULL,
  fee             NUMERIC(18,2) NOT NULL DEFAULT 0.00,
  description     TEXT,
  metadata        JSONB,
  ip_address      INET,
  risk_score      SMALLINT,
  flagged         BOOLEAN NOT NULL DEFAULT FALSE,
  flagged_reason  TEXT,
  processed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tx_from    ON transactions(from_account_id);
CREATE INDEX idx_tx_to      ON transactions(to_account_id);
CREATE INDEX idx_tx_status  ON transactions(status);
CREATE INDEX idx_tx_created ON transactions(created_at DESC);
CREATE INDEX idx_tx_flagged ON transactions(flagged) WHERE flagged = TRUE;

-- ─── CARD FEE CONFIG (admin-controlled) ──────────────────────
CREATE TABLE card_fee_config (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_type       card_type NOT NULL UNIQUE,
  application_fee NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  fee_enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  annual_fee      NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  apr_min         NUMERIC(6,4) NOT NULL,
  apr_max         NUMERIC(6,4) NOT NULL,
  updated_by      UUID REFERENCES users(id),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO card_fee_config (card_type, application_fee, annual_fee, apr_min, apr_max)
VALUES
  ('classic',  0.00,   0.00, 0.1899, 0.2999),
  ('gold',    25.00,  95.00, 0.1799, 0.2899),
  ('platinum',50.00, 195.00, 0.1699, 0.2799);

-- ─── CARD APPLICATIONS ───────────────────────────────────────
CREATE TABLE card_applications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_type       card_type NOT NULL,
  status          card_app_status NOT NULL DEFAULT 'pending_fee',
  application_fee NUMERIC(10,2) NOT NULL,
  fee_paid_at     TIMESTAMPTZ,
  credit_limit    NUMERIC(18,2),
  apr             NUMERIC(6,4),
  review_notes    TEXT,
  reviewed_by     UUID REFERENCES users(id),
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cardapp_user   ON card_applications(user_id);
CREATE INDEX idx_cardapp_status ON card_applications(status);

-- ─── CREDIT CARDS ────────────────────────────────────────────
CREATE TABLE credit_cards (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES card_applications(id),
  user_id        UUID NOT NULL REFERENCES users(id),
  card_type      card_type NOT NULL,
  card_last4     CHAR(4) NOT NULL,
  expiry_month   SMALLINT NOT NULL,
  expiry_year    SMALLINT NOT NULL,
  status         card_status NOT NULL DEFAULT 'active',
  credit_limit   NUMERIC(18,2) NOT NULL,
  balance        NUMERIC(18,2) NOT NULL DEFAULT 0.00,
  apr            NUMERIC(6,4) NOT NULL,
  annual_fee     NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  issued_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  frozen_at      TIMESTAMPTZ
);

CREATE INDEX idx_cc_user   ON credit_cards(user_id);
CREATE INDEX idx_cc_status ON credit_cards(status);

-- ─── LOAN APPLICATIONS ───────────────────────────────────────
CREATE TABLE loan_applications (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  loan_type        loan_type NOT NULL,
  requested_amount NUMERIC(18,2) NOT NULL,
  term_months      SMALLINT NOT NULL,
  purpose          TEXT,
  annual_income    NUMERIC(18,2),
  status           loan_status NOT NULL DEFAULT 'draft',
  review_notes     TEXT,
  reviewed_by      UUID REFERENCES users(id),
  reviewed_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── LOANS ───────────────────────────────────────────────────
CREATE TABLE loans (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id      UUID NOT NULL REFERENCES loan_applications(id),
  user_id             UUID NOT NULL REFERENCES users(id),
  loan_type           loan_type NOT NULL,
  principal           NUMERIC(18,2) NOT NULL,
  interest_rate       NUMERIC(6,4) NOT NULL,
  term_months         SMALLINT NOT NULL,
  monthly_payment     NUMERIC(18,2) NOT NULL,
  outstanding_balance NUMERIC(18,2) NOT NULL,
  status              loan_status NOT NULL DEFAULT 'active',
  next_payment_date   DATE,
  disbursed_at        TIMESTAMPTZ
);

-- ─── FRAUD ALERTS ────────────────────────────────────────────
CREATE TABLE fraud_alerts (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES users(id),
  tx_id          UUID REFERENCES transactions(id),
  severity       alert_severity NOT NULL,
  rule_triggered TEXT NOT NULL,
  risk_score     SMALLINT NOT NULL,
  details        JSONB,
  is_resolved    BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_by    UUID REFERENCES users(id),
  resolved_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fraud_user     ON fraud_alerts(user_id);
CREATE INDEX idx_fraud_open     ON fraud_alerts(is_resolved) WHERE is_resolved = FALSE;

-- ─── NOTIFICATIONS ───────────────────────────────────────────
CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notif_user   ON notifications(user_id);
CREATE INDEX idx_notif_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;

-- ─── AUDIT LOG ───────────────────────────────────────────────
CREATE TABLE audit_log (
  id          BIGSERIAL PRIMARY KEY,
  actor_id    UUID REFERENCES users(id),
  action      TEXT NOT NULL,
  entity_type TEXT,
  entity_id   UUID,
  metadata    JSONB,
  ip_address  INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_actor   ON audit_log(actor_id);
CREATE INDEX idx_audit_action  ON audit_log(action);
CREATE INDEX idx_audit_created ON audit_log(created_at DESC);

-- ─── UPDATED_AT TRIGGER ──────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DO $$ DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'users','accounts','transactions','card_applications','loan_applications'
  ]) LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      t, t
    );
  END LOOP;
END $$;
