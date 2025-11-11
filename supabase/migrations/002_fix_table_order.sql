-- Safe migration to fix table creation order
-- This handles the case where conversations table was created before folders

-- First, drop the foreign key constraint if it exists (in case conversations table exists)
ALTER TABLE conversations 
  DROP CONSTRAINT IF EXISTS conversations_folder_id_fkey;

-- Create folders table if it doesn't exist
CREATE TABLE IF NOT EXISTS folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Now add the foreign key constraint back
ALTER TABLE conversations 
  ADD CONSTRAINT conversations_folder_id_fkey 
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL;

