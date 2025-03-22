
#!/bin/bash

# Check if a deviceId parameter is provided
if [ -z "$1" ]; then
    echo "Usage: $0 <remoteuser@host> <remote password> [port]"
    exit 1
fi
HOST=$1
PW=$2
# Check if a port parameter is provided
if [ -z "$3" ]; then
    PORT=22
else
    PORT=$3
fi
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
# save it to a tar file
echo 'saving to tar'
sudo docker save -o image.tar ${IMG}
# copy the docker-compose.yml and the tar file to the remote server
echo 'scp transfering docker-compose.yml'
sudo sshpass -p ${PW} scp -P ${PORT} docker-compose.yml ${HOST}:~/tower-server/docker-image
read -p "scp transfer image.tar Proceed? (y/n): " confirm
if [ "$confirm" != "y" ]; then
    echo "Deployment aborted."
    exit 1
fi
sudo sshpass -p ${PW} scp -P ${PORT} image.tar ${HOST}:~/tower-server/docker-image/
# load the image on the remote server
echo 'load image on remote server'
sudo sshpass -p ${PW} ssh -p ${PORT} ${HOST} "sudo docker load -i ~/tower-server/docker-image/image.tar"
# start the container
read -p "Starting remote container. Proceed? (y/n): " confirm
if [ "$confirm" != "y" ]; then
    echo "Deployment aborted."
    exit 1
fi
sshpass -p ${PW} ssh -p ${PORT} ${HOST} "cd ~/tower-server/docker-image/ && echo '${PW}' | sudo -S docker compose -f ~/tower-server/docker-image/docker-compose.yml up -d"