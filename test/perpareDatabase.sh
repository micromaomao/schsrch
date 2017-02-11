#!/usr/bin/env bash
cd "$(dirname "$0")"

mongo mongodb://$MONGODB/test --eval "db.dropDatabase()"
../doIndex.bin.js pastpapers
