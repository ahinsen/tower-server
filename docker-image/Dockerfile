FROM node:23.7.0

WORKDIR /home/iot-server/tower-server/docker-image

COPY package*.json ./

RUN npm install

COPY . .

# Copy the entrypoint script
# COPY entrypoint.sh /usr/local/bin/

# Make the entrypoint script executable
# RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["entrypoint.sh"]

CMD ["node", "iotserver1.js"]
