const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
let waitingUser = null;

// Function to send JSON messages safely
function sendMessage(socket, message) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
    }
}

wss.on("connection", (socket) => {
    console.log("✅ New user connected");

    // Handle heartbeat to keep connection alive
    socket.isAlive = true;
    socket.on("pong", () => (socket.isAlive = true));

    if (!waitingUser) {
        waitingUser = socket;
    } else {
        // Pair the waiting user with the new user
        const partner = waitingUser;
        waitingUser = null;

        socket.partner = partner;
        partner.partner = socket;

        sendMessage(partner, { type: "match", initiator: true });
        sendMessage(socket, { type: "match", initiator: false });

        console.log("🔗 Users paired successfully");
    }

    // Handle messages between peers
    socket.on("message", (message) => {
        if (socket.partner) {
            sendMessage(socket.partner, JSON.parse(message));
        }
    });

    // Handle disconnection
    socket.on("close", () => {
        console.log("❌ User disconnected");

        if (socket.partner) {
            sendMessage(socket.partner, { type: "partner-disconnected" });
            socket.partner.partner = null;
        }

        if (waitingUser === socket) {
            waitingUser = null;
        }
    });
});

// Heartbeat mechanism to detect inactive users
setInterval(() => {
    wss.clients.forEach((socket) => {
        if (!socket.isAlive) return socket.terminate();
        socket.isAlive = false;
        socket.ping();
    });
}, 30000); // Runs every 30 seconds

server.listen(PORT, () => {
    console.log(`🚀 WebSocket signaling server is running on port ${PORT}`);
});
