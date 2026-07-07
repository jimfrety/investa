#!/bin/sh
# Render provides DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD from managed Postgres.
# Build the JDBC URL if SPRING_DATASOURCE_URL is not already set.
if [ -z "$SPRING_DATASOURCE_URL" ] && [ -n "$DB_HOST" ]; then
  export SPRING_DATASOURCE_URL="jdbc:postgresql://${DB_HOST}:${DB_PORT}/${DB_NAME}"
fi

exec java -jar /app/app.jar
