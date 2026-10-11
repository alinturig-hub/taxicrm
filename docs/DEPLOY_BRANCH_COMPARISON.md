# Comparație pentru deploy TaxiCRM

Verificare: 11 octombrie 2026. Numai repository și configurația Coolify; fără acces la baza reală, merge, push sau deploy.

## Referințe verificate

- Branch local: `codex/taxicrm`; HEAD `507b242669b678c16e2cfbb7c953e8e5b5c2f71f`, cu modificări locale nepublicate.
- Branch configurat în Coolify: `wip-revenue-customers-20260812`; vârf GitHub `8ae9d4224bca66ec956a44526e9e4b6c6e6bdf9b`.
- `git merge-base` este exact vârful branch-ului configurat. Numărul commiturilor exclusive: local 6, branch configurat 0. Nu există commituri ale acestui branch omise din istoricul local.
- Configurația Coolify raportează `git_commit_sha=HEAD`. Istoricul deployurilor confirmă ultimul deploy reușit `fml4vfcirtvnns1s2k8sktvu`, commit `8ae9d4224bca66ec956a44526e9e4b6c6e6bdf9b`, finalizat la 9 octombrie 2026, 00:03:51 Europe/London. Acesta coincide cu vârful branch-ului comparat.

## Cele șase commituri suplimentare ale bazei locale

1. `49d15fa`: Add temporary read-only fleet export.
2. `1a002ef`: Merge remote-tracking branch 'origin/main'.
3. `c34f7f9`: Match account revenue rules by Autocab account ID.
4. `4fb44ea`: Redesign webhook configuration dashboard.
5. `d2e5ef6`: Merge production features with main.
6. `507b242`: Add Hackney Carriage analytics to executive dashboard.

Diferența netă între commiturile comparate este de 7 fișiere. Include dashboardul webhookurilor, regulile financiare, analytics Hackney și migrarea descrisă mai jos. Commiturile de merge sunt istorice; nu s-a executat merge în această verificare.

## Modificări locale propuse

Hackney Driver Performance; procesare webhook cu duplicate/retry/ordine diferită; fare separat de price și tratarea valorilor lipsă; recalculare paginată a tagurilor clienților; preview pentru îmbogățirea Places și cache; preview/salvare pentru datele API; corecții weather și scheduler; previzualizare SMS/freephone. SMS și joburile noi nu reprezintă livrare SMS sau worker activ.

## Blocaje înainte de deploy

- Modificările locale nu au încă un commit și nu există branch remote `codex/taxicrm` la momentul comparației.
- Blocaj Docker rezolvat: etapa de build primește o adresă fictivă `build_only` pe loopback, port 1, doar pentru inițializarea Prisma la compilare. Nu intră în configurația de runtime și nu necesită baza reală. Imaginea `taxicrm:codex-development` s-a construit cu succes, ID `sha256:cc3667a11d5ae68837792e1df4b05c1317de618efb2e0a4c044ac11445ee025d`.
- Baza locală include deja `20261006002000_account_revenue_rule_by_account_id`, absentă din branch-ul configurat. Aceasta elimină indexul unic `(provider, accountCode)` și creează indexul unic `(provider, accountId)`. Nu este o migrare nouă creată în această sesiune și nu a fost aplicată în producție de agent.
- Confirmat prin rezultatul read-only furnizat de utilizator la 11 octombrie 2026: migrarea `20261006002000_account_revenue_rule_by_account_id` are `finished_at=2026-10-06 11:49:48.676036+00`, fără `rolled_back_at`; indexul unic `AccountRevenueRule_provider_accountId_key` este pe `(provider, accountId)`; numărul grupurilor duplicate este 0. Această migrare nu trebuie aplicată pentru deploy. Interogările s-au încheiat cu `ROLLBACK`. Agentul nu a aplicat migrări sau modificări în baza reală.
- Logurile ultimului deploy reușit nu menționează migrarea financiară, însă verificarea SQL furnizată de utilizator confirmă aplicarea ei separat. Utilizatorul a aprobat verificarea strict read-only; nu a autorizat modificări ale schemei. Accesul direct al agentului la PostgreSQL rămâne indisponibil tehnic.

Coolify folosește Dockerfile `/Dockerfile`; comenzile pre/post deployment sunt nule la verificare. Aceste valori nu dovedesc schema bazei reale și nu autorizează migrări.

Validare disponibilă: 32 teste unitare și 18 teste de integrare au trecut în mediul izolat, cu date sintetice. Cele 18 teste de integrare au trecut din nou la această verificare. Buildul Docker a trecut; imaginea a pornit cu baza izolată, `/api/health` a confirmat HTTP 200 și baza conectată, iar `/login` a returnat HTTP 200. Containerul de smoke test a fost eliminat după verificare. `CRON_SECRET` este absent și backfillul istoric este dezactivat în acest test. Imaginea nu include configurația SMS locală criptată.
