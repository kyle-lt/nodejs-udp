FROM node:14

# Copy src
WORKDIR /app
COPY . .

# Grab libs
RUN npm install

# Rebuild for proper arch
RUN npm rebuild

# Run app
CMD [ "node", "app.js" ]