import { createRoot } from "react-dom/client";
import "react-quill/dist/quill.snow.css";
import "jsvectormap/dist/css/jsvectormap.css";
import "react-toastify/dist/ReactToastify.css";
import "react-modal-video/css/modal-video.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "lightgallery/css/lightgallery.css";
import "lightgallery/css/lg-zoom.css";
import "lightgallery/css/lg-thumbnail.css";
import App from "./App.jsx";
import { isAuthenticated } from "./utils/auth.js";

// Check build type
const buildType = import.meta.env.VITE_BUILD_TYPE || 'admin';
const isClientHubBuild = buildType === 'clienthub';

// Prevent rendering protected pages before auth check — redirect to sign-in if not authenticated
const publicPaths = [
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/access-denied",
  "/coming-soon",
  "/maintenance",
  "/blank-page",
  "/clienthub",
];

// For ClientHub build, root path is public (no auth required)
if (isClientHubBuild) {
  publicPaths.push("/");
}

if (!isAuthenticated() && !publicPaths.includes(window.location.pathname) && !window.location.pathname.startsWith("/clienthub")) {
  // Hard redirect avoids flashing protected content while React mounts
  window.location.replace("/sign-in");
} else {
  createRoot(document.getElementById("root")).render(
    <>
      <App />
    </>
  );
}
