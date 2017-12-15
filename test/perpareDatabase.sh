#!/usr/bin/env bash
cd "$(dirname "$0")"

# Drop database and elasticsearch index.
mongo --host $MONGODB --eval "db.getSiblingDB('test').dropDatabase()"
curl -X DELETE 'http://'$ES'/pastpaper'

# Extract papers
tmpdir=$(mktemp -d)
openssl aes-256-cbc -d -in pastpapers.bin -pass pass:schsrch | gzip -d | tar -x -C $tmpdir
if [ $? -ne 0 ]; then
  echo "Unable to extract past papers to $tmpdir."
  rm -rv $tmpdir
  exit 1
fi
if [ ! -f $tmpdir/pastpapers/9699_s17_1_3_qp.pdf]; then
  echo "Expected extracted paper to exist in $tmpdir."
  rm -rv $tmpdir
  exit 1
fi

QUICK=1 ../doIndex.bin.js $tmpdir/pastpapers

rm -rf $tmpdir
