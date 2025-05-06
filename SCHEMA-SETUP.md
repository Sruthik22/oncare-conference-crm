# Database Schema Setup

This document explains how to set up the database functions needed for the dynamic property system.

## Setting Up Schema Functions

1. Open your Supabase SQL Editor.
2. Copy and paste the SQL from `lib/supabase/schema-functions.sql` into the editor.
3. Run the SQL to create the stored procedures.

## Available Functions

### `get_table_columns(table_names text[])`

This function retrieves column metadata for the specified tables:

```sql
-- Example: Get columns for attendees and health_systems tables
SELECT * FROM get_table_columns(ARRAY['attendees', 'health_systems']);
```

### `get_foreign_keys()`

This function retrieves all foreign key relationships in the database:

```sql
-- Example: Get all foreign key relationships
SELECT * FROM get_foreign_keys();
```

## Dynamic Property System

The CRM now supports dynamic properties for entities:

1. **Automatic Schema Detection**: The system automatically detects the database schema to display columns.
2. **Virtual Properties**: Special calculated properties (like full name) are added automatically.
3. **Relationship Detection**: Foreign keys are automatically identified and displayed as relationships.

## Adding New Columns

To add a new column to an entity:

1. Add the column to the database table:

```sql
ALTER TABLE attendees ADD COLUMN custom_field TEXT;
```

2. The system will automatically detect the new column and add it to the UI.

## Column Type Mapping

| Database Type            | Property Type |
| ------------------------ | ------------- |
| uuid, text, varchar      | text          |
| integer, bigint, numeric | number        |
| timestamp, date          | date          |
| ARRAY                    | tags          |

Additionally:

-   Columns ending with `_id` are treated as relations
-   Columns named `email` are treated as email fields
-   Columns named `phone` are treated as phone fields
-   Columns containing `url` or named `website` are treated as URL fields
