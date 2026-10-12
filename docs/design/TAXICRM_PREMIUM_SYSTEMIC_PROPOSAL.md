# TaxiCRM — propunere de design premium și structură sistemică

Data analizei: 12 octombrie 2026. Propunere pentru review; nu modifică aplicația live. Prototipul HTML folosește exclusiv date sintetice.

## Concluzia

Recomand o interfață de lucru deschisă, ivory, cu navigație graphite, acțiuni petrol și accent champagne discret. Varianta dark păstrează aceeași ierarhie. Simplificarea trebuie făcută prin organizarea activității: ce necesită atenție, cine răspunde, ce acțiune urmează și ce rezultat verificăm.

Prototip: `taxicrm-premium-proposal.html`. Permite schimbarea temei și explorarea secțiunilor. Elementele de responsabilitate/acțiune sunt o propunere de produs, nu funcționalități deja implementate.

## Ce am observat în repository

- Există șapte grupuri de navigație și 44 de fișiere de pagini dashboard. Nu toate sunt ecrane principale distincte.
- Workspace home și Business overview introduc două puncte de pornire, iar huburile adaugă frecvent încă un click până la activitate.
- Huburile folosesc carduri de minimum 208 px, descrieri ample și mult spațiu. Într-un CRM folosit zilnic, acest spațiu poate afișa activitate și următoarele acțiuni.
- Culorile sunt definite atât prin variabile CSS light/dark, cât și direct în componente: navy, slate, albastru, violet și gradiente. Schimbarea câtorva variabile nu uniformizează toate ecranele.
- Intelligence & AI amestecă analiza, performanța șoferilor, predicțiile și automatizările. Utilizatorul trebuie să cunoască implementarea pentru a găsi unele funcții.
- Autocab și Local sunt acum separate. Această separare trebuie păstrată, inclusiv între configurarea webhookurilor și evenimentele primite.
- Revenue rules, datele Europe/London și payloadurile Autocab sunt cerințe de business; un redesign nu trebuie să le modifice.

## CRM-uri comparate

Am consultat pagini oficiale publice. Nu am accesat conturi private și nu pretind un audit complet al produselor.

| Produs | Ce rezultă din prezentarea oficială | Adaptare pentru TaxiCRM |
|---|---|---|
| [Attio](https://attio.com/) | Date, relații, automatizări și reporting într-un CRM flexibil | Profil client unificat, relații client–booking–șofer–loc, liste cu filtre salvate |
| [Pipedrive](https://www.pipedrive.com/en/products) | Activity-based selling, pipeline și următoarele activități | Acțiune următoare vizibilă, responsabil și termen; pipeline pentru oportunități, nu pentru fiecare cursă |
| [HubSpot](https://www.hubspot.com/products/crm) | Bază CRM comună și zone distincte marketing, sales, service | Un singur profil client reutilizat de Operations și Marketing, fără dublarea identității |
| [Salesforce Sales Cloud](https://www.salesforce.com/sales/) | Context CRM, pipeline, automatizare și analiză | Separarea spațiului de lucru de administrare, vederi adaptate rolului; evitarea complexității de configurare inutile |

Nu recomand copierea unui CRM de vânzări: TaxiCRM are curse, șoferi, surse de booking, geografie și reguli financiare proprii.

## Paleta recomandată

| Rol | Culoare | Utilizare |
|---|---|---|
| Graphite | `#171C25` | Sidebar și elemente de identitate |
| Ivory | `#F7F6F2` | Fundal principal, lucru zilnic |
| White | `#FFFFFF` | Tabele, panouri și formulare |
| Petrol | `#0F766E` | Acțiunea principală și selecția activă |
| Champagne | `#B59A68` | Accent de brand; fără butoane sau texte mici pe alb |
| Text | `#202733` | Titluri și informația principală |
| Secondary | `#566171` | Etichete și explicații |
| Success | `#18794E` | Confirmat, finalizat |
| Warning | `#9A5B13` | Necesită atenție |
| Danger | `#B42336` | Eroare și acțiune distructivă |

Contrast calculat conform formulei WCAG: text/ivory 13,88:1; secondary/white 6,28:1; white/petrol 5,47:1; champagne/graphite 6,33:1. Champagne/white este numai 2,70:1 și nu se folosește pentru text normal. Aceste măsurători validează perechile de culori, nu certifică întreaga aplicație ca accesibilă.

Reguli vizuale: o singură acțiune principală pe panou; roșu rezervat riscului/ștergerii; statusurile includ text și icon, nu doar culoare. Titluri 24–30 px, corp 14–16 px, label 12–13 px; numerale tabulare. Raze de 8–12 px, borduri fine, umbre discrete, fără glow și gradiente decorative peste tot. Tabelele au rânduri de 44–48 px pe desktop, cu controale accesibile pe mobil.

## Structura propusă

Cinci intrări de lucru, două intrări administrative în partea de jos:

1. **Astăzi** — o singură pagină de start: excepții, activitate și următoarele acțiuni. Conținutul diferă după rol.
2. **Operațiuni** — Live, Bookings, Drivers, Fleet, Zones. Hartă + listă; filtre salvate și panou de detaliu.
3. **Clienți** — o singură listă cu filtru Account/Individual; profil cu istoric, venituri verificate, taguri, locuri și dovezi pentru predicții.
4. **Marketing** — segmente și oportunități existente; activități/campanii ca etapă ulterioară. Nu afișăm „Send campaign” până când funcția există.
5. **Performanță** — Business overview, Executive intelligence, Hackney, rapoarte și predicții. AI este o acțiune contextuală, fără încă o taxonomie tehnică în meniul principal.
6. **Integrări** — Autocab și Local; în interior: Conexiune, Date, Webhooks/Evenimente, Sincronizări. Ecranele administrative și istoricul de procesare rămân distincte.
7. **Configurare** — reguli financiare, comunicare/SMS, places, calendar, utilizatori/roluri, sănătate și automatizări.

Migrarea structurii trebuie să păstreze rutele existente și permisiunile, cu redirecționări dacă se schimbă destinațiile. Ascunderea unui link nu înlocuiește controlul permisiunilor pe server.

## Adaptarea abordării lui Alain Cardon

Surse consultate: [Systemic organization coaching](https://www.metasysteme-coaching.eu/english/systemic-organization-coaching/) și [case study and methodology](https://www.metasysteme-coaching.eu/english/systemic-organizational-coaching-a-case-study-and-methodology/). Acestea discută cooperarea transversală, responsabilitatea, decizia colectivă, delegarea, urmărirea acțiunilor și măsurarea rezultatelor.

Traducerea de mai jos în funcționalități CRM este propunerea noastră; nu este o metodă de software atribuită lui Cardon și nu implică o afiliere.

**Semnal → responsabil → acțiune → rezultat → feedback.**

Exemplu: o linie freephone nu are bookinguri în fereastra configurată. Sistemul arată intervalul și calitatea datelor, fără a afirma că telefonul este defect. Persoana responsabilă verifică linia/feedul; acțiunea primește un termen; rezultatul și revenirea bookingurilor sunt verificate. SMS-ul este un canal al procesului, nu dovada rezolvării.

Alt exemplu: un segment de clienți devine mai puțin activ. Vedem perioada, tagurile și dovezile disponibile; o persoană decide acțiunea; ulterior comparăm rezultatul cu o bază relevantă. O predicție nu devine automat o constatare sau un diagnostic despre client.

Pagina Astăzi trebuie să răspundă: ce se întâmplă, ce decidem, cine face, până când și cum verificăm rezultatul. Owner nu este același lucru cu șoferul asociat unui booking. Șoferii continuă să fie asociați după regulile de badge existente.

## Ce există și ce trebuie dezvoltat

| Element | Situație |
|---|---|
| Bookings, șoferi, flota, clienți, taguri, places, predicții | Există; se reorganizează prezentarea |
| Autocab/Local, API records, webhook configuration/events | Există; se păstrează separarea și limitele actuale |
| Gateway SMS și monitorizarea freephone | Există; nu trimitem mesaje în acest audit |
| Tokenuri vizuale și navigație simplificată | Se pot implementa fără schemă nouă |
| Responsabil, termen, status de rezolvare pentru un incident/activitate | Necesită model de lucru persistent și aprobare de schemă înainte de implementare |
| Campanii, măsurarea conversiei și calendar de activități | Propunere ulterioară, nu capacitate live actuală |
| Conexiune reală la un sistem Local | Așteaptă protocolul și endpointul; importul JSON există |

## Ordinea recomandată

1. Validăm direcția pe prototip: culori, densitate și navigație.
2. Implementăm tokenurile comune și shellul, apoi Astăzi/Operations și profilul client. Nu înlocuim culorile prin search-and-replace global.
3. Păstrăm identitatea rutelor/API-urilor și verificăm rolurile, formularele, harta, stările goale, erorile și mobilul.
4. Proiectăm activități/incidente cu owner, termen și feedback; cerem aprobarea schimbării de schemă pe un plan concret.
5. Dezvoltăm marketingul și conexiunea Local după contractele de date reale.

Prototipul nu contactează API-uri, nu accesează producția și nu salvează date în CRM. Valorile de business din el sunt fictive. Analiza actuală nu activează OpenClaw, importul Need A Cab, SMS sau joburi.

## Verificarea prototipului

Chromium, 1440×1000 și 390×844: cele șapte secțiuni, selecția activă, dialogul de dovezi, comutarea light/dark, meniul mobil și închiderea cu Escape au trecut. Nu au existat erori JavaScript sau overflow orizontal la 390 px. Cererile externe au fost blocate în timpul testului. Capturile light, dark și mobile sunt în `/workspace/taxicrm-local/design-research/`; raportul și HTML-ul sunt păstrate în repository. Nu am rulat buildul aplicației pentru această propunere separată de runtime și nu am făcut deploy.
