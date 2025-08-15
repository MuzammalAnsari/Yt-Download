function injectDownloadButton() {
  if (document.getElementById("yt-download-btn")) return;

  const target = document.querySelector("#above-the-fold #title");
  if (!target) return;

  const btn = document.createElement("button");
  btn.id = "yt-download-btn";
  btn.textContent = "Download Formats";
  btn.style.cssText = `
    margin-left: 10px;
    padding: 6px 12px;
    background-color: #ff0000;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
  `;

  btn.addEventListener("click", () => {
    console.log("Download Formats button clicked");
    chrome.runtime.sendMessage({
      action: "openFormatsWindow",
      url: window.location.href
    });
  });

  target.appendChild(btn);
}

injectDownloadButton();
new MutationObserver(injectDownloadButton).observe(document.body, { childList: true, subtree: true });
