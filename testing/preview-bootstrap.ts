declare const __SIGNAL_MARKET_PREVIEW__: boolean;

// Install diagnostics before loading the React component graph, including import failures.
function showError(reason: unknown) {
    const panel = document.getElementById("preview-error");
    if (!panel) return;
    panel.hidden = false;
    panel.textContent = `Preview offline gagal dimuat: ${reason instanceof Error ? reason.message : String(reason)}. Periksa Console browser dan restart server preview setelah memperbaiki error.`;
}
window.fetch = () => Promise.reject(new Error("Network forbidden in offline preview"));
window.addEventListener("error", event => showError(event.error ?? event.message ?? "Asset JavaScript gagal dimuat"));
window.addEventListener("unhandledrejection", event => showError(event.reason));
void (__SIGNAL_MARKET_PREVIEW__ ? import("./market-preview") : import("./chart-preview"))
    .catch(reason => { showError(reason); console.error(reason); });
