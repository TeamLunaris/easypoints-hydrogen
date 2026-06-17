import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { VERSION } from "@lunaris/easypoints-hydrogen";

// Minimal consumer that mounts a React tree and reads from the library across the
// workspace link — proving single-React resolution and that the package is consumable.
// Replace with a real Hydrogen app entry when fleshing this example out (see README).
function App() {
  return <p>easyPoints Hydrogen example — library v{VERSION}</p>;
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
