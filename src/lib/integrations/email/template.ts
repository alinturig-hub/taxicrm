/** Preview only. Templates are plain text: never interpret customer data as HTML. */
export type EmailTemplateDraft = { name: string; subject: string; body: string };
export const EMAIL_VARIABLES = ['customer_name', 'company_name', 'unsubscribe_url'] as const;
const variables = new Set<string>(EMAIL_VARIABLES);
export function validateEmailDraft(value: unknown): { ok: true; draft: EmailTemplateDraft } | { ok: false; error: string } {
 if (!value || typeof value !== 'object' || Array.isArray(value)) return {ok:false,error:'Invalid template.'};
 const v=value as Record<string,unknown>;
 if (Object.keys(v).sort().join(',') !== 'body,name,subject' || typeof v.name !== 'string' || typeof v.subject !== 'string' || typeof v.body !== 'string') return {ok:false,error:'Invalid template fields.'};
 const name=v.name.trim(), subject=v.subject.trim(), body=v.body.trim();
 if (!name || name.length>120 || !subject || subject.length>200 || /[\r\n]/.test(subject) || !body || body.length>20000) return {ok:false,error:'Check the name, subject and message length.'};
 for (const match of Array.from((subject+'\n'+body).matchAll(/\{\{([^{}]+)\}\}/g))) if (!variables.has(match[1])) return {ok:false,error:`Unknown variable: ${match[1]}`};
 if (/\{\{|\}\}/.test((subject+'\n'+body).replace(/\{\{[^{}]+\}\}/g,''))) return {ok:false,error:'Check the variable format.'};
 return {ok:true,draft:{name,subject,body}};
}
export function previewEmailText(text:string, values:Partial<Record<(typeof EMAIL_VARIABLES)[number],string>>):string {
 return text.replace(/\{\{([^{}]+)\}\}/g, (original,name:string) => variables.has(name) ? (values[name as (typeof EMAIL_VARIABLES)[number]] ?? original) : original);
}
