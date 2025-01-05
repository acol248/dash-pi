#!/bin/bash

PROCESS_ID=`pgrep -f app.py`

kill -INT $PROCESS_ID
if [ $? -ne 0 ]; then
  echo "Failed to send interrupt to process $PROCESS_ID or process does not exist."
  exit 1
fi

while kill -0 $PROCESS_ID 2>/dev/null; do
  sleep 0.1
done

echo "DONE!"