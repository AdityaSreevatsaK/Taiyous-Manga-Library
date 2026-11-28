import {journalBackupRequest} from '../../../_lib/journal';
type Context=Parameters<typeof journalBackupRequest>[0]&{params:{action:string|string[]}};
export function onRequest(context:Context){return journalBackupRequest(context,typeof context.params.action==='string'?context.params.action:'');}
