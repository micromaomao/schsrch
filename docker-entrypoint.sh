#!/bin/bash

trap "exit 0" 0 2 14
while :; do
  ./server.js
done
