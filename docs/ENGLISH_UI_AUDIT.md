# English application copy

Translated Romanian runtime copy in login, NextAuth credential labels, Autocab connection/webhook pages, webhook empty-state/details copy and refusal maps. Runtime configuration errors and remaining refusal-map comments were also translated. Refusal dates now display en-GB with Europe/London; existing business-date semantics remain unchanged.

Preserved customer-entered values, stored payloads, booking/status identifiers, bilingual AI input-recognition and safety patterns. OpenClaw integration code is unchanged. Romanian design reports and the offline concept prototype are documentation, not runtime application copy.

Verification: source scan found no remaining Romanian accented text outside the AI recognition/safety patterns under src; no ro-RO runtime locale remains. Production build passed. Synthetic Chromium smoke tests cover English login labels/placeholder, invalid credentials, Autocab/webhook copy, empty booking/driver refusal pages and mobile login. No real authentication account or booking data is used.
