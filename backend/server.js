require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const Message = require("./models/Message");

const app = express();
const server = http.createServer(app);

// ==========================================
// CORS CONFIGURATION
// ==========================================

const allowedOrigins = [
    "http://localhost:5173",
    "https://mern-real-time-chat-app-rho.vercel.app",
];

// Check whether origin is allowed
const isAllowedOrigin = (origin) => {
    if (!origin) {
        return true;
    }

    // Local development
    if (origin === "http://localhost:5173") {
        return true;
    }

    // Main Vercel production domain
    if (
        origin ===
        "https://mern-real-time-chat-app-rho.vercel.app"
    ) {
        return true;
    }

    // Vercel preview deployments
    if (
        origin.endsWith(".vercel.app") &&
        origin.includes("mern-real-time-chat")
    ) {
        return true;
    }

    return false;
};


// ==========================================
// EXPRESS CORS
// ==========================================

app.use(
    cors({
        origin: function (origin, callback) {

            if (isAllowedOrigin(origin)) {
                callback(null, true);
            } else {
                callback(
                    new Error(
                        "Not allowed by CORS"
                    )
                );
            }
        },

        methods: [
            "GET",
            "POST",
            "PATCH",
            "PUT",
            "DELETE",
            "OPTIONS",
        ],

        credentials: true,
    })
);


// ==========================================
// BODY PARSER
// ==========================================

app.use(express.json());


// ==========================================
// SOCKET.IO
// ==========================================

const io = new Server(server, {
    cors: {
        origin: function (origin, callback) {

            if (isAllowedOrigin(origin)) {
                callback(null, true);
            } else {
                callback(
                    new Error(
                        "Not allowed by Socket.IO CORS"
                    )
                );
            }
        },

        methods: [
            "GET",
            "POST",
            "PATCH",
        ],

        credentials: true,
    },
});


// ==========================================
// API ROUTES
// ==========================================

app.use(
    "/api/auth",
    require("./routes/auth")
);

app.use(
    "/api/messages",
    require("./routes/messages")
);


// ==========================================
// ROOT ROUTE
// ==========================================

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "MERN Chat Backend is running",
    });
});


// ==========================================
// STORE CONNECTED USERS
// ==========================================

const userSocketMap = {};


// ==========================================
// SOCKET.IO CONNECTION
// ==========================================

io.on("connection", (socket) => {

    console.log(
        "User connected:",
        socket.id
    );


    // ======================================
    // USER ONLINE
    // ======================================

    socket.on(
        "userOnline",
        async (username) => {

            userSocketMap[username] =
                socket.id;

            console.log(
                `${username} is online`
            );

            io.emit(
                "onlineUsers",
                Object.keys(userSocketMap)
            );


            // ==================================
            // DELIVER PENDING MESSAGES
            // ==================================

            try {

                const pendingMessages =
                    await Message.find({
                        receiver: username,
                        status: "sent",
                    });


                for (
                    const message of
                    pendingMessages
                ) {

                    message.status =
                        "delivered";

                    await message.save();


                    const senderSocketId =
                        userSocketMap[
                            message.sender
                        ];


                    if (senderSocketId) {

                        io.to(
                            senderSocketId
                        ).emit(
                            "messageStatus",
                            {
                                messageId:
                                    message._id,

                                status:
                                    "delivered",
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
        }
    );


    // ======================================
    // SEND MESSAGE
    // ======================================

    socket.on(
        "sendMessage",
        async (data) => {

            try {

                const receiverSocketId =
                    userSocketMap[
                        data.receiver
                    ];


                if (receiverSocketId) {

                    const updatedMessage =
                        await Message.findByIdAndUpdate(
                            data._id,
                            {
                                status:
                                    "delivered",
                            },
                            {
                                new: true,
                            }
                        );


                    io.to(
                        receiverSocketId
                    ).emit(
                        "receiveMessage",
                        updatedMessage ||
                            data
                    );


                    socket.emit(
                        "messageStatus",
                        {
                            messageId:
                                data._id,

                            status:
                                "delivered",
                        }
                    );

                }

            } catch (err) {

                console.error(
                    "SOCKET SEND MESSAGE ERROR...",
                    err.message
                );

            }
        }
    );


    // ======================================
    // MARK MESSAGES AS SEEN
    // ======================================

    socket.on(
        "markMessagesSeen",
        async (data) => {

            try {

                const {
                    sender,
                    receiver,
                } = data;


                const messages =
                    await Message.find({
                        sender,
                        receiver,
                        status: {
                            $ne: "seen",
                        },
                    });


                if (
                    messages.length === 0
                ) {
                    return;
                }


                await Message.updateMany(
                    {
                        sender,
                        receiver,
                        status: {
                            $ne: "seen",
                        },
                    },
                    {
                        $set: {
                            status: "seen",
                        },
                    }
                );


                const senderSocketId =
                    userSocketMap[
                        sender
                    ];


                if (senderSocketId) {

                    io.to(
                        senderSocketId
                    ).emit(
                        "messagesSeen",
                        {
                            sender,
                            receiver,

                            messageIds:
                                messages.map(
                                    (message) =>
                                        message._id
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
        }
    );


    // ======================================
    // DISCONNECT
    // ======================================

    socket.on(
        "disconnect",
        () => {

            for (
                const [
                    username,
                    id,
                ] of Object.entries(
                    userSocketMap
                )
            ) {

                if (
                    id === socket.id
                ) {

                    delete userSocketMap[
                        username
                    ];


                    console.log(
                        `${username} is offline`
                    );

                    break;
                }
            }


            io.emit(
                "onlineUsers",
                Object.keys(
                    userSocketMap
                )
            );

        }
    );

});


// ==========================================
// MONGODB CONNECTION
// ==========================================

mongoose
    .connect(process.env.MONGO_URI)

    .then(() => {

        console.log(
            "Connected to MongoDB"
        );


        // ==================================
        // LOCAL SERVER
        // ==================================

        if (
            process.env.NODE_ENV !==
            "production"
        ) {

            server.listen(
                5000,
                () => {

                    console.log(
                        "Server is Running on PORT 5000"
                    );

                }
            );

        }

    })

    .catch((err) => {

        console.error(
            "MongoDB Connection Error:",
            err
        );

    });


// ==========================================
// VERCEL EXPORT
// ==========================================

module.exports = server;