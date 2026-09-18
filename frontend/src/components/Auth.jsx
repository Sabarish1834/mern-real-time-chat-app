import { useState } from "react";
import axios from "axios";

const API_URL = "http://localhost:5000/api";

function Auth({ onLogin }) {
    const [isLogin, setIsLogin] = useState(true);

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();

        setError("");
        setSuccess("");

        if (!username.trim() || !password.trim()) {
            setError("Username and password are required.");
            return;
        }

        try {
            setLoading(true);

            if (isLogin) {
                
                // LOGIN
                

                const response = await axios.post(
                    `${API_URL}/auth/login`,
                    {
                        username: username.trim(),
                        password,
                    }
                );

                const {
                    token,
                    username: loggedInUsername,
                } = response.data;

                // Save login details
                localStorage.setItem("token", token);
                localStorage.setItem(
                    "username",
                    loggedInUsername
                );

                // Send user details to App.jsx
                onLogin({
                    token,
                    username: loggedInUsername,
                });
            } else {
                // 
                // REGISTER

                await axios.post(
                    `${API_URL}/auth/register`,
                    {
                        username: username.trim(),
                        password,
                    }
                );

                setSuccess(
                    "Account created successfully! Please login."
                );

                // Clear inputs
                setUsername("");
                setPassword("");

                // Switch to login
                setIsLogin(true);
            }
        } catch (err) {
            const message =
                err.response?.data?.error ||
                "Something went wrong. Please try again.";

            setError(message);
        } finally {
            setLoading(false);
        }
    };

    const switchMode = () => {
        setIsLogin(!isLogin);

        setError("");
        setSuccess("");

        setUsername("");
        setPassword("");
    };

    return (
        <div className="auth-page">

            {/* 
                LEFT BRAND SECTION
             */}

            <div className="auth-brand">

                <div className="auth-brand-content">

                    <div className="auth-logo">
                        C
                    </div>

                    <h1>
                        Chat<span>ly</span>
                    </h1>

                    <p>
                        Connect. Chat. Stay in sync.
                    </p>

                    {/* Features */}

                    <div className="auth-feature-list">

                        <div className="auth-feature">

                            <div>⚡</div>

                            <div>
                                <strong>
                                    Real-time messaging
                                </strong>

                                <span>
                                    Messages delivered instantly.
                                </span>
                            </div>

                        </div>

                        <div className="auth-feature">

                            <div>🟢</div>

                            <div>
                                <strong>
                                    See who's online
                                </strong>

                                <span>
                                    Stay connected with your people.
                                </span>
                            </div>

                        </div>

                        <div className="auth-feature">

                            <div>🔒</div>

                            <div>
                                <strong>
                                    Secure conversations
                                </strong>

                                <span>
                                    Your chats stay private.
                                </span>
                            </div>

                        </div>

                    </div>

                </div>

                {/* Background Glow */}

                <div className="auth-glow glow-one"></div>

                <div className="auth-glow glow-two"></div>

            </div>


            {/* 
                RIGHT AUTH SECTION
             */}

            <div className="auth-section">

                <div className="auth-card">

                    {/* Mobile Logo */}

                    <div className="mobile-logo">

                        <div className="auth-logo">
                            C
                        </div>

                        <span>
                            Chatly
                        </span>

                    </div>


                    {/* 
                        AUTH HEADING
                     */}

                    <div className="auth-heading">

                        <h2>
                            {isLogin
                                ? "Welcome back"
                                : "Create your account"}
                        </h2>

                        <p>
                            {isLogin
                                ? "Sign in to continue your conversations."
                                : "Join Chatly and start connecting instantly."}
                        </p>

                    </div>


                    {/* 
                        FORM
                    */}

                    <form onSubmit={handleSubmit}>

                        {/* Username */}

                        <div className="form-group">

                            <label>
                                Username
                            </label>

                            <div className="input-wrapper">

                                <span className="input-icon">
                                    
                                </span>

                                <input
                                    type="text"
                                    placeholder="Enter your username"
                                    value={username}
                                    onChange={(e) =>
                                        setUsername(e.target.value)
                                    }
                                    autoComplete="username"
                                />

                            </div>

                        </div>


                        {/* Password */}

                        <div className="form-group">

                            <label>
                                Password
                            </label>

                            <div className="input-wrapper">

                                <span className="input-icon">
                                    
                                </span>

                                <input
                                    type="password"
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={(e) =>
                                        setPassword(e.target.value)
                                    }
                                    autoComplete={
                                        isLogin
                                            ? "current-password"
                                            : "new-password"
                                    }
                                />

                            </div>

                        </div>


                        {/* Error Message */}

                        {error && (
                            <div className="auth-message error">

                                <span>
                                    !
                                </span>

                                {error}

                            </div>
                        )}


                        {/* Success Message */}

                        {success && (
                            <div className="auth-message success">

                                <span>
                                    ✓
                                </span>

                                {success}

                            </div>
                        )}


                        {/* Submit Button */}

                        <button
                            type="submit"
                            className="auth-submit"
                            disabled={loading}
                        >

                            {loading ? (

                                <span className="loading-content">

                                    <span className="spinner"></span>

                                    {isLogin
                                        ? "Signing in..."
                                        : "Creating account..."}

                                </span>

                            ) : (

                                <>
                                    {isLogin
                                        ? "Sign in"
                                        : "Create account"}

                                    <span>
                                        →
                                    </span>
                                </>

                            )}

                        </button>

                    </form>


                    {/* 
                        DIVIDER
                     */}

                    <div className="auth-divider">

                        <span>
                            OR
                        </span>

                    </div>


                    {/*
                        LOGIN / REGISTER SWITCH
                    */}

                    <div className="auth-switch">

                        <span>
                            {isLogin
                                ? "Don't have an account?"
                                : "Already have an account?"}
                        </span>

                        <button
                            type="button"
                            onClick={switchMode}
                        >
                            {isLogin
                                ? "Create account"
                                : "Sign in"}
                        </button>

                    </div>


                    {/* 
                        SECURITY
                     */}

                    <div className="auth-security">

                        <span>
                            🔒
                        </span>

                        Secure authentication powered by JWT

                    </div>

                </div>

            </div>

        </div>
    );
}

export default Auth;