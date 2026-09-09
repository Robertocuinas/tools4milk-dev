from scripts.apply_migrations import split_sql


def test_split_sql_preserves_dollar_quoted_postgres_blocks():
    statements = split_sql(
        """DO $$ BEGIN
    PERFORM 1;
END $$;
CREATE TABLE example (id INTEGER);"""
    )

    assert statements == [
        "DO $$ BEGIN\n    PERFORM 1;\nEND $$",
        "CREATE TABLE example (id INTEGER)",
    ]

    tagged = split_sql(
        """CREATE FUNCTION audit() RETURNS trigger AS $FN$
BEGIN
    RETURN NEW;
END;
$FN$ LANGUAGE plpgsql;"""
    )
    assert tagged == [
        "CREATE FUNCTION audit() RETURNS trigger AS $FN$\nBEGIN\n    RETURN NEW;\nEND;\n$FN$ LANGUAGE plpgsql"
    ]