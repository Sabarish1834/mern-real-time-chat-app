require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const Message = require("./models/Message");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST", "PATCH"],
    },
});

app.use(cors());
app.use(express.json());

app.use("/api/auth", require("./routes/auth"));
app.use("/api/messages", require("./routes/messages"));

// Store connected users
const userSocketMap = {};

// Socket.IO
io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    // User comes online
    socket.on("userOnline", async (username) => {
        userSocketMap[username] = socket.id;

        console.log(`${username} is online`);

        io.emit("onlineUsers", Object.keys(userSocketMap));

        // Deliver previously sent messages
        try {
            const pendingMessages = await Message.find({
                receiver: username,
                status: "sent",
            });

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
                "DELIVERY STATUS ERROR...",
                err.message
            );
        }
    });

    // Send message
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

                // Tell sender that message is delivered
                socket.emit("messageStatus", {
                    messageId: data._id,
                    status: "delivered",
                });
            }
        } catch (err) {
            console.error(
                "SOCKET SEND MESSAGE ERROR...",
                err.message
            );
        }
    });

    // Mark messages as seen
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

            // Tell sender that these messages are seen
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
                "SEEN STATUS ERROR...",
                err.message
            );
        }
    });

    // User disconnects
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
    });
});

// MongoDB connection
mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
        server.listen(5000, () => {
            console.log(
                "Server is Running on PORT 5000"
            );
        });
    })
    .catch((err) => {
        console.log(err);
    });