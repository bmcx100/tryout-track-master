-- Add custom annotation columns for parent overrides (Spec 024)
ALTER TABLE player_annotations ADD COLUMN IF NOT EXISTS custom_jersey text;
ALTER TABLE player_annotations ADD COLUMN IF NOT EXISTS custom_position text;
ALTER TABLE player_annotations ADD COLUMN IF NOT EXISTS custom_previous_team text;
ALTER TABLE player_annotations ADD COLUMN IF NOT EXISTS custom_team text;
