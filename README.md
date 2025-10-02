# Guardian

Guardian is community policing application, essentially an online portal which enables reporting crimes and contacting your local force.

### Running the backend for development

```bash
# Client is deprecated and shall be ignored on this. It was merely used for initial phases of development.
# Backend Tested with following versions
# Python 3.11
# NodeJS 22.19.0
# Other possible requirements for Windows: Visual Studio Building Tools with C++ development kit module
# Note: This was developed on macOS, and i ran into windows incompatibilty issues when running on Windows for testing.
# One of the issues was fixed but the other requires executing one additonal command before running the project.
# Read below.

# 1. Clone/download the rep

# 2. cd into /backend

# 3. Install dependencies
    npm install

# 4. Set env variables by renaming the .env.example file to .env
# replace necessary values such as your mapbox public token key,
# set chatbot json file location (after placing the file in the directory) and chatbot project name

# 5. (For Windows) Run the following command in /backend which copies a tensorflow file
# to another destination which windows fail to do for some reason by its own

cp node_modules/\@tensorflow/tfjs-node/deps/lib/tensorflow.dll node_modules/\@tensorflow/tfjs-node/lib/napi-v8/

# 6. Train the model
npm run model:train

# Start the development server
npm run dev

# Start the frontend server
npx cross-env EXPO_PUBLIC_API_URL=http://192.168.56.1:2699 expo start -c

# Generate mock data
npm run script:generateExampleData
```

You can then visit `localhost:2699/api-docs` and view all available endpoints
