FROM node:18-alpine

# Set working directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm install

# Bundle app source code
COPY . .

# Expose port
EXPOSE 3000

# Run the app
CMD ["npm", "start"]
