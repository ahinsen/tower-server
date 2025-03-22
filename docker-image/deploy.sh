
#!/bin/bash
# Check the first argument and set the USR variable
if [ "$1" == "dev" ]; then
    USR="iot-server"
elif [ "$1" == "prd" ]; then
    USR="bz"
else
    echo "usage: $0 dev or $0 prd"
    exit 1
fi

IMG="towersrv"
cd /home/${USR}/tower-server

echo 'deleting files of previous builds, and removing image -----------------'
rm -f ./docker-image/${IMG}.tar
rm -f ./docker-image/*.js
rm -f ./docker-image/*.json
docker compose --file /home/${USR}/tower-server/docker-image/compose-${$1}.yml --project-name 'docker-image' down
sudo docker rmi -f towersrv
sudo docker image ls

echo 'copying files to docker-image -----------------------------------------'
cp /home/${USR}/tower-server/src/*.js ./docker-image/
cp /home/${USR}/tower-server/*.json ./docker-image/

# Build the docker image locally
echo 'building image --------------------------------------------------------'
sudo docker build --no-cache -t ${IMG} ./docker-image/
#cleanup
echo 'cleanup source files from docker-image folder -------------------------'
rm -f ./docker-image/*.js
rm -f ./docker-image/*.json
# start the container
read -p "Starting local container. Proceed? (y/n): " confirm
if [ "$confirm" != "y" ]; then
    echo "Deployment aborted."
    exit 1
fi
docker compose -f ./docker-image/compose-${$1}.yml up -d
docker logs -f ${IMG}
