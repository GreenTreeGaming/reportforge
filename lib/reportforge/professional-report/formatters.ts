export const money=(v:number|null)=>v===null||!Number.isFinite(v)?"Not available":new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(v);
export const compactMoney=(v:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",notation:"compact",maximumFractionDigits:1}).format(v);
export const pct=(v:number|null)=>v===null||!Number.isFinite(v)?"Not available":new Intl.NumberFormat("en-US",{style:"percent",maximumFractionDigits:1}).format(v);
export const signedPct=(v:number|null)=>v===null?"Not available":new Intl.NumberFormat("en-US",{style:"percent",maximumFractionDigits:1,signDisplay:"exceptZero"}).format(v);
export const signedMoney=(v:number)=>`${v>0?"+":v<0?"−":""}${money(Math.abs(v))}`;
export const monthLabel=(p:string)=>{const [y,m]=p.split("-").map(Number);return new Intl.DateTimeFormat("en-US",{month:"short",year:"numeric"}).format(new Date(y,m-1,1));};
export const dateLabel=(v:string)=>new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric"}).format(new Date(v));
export const human=(v:string)=>v.replaceAll("_"," ").replace(/\w/g,c=>c.toUpperCase());
