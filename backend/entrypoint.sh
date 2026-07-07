#!/bin/sh
# Render provides DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD from managed Postgres.
# When DB_HOST is set, always build a proper jdbc:postgresql:// URL,
# overriding any stale SPRING_DATASOURCE_URL that may have been set with a postgres:// URI.
if [ -n "$DB_HOST" ]; then
  export SPRING_DATASOURCE_URL="jdbc:postgresql://${DB_HOST}:${DB_PORT}/${DB_NAME}"
fi

# Limit JVM heap to stay within Render starter plan's 512MB container limit
exec java -Xms128m -Xmx380m -jar /app/app.jar

