CREATE TABLE user_associations (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  association_id uuid NOT NULL REFERENCES associations (id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  consent_given_at timestamptz,
  PRIMARY KEY (user_id, association_id)
);

ALTER TABLE user_associations ENABLE ROW LEVEL SECURITY;
