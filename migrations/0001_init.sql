PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS donor_profiles (
  uid TEXT PRIMARY KEY CHECK (length(uid) BETWEEN 1 AND 128),
  blood_group TEXT NOT NULL CHECK (blood_group IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  state TEXT NOT NULL CHECK (length(state) BETWEEN 2 AND 80),
  state_key TEXT NOT NULL CHECK (length(state_key) BETWEEN 1 AND 100),
  district TEXT NOT NULL CHECK (length(district) BETWEEN 2 AND 60),
  district_key TEXT NOT NULL CHECK (length(district_key) BETWEEN 1 AND 100),
  consent_version TEXT NOT NULL CHECK (length(consent_version) <= 40),
  consented_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY CHECK (length(id) = 36),
  owner_uid TEXT NOT NULL CHECK (length(owner_uid) BETWEEN 1 AND 128),
  blood_group TEXT NOT NULL CHECK (blood_group IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  component TEXT NOT NULL CHECK (component IN ('Whole blood','Red cells','Platelets','Plasma')),
  units INTEGER NOT NULL CHECK (units BETWEEN 1 AND 20),
  state TEXT NOT NULL CHECK (length(state) BETWEEN 2 AND 80),
  state_key TEXT NOT NULL CHECK (length(state_key) BETWEEN 1 AND 100),
  district TEXT NOT NULL CHECK (length(district) BETWEEN 2 AND 60),
  district_key TEXT NOT NULL CHECK (length(district_key) BETWEEN 1 AND 100),
  hospital TEXT NOT NULL CHECK (length(hospital) BETWEEN 2 AND 100),
  needed_by TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  phone_cipher TEXT NOT NULL,
  phone_iv TEXT NOT NULL,
  share_phone INTEGER NOT NULL CHECK (share_phone = 1),
  consent_version TEXT NOT NULL CHECK (length(consent_version) <= 40),
  consented_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS requests_for_matches
  ON requests (blood_group, state_key, district_key, share_phone, expires_at);

CREATE INDEX IF NOT EXISTS requests_for_owner
  ON requests (owner_uid, expires_at, created_at);

CREATE TABLE IF NOT EXISTS disclosures (
  donor_uid TEXT NOT NULL CHECK (length(donor_uid) BETWEEN 1 AND 128),
  request_id TEXT NOT NULL CHECK (length(request_id) = 36),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (donor_uid, request_id)
) STRICT;

CREATE INDEX IF NOT EXISTS disclosures_by_time
  ON disclosures (donor_uid, created_at);
