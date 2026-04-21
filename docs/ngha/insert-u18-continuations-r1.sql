-- Insert U18 AA Round 1 continuations (all 40 players)
INSERT INTO continuation_rounds (
  association_id, division, team_level, round_number,
  jersey_numbers, ip_players, sessions, status, is_final_team
) VALUES (
  'a1000000-0000-0000-0000-000000000001',
  'U18',
  'AA',
  1,
  ARRAY['168','191','203','223','252','265','266','270','271','298','301','309','325','434','467','492','505','524','546','550','575','658','664','671','681','683','684','688','707','712','771','782','872','873','881','885','935','975','977','999'],
  ARRAY[]::text[],
  '[]'::jsonb,
  'published',
  false
);
