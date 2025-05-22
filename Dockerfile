FROM mcr.microsoft.com/playwright:v1.50.1-jammy

WORKDIR /app

COPY package*.json ./
RUN npm install

# Copy source files
COPY . .

RUN npx playwright install --with-deps chromium

# Build the TypeScript code
RUN npm run build

EXPOSE 3000

# Start the app
CMD ["npm", "start"]
