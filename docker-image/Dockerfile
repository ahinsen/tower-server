FROM node:23.7.0

WORKDIR /home/tower-server/

# Copy package.json and package-lock.json files
COPY *.json *.js ./

RUN npm install
# Install forever globally
#RUN npm install -g forever

# Copy the entrypoint script
#COPY entrypoint.sh /usr/local/bin/

# Make the entrypoint script executable
#RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 8000

#ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
ENTRYPOINT [ "/usr/local/bin/node", "/home/tower-server/deviceHttpAPI.js" ]