
#!/bin/bash

# Check if a deviceId parameter is provided

IMG="towersrv"
cd /home/iot-server/tower-server

echo 'deleting files of previous builds, and removing image'
rm -f /docker-image/${IMG}.tar
rm -f /docker-image/*.js
rm -f /docker-image/*.json
sudo docker rmi -f ${IMG}

echo 'copying files to docker-image'
cp /home/iot-server/tower-server/src/*.js ./docker-image/
cp /home/iot-server/tower-server/package*.json ./docker-image/
cp /home/iot-server/tower-server/towerSrvCfg_container.json ./docker-image/towerSrvCfg.json

# Build the docker image locally
echo 'building image'
sudo docker build --no-cache -t ${IMG} ./docker-image/
#cleanup
rm -f /docker-image/*.js
rm -f /docker-image/*.json
# start the container
read -p "Starting local container. Proceed? (y/n): " confirm
if [ "$confirm" != "y" ]; then
    echo "Deployment aborted."
    exit 1
fi
docker compose -f ./docker-image/docker-compose.yml up -d