# Chrome Web Store: invulteksten

Dit bestand bevat de teksten voor het Chrome Web Store Developer Dashboard. De velden zijn in het Engels, omdat de beoordelaars van Google Engels lezen. Voor Microsoft Edge Add-ons kun je dezelfde teksten gebruiken.

## Tabblad "Store listing"

**Name** (komt uit de manifest): `FlowKit for Power Automate`

**Summary** (komt uit de manifest, max. 132 tekens):

> Edit, debug and document Power Automate flows: JSON editor, run history, review before save, connector overview and docs export.

**Description:**

> FlowKit is a toolkit for people who build and maintain Power Automate cloud flows.
>
> Open any flow in Power Automate, click the FlowKit icon and the flow opens in a full JSON editor with IntelliSense for the workflow definition language.
>
> Features
> • JSON editor: edit the complete flow definition and connection references, with schema validation.
> • Review before save: see a side by side comparison of your changes before they are saved to Power Automate.
> • Run history: browse recent runs, filter on status and see per action the status, error, duration, inputs and outputs. Drill into the individual iterations of loops and jump straight to the action in the editor.
> • Connector overview: see which connectors a flow uses, whether they are Standard or Premium and which connection reference each action uses. Premium built-in actions such as HTTP are listed as well.
> • Documentation export: generate readable documentation of a flow (trigger, schedule, connectors, variables and all steps including conditions and branches) as HTML or Markdown.
> • Download JSON: save the flow definition as a file.
> • Validate: run the Power Automate flow checker on your edited definition.
>
> Privacy
> FlowKit has no servers of its own and does not collect any data. It uses your existing Power Automate session to call Microsoft's APIs on your behalf. See the privacy policy for details.
>
> FlowKit is not affiliated with or endorsed by Microsoft. Power Automate is a trademark of the Microsoft group of companies.

**Category:** Developer Tools

**Language:** English

**Icon:** `extension/icons/icon-128.png`

**Screenshots:** vijf screenshots van 1280x800 staan in `design/store-screenshots`. Upload ze in deze volgorde: editor, run-geschiedenis, wijzigingen controleren, connectoren, documentatie. Ze zijn gemaakt met een fictieve demoflow van Contoso, dus zonder klantgegevens.

**Small promo tile** (optioneel, 440x280): kan worden gemaakt op basis van `design/icon.svg`.

## Tabblad "Privacy practices"

**Single purpose description:**

> FlowKit helps users view, edit, debug and document their own Power Automate cloud flows. It opens the flow that is currently open in the Power Automate portal in a JSON editor and shows its run history, connectors and documentation.

**Permission justification: `tabs`**

> Used to read the URL of the active tab to detect when a Power Automate flow is open (make.powerautomate.com/environments/{environment}/flows/{flow}). The environment and flow ID from the URL determine which flow FlowKit opens, and the toolbar button is only enabled on these pages. The permission is also used to open the FlowKit editor in a new tab next to the flow.

**Permission justification: `webRequest`**

> Used to observe requests that the Power Automate portal sends to Microsoft's Power Automate APIs (*.api.flow.microsoft.com and *.api.powerplatform.com) and read their Authorization header and API base URL. FlowKit uses this existing session token to call the same Microsoft APIs on the user's behalf (read, validate and save the flow, read run history). Requests are only observed, never blocked or modified. The token is never sent anywhere other than the Microsoft API it belongs to.

**Permission justification: `storage`**

> Used with chrome.storage.session only, to keep the detected flow and session token in memory while the browser is open. Without it this state is lost whenever the service worker is suspended, which disables the toolbar button. Session storage is cleared when the browser closes.

**Host permission justification:**

> *.flow.microsoft.com and *.api.powerplatform.com: call the Power Automate APIs to read, validate and save the user's flows and read run history and connector details.
> *.make.powerautomate.com and *.make.powerapps.com: the Power Automate portals where flows are opened; needed to observe the API requests these pages make.
> *.logic.azure.com: download run inputs and outputs from the temporary content links that Power Automate returns for each run action.

**Are you using remote code?** No, I am not using remote code.

**Data usage**, aan te vinken onder "What user data do you plan to collect from users now or in the future?":

- **Authentication information**: de extensie leest het sessietoken van Power Automate.
- **Website content**: de extensie toont flowdefinities, run-inputs en run-outputs.

Laat de overige categorieën uit. Google telt het verwerken van deze gegevens als verzamelen, ook als er niets naar de ontwikkelaar gaat.

**Certificeringen**, alle drie aanvinken:

- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:**

> https://github.com/StanFV/Power-Automate-Tools/blob/main/PRIVACY.md

Deze link werkt pas als `PRIVACY.md` op de branch `main` staat.

## Tabblad "Distribution"

- **Visibility:** begin eventueel met *Unlisted*: alleen mensen met de link kunnen installeren. Zo kun je eerst met collega's testen.
- **Regions:** alle regio's, of alleen Nederland en België als je de doelgroep beperkt.

## Pakket maken

Zip de inhoud van de map `extension`, dus niet de map zelf, zodat `manifest.json` in de root van de zip staat. Upload die zip in het dashboard.
