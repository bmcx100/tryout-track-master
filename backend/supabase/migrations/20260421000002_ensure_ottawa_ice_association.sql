-- Ensure Ottawa Ice (OGHA) association exists with join_enabled = true
INSERT INTO associations (id, name, abbreviation, join_code, join_enabled)
VALUES (
  '9ba699fa-0b0c-454b-9d2b-a5489378dd56',
  'Ottawa Ice',
  'OGHA',
  'OGHA2026',
  true
)
ON CONFLICT (id) DO UPDATE
SET join_enabled = true;
