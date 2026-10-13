# Power-Automate-Tools
Verbeterde versie van de Power Automate Tools extensie die online beschikbaar is met nieuwe features en fixes.

## Installeren
1. Ga in Chrome of Edge naar `chrome://extensions` (of `edge://extensions`).
2. Zet Ontwikkelaarsmodus aan.
3. Kies "Uitgepakte extensie laden" en selecteer de map `extension`.

Schakel de originele extensie uit de Web Store uit, beide gebruiken dezelfde extensie-ID.

## Wijzigingen in 1.4
**Knop soms niet klikbaar opgelost.** De achtergrondcode bewaarde alle status (welke flow open staat en het token) alleen in het geheugen van de service worker. Chrome stopt die worker na ongeveer 30 seconden inactiviteit, waarna de knop uitgeschakeld bleef of een klik niets deed. De status wordt nu in `chrome.storage.session` bewaard. Daarnaast wordt de flow direct uit de URL van het tabblad gehaald, ook bij navigatie binnen de portal zonder pagina te herladen.

**Download JSON.** In de editor staat een knop die de huidige inhoud (definitie en connection references) als `<flownaam>.json` downloadt.
