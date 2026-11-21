import {describe,expect,it} from 'vitest';
import {mangaChartDateTick} from './analyticsChartDates';

function labels(today:Date):string[]{
  return Array.from({length:14},(_,index)=>{
    const day=new Date(today);
    day.setHours(12,0,0,0);
    day.setDate(day.getDate()-(13-index));
    return mangaChartDateTick(day,index,14);
  }).filter(Boolean);
}
describe('rolling analytics chart date labels',()=>{
  it('labels five dates, every three days from the most recent day',()=>{
    expect(labels(new Date(2026,10,21,12))).toEqual([
      '8 Nov','11 Nov','14 Nov','17 Nov','21 Nov'
    ]);
  });
  it('rolls across months, including the current date',()=>{
    expect(labels(new Date(2026,2,2,12))).toEqual([
      '18 Feb','21 Feb','24 Feb','27 Feb','2 Mar'
    ]);
  });
  it('rolls across years without hard-coded dates',()=>{
    expect(labels(new Date(2027,0,1,12))).toEqual([
      '20 Dec','23 Dec','26 Dec','29 Dec','1 Jan'
    ]);
  });
  it('never labels an invalid position',()=>{
    expect(mangaChartDateTick(new Date(2026,10,21),-1,14)).toBe('');
    expect(mangaChartDateTick(new Date(2026,10,21),14,14)).toBe('');
    expect(mangaChartDateTick(new Date(2026,10,21),1,14)).toBe('21 Nov');
  });
});
