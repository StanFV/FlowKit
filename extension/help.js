"use strict";

(async function () {
  const params = new URLSearchParams(location.search);
  const host = params.get("host");
  const path = params.get("path") || "";

  const page = document.getElementById("page");
  if (host) {
    const code = document.createElement("code");
    code.textContent = host + path;
    page.appendChild(code);
  } else {
    page.textContent = "Unknown (not a web page)";
  }

  const session = document.getElementById("session");
  const seen = params.get("api") === "1";
  session.textContent = seen ? "Detected" : "Not detected";
  session.className = seen ? "ok" : "no";

  const missing = await window.FlowKitAccess.missing();
  if (!missing.length) return;
  const list = document.getElementById("missing");
  for (const origin of missing) {
    const li = document.createElement("li");
    li.textContent = window.FlowKitAccess.label(origin);
    list.appendChild(li);
  }
  document.getElementById("access").hidden = false;
  document.getElementById("grant").addEventListener("click", async () => {
    try {
      if (await window.FlowKitAccess.request(missing)) {
        document.getElementById("grant").hidden = true;
        document.getElementById("granted").hidden = false;
      }
    } catch (e) {
      // the user closed the prompt
    }
  });
})();
