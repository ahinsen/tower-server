
#!/bin/bash

# Check if a deviceId parameter is provided
if [ -z "$1" ]; then
    echo "Usage: $0 <remote password>"
    exit 1
fi

PW=$1
echo 'deleting tar'
rm -f iotsrv.tar
# Build the docker image locally
echo 'building image'
docker build -t iotsrv .
# save it to a tar file
echo 'saving to tar'
docker save -o iotsrv.tar iotsrv
# copy the docker-compose.yml and the tar file to the remote server
echo 'scp transfering docker-compose.yml'
sudo sshpass -p ${PW} scp -P 8022 docker-compose.yml bz@szp.cwskft.hu:~/tower-server/docker-image
read -p "scp transfer image.tar Proceed? (y/n): " confirm
if [ "$confirm" != "y" ]; then
    echo "Deployment aborted."
    exit 1
fi
sudo sshpass -p ${PW} scp -P 8022 iotsrv.tar bz@szp.cwskft.hu:~/tower-server/docker-image
# load the image on the remote server
echo 'load image on remote server'
sudo sshpass -p ${PW} ssh -p 8022 bz@szp.cwskft.hu "sudo docker load -i ~/tower-server/docker-image/iotsrv.tar"
# start the container
read -p "Starting remote container. Proceed? (y/n): " confirm
if [ "$confirm" != "y" ]; then
    echo "Deployment aborted."
    exit 1
fi
#sudo sshpass -p 'Semmi123' ssh -p 8022 bz@szp.cwskft.hu "cd ~/tower-server/docker-image && sudo -S docker compose up -d"
sshpass -p ${PW} ssh -p 8022 bz@szp.cwskft.hu "cd ~/tower-server/docker-image && echo 'Semmi123' | sudo -S docker compose -f ~/tower-server/docker-image/docker-compose.yml up -d"