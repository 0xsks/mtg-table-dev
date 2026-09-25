#!/bin/bash
while true; do
  node server.js >> server.log 2>&1
  echo "Server crashed with exit code $?. Restarting in 1s..." >> server.log
  sleep 1
done
