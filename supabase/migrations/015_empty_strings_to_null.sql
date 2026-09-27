-- =========================================================================
-- Convert empty / whitespace-only text cells to NULL in public tables.
-- Skips generated / non-updatable columns.
-- =========================================================================

DO $body$
DECLARE
  r RECORD;
  updated BIGINT;
  total BIGINT := 0;
BEGIN
  FOR r IN
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND c.is_nullable = 'YES'
      AND c.data_type IN ('text', 'character varying', 'character')
      AND coalesce(c.is_generated, 'NEVER') = 'NEVER'
      AND coalesce(c.is_updatable, 'YES') = 'YES'
  LOOP
    BEGIN
      EXECUTE format(
        'UPDATE public.%I SET %I = NULL WHERE %I IS NOT NULL AND btrim(%I::text) = %L',
        r.table_name, r.column_name, r.column_name, r.column_name, ''
      );
      GET DIAGNOSTICS updated = ROW_COUNT;
      total := total + updated;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'skipped %.%: %', r.table_name, r.column_name, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'empty_strings_set_to_null=%', total;
END
$body$;
