# Dashboard for Tracking Park Visitations

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Running the development server

1. Install [Node.js](https://nodejs.org/en/download/)
2. Clone this repository
3. Open Node.js terminal and navigate to project directory
4. Install project packages using `npm install`
5. Install `concurrently` package using `npm install -g concurrently`
6. Run the app (server + React frontend) using `npm run dev`



## package.json scripts

### `npm run dev`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

This command concurrently runs the following commands: "npm run server" and "npm run client"

### `npm run server`

Runs the command "node server.js"  

This runs the back-end Express server that queries MongoDB for Park Visitations data.

### `npm run client`

Runs the command "npm start --prefix dashboard" which starts the frontend (in the dashboard folder)

