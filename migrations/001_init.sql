-- BladderSense v2 schema. One file for a fresh database; add 002_*.sql for later changes.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email              TEXT NOT NULL,
    first_name         TEXT CHECK (char_length(first_name) <= 60),
    birth_year         SMALLINT CHECK (birth_year BETWEEN 1920 AND 2010),
    timezone           TEXT NOT NULL DEFAULT 'UTC',
    reminder_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
    reminder_hour      SMALLINT NOT NULL DEFAULT 8 CHECK (reminder_hour BETWEEN 0 AND 23),
    weekly_email       BOOLEAN NOT NULL DEFAULT TRUE,
    last_reminded_on   DATE,
    last_weekly_on     DATE,
    onboarded_at       TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at       TIMESTAMPTZ
);

CREATE UNIQUE INDEX users_email_key ON users (lower(email));

-- One row per emailed sign-in. The email carries both a 6-digit code and a
-- link; only hashes are stored. Keyed by email because the user may not exist yet.
CREATE TABLE login_tokens (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email        TEXT NOT NULL,
    code_hash    TEXT NOT NULL,
    link_hash    TEXT NOT NULL UNIQUE,
    attempts     SMALLINT NOT NULL DEFAULT 0,
    expires_at   TIMESTAMPTZ NOT NULL,
    used_at      TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX login_tokens_email_idx ON login_tokens (lower(email), created_at DESC);

CREATE TABLE sessions (
    token_hash   TEXT PRIMARY KEY,
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at   TIMESTAMPTZ NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX sessions_user_idx ON sessions (user_id);

-- One morning check-in per day. entry_date is the user's local date; the entry
-- covers last night and the 24 hours before it. urgent, leaks and
-- caffeine_alcohol are NULL only on days imported from v1, which did not ask.
CREATE TABLE entries (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entry_date        DATE NOT NULL,
    night_trips       SMALLINT NOT NULL CHECK (night_trips BETWEEN 0 AND 15),
    urgent            SMALLINT CHECK (urgent BETWEEN 0 AND 30),
    leaks             SMALLINT CHECK (leaks BETWEEN 0 AND 30),
    evening_drinks    TEXT NOT NULL CHECK (evening_drinks IN ('none', 'small', 'moderate', 'large')),
    caffeine_alcohol  BOOLEAN,
    activity          TEXT NOT NULL CHECK (activity IN ('none', 'light', 'moderate', 'high')),
    stress            SMALLINT NOT NULL CHECK (stress BETWEEN 1 AND 5),
    sleep             TEXT NOT NULL CHECK (sleep IN ('poor', 'fair', 'good')),
    notes             TEXT CHECK (char_length(notes) <= 500),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, entry_date)
);

-- A read-only link a user hands to their doctor. Fixed date range, expires,
-- revocable. Only the token hash is stored.
CREATE TABLE report_links (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      TEXT NOT NULL UNIQUE,
    start_date      DATE NOT NULL,
    end_date        DATE NOT NULL,
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked_at      TIMESTAMPTZ,
    view_count      INTEGER NOT NULL DEFAULT 0,
    last_viewed_at  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX report_links_user_idx ON report_links (user_id);

-- Every Doctor Report generated. Exists to measure the launch metric.
CREATE TABLE report_exports (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind        TEXT NOT NULL CHECK (kind IN ('download', 'link')),
    days        SMALLINT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
