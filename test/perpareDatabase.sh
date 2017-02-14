#!/usr/bin/env bash
cd "$(dirname "$0")"

mongo mongodb://$MONGODB/test --eval "db.dropDatabase()"
QUICK=1 ../doIndex.bin.js pastpapers
