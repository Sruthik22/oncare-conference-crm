# Database Migrations

This directory contains SQL migrations for the Oncare CRM application.

## Running Migrations

To run these migrations, you have two options:

### Option 1: Run from the Supabase Dashboard

1. Log in to your [Supabase Dashboard](https://app.supabase.com/)
2. Go to your project
3. Navigate to the SQL Editor
4. Create a new query
5. Copy and paste the contents of the SQL files in this directory
6. Run the query

### Option 2: Use the Supabase CLI

1. Install the Supabase CLI if you haven't already:

```bash
npm install -g supabase
```

2. Log in to the Supabase CLI:

```bash
supabase login
```

3. Link your project:

```bash
supabase link --project-ref your-project-ref
```

4. Run the migrations:

```bash
supabase db push
```

## Column Management Functions

The `column_management.sql` file contains functions that allow you to check if a column exists and add columns dynamically. These functions are used by the AI enrichment feature to add new columns to tables when enriching data.

-   `column_exists(table_name, column_name)` - Checks if a column exists in a table
-   `add_column(table_name, column_name, column_type)` - Adds a column to a table if it doesn't exist

### Notes

-   These functions must be run with administrator privileges.
-   The functions use `SECURITY DEFINER` to run with the privileges of the user who created them, which should be the database owner.
