import {journalImportRequest} from '../../../_lib/journal';
type Context=Parameters<typeof journalImportRequest>[0]&{params:{action:string|string[]}};
export function onRequest(context:Context){return journalImportRequest(context,typeof context.params.action==='string'?context.params.action:'');}
