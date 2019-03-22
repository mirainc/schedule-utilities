#Pulling latest lts version of node
FROM node:carbon

# Create app directory
RUN mkdir -p /usr/src/schedule-utilities
WORKDIR /usr/src/schedule-utilities

# Add project files to the docker container
ADD . /usr/src/schedule-utilities

RUN npm install

RUN npm run build

#Exposing default port
EXPOSE 3000
