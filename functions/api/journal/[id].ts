import {journalRequest} from '../../_lib/journal';
type Context=Parameters<typeof journalRequest>[0]&{params:{id:string|string[]}};
export function onRequest(context:Context){return journalRequest(context,typeof context.params.id==='string'?context.params.id:'');}
