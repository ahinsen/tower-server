FROM node:23.7.0

WORKDIR /home/iot-server/tower-server/docker-image

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 8000

CMD ["node", "iotserver1.js"]
