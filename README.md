# FlowKit for Power Automate
Browserextensie om Power Automate cloudflows te bewerken, debuggen en documenteren. Gebaseerd op de extensie Power Automate Tools, met nieuwe functies en fixes.

Zie [PRIVACY.md](PRIVACY.md) voor de privacyverklaring en [STORE-LISTING.md](STORE-LISTING.md) voor de teksten voor de Chrome Web Store.

## Installeren
1. Ga in Chrome of Edge naar `chrome://extensions` (of `edge://extensions`).
2. Zet Ontwikkelaarsmodus aan.
3. Kies "Uitgepakte extensie laden" en selecteer de map `extension`.

Deze versie heeft een eigen extensie-ID en kan naast de originele extensie geïnstalleerd worden.

## Icoon
De bronbestanden van het icoon staan in `design`: `icon.svg` voor 48px en groter, `icon-small.svg` als vereenvoudigde variant voor 16 en 32px. De 256 en 512px versies zijn bedoeld voor de Web Store-vermelding.

## Wijzigingen in 1.6
Nieuwe naam FlowKit en een eigen icoon. Het ongebruikte recht `activeTab` is verwijderd en de JSON-editor haalt geen schema's meer van internet op, omdat die al in de extensie zitten.

## Wijzigingen in 1.5
**Run-geschiedenis.** Via "Run history" zie je de laatste runs met status en duur, te filteren op status. Open een run en je ziet per actie de status, foutmelding en duur, gesorteerd op uitvoervolgorde. Bij een mislukte run staan direct alleen de probleemacties open. Per actie kun je de inputs en outputs bekijken, kopiëren of downloaden, naar de actie in de editor springen en bij lussen de afzonderlijke iteraties bekijken.

**Diff voor het opslaan.** Save toont eerst een vergelijking tussen de geladen versie en jouw versie. Pas na "Save to Power Automate" wordt er echt opgeslagen.

**Connectoren.** Een overzicht van alle gebruikte connectoren met licentieniveau (Standard of Premium), het aantal acties en de verbinding. Premium ingebouwde acties zoals HTTP en de HTTP-trigger worden apart getoond. Het licentieniveau wordt opgehaald bij Power Automate. Lukt dat niet, dan valt de extensie terug op een ingebouwde lijst en staat er een sterretje bij.

**Documentatie.** Genereert Nederlandstalige documentatie van de flow (algemene gegevens, trigger en schema, connectoren, variabelen en alle stappen met voorwaarden en takken) als HTML of Markdown. Het HTML-bestand kun je in Word openen.

## Wijzigingen in 1.4
**Knop soms niet klikbaar opgelost.** De achtergrondcode bewaarde alle status (welke flow open staat en het token) alleen in het geheugen van de service worker. Chrome stopt die worker na ongeveer 30 seconden inactiviteit, waarna de knop uitgeschakeld bleef of een klik niets deed. De status wordt nu in `chrome.storage.session` bewaard. Daarnaast wordt de flow direct uit de URL van het tabblad gehaald, ook bij navigatie binnen de portal zonder pagina te herladen.

**Download JSON.** In de editor staat een knop die de huidige inhoud (definitie en connection references) als `<flownaam>.json` downloadt.
