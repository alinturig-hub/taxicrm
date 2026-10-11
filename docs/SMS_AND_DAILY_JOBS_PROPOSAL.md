# Propunere: SMS Gateway, notificări și verificări periodice

Status: propunere pentru revizuire, nu implementare sau migrare. Repository `alinturig-hub/taxicrm`, branch verificat `codex/hackney-development`, SHA `507b242669b678c16e2cfbb7c953e8e5b5c2f71f`. Nu s-a accesat admin.needacabplus.app, producția TaxiCRM sau integrările excluse. Nu s-au trimis SMS-uri.

## Ce există

Repository-ul nu conține configurare SMS, notificări sau o coadă de livrare. Există criptarea credențialelor integrărilor și administrare ADMIN/MANAGER, care pot fi reutilizate. Joburile din server.mjs folosesc timere și protecții per proces; acestea nu garantează reluarea după restart sau evitarea duplicatelor între replici.

Actualizare după captura furnizată: există acum un formular de previzualizare locală la `/dashboard/configuration/sms`, pentru ADMIN/MANAGER. Nu salvează configurația și nu trimite cereri. Presetul Orion este `https://orionconnect.co.uk/api/endpoint/webhook`, format POST_JSON, câmpuri customer_phone/message/sender. Expeditorul din previzualizarea TaxiCRM este TaxiCRM, modificabil; nu se copiază identitatea altei aplicații. URL-ul complet poate conține parametri semnați: sunt ascunși în input și excluși integral din preview. Nici criptarea lor în DB, nici păstrarea lor după o actualizare nu sunt pretinse ca implementate. După aprobarea schemei, endpointul public și secretul query vor fi salvate separat; menținerea aceluiași endpoint fără o nouă semnătură trebuie să păstreze secretul criptat existent.

Solicitarea de joburi a fost precizată ca monitorizarea unor numere freephone de pe care provin bookinguri. În schema/maparea bookingurilor există TelephoneNumber al clientului, dar nu un câmp dedicat identificat pentru numărul freephone apelat. Aceste numere nu se confundă. Pentru matching este necesar numele exact al câmpului din payloadul Autocab sau un exemplu anonimizat care îl demonstrează. Condiția de alertă, destinatarii și programarea rămân de confirmat; nu s-a activat vreo verificare zilnică.

## Modificarea de schemă propusă — necesită aprobare

| Model nou | Câmpuri principale și constrângeri |
| --- | --- |
| SmsGatewayConfiguration | id; provider; baseUrl; sender; credentialsEncrypted; isEnabled implicit false; lastTestedAt; lastError; createdAt; updatedAt. Providerul și structura credențialelor se stabilesc după confirmarea furnizorului. API-ul public al configurației întoarce numai existența credențialelor, niciodată secretul. |
| NotificationJob | id; name; checkType dintr-o listă de verificări implementate; checkConfiguration JSON validat; channel; destination; scheduleMode; intervalHours sau localTime; timeZone Europe/London; nextRunAt; leaseUntil; isEnabled implicit false; createdAt; updatedAt. Index pe isEnabled/nextRunAt. Nu permite cod arbitrar de executat. |
| NotificationJobRun | id; jobId; scheduledFor; status; startedAt; finishedAt; result JSON; error. Cheie unică jobId + scheduledFor, pentru aceeași execuție logică. |
| NotificationDelivery | id; jobRunId; eventType; channel; destination; message; status; attemptCount; nextAttemptAt; leaseUntil; providerMessageId; lastError; createdAt; sentAt. Cheie unică jobRunId + eventType + channel + destination; index pe status/nextAttemptAt. Păstrează mesajul planificat și rezultatul livrării pentru revizuire. |

Configurația gateway-ului este stocată în TaxiCRM DB cu secretul criptat prin mecanismul existent. Nu se salvează parole în magazinul generic ApiEndpointRecord sau în loguri. Modificările de schemă, migrarea și adaptarea UI/API nu au fost implementate înainte de aprobare.

## Flux propus

1. Administratorul configurează providerul și expeditorul; implicit gateway-ul este dezactivat. Testele locale folosesc adapter sintetic fără rețea. Un test real prin SMS este o acțiune distinctă, cu destinatar confirmat.
2. Administratorul alege verificarea, condiția de notificare și destinatarul. Preview arată rezultatul verificării și mesajul înainte de activare. Verificările nu trimit automat SMS-uri către clienți.
3. Workerul selectează joburile scadente în loturi, revendică execuția prin lease și salvează JobRun. Restartul nu pierde programarea. Instanțele concurente nu revendică aceeași execuție logică.
4. Rezultatul și mesajul de notificare sunt persistate înainte de trimitere. Livrarea are retry și identificator stabil; confirmarea și erorile sunt vizibile în istoric. Dacă providerul nu oferă idempotency sau verificarea mesajului prin ID, un timeout ambiguu după acceptarea SMS-ului nu se reîncearcă orbește: se marchează pentru reconciliere. Nu se promite exact-once fără suportul providerului.
5. În mediul izolat, mesajele sunt doar simulate. Activarea pe producție, joburile reale și SMS-urile reale necesită autorizare distinctă.

## Decizii necesare

- Ce se verifică efectiv și când se notifică: fiecare execuție, numai eșecuri sau o condiție specifică? Nu se presupune că toate joburile de enrichment/backfill trebuie pornite zilnic.
- Destinatarul și canalul pentru notificările administrative.
- Interval de exact 24 de ore sau aceeași oră zilnică Europe/London? Sunt comportamente diferite la DST: o zi locală poate avea 23/25 de ore. Execuțiile se stochează ca momente UTC, iar orele de business se afișează Europe/London.
- Providerul SMS, câmpurile publice ale formularului de referință și documentația API, fără chei/parole în conversație. Linkul indicat nu oferă dovada structurii configurației fără acces la aplicație.
- Aprobarea celor patru modele înainte de implementare. Aprobarea schemei pentru dezvoltare nu este aprobare pentru migrare în producție sau trimiterea de SMS-uri.

## Teste planificate după aprobare

Salvare și mascarea credențialelor; autorizare; previzualizare fără livrare; interval 24h și schimbări DST; două instanțe revendicând aceeași execuție; restart/lease expirat; notificare duplicată; retry/backoff; timeout ambiguu; istoric vizibil. Exclusiv date și provider sintetice în această etapă.

## Editor freephone precizat de utilizator

Freephone-ul se configurează prin nume, nu număr: exemplul furnizat este Derriford Hospital Freephone. Editorul local de pe aceeași pagină SMS este compact, cu trei reguli expandabile: raport zilnic, niciun booking în 24h și bookinguri sub un prag explicit. Toate trei sunt prezente în draft. Fiecare are text propriu și destinatar opțional; dacă lipsește, se moștenește destinatarul general. Pragul nu este presupus, ci trebuie completat înainte de previzualizare.

Configurația propusă a NotificationJob.checkConfiguration va păstra numele freephone, identificatorul sursei confirmate din Autocab, destinatarul general și lista de reguli cu eveniment, activare, text, destinatar specific și prag. Fiecare eveniment potrivit produce o livrare distinctă: de exemplu zero bookinguri poate declanșa atât raportul, cât și alerta de zero și alerta sub prag. De aceea Delivery are eventType în cheia de deduplicare. Nu se presupune o regulă de suprimare între evenimente.

Previzualizarea folosește exclusiv un număr de bookinguri introdus pentru simulare. Funcția de numărare este testată numai pe observații sintetice cu sursă explicită și folosește intervalul (now-24h, now], evitând suprapunerea la limită. Pentru o verificare reală trebuie validat câmpul de sursă din Autocab; bookingurile fără sursă sau dată sunt raportate separat și nu constituie dovadă sigură pentru o alertă de zero. Momentul verificării se afișează Europe/London; nu se interpretează o zi DST ca 24h.

Nu s-a implementat persistența editorului, workerul programat sau livrarea reală. Aprobarea de schemă solicitată rămâne neconfirmată. Captura SMS oferă endpointul public Orion și numele parametrilor; nu dovedește că avem acces la URL-ul semnat din administrarea externă. Nu există o sesiune autentificată disponibilă pentru preluarea acestuia.

Ulterior, utilizatorul a furnizat direct endpointul semnat Orion. Acesta a fost pregătit ca draft criptat în afara repository-ului, în mediul izolat, cu permisiuni 0600; nu s-a apelat providerul și nu s-a accesat administrarea externă. Runtime-ul local poate precompleta formularul prin SMS_GATEWAY_DRAFT_FILE. Pagina primește numai endpointul public și indicatorul că parametrii semnați există, niciodată secretul sau ciphertextul. Livrarea rămâne dezactivată; draftul local nu înlocuiește schema DB sau implementarea joburilor. În JSON trimis eventual către provider, customer_phone este destinatarul, message este textul, iar {{message}} este șablonul configurat în Orion. URL-ul semnat și valorile lui nu sunt incluse în documentație, repository sau loguri.
