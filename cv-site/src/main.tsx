import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CvPortfolio } from "./CvPortfolio";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CvPortfolio />
  </StrictMode>,
);
