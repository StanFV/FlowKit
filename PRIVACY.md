# FlowKit for Power Automate: Privacy Policy

*Last updated: 13 October 2026*

[Nederlandse versie hieronder](#nederlands)

FlowKit for Power Automate ("FlowKit", "the extension") is a browser extension that lets you view, edit, debug and document your own Power Automate cloud flows. This policy explains what data the extension handles and what it does with it.

## Summary

FlowKit has no servers of its own. It does not collect, store, sell or share any of your data with the developer or with third parties. Everything the extension does happens in your browser, and the only services it talks to are Microsoft services that you are already signed in to.

## Data the extension handles

**Authentication tokens.** When you open a flow in Power Automate, your browser sends requests to Microsoft's Power Automate APIs (`*.api.flow.microsoft.com` and `*.api.powerplatform.com`). FlowKit reads the `Authorization` header of those requests so that it can call the same APIs on your behalf, with the permissions you already have. The token is:

- kept only in the browser's session storage (`chrome.storage.session`), which lives in memory and is cleared when you close the browser, reload the extension or close the tab the token came from;
- sent only to the Microsoft API from which it was obtained;
- never written to disk by the extension, logged or sent to the developer or any other party.

**Page addresses (URLs).** FlowKit reads the address of your tabs to recognise when a Power Automate flow is open (for example `make.powerautomate.com/environments/.../flows/...`). Only the environment ID and flow ID are used, to know which flow to open. Addresses are not stored beyond the browser session and are not sent anywhere.

**Flow content and run history.** When you use the editor, run history, connector overview or documentation export, FlowKit retrieves your flow definition, run history, run inputs and outputs and connector details from Microsoft. This content is shown to you in the extension and is only kept in memory while the editor tab is open. Files you download (JSON, HTML or Markdown) are saved by your browser on your own device.

## Services the extension connects to

All connections go to Microsoft services:

| Service | Purpose |
| --- | --- |
| `*.api.flow.microsoft.com`, `*.api.powerplatform.com` | Read and save flows, validate flows, read run history and connector details |
| `*.logic.azure.com` | Read run inputs and outputs through the temporary links provided by Power Automate (no token is sent) |
| `res.cdn.office.net` | Load the Fluent UI icon font |
| Connector icon URLs returned by Power Automate | Show connector icons in the connector overview |

The extension does not use analytics, tracking, advertising or any server operated by the developer.

## What the extension does not do

- It does not sell or transfer your data to third parties.
- It does not use your data for purposes unrelated to its single purpose: working with your Power Automate flows.
- It does not use your data to determine creditworthiness or for lending purposes.
- It does not run remote code; all code is included in the extension package.

## Your control

You can remove all data the extension holds at any time by closing the browser, or by disabling or removing the extension at `chrome://extensions` or `edge://extensions`. Saving changes to a flow only happens when you confirm it in the "Review changes before saving" dialog.

## Changes to this policy

Changes are published in this file in the [source repository](https://github.com/StanFV/Power-Automate-Tools), with the date at the top updated.

## Contact

Questions about this policy can be submitted as an issue at <https://github.com/StanFV/Power-Automate-Tools/issues>.

---

<a id="nederlands"></a>

# FlowKit for Power Automate: Privacyverklaring

*Laatst bijgewerkt: 13 oktober 2026*

FlowKit for Power Automate ("FlowKit", "de extensie") is een browserextensie waarmee je je eigen Power Automate cloudflows kunt bekijken, bewerken, debuggen en documenteren. Deze verklaring legt uit welke gegevens de extensie verwerkt en wat ermee gebeurt.

## Samenvatting

FlowKit heeft geen eigen servers. De extensie verzamelt, bewaart, verkoopt of deelt geen gegevens met de ontwikkelaar of met derden. Alles gebeurt in je browser. De extensie maakt alleen verbinding met diensten van Microsoft waarbij je al bent aangemeld.

## Welke gegevens de extensie verwerkt

**Toegangstokens.** Als je een flow opent in Power Automate, stuurt je browser verzoeken naar de Power Automate-API's van Microsoft (`*.api.flow.microsoft.com` en `*.api.powerplatform.com`). FlowKit leest de `Authorization`-header van die verzoeken, zodat de extensie dezelfde API's namens jou kan aanroepen met de rechten die je al hebt. Het token wordt:

- alleen bewaard in de sessieopslag van de browser (`chrome.storage.session`). Die staat in het geheugen en wordt gewist als je de browser sluit, de extensie herlaadt of het tabblad sluit waar het token vandaan kwam;
- alleen verstuurd naar de Microsoft-API waar het vandaan komt;
- nooit door de extensie op schijf opgeslagen, gelogd of naar de ontwikkelaar of anderen gestuurd.

**Webadressen (URL's).** FlowKit leest het adres van je tabbladen om te herkennen wanneer er een Power Automate-flow open staat (bijvoorbeeld `make.powerautomate.com/environments/.../flows/...`). Alleen de omgevings-ID en flow-ID worden gebruikt, om te weten welke flow geopend moet worden. Adressen worden niet langer bewaard dan de browsersessie en nergens heen gestuurd.

**Inhoud van flows en run-geschiedenis.** Als je de editor, de run-geschiedenis, het connectoroverzicht of de documentatie-export gebruikt, haalt FlowKit je flowdefinitie, run-geschiedenis, inputs en outputs van runs en connectorgegevens op bij Microsoft. Deze inhoud wordt alleen in de extensie aan jou getoond en alleen in het geheugen bewaard zolang het editortabblad open is. Bestanden die je downloadt (JSON, HTML of Markdown) worden door je browser op je eigen apparaat opgeslagen.

## Diensten waarmee de extensie verbinding maakt

Alle verbindingen gaan naar diensten van Microsoft:

| Dienst | Doel |
| --- | --- |
| `*.api.flow.microsoft.com`, `*.api.powerplatform.com` | Flows lezen, opslaan en valideren, run-geschiedenis en connectorgegevens ophalen |
| `*.logic.azure.com` | Inputs en outputs van runs lezen via de tijdelijke links die Power Automate geeft (er wordt geen token meegestuurd) |
| `res.cdn.office.net` | Het lettertype met Fluent UI-iconen laden |
| Connectoriconen die Power Automate teruggeeft | Iconen tonen in het connectoroverzicht |

De extensie gebruikt geen analytics, tracking of advertenties en geen server van de ontwikkelaar.

## Wat de extensie niet doet

- Gegevens verkopen of doorgeven aan derden.
- Gegevens gebruiken voor iets anders dan het enige doel van de extensie: werken met je Power Automate-flows.
- Gegevens gebruiken om kredietwaardigheid te beoordelen of voor leningen.
- Code van buitenaf uitvoeren; alle code zit in het extensiepakket.

## Zelf de regie houden

Je kunt alle gegevens die de extensie bewaart op elk moment verwijderen door de browser te sluiten of door de extensie uit te schakelen of te verwijderen via `chrome://extensions` of `edge://extensions`. Wijzigingen aan een flow worden pas opgeslagen nadat je dat bevestigt in het venster "Review changes before saving".

## Wijzigingen in deze verklaring

Wijzigingen worden in dit bestand gepubliceerd in de [broncode-repository](https://github.com/StanFV/Power-Automate-Tools). De datum bovenaan wordt dan aangepast.

## Contact

Vragen over deze verklaring kun je stellen via een issue op <https://github.com/StanFV/Power-Automate-Tools/issues>.
