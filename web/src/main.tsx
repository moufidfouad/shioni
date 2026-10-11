import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "framer-motion";
import { Toaster } from "sonner";
import App from "./App";
import  AuthProvider  from "./providers/contexts/AuthContext";
import { queryClient } from "./lib/queryClient";
import ScrollToTopButton from "./components/ScrollToTopButton";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>

      <MotionConfig reducedMotion="user">
        <BrowserRouter>
          <AuthProvider>
            <App />
            <Toaster richColors position="top-right" closeButton />
            <ScrollToTopButton />
          </AuthProvider>
        </BrowserRouter>
      </MotionConfig>
    </QueryClientProvider>
  </React.StrictMode>
);
