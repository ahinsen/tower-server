#!/bin/bash

# Check if the service name is provided
if [ -z "$1" ]; then
  echo "Usage: $0 <service-name>"
  exit 1
fi

SERVICE_NAME=$1
SERVICE_FILE="./${SERVICE_NAME}.service"
SYSTEMD_PATH="/etc/systemd/system/${SERVICE_NAME}.service"

# Copy the service file to the systemd directory
sudo cp $SERVICE_FILE $SYSTEMD_PATH

# Reload the systemd manager configuration
sudo systemctl daemon-reload

# Enable the service to start on boot
sudo systemctl enable $SERVICE_NAME

# Restart the service
sudo systemctl restart $SERVICE_NAME

# Check the status of the service
sudo systemctl status $SERVICE_NAME