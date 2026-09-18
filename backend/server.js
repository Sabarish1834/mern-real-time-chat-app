require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const Message = require("./models/Message");

const app = express();
const server = http.createServer(app);

// ===============================
// CORS
// ===============================

const allowedOrigins = [
    "http://localhost:5173",
    "https://mern-real-time-chat-app-rho.vercel.app",
];

app.use(
    cors({
        origin: allowedOrigins,
        methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
        credentials: true,
    })
);

app.use(express.json());

// ===============================
// SOCKET.IO
// ===============================

const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
        credentials: true,
    },
});

// ===============================
// API ROUTES
// ===============================

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "MERN Chat Backend is running",
    });
});

app.use("/api/auth", require("./routes/auth"));
app.use("/api/messages", require("./routes/messages"));

// ===============================
// STORE CONNECTED USERS
// ===============================

const userSocketMap = {};

// ===============================
// SOCKET.IO CONNECTION
// ===============================

io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    // =================================
    // USER ONLINE
    // =================================

    socket.on("userOnline", async (username) => {
        try {
            userSocketMap[username] = socket.id;

            console.log(`${username} is online`);

            // Send online users to everyone
            io.emit(
                "onlineUsers",
                Object.keys(userSocketMap)
            );

            // Find pending messages
            const pendingMessages = await Message.find({
                receiver: username,
                status: "sent",
            });

            // Mark pending messages as delivered
            for (const message of pendingMessages) {
                message.status = "delivered";

                await message.save();

                const senderSocketId =
                    userSocketMap[message.sender];

                if (senderSocketId) {
                    io.to(senderSocketId).emit(
                        "messageStatus",
                        {
                            messageId: message._id,
                            status: "delivered",
                        }
                    );
                }
            }
        } catch (err) {
            console.error(
                "DELIVERY STATUS ERROR:",
                err.message
            );
        }
    });

    // =================================
    // SEND MESSAGE
    // =================================

    socket.on("sendMessage", async (data) => {
        try {
            const receiverSocketId =
                userSocketMap[data.receiver];

            // Receiver is online
            if (receiverSocketId) {
                const updatedMessage =
                    await Message.findByIdAndUpdate(
                        data._id,
                        {
                            status: "delivered",
                        },
                        {
                            new: true,
                        }
                    );

                // Send message to receiver
                io.to(receiverSocketId).emit(
                    "receiveMessage",
                    updatedMessage || data
                );

                // Tell sender message was delivered
                socket.emit("messageStatus", {
                    messageId: data._id,
                    status: "delivered",
                });
            }
        } catch (err) {
            console.error(
                "SOCKET SEND MESSAGE ERROR:",
                err.message
            );
        }
    });

    // =================================
    // MARK MESSAGES AS SEEN
    // =================================

    socket.on("markMessagesSeen", async (data) => {
        try {
            const { sender, receiver } = data;

            const messages = await Message.find({
                sender,
                receiver,
                status: { $ne: "seen" },
            });

            if (messages.length === 0) {
                return;
            }

            await Message.updateMany(
                {
                    sender,
                    receiver,
                    status: { $ne: "seen" },
                },
                {
                    $set: {
                        status: "seen",
                    },
                }
            );

            // Tell sender messages are seen
            const senderSocketId =
                userSocketMap[sender];

            if (senderSocketId) {
                io.to(senderSocketId).emit(
                    "messagesSeen",
                    {
                        sender,
                        receiver,
                        messageIds: messages.map(
                            (message) => message._id
                        ),
                    }
                );
            }
        } catch (err) {
            console.error(
                "SEEN STATUS ERROR:",
                err.message
            );
        }
    });

    // =================================
    // USER DISCONNECT
    // =================================

    socket.on("disconnect", () => {
        for (const [username, id] of Object.entries(
            userSocketMap
        )) {
            if (id === socket.id) {
                delete userSocketMap[username];

                console.log(
                    `${username} is offline`
                );

                break;
            }
        }

        io.emit(
            "onlineUsers",
            Object.keys(userSocketMap)
        );

        console.log(
            "User disconnected:",
            socket.id
        );
    });
});

// ===============================
// MONGODB CONNECTION
// ===============================

mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
        console.log("MongoDB Connected Successfully");
    })
    .catch((err) => {
        console.error(
            "MongoDB Connection Error:",
            err.message
        );
    });

// ===============================
// VERCEL EXPORT
// ===============================

module.exports = server;