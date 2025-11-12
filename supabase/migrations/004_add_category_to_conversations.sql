-- Add category_id and auto_categorized columns to conversations table
ALTER TABLE conversations 
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS auto_categorized BOOLEAN DEFAULT FALSE;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_conversations_category_id ON conversations(category_id);

-- Add comment for clarity
COMMENT ON COLUMN conversations.category_id IS 'References the category this conversation belongs to';
COMMENT ON COLUMN conversations.auto_categorized IS 'Indicates if the category was automatically assigned by AI';

