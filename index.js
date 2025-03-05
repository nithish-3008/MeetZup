const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

let waitingUser = null;

wss.on("connection", (socket) => {
    console.log("New user connected");

    if (!waitingUser) {
        waitingUser = socket;
    } else {
        const partner = waitingUser;
        waitingUser = null;

        socket.partner = partner;
        partner.partner = socket;

        partner.send(JSON.stringify({ type: "match", initiator: true }));
        socket.send(JSON.stringify({ type: "match", initiator: false }));
    }

    socket.on("message", (message) => {
        if (socket.partner && socket.partner.readyState === WebSocket.OPEN) {
            socket.partner.send(message);
        }
    });

    socket.on("close", () => {
        if (socket.partner) {
            socket.partner.partner = null;
            socket.partner = null;
        }
        if (waitingUser === socket) {
            waitingUser = null;
        }
    });
});

server.listen(PORT, () => {
    console.log(`✅ WebSocket signaling server is running on port ${PORT}`);
});
