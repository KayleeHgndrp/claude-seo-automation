# Tattoo Heaven — nieuwe website (concept)

Frisse, clean redesign voor **Tattoo Heaven Haarlem**. Statische site (HTML + CSS +
vanilla JS), dus supersnel, Google-vriendelijk en zonder buildstap te hosten.

## Bestanden

```
tattoo-heaven/
  index.html          # De volledige one-page landingspagina
  css/styles.css      # Design/stijl (dark + gold, brand-kleuren)
  js/main.js          # Animaties: scroll-reveal, tellers, mobiel menu, parallax, formulier
  assets/favicon.svg  # Favicon (goud op zwart)
  robots.txt          # SEO
  sitemap.xml         # SEO
  README.md           # Dit bestand
```

## Bekijken

Open `index.html` in de browser, of start een lokale server:

```bash
cd tattoo-heaven
python3 -m http.server 8000
# open http://localhost:8000
```

## Ontwerpkeuzes

- **Merk-look behouden, maar veel strakker**: zwart canvas + goud accent (zoals het
  logo), maar met veel meer rust, ruimte en een frisse, toegankelijke uitstraling.
- **Meteen duidelijk welke stijlen**: grote "Stijlen"-sectie met een specialist per
  stijl — precies het kernpunt uit de briefing.
- **Animaties** (in de geest van de Framer-voorbeelden): zachte scroll-reveals,
  meelopende marquees, een groot outlined "Hygiënisch · Vakkundig · Toegankelijk"
  statement (zoals de bestaande "HYGIËNISCH"-animatie), tellers en subtiele parallax.
  Alles respecteert `prefers-reduced-motion`.
- **Makkelijk contact**: prominente CTA's, WhatsApp-knop én een uitgebreid formulier.
- **Uitgebreid contactformulier** met (optioneel): stijl, artiest-voorkeur, grootte,
  plaatsing en budget (niet verplicht) — conform de wens.

## ⚠️ Nog invullen / bevestigen vóór livegang

Zoek in de code op `PLACEHOLDER` — alle punten staan met een comment gemarkeerd.

- [ ] **Exact adres**: straatnaam + postcode (nu "Straatnaam 102, Haarlem"). Pand-nr. 102
      komt van de gevelfoto; graag de volledige straat/postcode aanleveren.
- [ ] **E-mailadres** (nu `info@tattoo-heaven.nl` als aanname).
- [ ] **WhatsApp/telefoon**: nu `06 4219 2970` (van de gevel). Bevestigen a.u.b.
- [ ] **Social links**: echte Instagram-, TikTok- en Facebook-URL's.
- [ ] **Artiest-specialisaties**: namen kloppen (Danny, Djovanni, Ray Sebastian,
      Amalija, Bodil, Gian Luca, Claudia) — de stijl-labels per artiest zijn een
      aanname en moeten per persoon bevestigd worden.
- [ ] **Foto's**: alle beeldvlakken zijn placeholders. Vervang de `.hero-photo`,
      `.studio-photo`, `.artist-photo` en `.gallery-item` blokken door echte foto's
      (`<img>`), plus een `og-image.jpg` in `assets/` voor social sharing.
- [ ] **Reviews**: nu voorbeeldteksten — vervang door echte (Google-)reviews + score.
- [ ] **Info-pagina's**: link "Shop regels", "Nazorg", "Vergunning" en
      "Privacyverklaring" naar de bestaande/nieuwe pagina's.
- [ ] **Formulier-endpoint**: `action` staat op een Formspree-placeholder
      (`https://formspree.io/f/your-form-id`). Zet er een echt endpoint in (Formspree,
      een eigen backend, of de bestaande WordPress-form). Zodra dat er staat, verstuurt
      `main.js` netjes via fetch met een bedank-melding.
- [ ] **KvK / BTW** in de footer.
- [ ] **Domein-URL's** in `sitemap.xml`, `robots.txt` en de OG/canonical tags staan al
      op `https://tattoo-heaven.nl/`.

## SEO die al klaarstaat

- Semantische HTML, één `<h1>`, logische heading-structuur.
- Meta description, canonical, Open Graph + Twitter cards, `lang="nl"`.
- JSON-LD `TattooParlor` schema (adres, openingstijden, telefoon, sinds 2010).
- `robots.txt` + `sitemap.xml`.
- Snel: geen frameworks, fonts met `display=swap`, lichte inline SVG-assets.
