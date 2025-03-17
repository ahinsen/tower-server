#!/bin/bash
# filepath: /home/iot-server/tower-server/docker-image/entrypoint.sh

# Start both node processes using forever
forever start /home/tower-server/deviceHttpAPI.js
forever start /home/tower-server/aioUpdate.js

# Keep the container running
tail -f /dev/null
