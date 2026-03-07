import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

function showOverlay(message: string) {
	try {
		let overlay = document.getElementById('app-error-overlay');
		if (!overlay) {
			overlay = document.createElement('div');
			overlay.id = 'app-error-overlay';
			overlay.style.position = 'fixed';
			overlay.style.zIndex = '999999';
			overlay.style.left = '12px';
			overlay.style.top = '12px';
			overlay.style.right = '12px';
			overlay.style.background = '#fff6f6';
			overlay.style.border = '1px solid #f5c2c7';
			overlay.style.color = '#842029';
			overlay.style.padding = '12px';
			overlay.style.borderRadius = '6px';
			overlay.style.boxShadow = '0 6px 18px rgba(0,0,0,0.08)';
			overlay.style.fontFamily = 'system-ui, Arial, sans-serif';
			overlay.style.whiteSpace = 'pre-wrap';
			document.body.appendChild(overlay);
		}
		overlay.textContent = message;
	} catch (err) {
		/* ignore */
	}
}

function renderApp() {
	try {
		createRoot(document.getElementById("root")!).render(<App />);
	} catch (err: any) {
		console.error("Render error:", err);
		showOverlay('Error: ' + String(err));
	}
}

window.addEventListener("error", (e) => {
	console.error("Unhandled error:", e.error || e.message);
	showOverlay('Unhandled error: ' + String(e.error || e.message));
});

window.addEventListener("unhandledrejection", (e) => {
	console.error("Unhandled rejection:", e.reason);
	showOverlay('Unhandled rejection: ' + String(e.reason));
});

renderApp();
