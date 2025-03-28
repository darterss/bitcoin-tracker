#!/bin/sh
set -e

/wait-for-it.sh db:5432 -- echo "DB is ready"

sleep 1

if [ -d "prisma/migrations" ] && [ "$(ls -A prisma/migrations)" ]; then
  npx prisma migrate deploy
else
  npx prisma db push
fi

exec node server/index.js & npm run dev