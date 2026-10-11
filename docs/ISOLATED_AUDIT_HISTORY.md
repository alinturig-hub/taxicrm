# TaxiCRM — istoric și audit izolat

Documentul atașat de utilizator este context istoric, nu autorizare pentru operațiuni în producție. Auditul pornește de pe `codex/hackney-development`, SHA `507b242669b678c16e2cfbb7c953e8e5b5c2f71f`. Nu s-au executat push, merge, deploy, migrări reale, backfill sau acces la integrările excluse.

## Constatări și remedieri

- Hackney Driver Performance asociază bookingurile cu registrul șoferilor după badge, păstrând zerourile inițiale. Perioadele calendaristice folosesc Europe/London, inclusiv schimbările DST. Badge-urile lipsă, necunoscute sau ambigue și tarifele lipsă sunt explicite.
- Procesarea webhookurilor este tranzacțională, cu blocare pe entitate, audit atomic și retry pentru evenimente contextuale sosite înaintea bookingului. Payloadurile originale rămân păstrate. Testele verifică duplicatele, rollback, concurența și evenimentele întârziate.
- Regulile financiare erau indexate incompatibil între încărcare și consum. Cheia comună este acum provider + accountId, independentă de accountCode. Conturile neconfigurate nu primesc un tarif presupus în interfață. Nu s-au modificat formulele financiare sau schema.
- Afișarea bookingurilor: lista principală și istoricul clientului au acum coloane separate Fare și Price. API-ul profilului selectează și fare. Lipsa unei valori este „Not available”, distinctă de zero explicit. Workspace Pricing afișa deja Fare separat. Nu se substituie fare cu price, cost sau estimări și nu se schimbă totalurile financiare. Testele sintetice verifică Fare la creare, păstrarea lui la actualizări parțiale și transmiterea în istoricul clientului pentru bookinguri completed/cancelled/no-fare/dispatched. Această verificare de cod nu este un audit al tuturor bookingurilor din baza reală și nu execută recuperarea datelor istorice.
- `Integration > Webhook` (`/dashboard/integrations/autocab/webhooks`) și `Configuration > Webhooks` (`/dashboard/configuration/webhooks`) sunt pagini server distincte. Prima nu specifica fusul orar la afișare; acum folosește Europe/London. Commitul istoric de redesign al Configuration nu demonstrează remedierea Integration. Un răspuns HTML local corect nu exclude o problemă de hidratare în browserul utilizatorului.
- Weather cerea ziua curentă din arhiva Open-Meteo. Acum folosește limita end_date comunicată explicit de furnizor, cu maximum o reîncercare; intervalele integral indisponibile nu generează observații inventate. Validează datele reale și ordinea lor și limitează durata cererii. Limita istorică 2026-10-08 nu este hardcodată ca politică de disponibilitate.
- Schedulerul accepta HTTP 200 cu success:false și putea repeta aceleași batchuri eșuate până la plafonul de 300. Acum oprește acel drenaj. Nu raportează finalizare când lipsește CRON_SECRET. Snapshoturile verifică eligibilitatea înainte de a încărca weather și transmit data jobului către refresh.

## Memorie și suprapuneri: ipoteze încă deschise

`server.mjs` rulează Next, WebSocket și joburile în același proces. Protecțiile running sunt per job/per proces: nu serializează joburi diferite și nu coordonează invocări externe sau replici. Scripturile run-* din repository selectează containere etichetate production; au fost doar citite, niciodată executate. Prezența lor nu dovedește instalarea unui cron.

Snapshoturile pot încărca toate bookingurile și locațiile pentru 50 de clienți simultan și toate observațiile weather. Predicțiile citesc istoricul complet al unui client. Forecastul încarcă toate cererile de la un start fix (2026-08-04T23:00:00Z), deci volumul crește în timp. Un interval weather istoric mare poate genera un răspuns mare. Numărul de batchuri limitează execuția, nu memoria fiecărui batch. Acestea sunt riscuri concrete; nu dovedesc cauza incidentului OOM. Nu s-a introdus trunchiere arbitrară a istoricului sau dezactivare de joburi. Optimizarea necesită măsurarea volumelor și verificarea echivalenței rezultatelor.

## Dovezi necesare pentru reconcilierea cu producția

Furnizate de utilizator, fără secrete sau payloaduri reale:

1. Commitul buildului, digestul imaginii și hashul server.mjs din artefactul executat, plus informații despre eventualele bind mounts. Compararea unui checkout de pe host cu alt fișier din container nu identifică singură artefactul activ.
2. Pentru fiecare rută Webhooks separat: URL, momentul incidentului, stackul browserului, fișierele/chunkurile implicate și codurile HTTP, corelate cu buildul. Nu se atribuie excepția client OOM-ului fără aceste dovezi.
3. Cron/timere instalate, numărul de replici și intervalele start/end ale fiecărui job; RSS/heap înainte și după batch, heap profile anonim, logul fatal V8, exit code și contoarele cgroup OOM. Acestea disting limita heapului V8 de uciderea containerului pentru memorie.
4. Inventarul migrațiilor aplicate și schema pentru minutele gratuite de așteptare. Istoricul menționează `20261009060500_add_account_free_waiting_minutes`; această migrare/câmp nu există în schema checkoutului auditat. Implementarea parității necesită propunere și aprobare explicită înainte de orice schimbare de schemă. Nu se presupun minute gratuite sau tarife CMAC.
5. Mesajul sanitizat al furnizorului weather cu limita acceptată la momentul apelului. Disponibilitatea reală nu se deduce dintr-un log istoric.

Corecțiile și verificările independente folosesc numai baza locală loopback și date sintetice. Nu s-a accesat producția pentru a obține aceste dovezi.
