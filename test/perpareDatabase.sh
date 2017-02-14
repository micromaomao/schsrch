#!/usr/bin/env bash
cd "$(dirname "$0")"

mongo --host $MONGODB --eval "db.getSiblingDB('test').dropDatabase()"
QUICK=1 ../doIndex.bin.js pastpapers
