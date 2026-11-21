/** Sparse, rolling date markers for the 14-day manga analytics chart.
 * Anchor to the newest day, so today's date is always shown. */
export function mangaChartDateTick(date:Date,index:number,totalDays:number):string {
  if(!Number.isInteger(index)||!Number.isInteger(totalDays)||totalDays<=0||
    index<0||index>=totalDays||(totalDays-1-index)%3!==0)return '';
  return date.toLocaleDateString('en-GB',{day:'numeric',month:'short'});
}
