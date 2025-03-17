FROM node:23.7.0

WORKDIR /home/tower-server/

#COPY /home/iot-server/tower-server/package.json ./
#COPY /home/iot-server/tower-server/package-lock.json ./

COPY . .
RUN npm install
# Install forever globally
RUN npm install -g forever

#COPY /home/iot-server/tower-server/*.js ./
#COPY /home/iot-server/tower-server/towerSrvCfg_container.json ./towerSrvCfg.json
#/towerSrvCfg.json

#COPY ../iotserver1.js .

#COPY ../aioUpdate.js .

# Copy the entrypoint script
COPY ./entrypoint.sh /usr/local/bin/

# Make the entrypoint script executable
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["entrypoint.sh"]

