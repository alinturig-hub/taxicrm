# Recalcularea tagurilor și completarea Places Intelligence

Implementare pregătită și verificată exclusiv în mediul izolat. Nu s-a executat procesarea bazei reale, deploy sau backfill. Branch: `codex/hackney-development`; SHA inițial verificat: `507b242669b678c16e2cfbb7c953e8e5b5c2f71f`.

## Ordinea procesării

1. Inventarierea pickup/destination și completarea Places Intelligence din cache sau furnizor, în loturi de maximum 100. Ruta existentă `/api/dashboard/integrations/geoapify/enrich` acceptă `scope: "ALL"`; nu filtrează după statusul bookingului. `dryRun: true` previzualizează lotul fără apeluri, rezervări de credite, job-run records sau scrieri. Raportează separat locațiile fără coordonate din scope-ul cerut. Acestea nu pot fi completate automat de mecanismul curent.
2. Clasificarea POI prin mecanismul existent `enrichFrequentPlaceCategories`. Identificarea unui loc și clasificarea POI sunt etape distincte; tagurile bazate pe categorii folosesc numai clasificări READY și nesensibile. Clasificarea poate necesita propriile credite și nu a fost executată cu API real.
3. Recalcularea tagurilor clienților, nu taguri noi pe booking. Ruta nouă `/api/dashboard/customers/tags/recalculate` necesită ADMIN/MANAGER activ, rulează numai tagurile și nu lansează Geoapify. Implicit este previzualizare. Exemplu de corp pentru revizuire: `{"limit":50,"dryRun":true,"now":"2026-10-11T12:00:00Z"}`. Pentru loturile următoare se transmite `afterId` egal cu `nextCursor` și se păstrează același `now`. Previzualizarea și aplicarea încep fiecare de la primul lot; cursorul previzualizării nu trebuie folosit pentru a începe aplicarea, altfel se sar clienți. Aplicarea cere explicit `dryRun:false` în cerere.

## Reguli păstrate

- Se parcurg toți clienții în scope all, inclusiv cei inactivi sau fără taguri. `hasMore` și `nextCursor` permit reluarea; loturile nu se bazează pe offset sau pe existența în continuare a rândului cursorului.
- Tagurile actuale folosesc fereastra existentă de 14 zile. Se selectează numai bookinguri al căror pickupDueTime, ori bookedAtTime dacă pickup lipsește, intră în interval. Bookingurile viitoare, foarte vechi sau nedatate nu sunt transformate în dovezi curente. Se păstrează pragurile și interpretarea orelor Europe/London din funcția existentă; nu se schimbă regula Advance Booker.
- Scrierile tagurilor sunt atomice pentru fiecare client. Repetarea lotului actualizează cheile unice existente; tagurile care nu mai îndeplinesc regulile sunt dezactivate. Clienții eșuați apar în failedCustomerIds și trebuie reîncercați; un cursor avansat nu este dovada că toți clienții au fost procesați cu succes.
- Se încarcă numai datele necesare regulilor, nu întregul profil sau toate bookingurile istorice. Nu se trunchiază arbitrar bookingurile din fereastra relevantă.
- Fare este afișat separat de Price în lista bookingurilor și în istoricul clientului. Un câmp lipsă nu se afișează ca zero și nu este completat cu cost sau estimare. Nu se schimbă formulele financiare, payloadurile Autocab originale sau schema.

## Cache, credite și limite

Locațiile sunt deduplicate după cheia existentă de coordonate la cinci zecimale. READY și NOT_FOUND sunt reutilizate fără lookup nou. Operațiile simultane pe aceeași cheie împart aceeași promisiune în interiorul unui proces, care este eliminată la finalizare sau eșec. Această protecție nu coordonează replici sau procese separate: o aplicare viitoare trebuie să folosească un singur worker până la implementarea unei protecții distribuite verificate. Nu se pretinde o garanție globală de zero credite suplimentare.

Un NOT_FOUND este rezultat cache-uit, nu un loc inventat. Coordonatele lipsă, creditele insuficiente, retry-urile amânate și eșecurile furnizorului pot lăsa bookinguri necompletate. Loturile de aplicare Geoapify păstrează protecțiile existente de buget și retry. Previzualizarea nu estimează exact costul total și nu rezolvă locațiile fără coordonate.

## Validare

Teste sintetice: câmpul Fare la creare și actualizări parțiale; istoricul clientului; previzualizarea și reluarea tagurilor; fereastra de 14 zile; dezactivarea tagurilor vechi; rollback la eroare; reutilizarea simultană READY/NOT_FOUND pentru pickup și destination fără credențiale sau fetch extern. Rutele de previzualizare sunt verificate prin autentificare locală cu utilizator sintetic. Baza locală este numai `127.0.0.1:5432/taxicrm`; fixture-urile sunt șterse la final.

Pentru a procesa efectiv toate bookingurile reale sunt necesare aprobarea explicită pentru producție/backfill și inventarul de coordonate, cache, credite și replici. Această etapă nu este autorizată de solicitările curente, care păstrează restricțiile anterioare.
