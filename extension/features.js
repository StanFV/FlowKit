"use strict";

// Extra features for the flow editor page: run history, diff before save,
// connector overview and documentation export. The bundled React app (app.js)
// calls into window.PATools from its command bar; everything here is plain DOM.
(function () {
  const params = new URLSearchParams(location.search);
  const envId = params.get("envId");
  const flowId = params.get("flowId");
  const LEGACY_VERSION = "2016-11-01";

  const api = { apiUrl: null, apiToken: null, legacyApiUrl: null, legacyToken: null };
  const ctx = { editor: null, name: "", environment: null, baseline: null };

  // Same message the React app listens to; this script is loaded first so it
  // also receives the token sent in reply to "app-loaded".
  chrome.runtime.onMessage.addListener((message) => {
    if (message && message.type === "token-changed") {
      api.apiUrl = message.apiUrl || api.apiUrl;
      api.apiToken = message.token || api.apiToken;
      api.legacyApiUrl = message.legacyApiUrl || api.legacyApiUrl;
      api.legacyToken = message.legacyToken || api.legacyToken;
    }
  });

  // ---------------------------------------------------------------- helpers

  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      if (value === undefined || value === null || value === false) continue;
      if (key === "className") node.className = value;
      else if (key === "style" && typeof value === "object") Object.assign(node.style, value);
      else if (key.startsWith("on")) node.addEventListener(key.slice(2).toLowerCase(), value);
      else node.setAttribute(key, value === true ? "" : value);
    }
    for (const child of children.flat(Infinity)) {
      if (child === undefined || child === null || child === false) continue;
      node.appendChild(typeof child === "string" || typeof child === "number" ? document.createTextNode(String(child)) : child);
    }
    return node;
  }

  function button(text, onClick, primary) {
    return el("button", { className: "pat-btn" + (primary ? " pat-btn-primary" : ""), onClick }, text);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  function fileName(name, extension) {
    const safe = (name || "flow").replace(/[\\/:*?"<>|]+/g, "_").trim() || "flow";
    return `${safe}.${extension}`;
  }

  function download(content, name, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = el("a", { href: url, download: name });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    return isNaN(date) ? String(value) : date.toLocaleString();
  }

  function formatDuration(start, end) {
    if (!start || !end) return "";
    const ms = new Date(end) - new Date(start);
    if (!(ms >= 0)) return "";
    if (ms < 1000) return `${ms} ms`;
    const seconds = ms / 1000;
    if (seconds < 60) return `${seconds.toFixed(1)} s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ${Math.round(seconds % 60)} s`;
    return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
  }

  function statusBadge(status) {
    const value = status || "Unknown";
    return el("span", { className: `pat-badge pat-status-${value.toLowerCase()}` }, value);
  }

  function errorText(error) {
    if (!error) return "";
    if (typeof error === "string") return error;
    return [error.code, error.message].filter(Boolean).join(": ");
  }

  async function fetchJson(url, token, options) {
    const response = await fetch(url, Object.assign({ headers: token ? { authorization: token } : {} }, options));
    const text = await response.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch (e) {
      body = null;
    }
    if (!response.ok) {
      const message = (body && body.error && (body.error.message || body.error.code)) || `${response.status} ${response.statusText}`;
      throw new Error(message);
    }
    return body;
  }

  function withVersion(url, version) {
    return url.includes("api-version=") ? url : `${url}${url.includes("?") ? "&" : "?"}api-version=${version}`;
  }

  function getEditorJson() {
    if (!ctx.editor) throw new Error("The editor is not loaded yet.");
    try {
      return JSON.parse(ctx.editor.getValue());
    } catch (e) {
      throw new Error("The editor content is not valid JSON: " + e.message);
    }
  }

  function revealAction(name) {
    const editor = ctx.editor;
    if (!editor) return;
    const model = editor.getModel();
    const matches = model.findMatches(`${JSON.stringify(name)}: {`, false, false, true, null, false);
    if (!matches.length) return;
    const range = matches[0].range;
    editor.revealRangeInCenter(range);
    editor.setSelection(range);
    editor.focus();
  }

  // ------------------------------------------------------------ side panel

  let openPanel = null;

  function showPanel(title, actions) {
    closePanel();
    const body = el("div", { className: "pat-panel-body" });
    const panel = el(
      "div",
      { className: "pat-panel", role: "dialog", "aria-label": title },
      el(
        "div",
        { className: "pat-panel-header" },
        el("h2", {}, title),
        el("div", { className: "pat-panel-actions" }, actions || [], el("button", { className: "pat-close", title: "Close", onClick: closePanel }, "✕"))
      ),
      body
    );
    document.body.appendChild(panel);
    openPanel = panel;
    return body;
  }

  function closePanel() {
    if (openPanel) openPanel.remove();
    openPanel = null;
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && openPanel && !document.querySelector(".pat-modal")) closePanel();
  });

  function message(text, kind) {
    return el("div", { className: `pat-message pat-message-${kind || "info"}` }, text);
  }

  function loading(text) {
    return el("div", { className: "pat-loading" }, el("span", { className: "pat-spinner" }), text || "Loading...");
  }

  // ------------------------------------------------------------ run history

  function runApiBases() {
    const bases = [];
    if (api.legacyApiUrl && api.legacyToken) {
      bases.push({
        url: `${api.legacyApiUrl}providers/Microsoft.ProcessSimple/environments/${envId}/flows/${flowId}`,
        token: api.legacyToken,
        version: LEGACY_VERSION,
      });
    }
    if (api.apiUrl && api.apiToken && api.apiUrl !== api.legacyApiUrl) {
      bases.push({ url: `${api.apiUrl}powerautomate/flows/${flowId}`, token: api.apiToken, version: "1" });
    }
    return bases;
  }

  let runBase = null;

  async function runRequest(path) {
    if (runBase) return fetchJson(withVersion(runBase.url + path, runBase.version), runBase.token);
    const bases = runApiBases();
    if (!bases.length) throw new Error("No API token available. Refresh the flow's tab in Power Automate and try again.");
    let lastError = null;
    for (const base of bases) {
      try {
        const result = await fetchJson(withVersion(base.url + path, base.version), base.token);
        runBase = base;
        return result;
      } catch (e) {
        lastError = e;
      }
    }
    throw new Error(
      lastError.message +
        (api.legacyToken ? "" : " (Open the flow in the Power Automate designer or run history once to enable the legacy API, then try again.)")
    );
  }

  async function nextPage(nextLink) {
    return fetchJson(nextLink, runBase.token);
  }

  async function fetchAllPages(path) {
    let page = await runRequest(path);
    const items = [...((page && page.value) || [])];
    while (page && page.nextLink) {
      page = await nextPage(page.nextLink);
      items.push(...((page && page.value) || []));
    }
    return items;
  }

  function openRuns(previous) {
    const state = previous || { runs: [], nextLink: null, filter: "all" };
    const filter = el(
      "select",
      { className: "pat-select", title: "Filter by status" },
      ["all", "Failed", "Succeeded", "Running", "Cancelled"].map((v) => el("option", { value: v, selected: v === state.filter }, v === "all" ? "All statuses" : v))
    );
    const refresh = button("Refresh", () => load());
    const body = showPanel("Run history", [filter, refresh]);
    filter.addEventListener("change", () => {
      state.filter = filter.value;
      render();
    });

    function render() {
      body.textContent = "";
      const runs = state.runs.filter((r) => state.filter === "all" || (r.properties && r.properties.status) === state.filter);
      if (!runs.length) body.appendChild(message("No runs found."));
      const list = el("div", { className: "pat-list" });
      for (const run of runs) {
        const p = run.properties || {};
        list.appendChild(
          el(
            "div",
            { className: "pat-row pat-clickable", tabindex: "0", onClick: () => openRun(run), onKeydown: (e) => e.key === "Enter" && openRun(run) },
            statusBadge(p.status),
            el("span", { className: "pat-grow" }, formatDate(p.startTime)),
            el("span", { className: "pat-muted" }, formatDuration(p.startTime, p.endTime)),
            el("span", { className: "pat-muted pat-small" }, run.name)
          )
        );
      }
      body.appendChild(list);
      if (state.nextLink) {
        body.appendChild(
          button("Load more", async (e) => {
            e.target.disabled = true;
            try {
              const page = await nextPage(state.nextLink);
              state.runs.push(...(page.value || []));
              state.nextLink = page.nextLink || null;
            } catch (err) {
              body.appendChild(message("Error loading more runs: " + err.message, "error"));
            }
            render();
          })
        );
      }
    }

    async function load() {
      body.textContent = "";
      body.appendChild(loading("Loading runs..."));
      try {
        const page = await runRequest("/runs");
        state.runs = (page && page.value) || [];
        state.nextLink = (page && page.nextLink) || null;
        render();
      } catch (e) {
        body.textContent = "";
        body.appendChild(message("Error loading run history: " + e.message, "error"));
      }
    }

    function openRun(run) {
      const p = run.properties || {};
      const back = button("← Back", () => openRuns(state));
      const detail = showPanel(`Run ${formatDate(p.startTime)}`, [back]);
      const portalUrl = `https://make.powerautomate.com/environments/${encodeURIComponent(envId)}/flows/${encodeURIComponent(flowId)}/runs/${encodeURIComponent(run.name)}`;
      detail.appendChild(
        el(
          "div",
          { className: "pat-summary" },
          statusBadge(p.status),
          el("span", {}, `Duration: ${formatDuration(p.startTime, p.endTime) || "-"}`),
          el("a", { href: portalUrl, target: "_blank", rel: "noopener" }, "Open in Power Automate")
        )
      );
      if (p.error) detail.appendChild(message(errorText(p.error), "error"));

      const onlyProblems = el("input", { type: "checkbox", id: "pat-only-problems" });
      detail.appendChild(el("label", { className: "pat-check", for: "pat-only-problems" }, onlyProblems, " Show only failed, timed out and cancelled actions"));
      const list = el("div", { className: "pat-list" }, loading("Loading actions..."));
      detail.appendChild(list);

      let actions = [];
      const renderActions = () => {
        list.textContent = "";
        if (p.trigger && !onlyProblems.checked) list.appendChild(actionRow(run, Object.assign({ isTrigger: true }, p.trigger)));
        const problem = new Set(["Failed", "TimedOut", "Cancelled", "Aborted"]);
        const visible = actions.filter((a) => !onlyProblems.checked || problem.has(a.properties && a.properties.status));
        if (!visible.length && onlyProblems.checked) list.appendChild(message("No failed actions in this run."));
        visible.forEach((a) => list.appendChild(actionRow(run, Object.assign({ name: a.name }, a.properties))));
      };
      onlyProblems.addEventListener("change", renderActions);

      fetchAllPages(`/runs/${encodeURIComponent(run.name)}/actions`)
        .then((items) => {
          actions = items.sort((a, b) => {
            const x = (a.properties && a.properties.startTime) || "9999";
            const y = (b.properties && b.properties.startTime) || "9999";
            return x < y ? -1 : x > y ? 1 : 0;
          });
          onlyProblems.checked = actions.some((a) => a.properties && a.properties.status === "Failed");
          renderActions();
        })
        .catch((e) => {
          list.textContent = "";
          list.appendChild(message("Error loading actions: " + e.message, "error"));
        });
    }

    if (previous) render();
    else load();
  }

  function actionRow(run, action) {
    const details = el("div", { className: "pat-details", hidden: true });
    const row = el(
      "div",
      { className: "pat-action" + (action.status === "Failed" ? " pat-action-failed" : "") },
      el(
        "div",
        {
          className: "pat-row pat-clickable",
          tabindex: "0",
          onClick: () => toggle(),
          onKeydown: (e) => e.key === "Enter" && toggle(),
        },
        statusBadge(action.status),
        el("span", { className: "pat-grow pat-name" }, action.isTrigger ? `${action.name} (trigger)` : action.name),
        action.repetitionCount ? el("span", { className: "pat-muted pat-small" }, `${action.repetitionCount}×`) : null,
        el("span", { className: "pat-muted" }, formatDuration(action.startTime, action.endTime))
      ),
      details
    );

    let built = false;
    function toggle() {
      details.hidden = !details.hidden;
      if (built) return;
      built = true;
      details.appendChild(
        el(
          "div",
          { className: "pat-meta" },
          action.code ? el("span", {}, `Code: ${action.code}`) : null,
          action.startTime ? el("span", {}, `Start: ${formatDate(action.startTime)}`) : null,
          action.endTime ? el("span", {}, `End: ${formatDate(action.endTime)}`) : null
        )
      );
      if (action.error) details.appendChild(message(errorText(action.error), "error"));
      const output = el("div");
      const buttons = el("div", { className: "pat-buttons" });
      if (action.inputsLink && action.inputsLink.uri) buttons.appendChild(button("Inputs", () => showContent(output, "Inputs", action.inputsLink.uri)));
      if (action.outputsLink && action.outputsLink.uri) buttons.appendChild(button("Outputs", () => showContent(output, "Outputs", action.outputsLink.uri)));
      buttons.appendChild(button("Show in editor", () => revealAction(action.name)));
      if (action.repetitionCount && !action.isTrigger) {
        buttons.appendChild(button("Iterations", () => showRepetitions(output, run, action.name)));
      }
      details.appendChild(buttons);
      details.appendChild(output);
    }
    return row;
  }

  const MAX_DISPLAY = 300000;

  async function showContent(container, label, uri) {
    container.textContent = "";
    container.appendChild(loading(`Loading ${label.toLowerCase()}...`));
    try {
      const response = await fetch(uri);
      let text = await response.text();
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${text.slice(0, 300)}`);
      try {
        text = JSON.stringify(JSON.parse(text), null, 2);
      } catch (e) {
        // not JSON, show as is
      }
      container.textContent = "";
      const truncated = text.length > MAX_DISPLAY;
      container.appendChild(
        el(
          "div",
          { className: "pat-content-header" },
          el("strong", {}, label),
          el(
            "span",
            { className: "pat-buttons" },
            button("Copy", (e) => {
              navigator.clipboard.writeText(text);
              e.target.textContent = "Copied";
            }),
            button("Download", () => download(text, fileName(`${ctx.name} - ${label}`, "json"), "application/json"))
          )
        )
      );
      if (truncated) container.appendChild(message(`Content is large; showing the first ${MAX_DISPLAY.toLocaleString()} characters. Use Download for the full content.`));
      container.appendChild(el("pre", { className: "pat-pre" }, truncated ? text.slice(0, MAX_DISPLAY) : text));
    } catch (e) {
      container.textContent = "";
      container.appendChild(message(`Could not load ${label.toLowerCase()}: ${e.message}`, "error"));
    }
  }

  async function showRepetitions(container, run, actionName) {
    container.textContent = "";
    container.appendChild(loading("Loading iterations..."));
    try {
      const reps = await fetchAllPages(`/runs/${encodeURIComponent(run.name)}/actions/${encodeURIComponent(actionName)}/repetitions`);
      container.textContent = "";
      const failedOnly = el("input", { type: "checkbox" });
      const list = el("div", { className: "pat-list pat-nested" });
      const render = () => {
        list.textContent = "";
        reps
          .filter((r) => !failedOnly.checked || (r.properties && r.properties.status) !== "Succeeded")
          .forEach((rep) => {
            const p = rep.properties || {};
            const index = (p.repetitionIndexes || []).map((i) => i.itemIndex).join(" / ") || rep.name;
            list.appendChild(actionRow(run, Object.assign({}, p, { name: `${actionName} #${index}`, repetitionCount: 0 })));
          });
        if (!list.childNodes.length) list.appendChild(message("No iterations to show."));
      };
      failedOnly.addEventListener("change", render);
      container.appendChild(el("label", { className: "pat-check" }, failedOnly, ` Only show iterations that did not succeed (${reps.length} total)`));
      container.appendChild(list);
      render();
    } catch (e) {
      container.textContent = "";
      container.appendChild(message("Error loading iterations: " + e.message, "error"));
    }
  }

  // ------------------------------------------------------- diff before save

  function confirmSave(current, doSave) {
    const monaco = window.__paMonaco;
    const baseline = ctx.baseline === null ? current : ctx.baseline;
    if (!monaco) {
      doSave();
      return;
    }
    const container = el("div", { className: "pat-diff" });
    const summary = el("span", { className: "pat-muted" }, baseline === current ? "No changes compared to the loaded version." : "Comparing...");
    const close = () => {
      diffEditor.dispose();
      original.dispose();
      modified.dispose();
      modal.remove();
      document.removeEventListener("keydown", onKey, true);
    };
    const save = button("Save to Power Automate", () => {
      close();
      doSave();
    }, true);
    const modal = el(
      "div",
      { className: "pat-modal" },
      el(
        "div",
        { className: "pat-modal-dialog", role: "dialog", "aria-label": "Review changes" },
        el("div", { className: "pat-panel-header" }, el("h2", {}, "Review changes before saving"), el("span", { className: "pat-muted pat-small" }, "Left: loaded version · Right: your version")),
        container,
        el("div", { className: "pat-modal-footer" }, summary, el("span", { className: "pat-grow" }), button("Cancel", () => close()), save)
      )
    );
    document.body.appendChild(modal);
    const original = monaco.editor.createModel(baseline, "json");
    const modified = monaco.editor.createModel(current, "json");
    const diffEditor = monaco.editor.createDiffEditor(container, {
      readOnly: true,
      originalEditable: false,
      automaticLayout: true,
      renderSideBySide: true,
      minimap: { enabled: false },
    });
    diffEditor.setModel({ original, modified });
    diffEditor.onDidUpdateDiff(() => {
      if (baseline === current) return;
      const changes = diffEditor.getLineChanges() || [];
      summary.textContent = changes.length ? `${changes.length} changed block${changes.length === 1 ? "" : "s"}.` : "Only whitespace or formatting changed.";
      if (changes.length) diffEditor.revealLineInCenter(changes[0].modifiedStartLineNumber || 1);
    });
    const onKey = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
      }
    };
    document.addEventListener("keydown", onKey, true);
    save.focus();
  }

  // ------------------------------------------------------ flow inspection

  // Connectors that require a premium licence (fallback when the API does not
  // report the tier). Not exhaustive.
  const KNOWN_PREMIUM = new Set([
    "commondataserviceforapps",
    "sql",
    "azureblob",
    "azurefile",
    "azuretables",
    "azurequeues",
    "servicebus",
    "eventhubs",
    "documentdb",
    "keyvault",
    "azureautomation",
    "azuredatafactory",
    "kusto",
    "webcontents",
    "uiflow",
    "wordonlinebusiness",
    "salesforce",
    "docusign",
    "adobesign",
  ]);

  const PREMIUM_REQUEST_KINDS = new Set(["", "http"]);

  const TYPE_LABELS = {
    if: "Voorwaarde",
    switch: "Switch",
    foreach: "Toepassen op elk",
    until: "Doen tot",
    scope: "Bereik",
    compose: "Opstellen",
    initializevariable: "Variabele initialiseren",
    setvariable: "Variabele instellen",
    incrementvariable: "Variabele verhogen",
    decrementvariable: "Variabele verlagen",
    appendtoarrayvariable: "Toevoegen aan matrixvariabele",
    appendtostringvariable: "Toevoegen aan tekenreeksvariabele",
    http: "HTTP",
    httpwebhook: "HTTP-webhook",
    response: "Antwoord",
    terminate: "Beëindigen",
    parsejson: "JSON parseren",
    query: "Matrix filteren",
    select: "Selecteren",
    table: "Tabel maken",
    join: "Samenvoegen",
    wait: "Vertraging",
    workflow: "Onderliggende flow uitvoeren",
    recurrence: "Terugkeerpatroon",
    request: "Handmatige/HTTP-trigger",
    expression: "Gegevensbewerking",
  };

  function childActionGroups(action) {
    const groups = [];
    if (action.actions) groups.push({ label: action.type && action.type.toLowerCase() === "if" ? "Ja" : null, actions: action.actions });
    if (action.else && action.else.actions) groups.push({ label: "Nee", actions: action.else.actions });
    if (action.cases) {
      for (const [caseName, c] of Object.entries(action.cases)) {
        groups.push({ label: `Case ${caseName}${c.case !== undefined ? ` (${JSON.stringify(c.case)})` : ""}`, actions: c.actions || {} });
      }
    }
    if (action.default && action.default.actions) groups.push({ label: "Standaard", actions: action.default.actions });
    return groups;
  }

  // Orders actions by their runAfter dependencies, keeping JSON order for ties.
  function orderActions(actions) {
    const entries = Object.entries(actions || {});
    const names = new Set(entries.map(([n]) => n));
    const placed = new Set();
    const result = [];
    let progress = true;
    while (result.length < entries.length && progress) {
      progress = false;
      for (const [name, action] of entries) {
        if (placed.has(name)) continue;
        const deps = Object.keys(action.runAfter || {}).filter((d) => names.has(d));
        if (deps.every((d) => placed.has(d))) {
          placed.add(name);
          result.push([name, action]);
          progress = true;
        }
      }
    }
    for (const entry of entries) if (!placed.has(entry[0])) result.push(entry);
    return result;
  }

  function apiNameFromId(id) {
    if (!id) return null;
    const match = /\/apis\/([^/]+)$/i.exec(id);
    return match ? match[1] : id.split("/").pop();
  }

  function connectionKeyFromExpression(value) {
    const match = /\['\$connections'\]\['([^']+)'\]/.exec(value || "");
    return match ? match[1] : null;
  }

  function describeConnectionReference(ref) {
    ref = ref || {};
    const apiId = ref.id || (ref.api && (ref.api.id || ref.api.name)) || ref.apiName || null;
    return {
      apiName: apiNameFromId(apiId),
      connection:
        ref.connectionName ||
        (ref.connection && (ref.connection.connectionReferenceLogicalName || ref.connection.name || ref.connection.id)) ||
        null,
      source: ref.source || (ref.connection && ref.connection.connectionReferenceLogicalName ? "Connection reference (solution)" : null),
    };
  }

  // Walks triggers and actions and collects everything the overview and the
  // documentation export need.
  function analyzeFlow(flowJson) {
    const definition = flowJson.definition || {};
    const references = flowJson.connectionReferences || {};
    const connectors = new Map();
    const builtInPremium = [];
    const variables = [];

    const connectorFor = (key) => {
      const ref = describeConnectionReference(references[key]);
      const apiName = ref.apiName || key.replace(/_\d+$/, "");
      if (!connectors.has(apiName)) {
        connectors.set(apiName, { apiName, displayName: null, iconUri: null, tier: null, tierSource: null, references: new Set(), operations: [] });
      }
      const connector = connectors.get(apiName);
      connector.references.add(key + (ref.connection && ref.connection !== key ? ` → ${ref.connection}` : ""));
      return connector;
    };

    for (const key of Object.keys(references)) connectorFor(key);

    const describe = (name, item, isTrigger) => {
      const type = (item.type || "").toLowerCase();
      const kind = (item.kind || "").toLowerCase();
      const inputs = item.inputs || {};
      const host = inputs.host || {};
      const info = { name, type: item.type || "", kind: item.kind || "", label: TYPE_LABELS[type] || item.type || "", connector: null, operation: null, premium: false };

      if (type.startsWith("openapiconnection")) {
        const key = host.connectionName || connectionKeyFromExpression(host.connection && host.connection.name);
        const connector = key ? connectorFor(key) : null;
        info.connector = connector ? connector.apiName : apiNameFromId(host.apiId);
        info.operation = host.operationId || null;
      } else if (type.startsWith("apiconnection")) {
        const key = connectionKeyFromExpression(host.connection && host.connection.name);
        const connector = key ? connectorFor(key) : null;
        info.connector = connector ? connector.apiName : null;
        info.operation = inputs.path ? `${(inputs.method || "").toUpperCase()} ${inputs.path}`.trim() : null;
      }

      if (info.connector && connectors.has(info.connector)) {
        connectors.get(info.connector).operations.push({ name, operation: info.operation, isTrigger });
      }

      if (type === "http" || type === "httpwebhook") info.premium = true;
      if (type === "request" && PREMIUM_REQUEST_KINDS.has(kind)) info.premium = true;
      if (type === "response" && PREMIUM_REQUEST_KINDS.has(kind)) info.premium = true;
      if (info.premium) builtInPremium.push({ name, type: item.type, kind: item.kind, isTrigger });

      if (type === "initializevariable" && inputs.variables) {
        for (const v of inputs.variables) variables.push({ name: v.name, type: v.type, value: v.value, action: name });
      }
      return info;
    };

    const buildTree = (actions) =>
      orderActions(actions).map(([name, action]) => {
        const node = describe(name, action, false);
        node.description = action.description || null;
        node.runAfter = action.runAfter || {};
        node.expression = action.expression;
        node.foreach = action.foreach;
        node.switchOn = action.type && action.type.toLowerCase() === "switch" ? action.expression : undefined;
        node.groups = childActionGroups(action).map((g) => ({ label: g.label, children: buildTree(g.actions) }));
        return node;
      });

    const triggers = Object.entries(definition.triggers || {}).map(([name, trigger]) => {
      const node = describe(name, trigger, true);
      node.recurrence = trigger.recurrence || null;
      node.conditions = (trigger.conditions || []).map((c) => c.expression).filter(Boolean);
      node.splitOn = trigger.splitOn || null;
      node.description = trigger.description || null;
      return node;
    });

    const steps = buildTree(definition.actions || {});
    let count = 0;
    const countNodes = (nodes) =>
      nodes.forEach((n) => {
        count++;
        n.groups.forEach((g) => countNodes(g.children));
      });
    countNodes(steps);

    return { triggers, steps, connectors: [...connectors.values()], builtInPremium, variables, actionCount: count };
  }

  // Looks up display name, icon and licence tier of each connector. Falls back
  // to the built-in premium list when the API is not reachable.
  async function enrichConnectors(connectors) {
    await Promise.all(
      connectors.map(async (connector) => {
        if (api.legacyApiUrl && api.legacyToken && envId) {
          try {
            const result = await fetchJson(
              `${api.legacyApiUrl}providers/Microsoft.ProcessSimple/environments/${envId}/apis/${encodeURIComponent(connector.apiName)}?api-version=${LEGACY_VERSION}`,
              api.legacyToken
            );
            const p = (result && result.properties) || {};
            connector.displayName = p.displayName || null;
            connector.iconUri = p.iconUri || null;
            if (p.tier && p.tier !== "NotSpecified") {
              connector.tier = p.tier;
              connector.tierSource = "api";
            }
            if (p.isCustomApi) {
              connector.tier = "Premium";
              connector.tierSource = "api";
              connector.custom = true;
            }
          } catch (e) {
            // fall back below
          }
        }
        if (!connector.tier) {
          const shortName = connector.apiName.replace(/^shared_/, "");
          connector.tier = KNOWN_PREMIUM.has(shortName) ? "Premium" : "Standard";
          connector.tierSource = "list";
        }
      })
    );
    return connectors;
  }

  function connectorName(connector) {
    return connector.displayName || connector.apiName.replace(/^shared_/, "");
  }

  // ------------------------------------------------------ connector overview

  async function openConnectors() {
    let flow;
    try {
      flow = getEditorJson();
    } catch (e) {
      showPanel("Connectors").appendChild(message(e.message, "error"));
      return;
    }
    const body = showPanel("Connectors", [button("Refresh", () => openConnectors())]);
    body.appendChild(loading("Analysing flow..."));
    const analysis = analyzeFlow(flow);
    await enrichConnectors(analysis.connectors);
    body.textContent = "";

    const premiumConnectors = analysis.connectors.filter((c) => c.tier === "Premium");
    const isPremium = premiumConnectors.length > 0 || analysis.builtInPremium.length > 0;
    body.appendChild(
      message(
        isPremium
          ? `This flow uses premium functionality (${[...premiumConnectors.map(connectorName), ...analysis.builtInPremium.map((b) => b.type)].filter((v, i, a) => a.indexOf(v) === i).join(", ")}). Running it requires a Power Automate Premium, Process or per-flow licence, or a licence that includes premium connectors.`
          : "No premium connectors or premium built-in actions found. A standard Microsoft 365 licence is sufficient for the connectors used.",
        isPremium ? "warning" : "success"
      )
    );
    if (analysis.connectors.some((c) => c.tierSource === "list")) {
      body.appendChild(message("For some connectors the licence tier could not be retrieved from Power Automate and is based on a built-in list. Verify these in the connector documentation.", "info"));
    }

    const table = el(
      "table",
      { className: "pat-table" },
      el("thead", {}, el("tr", {}, el("th", {}, "Connector"), el("th", {}, "Tier"), el("th", {}, "Actions"), el("th", {}, "Connection reference")))
    );
    const tbody = el("tbody");
    table.appendChild(tbody);
    for (const connector of analysis.connectors.sort((a, b) => connectorName(a).localeCompare(connectorName(b)))) {
      const opsRow = el(
        "tr",
        { hidden: true },
        el(
          "td",
          { colspan: "4" },
          connector.operations.length
            ? el(
                "ul",
                { className: "pat-ops" },
                connector.operations.map((op) =>
                  el(
                    "li",
                    {},
                    el("a", { href: "#", onClick: (e) => (e.preventDefault(), revealAction(op.name)) }, op.name),
                    op.isTrigger ? " (trigger)" : "",
                    op.operation ? el("span", { className: "pat-muted" }, ` · ${op.operation}`) : ""
                  )
                )
              )
            : el("span", { className: "pat-muted" }, "Not used by any action (unused connection reference).")
        )
      );
      tbody.appendChild(
        el(
          "tr",
          { className: "pat-clickable", onClick: () => (opsRow.hidden = !opsRow.hidden) },
          el(
            "td",
            {},
            el(
              "span",
              { className: "pat-connector" },
              connector.iconUri ? el("img", { src: connector.iconUri, alt: "", width: "20", height: "20" }) : null,
              el("span", {}, connectorName(connector), el("br"), el("span", { className: "pat-muted pat-small" }, connector.apiName))
            )
          ),
          el(
            "td",
            {},
            el("span", { className: `pat-badge ${connector.tier === "Premium" ? "pat-premium" : "pat-standard"}` }, connector.custom ? "Premium (custom)" : connector.tier),
            connector.tierSource === "list" ? el("span", { className: "pat-muted pat-small", title: "Based on built-in list" }, " *") : null
          ),
          el("td", {}, String(connector.operations.length)),
          el("td", { className: "pat-small" }, [...connector.references].join(", "))
        )
      );
      tbody.appendChild(opsRow);
    }
    if (!analysis.connectors.length) body.appendChild(message("This flow does not use any connectors."));
    else body.appendChild(table);

    if (analysis.builtInPremium.length) {
      body.appendChild(el("h3", {}, "Premium built-in actions"));
      body.appendChild(
        el(
          "ul",
          { className: "pat-ops" },
          analysis.builtInPremium.map((b) =>
            el(
              "li",
              {},
              el("a", { href: "#", onClick: (e) => (e.preventDefault(), revealAction(b.name)) }, b.name),
              el("span", { className: "pat-muted" }, ` · ${b.type}${b.kind ? ` (${b.kind})` : ""}${b.isTrigger ? " · trigger" : ""}`)
            )
          )
        )
      );
    }
  }

  // --------------------------------------------------- documentation export

  function shorten(value, max) {
    const text = typeof value === "string" ? value : JSON.stringify(value);
    if (text === undefined) return "";
    return text.length > max ? text.slice(0, max) + "…" : text;
  }

  function displayName(name) {
    return name.replace(/_/g, " ");
  }

  function describeRecurrence(r) {
    if (!r) return null;
    const units = { Second: ["seconde", "seconden"], Minute: ["minuut", "minuten"], Hour: ["uur", "uur"], Day: ["dag", "dagen"], Week: ["week", "weken"], Month: ["maand", "maanden"] };
    const interval = Number(r.interval) || 1;
    const unit = units[r.frequency] ? units[r.frequency][interval === 1 ? 0 : 1] : r.frequency || "";
    let text = interval === 1 ? `Elke ${unit}` : `Elke ${interval} ${unit}`;
    if (r.schedule) {
      const s = r.schedule;
      if (s.weekDays) text += `, op ${s.weekDays.join(", ")}`;
      if (s.hours) text += `, om ${s.hours.join(", ")} uur`;
      if (s.minutes) text += ` (minuten ${s.minutes.join(", ")})`;
    }
    if (r.timeZone) text += `, tijdzone ${r.timeZone}`;
    if (r.startTime) text += `, vanaf ${r.startTime}`;
    return text;
  }

  function stepDetails(node, connectorsByName, previousName) {
    const lines = [];
    const connector = node.connector && connectorsByName.get(node.connector);
    if (connector) {
      lines.push(["Connector", `${connectorName(connector)}${connector.tier === "Premium" ? " (premium)" : ""}`]);
      if (node.operation) lines.push(["Bewerking", node.operation]);
    } else if (node.label) {
      lines.push(["Type", node.label + (node.kind ? ` (${node.kind})` : "")]);
    }
    if (node.premium) lines.push(["Licentie", "Premium"]);
    if (node.description) lines.push(["Notitie", node.description]);
    if (node.foreach !== undefined) lines.push(["Herhaalt over", shorten(node.foreach, 200)]);
    if (node.type && node.type.toLowerCase() === "if" && node.expression !== undefined) lines.push(["Voorwaarde", shorten(node.expression, 300)]);
    if (node.type && node.type.toLowerCase() === "until" && node.expression !== undefined) lines.push(["Totdat", shorten(node.expression, 300)]);
    if (node.switchOn !== undefined) lines.push(["Switch op", shorten(node.switchOn, 200)]);
    const runAfter = Object.entries(node.runAfter || {});
    const isDefault = runAfter.length === 0 || (runAfter.length === 1 && runAfter[0][0] === previousName && runAfter[0][1].length === 1 && runAfter[0][1][0] === "Succeeded");
    if (!isDefault) {
      lines.push(["Uitvoeren na", runAfter.map(([n, s]) => `${displayName(n)} (${s.join(", ")})`).join("; ")]);
    }
    return lines;
  }

  function buildDocumentation(analysis, meta) {
    const connectorsByName = new Map(analysis.connectors.map((c) => [c.apiName, c]));
    const md = [];
    const html = [];
    const h = escapeHtml;
    const mdCell = (v) => String(v).replace(/\|/g, "\\|").replace(/\n/g, " ");
    const mdCode = (v) => "`" + String(v).replace(/`/g, "'") + "`";

    md.push(`# ${meta.name}`, "");
    html.push(`<h1>${h(meta.name)}</h1>`);

    const general = [
      ["Omgeving", meta.environment],
      ["Flow-ID", meta.flowId],
      ["Status", meta.state],
      ["Aangemaakt", meta.created],
      ["Laatst gewijzigd", meta.modified],
      ["Aantal acties", String(analysis.actionCount)],
      ["Premium licentie nodig", meta.premium ? "Ja" : "Nee"],
    ].filter(([, v]) => v);
    md.push("## Algemeen", "", "| Eigenschap | Waarde |", "| --- | --- |", ...general.map(([k, v]) => `| ${k} | ${mdCell(v)} |`), "");
    html.push("<h2>Algemeen</h2><table>", ...general.map(([k, v]) => `<tr><th>${h(k)}</th><td>${h(v)}</td></tr>`), "</table>");

    md.push("## Trigger", "");
    html.push("<h2>Trigger</h2>");
    for (const t of analysis.triggers) {
      const lines = stepDetails(t, connectorsByName, null);
      const recurrence = describeRecurrence(t.recurrence);
      if (recurrence) lines.push(["Schema", recurrence]);
      if (t.splitOn) lines.push(["Splitsen op", t.splitOn]);
      t.conditions.forEach((c) => lines.push(["Triggervoorwaarde", c]));
      md.push(`**${displayName(t.name)}**`, "", ...lines.map(([k, v]) => `- ${k}: ${k === "Triggervoorwaarde" ? mdCode(v) : v}`), "");
      html.push(`<p><strong>${h(displayName(t.name))}</strong></p><ul>`, ...lines.map(([k, v]) => `<li>${h(k)}: ${k === "Triggervoorwaarde" ? `<code>${h(v)}</code>` : h(v)}</li>`), "</ul>");
    }

    md.push("## Connectoren", "");
    html.push("<h2>Connectoren</h2>");
    if (analysis.connectors.length) {
      md.push("| Connector | Licentie | Acties | Verbinding |", "| --- | --- | --- | --- |");
      html.push("<table><tr><th>Connector</th><th>Licentie</th><th>Acties</th><th>Verbinding</th></tr>");
      for (const c of analysis.connectors) {
        const refs = [...c.references].join(", ");
        md.push(`| ${mdCell(connectorName(c))} | ${c.tier} | ${c.operations.length} | ${mdCell(refs)} |`);
        html.push(`<tr><td>${h(connectorName(c))}</td><td>${h(c.tier)}</td><td>${c.operations.length}</td><td>${h(refs)}</td></tr>`);
      }
      md.push("");
      html.push("</table>");
    } else {
      md.push("Deze flow gebruikt geen connectoren.", "");
      html.push("<p>Deze flow gebruikt geen connectoren.</p>");
    }

    if (analysis.variables.length) {
      md.push("## Variabelen", "", "| Naam | Type | Beginwaarde |", "| --- | --- | --- |");
      html.push("<h2>Variabelen</h2><table><tr><th>Naam</th><th>Type</th><th>Beginwaarde</th></tr>");
      for (const v of analysis.variables) {
        const value = v.value === undefined ? "" : shorten(v.value, 120);
        md.push(`| ${mdCell(v.name)} | ${mdCell(v.type)} | ${value ? mdCode(mdCell(value)) : ""} |`);
        html.push(`<tr><td>${h(v.name)}</td><td>${h(v.type)}</td><td>${value ? `<code>${h(value)}</code>` : ""}</td></tr>`);
      }
      md.push("");
      html.push("</table>");
    }

    md.push("## Stappen", "");
    html.push("<h2>Stappen</h2>");
    const renderSteps = (nodes, depth) => {
      const indent = "   ".repeat(depth);
      html.push("<ol>");
      let previous = null;
      nodes.forEach((node, index) => {
        const lines = stepDetails(node, connectorsByName, previous);
        md.push(`${indent}${index + 1}. **${displayName(node.name)}**`);
        lines.forEach(([k, v]) => md.push(`${indent}   - ${k}: ${["Voorwaarde", "Totdat", "Herhaalt over", "Switch op"].includes(k) ? mdCode(v) : v}`));
        html.push(`<li><strong>${h(displayName(node.name))}</strong>`);
        if (lines.length) html.push("<ul>", ...lines.map(([k, v]) => `<li>${h(k)}: ${["Voorwaarde", "Totdat", "Herhaalt over", "Switch op"].includes(k) ? `<code>${h(v)}</code>` : h(v)}</li>`), "</ul>");
        for (const group of node.groups) {
          if (group.label) {
            md.push(`${indent}   - *${group.label}:*${group.children.length ? "" : " (geen acties)"}`);
            html.push(`<p class="branch">${h(group.label)}${group.children.length ? "" : " (geen acties)"}</p>`);
          }
          if (group.children.length) renderSteps(group.children, depth + 2);
        }
        html.push("</li>");
        previous = node.name;
      });
      html.push("</ol>");
    };
    renderSteps(analysis.steps, 0);
    md.push("");

    const footer = `Gegenereerd met FlowKit op ${new Date().toLocaleString("nl-NL")}.`;
    md.push("---", "", `*${footer}*`, "");
    html.push(`<hr><p class="footer">${h(footer)}</p>`);

    const style =
      "body{font-family:'Segoe UI',Arial,sans-serif;color:#201f1e;max-width:960px;margin:24px auto;padding:0 16px;line-height:1.45}" +
      "h1{font-size:26px}h2{font-size:19px;margin-top:28px;border-bottom:1px solid #e1dfdd;padding-bottom:4px}" +
      "table{border-collapse:collapse;margin:8px 0}th,td{border:1px solid #e1dfdd;padding:4px 10px;text-align:left;vertical-align:top}th{background:#f3f2f1}" +
      "code{background:#f3f2f1;padding:1px 4px;border-radius:3px;font-size:12px;word-break:break-all}" +
      "ol{padding-left:22px}ol li{margin:6px 0}ul{margin:2px 0;padding-left:18px;color:#3b3a39;font-size:13px}" +
      ".branch{font-style:italic;margin:6px 0 0;color:#605e5c}.footer{color:#8a8886;font-size:12px}";
    const htmlDoc = `<!DOCTYPE html><html lang="nl"><head><meta charset="utf-8"><title>${h(meta.name)}</title><style>${style}</style></head><body>${html.join("\n")}</body></html>`;
    return { markdown: md.join("\n"), html: htmlDoc };
  }

  async function openDocs() {
    let flow;
    try {
      flow = getEditorJson();
    } catch (e) {
      showPanel("Documentation").appendChild(message(e.message, "error"));
      return;
    }
    const body = showPanel("Documentation");
    body.appendChild(loading("Generating documentation..."));

    const analysis = analyzeFlow(flow);
    await enrichConnectors(analysis.connectors);
    const meta = {
      name: ctx.name || "Flow",
      environment: (ctx.environment && (ctx.environment.name || ctx.environment.id)) || envId,
      flowId,
      premium: analysis.connectors.some((c) => c.tier === "Premium") || analysis.builtInPremium.length > 0,
    };
    if (api.apiUrl && api.apiToken) {
      try {
        const details = await fetchJson(`${api.apiUrl}powerautomate/flows/${flowId}?api-version=1`, api.apiToken);
        const p = (details && details.properties) || {};
        meta.state = p.state || null;
        meta.created = p.createdTime ? new Date(p.createdTime).toLocaleString("nl-NL") : null;
        meta.modified = p.lastModifiedTime ? new Date(p.lastModifiedTime).toLocaleString("nl-NL") : null;
        if (p.environment && p.environment.properties && p.environment.properties.displayName) {
          meta.environment = `${p.environment.properties.displayName} (${p.environment.name})`;
        }
      } catch (e) {
        // optional details
      }
    }
    const docs = buildDocumentation(analysis, meta);

    body.textContent = "";
    body.appendChild(
      el(
        "div",
        { className: "pat-buttons" },
        button("Download HTML", () => download(docs.html, fileName(meta.name, "html"), "text/html"), true),
        button("Download Markdown", () => download(docs.markdown, fileName(meta.name, "md"), "text/markdown")),
        button("Copy Markdown", (e) => {
          navigator.clipboard.writeText(docs.markdown);
          e.target.textContent = "Copied";
        })
      )
    );
    body.appendChild(el("p", { className: "pat-muted pat-small" }, "The documentation is generated in Dutch from the current editor content, including unsaved changes. The HTML file can be opened in Word."));
    const frame = el("iframe", { className: "pat-preview", sandbox: "", title: "Preview" });
    frame.srcdoc = docs.html;
    body.appendChild(frame);
  }

  // ------------------------------------------------------------------ styles

  const css = `
.pat-panel{position:fixed;top:0;right:0;bottom:0;width:min(760px,62vw);background:#fff;box-shadow:-8px 0 24px rgba(0,0,0,.18);z-index:1000000;display:flex;flex-direction:column;font-family:'Segoe UI','Segoe UI Web (West European)',-apple-system,BlinkMacSystemFont,Roboto,'Helvetica Neue',sans-serif;font-size:14px;color:#323130}
.pat-panel-header{display:flex;align-items:center;gap:12px;padding:14px 20px;border-bottom:1px solid #edebe9}
.pat-panel-header h2{margin:0;font-size:20px;font-weight:600;flex:1}
.pat-panel-actions{display:flex;gap:8px;align-items:center}
.pat-panel-body{flex:1;overflow:auto;padding:16px 20px}
.pat-panel-body h3{font-size:15px;margin:20px 0 6px}
.pat-close{border:0;background:transparent;font-size:16px;cursor:pointer;padding:4px 8px;color:#605e5c}
.pat-close:hover{background:#f3f2f1}
.pat-btn{font:inherit;font-size:13px;border:1px solid #8a8886;background:#fff;color:#323130;border-radius:2px;padding:4px 14px;cursor:pointer;min-height:30px}
.pat-btn:hover{background:#f3f2f1}.pat-btn:disabled{opacity:.5;cursor:default}
.pat-btn-primary{background:#0078d4;border-color:#0078d4;color:#fff}.pat-btn-primary:hover{background:#106ebe}
.pat-select{font:inherit;font-size:13px;height:30px;border:1px solid #8a8886;border-radius:2px;padding:0 6px}
.pat-buttons{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}
.pat-list{display:flex;flex-direction:column}
.pat-nested{margin-left:12px;border-left:2px solid #edebe9;padding-left:8px}
.pat-row{display:flex;align-items:center;gap:12px;padding:8px 6px;border-bottom:1px solid #f3f2f1}
.pat-clickable{cursor:pointer}.pat-clickable:hover{background:#f3f2f1}
.pat-grow{flex:1;min-width:0}
.pat-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pat-muted{color:#605e5c}.pat-small{font-size:12px}
.pat-badge{display:inline-block;font-size:11px;font-weight:600;padding:2px 8px;border-radius:10px;background:#edebe9;color:#323130;min-width:64px;text-align:center}
.pat-status-succeeded{background:#dff6dd;color:#107c10}.pat-status-failed{background:#fde7e9;color:#a4262c}
.pat-status-running,.pat-status-waiting{background:#deecf9;color:#005a9e}.pat-status-timedout{background:#fff4ce;color:#8a5300}
.pat-premium{background:#f4e8fd;color:#5c2e91}.pat-standard{background:#edebe9;color:#323130}
.pat-action-failed>.pat-row{background:#fdf3f4}
.pat-details{padding:6px 10px 12px 18px;border-bottom:1px solid #edebe9;background:#faf9f8}
.pat-meta{display:flex;gap:16px;flex-wrap:wrap;color:#605e5c;font-size:12px;margin:4px 0}
.pat-message{padding:8px 12px;margin:8px 0;border-radius:2px;background:#f3f2f1;white-space:pre-wrap;word-break:break-word}
.pat-message-error{background:#fde7e9;color:#a4262c}.pat-message-warning{background:#fff4ce;color:#5c3c00}.pat-message-success{background:#dff6dd;color:#0b5a08}
.pat-loading{display:flex;align-items:center;gap:10px;padding:12px 0;color:#605e5c}
.pat-spinner{width:16px;height:16px;border:2px solid #c7e0f4;border-top-color:#0078d4;border-radius:50%;animation:pat-spin 1s linear infinite}
@keyframes pat-spin{to{transform:rotate(360deg)}}
.pat-pre{background:#fff;border:1px solid #edebe9;padding:10px;max-height:420px;overflow:auto;font-family:Consolas,'Courier New',monospace;font-size:12px;white-space:pre;margin:4px 0}
.pat-content-header{display:flex;align-items:center;justify-content:space-between;margin-top:8px}
.pat-check{display:flex;align-items:center;gap:6px;margin:10px 0;font-size:13px;cursor:pointer}
.pat-summary{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:8px}
.pat-table{border-collapse:collapse;width:100%;margin-top:12px}
.pat-table th,.pat-table td{text-align:left;padding:8px;border-bottom:1px solid #edebe9;vertical-align:top}
.pat-table th{font-weight:600;font-size:12px;color:#605e5c}
.pat-connector{display:flex;gap:10px;align-items:center}.pat-connector img{border-radius:3px}
.pat-ops{margin:4px 0;padding-left:20px}.pat-ops li{margin:3px 0}
.pat-ops a,.pat-summary a{color:#0078d4}
.pat-modal{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:1000001;display:flex;align-items:center;justify-content:center;font-family:'Segoe UI',-apple-system,Roboto,sans-serif;font-size:14px;color:#323130}
.pat-modal-dialog{background:#fff;width:92vw;height:86vh;display:flex;flex-direction:column;box-shadow:0 12px 40px rgba(0,0,0,.3)}
.pat-diff{flex:1;min-height:0}
.pat-modal-footer{display:flex;align-items:center;gap:8px;padding:12px 20px;border-top:1px solid #edebe9}
.pat-preview{width:100%;height:calc(100vh - 220px);border:1px solid #edebe9;background:#fff}
`;
  document.head.appendChild(el("style", {}, css));

  window.PATools = {
    setContext(values) {
      Object.assign(ctx, values);
    },
    setBaseline(value) {
      ctx.baseline = value;
    },
    confirmSave,
    openRuns: () => openRuns(),
    openConnectors,
    openDocs,
    // exposed for testing
    _analyzeFlow: analyzeFlow,
    _buildDocumentation: buildDocumentation,
  };
})();
