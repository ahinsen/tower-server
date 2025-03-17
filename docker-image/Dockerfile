FROM node:23.7.0

WORKDIR /home/tower-server/

# Copy package.json and package-lock.json files
COPY ../package.json ./
COPY ../package-lock.json ./

RUN npm install
# Install forever globally
RUN npm install -g forever

# Copy JavaScript files from the src folder
COPY ../src/*.js ./

# Copy the configuration file and rename it
COPY ../towerSrvCfg_container.json ./towerSrvCfg.json

# Copy the entrypoint script
COPY entrypoint.sh /usr/local/bin/

# Make the entrypoint script executable
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]

