## backend
npm init -y
npm install express mongoose dotenv bcryptjs jsonwebtoken cors socket.io nodemon

Express - Framework for building web severs and APIs in Node.js.
Mongoose - Library to interact with MongoDB database easily.
dotenv - Loads environment variables from a .env file.
bcryptjs - Library to hash password securely.
jsonwebtoken - Creates authentication tokens. Used for login systems and protected routes.
cors - Allows frontend and backend from different domains to communicate.
socket.io - Enables real-time communication between client and server.
nodemon - Automatically restarts your Node.js server when you change files.

## frontend
npm create vite@latest
npm install socket.io-client lucide-react
npm install axios