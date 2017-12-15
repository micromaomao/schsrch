#!/usr/bin/env bash
cd "$(dirname "$0")"
paperbin=pastpapers.bin
password=schsrch

# Drop database and elasticsearch index.
mongo --host $MONGODB --eval "db.getSiblingDB('test').dropDatabase()"
curl -X DELETE 'http://'$ES'/pastpaper'
echo # last command don't have \n

# Extract papers
tmpdir=$(mktemp -d)
openssl aes-256-cbc -d -in $paperbin -pass pass:$password -md sha256 -out $tmpdir/decrypt
if [ $? -ne 0 ]; then
  echo "Unable to decrypt $paperbin"
  rm -rv $tmpdir
  exit 1
fi
gzip -d < $tmpdir/decrypt | tar -x -C $tmpdir
if [ $? -ne 0 ]; then
  echo "Unable to extract past papers to $tmpdir."
  rm -rv $tmpdir
  exit 1
fi
if [ ! -f $tmpdir/pastpapers/0611_s16_qp_74.pdf ]; then
  echo "Expected extracted paper to exist in $tmpdir."
  rm -rv $tmpdir
  exit 1
fi

QUICK=1 ../doIndex.bin.js $tmpdir/pastpapers

rm -rf $tmpdir
