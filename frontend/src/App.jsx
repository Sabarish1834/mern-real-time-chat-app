import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import Auth from "./components/Auth";
import "./App.css";

const API_URL =
    import.meta.env.VITE_API_URL ||
    "http://localhost:5000/api";

const SOCKET_URL =
    import.meta.env.VITE_SOCKET_URL ||
    "http://localhost:5000";

function App() {
    // ========================================
    // USER
    // ========================================

    const [user, setUser] = useState(
        localStorage.getItem("username")
    );


    // ========================================
    // USERS
    // ========================================

    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [search, setSearch] = useState("");

    const [loadingUsers, setLoadingUsers] = useState(true);
    const [usersError, setUsersError] = useState("");


    // ========================================
    // ONLINE USERS
    // ========================================

    const [onlineUsers, setOnlineUsers] = useState([]);


    // ========================================
    // MESSAGES
    // ========================================

    const [messages, setMessages] = useState([]);
    const [messageText, setMessageText] = useState("");

    const [loadingMessages, setLoadingMessages] =
        useState(false);

    const [sendingMessage, setSendingMessage] =
        useState(false);


    // ========================================
    // SOCKET REF
    // ========================================

    const socketRef = useRef(null);

    const selectedUserRef = useRef(null);


    // ========================================
    // KEEP SELECTED USER UPDATED
    // ========================================

    useEffect(() => {
        selectedUserRef.current = selectedUser;
    }, [selectedUser]);


    // ========================================
    // LOGIN
    // ========================================

    const handleLogin = (data) => {
        /*
            Auth.jsx can send either:

            "sabarish"

            OR

            {
                token,
                username
            }

            So both are supported.
        */

        const username =
            typeof data === "string"
                ? data
                : data?.username;

        if (!username) {
            console.error(
                "Login username not found"
            );

            return;
        }

        setUser(username);
    };


    // ========================================
    // LOGOUT
    // ========================================

    const handleLogout = () => {
        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
        }

        localStorage.removeItem("token");
        localStorage.removeItem("username");

        setUser(null);
        setUsers([]);
        setSelectedUser(null);
        setMessages([]);
        setOnlineUsers([]);
        setMessageText("");
    };


    // ========================================
    // FETCH ALL USERS
    // ========================================

    useEffect(() => {
        if (!user) {
            return;
        }

        const fetchUsers = async () => {
            try {
                setLoadingUsers(true);
                setUsersError("");

                const token =
                    localStorage.getItem("token");

                const response = await axios.get(
                    `${API_URL}/auth/users`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }
                );

                setUsers(response.data);
            } catch (err) {
                console.error(
                    "FETCH USERS ERROR...",
                    err
                );

                setUsersError(
                    err.response?.data?.error ||
                        "Unable to load users"
                );
            } finally {
                setLoadingUsers(false);
            }
        };

        fetchUsers();
    }, [user]);


    // ========================================
    // SOCKET.IO CONNECTION
    // ========================================

    useEffect(() => {
        if (!user) {
            return;
        }

        // Create socket connection
        const socket = io(SOCKET_URL);

        socketRef.current = socket;


        // ========================================
        // SOCKET CONNECT
        // ========================================

        socket.on("connect", () => {
            console.log(
                "Socket connected:",
                socket.id
            );

            socket.emit("userOnline", user);
        });


        // ========================================
        // ONLINE USERS
        // ========================================

        socket.on(
            "onlineUsers",
            (onlineList) => {
                setOnlineUsers(onlineList);
            }
        );


        // ========================================
        // RECEIVE MESSAGE
        // ========================================

        socket.on(
            "receiveMessage",
            (newMessage) => {
                const currentSelectedUser =
                    selectedUserRef.current;


                setMessages((prev) => {
                    const alreadyExists =
                        prev.some(
                            (message) =>
                                message._id ===
                                newMessage._id
                        );


                    // Message already exists
                    if (alreadyExists) {
                        return prev.map(
                            (message) =>
                                message._id ===
                                newMessage._id
                                    ? {
                                          ...message,
                                          ...newMessage,
                                      }
                                    : message
                        );
                    }


                    // Add only if this chat is open
                    if (
                        currentSelectedUser &&
                        newMessage.sender ===
                            currentSelectedUser.username
                    ) {
                        return [
                            ...prev,
                            newMessage,
                        ];
                    }


                    return prev;
                });


                // ========================================
                // MARK AS SEEN
                // ========================================

                if (
                    currentSelectedUser &&
                    newMessage.sender ===
                        currentSelectedUser.username
                ) {
                    socket.emit(
                        "markMessagesSeen",
                        {
                            sender:
                                newMessage.sender,

                            receiver: user,
                        }
                    );
                }
            }
        );


        // ========================================
        // MESSAGE STATUS
        // SENT → DELIVERED
        // ========================================

        socket.on(
            "messageStatus",
            (data) => {
                setMessages((prev) =>
                    prev.map((message) =>
                        message._id ===
                        data.messageId
                            ? {
                                  ...message,
                                  status:
                                      data.status,
                              }
                            : message
                    )
                );
            }
        );


        // ========================================
        // MESSAGES SEEN
        // DELIVERED → SEEN
        // ========================================

        socket.on(
            "messagesSeen",
            (data) => {
                setMessages((prev) =>
                    prev.map((message) => {
                        const messageId =
                            message._id?.toString();

                        const shouldUpdate =
                            data.messageIds?.some(
                                (id) =>
                                    id?.toString() ===
                                    messageId
                            );

                        if (shouldUpdate) {
                            return {
                                ...message,
                                status: "seen",
                            };
                        }

                        return message;
                    })
                );
            }
        );


        // ========================================
        // SOCKET DISCONNECT
        // ========================================

        socket.on(
            "disconnect",
            () => {
                console.log(
                    "Socket disconnected"
                );
            }
        );


        // ========================================
        // CLEANUP
        // ========================================

        return () => {
            socket.disconnect();

            socketRef.current = null;
        };
    }, [user]);


    // ========================================
    // FETCH MESSAGES
    // ========================================

    useEffect(() => {
        if (!selectedUser || !user) {
            return;
        }

        const fetchMessages = async () => {
            try {
                setLoadingMessages(true);

                const token =
                    localStorage.getItem("token");

                const response = await axios.get(
                    `${API_URL}/messages/${selectedUser.username}`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }
                );

                setMessages(response.data);


                // ========================================
                // MARK RECEIVED MESSAGES AS SEEN
                // ========================================

                if (
                    socketRef.current?.connected
                ) {
                    socketRef.current.emit(
                        "markMessagesSeen",
                        {
                            sender:
                                selectedUser.username,

                            receiver: user,
                        }
                    );
                }
            } catch (err) {
                console.error(
                    "FETCH MESSAGES ERROR...",
                    err
                );
            } finally {
                setLoadingMessages(false);
            }
        };

        fetchMessages();
    }, [selectedUser, user]);


    // ========================================
    // SEND MESSAGE
    // ========================================

    const handleSendMessage = async (e) => {
        e.preventDefault();

        const text = messageText.trim();


        if (
            !text ||
            !selectedUser ||
            sendingMessage
        ) {
            return;
        }


        try {
            setSendingMessage(true);

            const token =
                localStorage.getItem("token");


            // ========================================
            // SAVE MESSAGE IN MONGODB
            // ========================================

            const response = await axios.post(
                `${API_URL}/messages`,
                {
                    receiver:
                        selectedUser.username,

                    text,
                },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );


            const newMessage = response.data;


            // ========================================
            // ADD MESSAGE TO SENDER SCREEN
            // ========================================

            setMessages((prev) => {
                const alreadyExists =
                    prev.some(
                        (message) =>
                            message._id ===
                            newMessage._id
                    );

                if (alreadyExists) {
                    return prev;
                }

                return [
                    ...prev,
                    newMessage,
                ];
            });


            // Clear input
            setMessageText("");


            // ========================================
            // SEND THROUGH SOCKET
            // ========================================

            if (
                socketRef.current?.connected
            ) {
                socketRef.current.emit(
                    "sendMessage",
                    newMessage
                );
            }
        } catch (err) {
            console.error(
                "SEND MESSAGE ERROR...",
                err
            );
        } finally {
            setSendingMessage(false);
        }
    };


    // ========================================
    // SELECT USER
    // ========================================

    const handleSelectUser = (selected) => {
        setSelectedUser(selected);

        setMessages([]);

        setMessageText("");
    };


    // ========================================
    // CHECK ONLINE STATUS
    // ========================================

    const isUserOnline = (username) => {
        return onlineUsers.includes(username);
    };


    // ========================================
    // SEARCH USERS
    // ========================================

    const filteredUsers = users.filter(
        (item) =>
            item.username
                .toLowerCase()
                .includes(
                    search.toLowerCase()
                )
    );


    // ========================================
    // FORMAT TIME
    // ========================================

    const formatTime = (date) => {
        if (!date) {
            return "";
        }

        return new Date(
            date
        ).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
        });
    };


    // ========================================
    // MESSAGE STATUS
    // ========================================

    const getMessageStatus = (status) => {
        // Seen
        if (status === "seen") {
            return {
                icon: "✓✓",
                className: "seen",
            };
        }


        // Delivered
        if (status === "delivered") {
            return {
                icon: "✓✓",
                className: "delivered",
            };
        }


        // Sent
        return {
            icon: "✓",
            className: "sent",
        };
    };


    // ========================================
    // AUTH PAGE
    // ========================================

    if (!user) {
        return (
            <Auth
                onLogin={handleLogin}
            />
        );
    }


    // ========================================
    // MAIN CHAT UI
    // ========================================

    return (
        <div className="app-container">

            {/* ========================================
                SIDEBAR
            ======================================== */}

            <aside className="sidebar">

                {/* Sidebar Header */}

                <div className="sidebar-header">

                    <div>
                        <h1>
                            Chatly
                        </h1>

                        <p>
                            Real-time messaging
                        </p>
                    </div>


                    <button
                        className="logout-btn"
                        onClick={handleLogout}
                    >
                        Logout
                    </button>

                </div>


                {/* ========================================
                    PROFILE
                ======================================== */}

                <div className="profile-card">

                    <div className="profile-avatar">
                        {user
                            .charAt(0)
                            .toUpperCase()}
                    </div>


                    <div>

                        <strong>
                            {user}
                        </strong>


                        <span className="profile-online">
                            <span></span>
                            Online
                        </span>

                    </div>

                </div>


                {/* ========================================
                    SEARCH
                ======================================== */}

                <div className="search-box">

                    <input
                        type="text"
                        placeholder="Search people..."
                        value={search}
                        onChange={(e) =>
                            setSearch(
                                e.target.value
                            )
                        }
                    />

                </div>


                {/* ========================================
                    CONTACT HEADER
                ======================================== */}

                <div className="contacts-header">

                    <span>
                        CONTACTS
                    </span>

                    <span>
                        {users.length}
                    </span>

                </div>


                {/* ========================================
                    CONTACT LIST
                ======================================== */}

                <div className="contacts-list">

                    {loadingUsers && (
                        <div className="empty-sidebar">
                            Loading contacts...
                        </div>
                    )}


                    {usersError && (
                        <div className="empty-sidebar error-text">
                            {usersError}
                        </div>
                    )}


                    {!loadingUsers &&
                        !usersError &&
                        filteredUsers.length ===
                            0 && (
                            <div className="empty-sidebar">
                                No users found
                            </div>
                        )}


                    {filteredUsers.map(
                        (item) => {
                            const online =
                                isUserOnline(
                                    item.username
                                );

                            const active =
                                selectedUser?.username ===
                                item.username;


                            return (
                                <button
                                    key={
                                        item._id
                                    }
                                    className={`contact-item ${
                                        active
                                            ? "active"
                                            : ""
                                    }`}
                                    onClick={() =>
                                        handleSelectUser(
                                            item
                                        )
                                    }
                                >

                                    {/* Avatar */}

                                    <div className="contact-avatar">
                                        {item.username
                                            .charAt(
                                                0
                                            )
                                            .toUpperCase()}
                                    </div>


                                    {/* User Info */}

                                    <div className="contact-info">

                                        <div className="user-name">

                                            <strong>
                                                {
                                                    item.username
                                                }
                                            </strong>

                                        </div>


                                        <div className="last-message">

                                            <span
                                                className={
                                                    online
                                                        ? "online-text"
                                                        : "offline-text"
                                                }
                                            >
                                                {online
                                                    ? "Online"
                                                    : "Offline"}
                                            </span>

                                        </div>

                                    </div>

                                </button>
                            );
                        }
                    )}

                </div>

            </aside>


            {/* ========================================
                CHAT AREA
            ======================================== */}

            <main className="chat-area">

                {/* ========================================
                    NO USER SELECTED
                ======================================== */}

                {!selectedUser ? (
                    <div className="welcome-screen">

                        <div className="welcome-icon">
                            💬
                        </div>

                        <h2>
                            Welcome to Chatly
                        </h2>

                        <p>
                            Select a contact and
                            start a conversation.
                        </p>

                    </div>
                ) : (

                    <>
                        {/* ========================================
                            CHAT HEADER
                        ======================================== */}

                        <header className="chat-header">

                            <div className="chat-user-info">

                                <div className="chat-avatar">
                                    {selectedUser.username
                                        .charAt(0)
                                        .toUpperCase()}
                                </div>


                                <div>

                                    <h2>
                                        {
                                            selectedUser.username
                                        }
                                    </h2>


                                    <div className="online-status">

                                        <span
                                            className={
                                                isUserOnline(
                                                    selectedUser.username
                                                )
                                                    ? "online-dot"
                                                    : "offline-dot"
                                            }
                                        ></span>


                                        {isUserOnline(
                                            selectedUser.username
                                        )
                                            ? "Online"
                                            : "Offline"}

                                    </div>

                                </div>

                            </div>

                        </header>


                        {/* ========================================
                            MESSAGES
                        ======================================== */}

                        <div className="messages-container">

                            {loadingMessages ? (

                                <div className="loading-messages">
                                    Loading messages...
                                </div>

                            ) : messages.length ===
                              0 ? (

                                <div className="no-messages">

                                    <div>
                                        👋
                                    </div>

                                    <h3>
                                        Start a
                                        conversation
                                    </h3>

                                    <p>
                                        Send a message
                                        to{" "}
                                        {
                                            selectedUser.username
                                        }
                                    </p>

                                </div>

                            ) : (

                                messages.map(
                                    (message) => {

                                        const isSent =
                                            message.sender ===
                                            user;


                                        const status =
                                            getMessageStatus(
                                                message.status
                                            );


                                        return (
                                            <div
                                                key={
                                                    message._id
                                                }
                                                className={`message-row ${
                                                    isSent
                                                        ? "sent-row"
                                                        : "received-row"
                                                }`}
                                            >

                                                <div
                                                    className={`message ${
                                                        isSent
                                                            ? "sent"
                                                            : "received"
                                                    }`}
                                                >

                                                    {/* Message */}

                                                    <div className="message-text">
                                                        {
                                                            message.text
                                                        }
                                                    </div>


                                                    {/* Time + Tick */}

                                                    <div className="message-meta">

                                                        <span className="time">
                                                            {formatTime(
                                                                message.createdAt
                                                            )}
                                                        </span>


                                                        {/* Ticks only for sender */}

                                                        {isSent && (
                                                            <span
                                                                className={`message-status ${status.className}`}
                                                            >
                                                                {
                                                                    status.icon
                                                                }
                                                            </span>
                                                        )}

                                                    </div>

                                                </div>

                                            </div>
                                        );
                                    }
                                )
                            )}

                        </div>


                        {/* ========================================
                            MESSAGE INPUT
                        ======================================== */}

                        <form
                            className="message-input-area"
                            onSubmit={
                                handleSendMessage
                            }
                        >

                            <input
                                type="text"
                                placeholder={`Message ${selectedUser.username}...`}
                                value={messageText}
                                onChange={(e) =>
                                    setMessageText(
                                        e.target.value
                                    )
                                }
                            />


                            <button
                                type="submit"
                                disabled={
                                    !messageText.trim() ||
                                    sendingMessage
                                }
                            >
                                {sendingMessage
                                    ? "..."
                                    : "Send"}
                            </button>

                        </form>

                    </>
                )}

            </main>

        </div>
    );
}

export default App;