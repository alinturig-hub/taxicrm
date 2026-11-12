'use client';
import {useState} from 'react';
import WebhookEventsMonitor from '@/components/integrations/WebhookEventsMonitor';
/** Load the existing monitor only when requested, on the same integration screen. */
export default function NeedACabPlusEvents(){
 const [open,setOpen]=useState(false);
 return <section className="integration-panel"><div className="integration-section-head"><div><h2>Integration events</h2><p>Inspect the events recorded by this installation.</p></div><button className="integration-button" type="button" aria-expanded={open} aria-controls="integration-events" onClick={()=>setOpen(value=>!value)}>{open?'Hide events':'Show events'}</button></div>{open&&<div id="integration-events" className="px-6 pb-6"><WebhookEventsMonitor embedded/></div>}</section>;
}
