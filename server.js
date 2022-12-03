const http = require("http");
const fs = require("fs");
const app = require("./app.js");

const server = http.createServer(app);
const port = 4567;
console.log("server created");
server.listen(port);
console.log(`listening, on port ${port}...`);
