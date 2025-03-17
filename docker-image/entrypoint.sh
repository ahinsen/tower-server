#!/bin/sh
# filepath: /home/iot-server/tower-server/docker-image/entrypoint.sh
# #!/bin/bash

# Modify the towerSrvCfg.json file
# cp /home/iot-server/tower-server/towerSrvCfg_container.json /home/iot-server/tower-server/towerSrvCfg.json
# echo "----------Modified towerSrvCfg.json----------------"

# Start both node processes using forever
forever start /home/iot-server/tower-server/docker-image/iotserver1.js
forever start /home/iot-server/tower-server/docker-image/aioUpdate.js

# Keep the container running
tail -f /dev/null
