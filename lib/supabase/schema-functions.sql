-- Function to get column information for specified tables
CREATE OR REPLACE FUNCTION get_table_columns(table_names text[])
RETURNS TABLE (
    table_name text,
    column_name text,
    data_type text,
    is_nullable text,
    column_default text
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.table_name::text,
        c.column_name::text,
        c.data_type::text,
        c.is_nullable::text,
        c.column_default::text
    FROM 
        information_schema.columns c
    WHERE 
        c.table_schema = 'public'
        AND c.table_name = ANY(table_names)
    ORDER BY 
        c.table_name, 
        c.ordinal_position;
END;
$$;

-- Function to get foreign key relationships
CREATE OR REPLACE FUNCTION get_foreign_keys()
RETURNS TABLE (
    table_name text,
    column_name text,
    foreign_table_name text,
    foreign_column_name text
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT
        tc.table_name::text,
        kcu.column_name::text,
        ccu.table_name::text AS foreign_table_name,
        ccu.column_name::text AS foreign_column_name
    FROM
        information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
    WHERE
        tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public';
END;
$$; 