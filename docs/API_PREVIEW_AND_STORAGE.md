# API Endpoints: vizualizare și stocare în TaxiCRM

Implementare locală pe `codex/hackney-development`, SHA inițial verificat `507b242669b678c16e2cfbb7c953e8e5b5c2f71f`. Folosește modelele existente ApiEndpointConfiguration și ApiEndpointRecord, fără migrare. Nu s-a accesat Autocab real sau producția și nu s-a făcut deploy.

## Fluxul pentru API-uri noi

1. În ecranul API Endpoints, Try API vizualizează răspunsul JSON original. Această etapă nu creează configurații sau înregistrări în DB. Adapterul curent este Autocab GET, cu autentificarea existentă; alte servicii/metode necesită propriul adapter, nu primesc automat credențialele Autocab. Apelul verifică exact origin-ul configurat, refuză redirect-uri și are timeout.
2. Store Records este bifat implicit. Save API & Data salvează configurația și înregistrările în aceeași tranzacție. Salvarea folosește răspunsul previzualizat, nu execută încă un apel la furnizor. Previzualizarea este semnată și expiră după 15 minute; modificarea URL-ului, parametrilor sau datelor necesită o nouă previzualizare. Metadatele status/timp ale apelului sunt păstrate.
3. Pentru o listă de obiecte se alege cheia stabilă existentă în sursă, de exemplu id. Zero este o cheie validă; zerourile inițiale ale identificatorilor text sunt păstrate. Cheile lipsă sau duplicate opresc întreaga salvare, fără actualizări parțiale.
4. Dacă răspunsul nu este o listă sau nu are chei stabile, Record Key poate rămâne gol: se stochează întregul JSON ca răspuns, sub cheia internă `$response`. Aceasta nu este un ID inventat pentru o entitate de business. Se acceptă obiecte, liste, valori simple și null.
5. View Saved Data arată răspunsul original și înregistrările persistate. Tabelul folosește câmpurile efective ale răspunsului, nu coloane fixe pentru capabilities. Datele sunt paginate câte 100; căutarea vizibilă filtrează pagina curentă. JSON-ul complet poate fi consultat separat.

## API-uri deja configurate, inclusiv Zones

View Saved Data este disponibil și pentru configurațiile Raw only. Din această pagină se poate vizualiza răspunsul deja păstrat și folosi Save Data in TaxiCRM cu Record Key ales explicit. Această acțiune folosește răspunsul salvat anterior și nu face apel extern. După salvare, Sync Now devine disponibil pentru URL-uri fără parametri nerezolvați și reutilizează același mecanism de stocare.

Filtrul ascuns active=true/companyId=1 din preview-ul Zones a fost eliminat: răspunsul original este păstrat integral, inclusiv alte companii și zone inactive. Răspunsurile vechi care au fost deja filtrate nu pot fi reconstruite din datele rămase; recuperarea completă cere o nouă previzualizare autorizată de la sursă. Nu s-au modificat automat configurațiile existente sau înregistrările reale.

## Utilizarea ulterioară în CRM

Datele sunt disponibile în DB, cu endpointId, externalId, data JSON originală, sourceVersion și lastSyncedAt. Același ID în două API-uri este separat prin endpointId. Repetarea salvării actualizează înregistrarea existentă, fără duplicate. Salvările pe același endpoint sunt serializate în tranzacție. Un răspuns parțial/paginat nu dezactivează automat înregistrările care lipsesc din acel răspuns; nu se presupune că orice API returnează un inventar complet.

Stocarea generică nu înlocuiește sincronizarea modelului Zone, regulile financiare sau modelele de predicție. Pentru folosirea ca feature CRM trebuie definită maparea și validată relația cu bookingurile. Schema curentă păstrează ultima valoare per înregistrare și ultimul răspuns complet; nu reprezintă un jurnal istoric al fiecărui apel. Un istoric de observații pentru antrenare/backtesting necesită o propunere separată și aprobarea schimbării de schemă înainte de implementare.

## Verificări

Teste cu zone sintetice pentru alte companii, inactive, ID zero, obiecte nested; chei lipsă/duplicate; salvare și repetare fără duplicate; păstrarea înregistrărilor la răspunsuri parțiale; JSON obiect/null/scalar; preview semnat, modificat sau expirat. Smoke autentificat local pentru vizualizarea și salvarea unui endpoint Raw only, salvarea unui preview semnat fără refetch, respingerea datelor schimbate și citirea paginată. Toate fixture-urile se șterg la final.
