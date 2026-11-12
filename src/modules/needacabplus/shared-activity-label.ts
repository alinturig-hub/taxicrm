export function activityLabel(value:Date|null):string {
 return value ? new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',dateStyle:'medium',timeStyle:'short'}).format(value)+' · London' : 'No record available';
}
