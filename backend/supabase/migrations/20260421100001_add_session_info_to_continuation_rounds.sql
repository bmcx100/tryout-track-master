-- Add optional session_info text field to continuation_rounds
ALTER TABLE continuation_rounds
  ADD COLUMN session_info text;
