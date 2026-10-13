<p align="center">
  <img src="design/icon-256.png" alt="FlowKit icoon" width="96" height="96">
</p>

<h1 align="center">FlowKit for Power Automate</h1>

<p align="center">
  Bewerk, debug en documenteer je Power Automate cloudflows vanuit één browserextensie.
</p>

FlowKit opent de flow die je in Power Automate bekijkt in een volledige JSON-editor. Daar zie je ook de run-geschiedenis, controleer je wijzigingen voor het opslaan, zie je welke connectoren en licenties de flow nodig heeft en genereer je documentatie. De extensie werkt in Chrome en Microsoft Edge.

![De FlowKit-editor met een flow als JSON](design/store-screenshots/1-editor.png)

## Functies

### JSON-editor
Bewerk de volledige flowdefinitie inclusief connection references in een editor met IntelliSense en schemavalidatie voor de workflowtaal van Power Automate. Vanuit de werkbalk kun je:

- **Save**: de flow opslaan in Power Automate, na een controle van je wijzigingen.
- **Validate**: de flowcontrole van Power Automate uitvoeren op je aangepaste definitie, met fouten en waarschuwingen in een apart paneel.
- **Download JSON**: de definitie als `<flownaam>.json` opslaan, bijvoorbeeld als back-up of om te delen.

### Run-geschiedenis
Debug mislukte runs zonder de editor te verlaten. Je ziet de laatste runs met status en duur, te filteren op status. Open een run en je krijgt per actie de status, de foutmelding en de duur, in de volgorde waarin de acties zijn uitgevoerd. Bij een mislukte run staan direct alleen de probleemacties open.

Per actie kun je de inputs en outputs bekijken, kopiëren of downloaden. Met "Show in editor" spring je naar die actie in de JSON. Bij een lus zie je de afzonderlijke iteraties, met een filter op de iteraties die niet gelukt zijn. Een link opent dezelfde run in Power Automate.

![Run-geschiedenis met een mislukte actie en de outputs](design/store-screenshots/2-run-history.png)

### Wijzigingen controleren voor het opslaan
Voordat FlowKit iets opslaat, zie je een vergelijking naast elkaar van de geladen versie en jouw versie. Pas als je op "Save to Power Automate" klikt, wordt de flow echt bijgewerkt. Zo voorkom je dat een onbedoelde wijziging in productie belandt.

![Vergelijking van wijzigingen voor het opslaan](design/store-screenshots/3-review-changes.png)

### Connectoren en licenties
Een overzicht van alle connectoren die de flow gebruikt, met het licentieniveau (Standard of Premium), het aantal acties en de connection reference. Klik op een connector om te zien welke acties hem gebruiken en spring daarmee naar de editor. Premium ingebouwde onderdelen zoals de HTTP-actie en de trigger "When a HTTP request is received" staan apart. Bovenaan zie je in één oogopslag of de flow een premium licentie nodig heeft.

Het licentieniveau wordt opgehaald bij Power Automate. Lukt dat niet, dan gebruikt FlowKit een ingebouwde lijst en staat er een sterretje bij.

![Overzicht van connectoren en licentieniveaus](design/store-screenshots/4-connectors.png)

### Documentatie genereren
Maak in een paar seconden leesbare documentatie van een flow, bijvoorbeeld voor overdracht aan een klant of collega. De documentatie is Nederlandstalig en bevat:

- algemene gegevens zoals omgeving, status en licentiebehoefte
- de trigger met schema en triggervoorwaarden
- de gebruikte connectoren en variabelen
- alle stappen in uitvoervolgorde, met voorwaarden, Ja/Nee-takken, notities en afwijkende "uitvoeren na"-instellingen

Download het resultaat als HTML (te openen in Word) of als Markdown.

![Voorbeeld van gegenereerde documentatie](design/store-screenshots/5-documentation.png)

## Gebruik
1. Open een flow in [Power Automate](https://make.powerautomate.com), bijvoorbeeld de detailpagina of de designer.
2. Klik op het FlowKit-icoon in de werkbalk van je browser. Het icoon is alleen actief op een pagina met een flow.
3. De flow opent in een nieuw tabblad met de editor en alle functies.

Krijg je de melding dat de pagina vernieuwd moet worden, vernieuw dan het tabblad met de flow in Power Automate en klik opnieuw op het icoon.

## Installeren
Totdat FlowKit in de Chrome Web Store staat, installeer je de extensie zo:

1. Download of clone deze repository.
2. Ga in Chrome naar `chrome://extensions` of in Edge naar `edge://extensions`.
3. Zet de ontwikkelaarsmodus aan.
4. Kies "Uitgepakte extensie laden" en selecteer de map `extension`.

## Privacy
FlowKit heeft geen eigen servers en verzamelt geen gegevens. De extensie gebruikt je bestaande Power Automate-sessie om namens jou de API's van Microsoft aan te roepen. Tokens worden alleen in het geheugen van de browser bewaard en nergens anders heen gestuurd dan naar Microsoft. Lees de volledige [privacyverklaring](PRIVACY.md).

## Projectstructuur

| Map of bestand | Inhoud |
| --- | --- |
| `extension/` | De extensie zelf, klaar om te laden of te zippen voor de Web Store |
| `extension/background.js` | Herkent flowpagina's en beheert de sessie |
| `extension/features.js` | Run-geschiedenis, wijzigingen controleren, connectoren en documentatie |
| `design/` | Bronbestanden van het icoon (`icon.svg`, `icon-small.svg` voor 16 en 32px) en grote versies voor de Web Store |
| `design/store-screenshots/` | Screenshots voor de Web Store en deze README |

## Verantwoording
FlowKit is gebaseerd op de extensie Power Automate Tools en uitgebreid met nieuwe functies en fixes.

FlowKit is niet gelieerd aan of goedgekeurd door Microsoft. Power Automate is een handelsmerk van de Microsoft-groep.
