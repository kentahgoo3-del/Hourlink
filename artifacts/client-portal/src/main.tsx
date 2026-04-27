import { createRoot } from "react-dom/client";
import App from "./App";
import PrivacyPage from "./pages/privacy";
import "./index.css";

const isPrivacy = window.location.pathname.endsWith("/privacy");

createRoot(document.getElementById("root")!).render(
  isPrivacy ? <PrivacyPage /> : <App />
);
