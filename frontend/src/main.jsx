import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <ToastProvider>
    <AuthProvider>
      <React.StrictMode>
        <App />
      </React.StrictMode>
    </AuthProvider>
  </ToastProvider>
);
