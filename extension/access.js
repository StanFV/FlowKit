"use strict";

// Site access check shared by the editor and the help page. Edge and Chrome
// let users limit an extension to specific sites; FlowKit then cannot see the
// Power Automate API requests it needs, even though it is installed.
(function () {
  const LABELS = [
    [/flow\.microsoft\.com/, "Power Automate API (flow.microsoft.com)"],
    [/api\.powerplatform\.com/, "Power Platform API (api.powerplatform.com)"],
    [/make\.powerautomate\.com/, "Power Automate portal (make.powerautomate.com)"],
    [/make\.powerapps\.com/, "Power Apps portal (make.powerapps.com)"],
    [/copilotstudio\.microsoft\.com/, "Copilot Studio (copilotstudio.microsoft.com)"],
    [/logic\.azure\.com/, "Run inputs and outputs (logic.azure.com)"],
  ];

  function origins() {
    return chrome.runtime.getManifest().host_permissions || [];
  }

  function label(origin) {
    const match = LABELS.find(([pattern]) => pattern.test(origin));
    return match ? match[1] : origin;
  }

  async function missing() {
    const result = [];
    for (const origin of origins()) {
      try {
        if (!(await chrome.permissions.contains({ origins: [origin] }))) result.push(origin);
      } catch (e) {
        // pattern not supported by this browser; ignore
      }
    }
    return result;
  }

  // Must be called from a user gesture (a button click).
  function request(list) {
    return chrome.permissions.request({ origins: list });
  }

  window.FlowKitAccess = { missing, request, label };
})();
