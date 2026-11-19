/** Generates original, abstract page illustrations in memory. No URLs, fetches or uploaded assets. */
const colours = [
  ['#161a2f', '#f4dfb9', '#c88b64'],
  ['#192f34', '#d8ead8', '#9cc5a6'],
  ['#2b2035', '#f0dbe8', '#b79acc'],
] as const;
function hash(value: string) {
  let h = 2166136261;
  for (const char of value) h = Math.imul(h ^ char.charCodeAt(0), 16777619);
  return h >>> 0;
}
export function makeFixturePage(chapterId: string, pageIndex: number): string {
  if (typeof document === 'undefined') throw new Error('Browser canvas unavailable');
  if (!Number.isSafeInteger(pageIndex) || pageIndex < 0 || pageIndex > 1000)
    throw new Error('Invalid synthetic page index');
  const canvas = document.createElement('canvas');
  canvas.width = 680; canvas.height = 920;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to create synthetic image');
  const trialChapters = ['ch_trialawakening', 'ch_trialcrossroad', 'ch_trialskybridge', 'ch_trialstarlight', 'ch_trialnewdawn'];
  const trialChapterNumber = trialChapters.indexOf(chapterId) + 1;
  const palette = colours[hash(chapterId) % colours.length]!;
  const [ink, paper, accent] = palette;
  ctx.fillStyle = paper; ctx.fillRect(0, 0, 680, 920);
  ctx.strokeStyle = ink; ctx.lineWidth = 8;
  const seed = hash(chapterId + String(pageIndex));
  const rects = pageIndex % 2 === 0
    ? [[37,50,606,340], [37,414,295,450], [352,414,291,450]]
    : [[37,50,295,390], [352,50,291,390], [37,460,606,405]];
  rects.forEach(([x,y,w,h], i) => {
    const px = x!, py = y!, pw = w!, ph = h!;
    ctx.save();
    ctx.beginPath();ctx.rect(px,py,pw,ph);ctx.clip();
    ctx.fillStyle = i === 1 ? accent : paper;
    ctx.globalAlpha = i === 1 ? 0.32 : 1;
    ctx.fillRect(px,py,pw,ph);ctx.globalAlpha = 1;
    ctx.strokeStyle = ink;ctx.lineWidth = 2.2;
    for(let j=0;j<15;j++){
      const variation = ((seed >>> (j % 20)) & 31);
      ctx.beginPath();ctx.moveTo(px - 40 + j * 65,py);
      ctx.lineTo(px + j * 35 + variation, py+ph);ctx.stroke();
    }
    ctx.beginPath();ctx.arc(px+pw*(0.47+0.07*i),py+ph*(0.46+0.04*i),Math.min(pw,ph)*0.25,0,Math.PI*2);
    ctx.fillStyle=ink;ctx.fill();
    ctx.beginPath();ctx.arc(px+pw*0.51,py+ph*0.42,Math.min(pw,ph)*0.19,0,Math.PI*2);
    ctx.fillStyle=paper;ctx.fill();
    ctx.lineWidth=8;ctx.strokeStyle=ink;ctx.strokeRect(px,py,pw,ph);
    ctx.restore();
  });
  ctx.fillStyle = ink;
  ctx.font = 'bold 17px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(trialChapterNumber
    ? 'SCROLL TRIAL / CHAPTER ' + String(trialChapterNumber).padStart(2, '0') + ' / 05'
    : 'ORIGINAL / SYNTHETIC PAGE', 340, 30);
  ctx.font='14px sans-serif';
  ctx.fillText((trialChapterNumber ? 'CH ' + trialChapterNumber + '  /  ' : 'TAIYOU DEMO  /  ') +
    'PAGE ' + String(pageIndex+1).padStart(2,'0'),340,897);
  return canvas.toDataURL('image/png');
}
