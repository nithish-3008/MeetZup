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

// Function to unpair users
function unpairUser(socket) {
    if (socket.partner) {
        sendMessage(socket.partner, { type: "partner-disconnected" });
        socket.partner.partner = null;
        socket.partner = null;
    }
}

// WebSocket connection logic
wss.on("connection", (socket) => {
    console.log("✅ New user connected");

    // Handle heartbeat to keep connection alive
    socket.isAlive = true;
    socket.on("pong", () => (socket.isAlive = true));

    // Match users
    if (!waitingUser) {
        waitingUser = socket;
    } else {
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
        try {
            const msg = JSON.parse(message);
            
            if (msg.type === "next") {
                console.log("🔄 User requested next match");
                unpairUser(socket);
                if (!waitingUser) {
                    waitingUser = socket;
                } else {
                    const partner = waitingUser;
                    waitingUser = null;
                    socket.partner = partner;
                    partner.partner = socket;
                    sendMessage(partner, { type: "match", initiator: true });
                    sendMessage(socket, { type: "match", initiator: false });
                    console.log("🔗 Users paired after next");
                }
            } else if (socket.partner) {
                sendMessage(socket.partner, msg);
            }
        } catch (err) {
            console.error("❌ Error processing message:", err);
        }
    });

    // Handle disconnection
    socket.on("close", () => {
        console.log("❌ User disconnected");
        unpairUser(socket);
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
