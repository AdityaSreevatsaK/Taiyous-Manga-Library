import {journalRequest} from '../../_lib/journal';
export function onRequest(context:Parameters<typeof journalRequest>[0]){return journalRequest(context);}
