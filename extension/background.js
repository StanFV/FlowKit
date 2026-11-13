"use strict";

// State is kept in chrome.storage.session so it survives the MV3 service worker
// being suspended. Previously everything lived in memory only: after ~30s of
// inactivity Chrome killed the worker, the tab/token info was lost and the
// toolbar button stayed disabled or did nothing when clicked.
const STORAGE_KEY = "state";
const GUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

let state = { tabs: {} };
let saveTimer = null;

const ready = chrome.storage.session
  .get(STORAGE_KEY)
  .then((stored) => {
    if (stored && stored[STORAGE_KEY]) {
      state = Object.assign({ tabs: {} }, stored[STORAGE_KEY]);
    }
  })
  .catch(() => {})
  .then(() => refreshAllTabs());

function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    chrome.storage.session.set({ [STORAGE_KEY]: state }).catch(() => {});
  }, 250);
}

function getTabState(tabId) {
  if (!state.tabs[tabId]) state.tabs[tabId] = {};
  return state.tabs[tabId];
}

function getEnvIdFromUrl(url) {
  if (!url) return null;
  const match = /environments\/([a-zA-Z0-9\-]+)/i.exec(url);
  return match ? match[1] : null;
}

// Parses a portal URL such as
//   make.powerautomate.com/environments/{env}/flows/{id}/details
//   make.powerautomate.com/environments/{env}/solutions/{sol}/flows/{id}
//   make.powerapps.com/environments/{env}/solutions/{sol}/objects/cloudflows/{id}/view
function getFlowFromTabUrl(url) {
  const envId = getEnvIdFromUrl(url);
  if (!envId) return null;
  const match = new RegExp(`flows\\/(${GUID})`, "i").exec(url);
  return match ? { envId, flowId: match[1] } : null;
}

// Copilot Studio (agent flows) does not document its URLs, so flows opened
// there are recognised from the Power Automate API calls the designer makes.
function isCopilotStudioUrl(url) {
  try {
    return /(^|\.)copilotstudio\.(preview\.)?microsoft\.com$/i.test(new URL(url).hostname);
  } catch (e) {
    return false;
  }
}

// `primary` marks a request for the flow itself (…/flows/{id} without a sub
// path), which is what a designer does when it opens a flow. Sub resources
// such as …/flows/{id}/runs are also requested on overview pages.
function getFlowFromRequestUrl(url) {
  if (!url) return null;
  const end = "(\\/[^?#]*)?(?:[?#]|$)";
  const legacy = new RegExp(
    `\\/providers\\/Microsoft\\.ProcessSimple\\/environments\\/([^/]+)\\/flows\\/(${GUID})${end}`,
    "i"
  ).exec(url);
  if (legacy) return { envId: legacy[1], flowId: legacy[2], primary: !legacy[3] };
  const modern = new RegExp(
    `\\.api\\.powerplatform\\.com\\/powerautomate\\/flows\\/(${GUID})${end}`,
    "i"
  ).exec(url);
  return modern ? { envId: null, flowId: modern[1], primary: !modern[2] } : null;
}

// The tab URL is the most reliable source: it always points at the flow that
// is currently open. Requests seen by webRequest are the fallback.
function resolveFlow(tab) {
  const tabState = tab && tab.id !== undefined ? state.tabs[tab.id] : undefined;
  const last = tabState && tabState.lastMatchedRequest;
  const fromRequest = () => {
    if (!last || !last.flowId) return null;
    const envId = last.envId || getEnvIdFromUrl(tab && tab.url);
    return envId ? { envId, flowId: last.flowId } : null;
  };
  // In Copilot Studio the IDs in the page URL are not necessarily the flow's
  // API name, so the flow the designer loaded wins. Only pages about flows
  // count, to avoid picking up flows an agent page merely lists.
  if (isCopilotStudioUrl(tab && tab.url)) {
    if (!/flow/i.test(new URL(tab.url).pathname)) return null;
    return fromRequest() || getFlowFromTabUrl(tab.url);
  }
  return getFlowFromTabUrl(tab && tab.url) || fromRequest();
}

function updateActionForTab(tab) {
  if (!tab || tab.id === undefined || tab.id < 0) return;
  if (tab.id === state.appTabId) return;
  if (resolveFlow(tab)) {
    chrome.action.enable(tab.id).catch(() => {});
  } else {
    chrome.action.disable(tab.id).catch(() => {});
  }
}

function refreshAllTabs() {
  return chrome.tabs
    .query({})
    .then((tabs) => {
      const openIds = new Set(tabs.map((t) => String(t.id)));
      for (const id of Object.keys(state.tabs)) {
        if (!openIds.has(id)) delete state.tabs[id];
      }
      if (state.appTabId !== undefined && !openIds.has(String(state.appTabId))) {
        delete state.appTabId;
      }
      tabs.forEach(updateActionForTab);
      save();
    })
    .catch(() => {});
}

function sendTokenToApp() {
  if (state.appTabId === undefined || state.initiatorTabId === undefined) return;
  const tabState = state.tabs[state.initiatorTabId];
  if (!tabState || !tabState.apiToken || !tabState.apiUrl) return;
  chrome.tabs
    .sendMessage(state.appTabId, {
      type: "token-changed",
      token: tabState.apiToken,
      apiUrl: tabState.apiUrl,
      legacyApiUrl: tabState.legacyApiUrl,
      legacyToken: tabState.legacyApiToken,
    })
    .catch(() => {});
}

chrome.action.disable();

chrome.runtime.onStartup.addListener(() => {
  ready.then(refreshAllTabs);
});

chrome.runtime.onInstalled.addListener(() => {
  ready.then(refreshAllTabs);
});

chrome.action.onClicked.addListener((tab) => {
  if (tab.id === undefined) return;
  ready.then(() => {
    const flow = resolveFlow(tab);
    if (!flow) return;
    state.initiatorTabId = tab.id;
    save();
    const url = `${chrome.runtime.getURL("app.html")}?envId=${encodeURIComponent(
      flow.envId
    )}&flowId=${encodeURIComponent(flow.flowId)}`;
    chrome.tabs.create({ url, index: tab.index + 1 }, (appTab) => {
      state.appTabId = appTab.id;
      save();
    });
  });
});

// Single page navigation inside the portal (e.g. from the flow list to a flow)
// changes the URL without new matching API calls, so watch URL changes too.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!changeInfo.url && changeInfo.status !== "complete") return;
  ready.then(() => {
    // A flow seen on the previous Copilot Studio page must not stick to the
    // next one; the designer requests the new flow after navigating.
    const tabState = state.tabs[tabId];
    if (changeInfo.url && tabState && tabState.lastMatchedRequest && isCopilotStudioUrl(changeInfo.url)) {
      const path = (u) => {
        try {
          return new URL(u).pathname;
        } catch (e) {
          return u;
        }
      };
      if (path(changeInfo.url) !== tabState.lastUrlPath) {
        delete tabState.lastMatchedRequest;
        save();
      }
    }
    if (tabState && changeInfo.url) {
      try {
        tabState.lastUrlPath = new URL(changeInfo.url).pathname;
      } catch (e) {
        // ignore
      }
    }
    updateActionForTab(tab);
  });
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  ready.then(() =>
    chrome.tabs
      .get(tabId)
      .then(updateActionForTab)
      .catch(() => {})
  );
});

chrome.tabs.onRemoved.addListener((tabId) => {
  ready.then(() => {
    if (state.appTabId === tabId) delete state.appTabId;
    if (state.initiatorTabId === tabId) delete state.initiatorTabId;
    delete state.tabs[tabId];
    save();
  });
});

function handleApiRequest(details) {
  if (details.tabId < 0) return Promise.resolve();
  return ready.then(() => {
      if (state.appTabId === details.tabId) return;

      const tabState = getTabState(details.tabId);
      let changed = false;

      const matched = getFlowFromRequestUrl(details.url);
      if (matched) {
        const prev = tabState.lastMatchedRequest;
        const sameFlow = prev && prev.flowId === matched.flowId;
        // A request for a sub resource of another flow never replaces a flow
        // that was explicitly loaded.
        const replace = !prev || matched.primary || !prev.primary || sameFlow;
        const envId = matched.envId || (sameFlow ? prev.envId : null);
        const primary = matched.primary || Boolean(sameFlow && prev.primary);
        if (replace && (!sameFlow || envId !== prev.envId || primary !== Boolean(prev.primary))) {
          tabState.lastMatchedRequest = { envId, flowId: matched.flowId, primary };
          changed = true;
        }
      }

      const authHeader = (details.requestHeaders || []).find(
        (h) => h.name.toLowerCase() === "authorization"
      );
      const token = authHeader && authHeader.value;
      const url = new URL(details.url);
      const baseUrl = `${url.protocol}//${url.hostname}/`;

      const set = (key, value) => {
        if (value && tabState[key] !== value) {
          tabState[key] = value;
          changed = true;
        }
      };

      if (url.hostname.includes("api.powerplatform.com")) {
        set("apiUrl", baseUrl);
        set("apiToken", token);
      } else if (url.hostname.includes("api.flow.microsoft.com")) {
        set("legacyApiUrl", baseUrl);
        set("legacyApiToken", token);
        if (!tabState.apiUrl) {
          set("apiUrl", baseUrl);
          set("apiToken", token);
        }
      }

      if (!changed) return;
      save();
      if (details.tabId === state.initiatorTabId) sendTokenToApp();
      return chrome.tabs
        .get(details.tabId)
        .then(updateActionForTab)
        .catch(() => {});
  });
}

chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    handleApiRequest(details);
  },
  { urls: ["https://*.api.flow.microsoft.com/*", "https://*.api.powerplatform.com/*"] },
  ["requestHeaders"]
);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  sendResponse();
  ready.then(() => {
    if (!sender.tab) return;
    // The app tab id is also re-learned here, in case it was lost.
    if (message.type === "app-loaded") {
      state.appTabId = sender.tab.id;
      save();
      sendTokenToApp();
    }
  });
});
