-- Test function for column_exists
DO $$
DECLARE
  result BOOLEAN;
BEGIN
  -- Test with an existing column (should return true)
  SELECT column_exists('attendees', 'id') INTO result;
  RAISE NOTICE 'Column "id" exists in attendees table: %', result;
  
  -- Test with a non-existing column (should return false)
  SELECT column_exists('attendees', 'test_column_123') INTO result;
  RAISE NOTICE 'Column "test_column_123" exists in attendees table: %', result;
  
  -- Test the add_column function (should create the column)
  PERFORM add_column('attendees', 'test_column_123', 'text');
  RAISE NOTICE 'Added column "test_column_123" to attendees table';
  
  -- Verify the column was created
  SELECT column_exists('attendees', 'test_column_123') INTO result;
  RAISE NOTICE 'After creation, column "test_column_123" exists in attendees table: %', result;
  
  -- Clean up test column
  EXECUTE 'ALTER TABLE attendees DROP COLUMN IF EXISTS test_column_123';
  RAISE NOTICE 'Dropped test column';
END $$; 