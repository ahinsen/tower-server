#!/bin/bash

# Modify the towerSrvCfg.json file
cp /home/iot-server/tower-server/towerSrvCfg_container.json > /home/iot-server/tower-server/towerSrvCfg.json

# Execute the original CMD
exec "$@"