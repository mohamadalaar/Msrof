(function(root) {
  'use strict';
  const CURRENCIES = {
    TRY: {name:'ليرة تركية',short:'ل.ت',symbol:'₺'},
    USD: {name:'دولار أمريكي',short:'دولار',symbol:'$'},
    EUR: {name:'يورو',short:'يورو',symbol:'€'},
    SYP: {name:'ليرة سورية',short:'ل.س',symbol:'ل.س'}
  };
  const CATEGORIES = {
    income:['راتب','عمل إضافي','حوالة','هدية','مدخول آخر'],
    expense:['مشتريات البيت','إيجار وسكن','فواتير','مواصلات','صحة','تعليم','مطاعم وترفيه','مصروف آخر']
  };
  const freshState = () => ({version:1,entries:[],rates:{TRY:1,USD:null,EUR:null,SYP:null},ratesUpdatedAt:null,reports:{}});
  function parseNumber(value) {
    if(typeof value==='number') return value;
    if(typeof value!=='string') return NaN;
    let s=value.trim().replace(/[٠-٩]/g,x=>'٠١٢٣٤٥٦٧٨٩'.indexOf(x)).replace(/[۰-۹]/g,x=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(x)).replace(/٬/g,'').replace(/٫/g,'.').replace(/\s/g,'');
    if(!s) return NaN;
    if(/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s=s.replace(/,/g,'');
    else if(!s.includes('.') && (s.match(/,/g)||[]).length===1) s=s.replace(',','.');
    if(!/^\d+(\.\d+)?$/.test(s)) return NaN;
    return Number(s);
  }
  function validDate(value) {
    if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const d=new Date(value+'T12:00:00Z');
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10)===value && value>='1900-01-01' && value<='2100-12-31';
  }
  const validMonth = v => typeof v==='string' && /^(19\d{2}|20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(v);
  function bounds(month) {
    if(!validMonth(month)) throw new Error('شهر غير صالح');
    const [y,m]=month.split('-').map(Number);
    const next=new Date(Date.UTC(y,m,1)).toISOString().slice(0,10);
    return {start:month+'-01',end:next};
  }
  function monthEntries(entries,month) {
    const b=bounds(month);
    return entries.filter(e=>e.date>=b.start && e.date<b.end).sort((a,b)=>b.date.localeCompare(a.date)||String(b.createdAt).localeCompare(String(a.createdAt))||a.id.localeCompare(b.id));
  }
  function validateRates(input) {
    if(!input||typeof input!=='object') throw new Error('أسعار الصرف غير صالحة');
    const rates={TRY:1};
    for(const code of ['USD','EUR','SYP']) {
      const v=input[code];
      if(v===null||v===undefined||v==='') rates[code]=null;
      else if(typeof v==='number' && Number.isFinite(v) && v>0 && v<=1e9) rates[code]=v;
      else throw new Error('سعر صرف غير صالح');
    }
    return rates;
  }
  const isoTime = value => typeof value==='string' && value.length<=30 && Number.isFinite(Date.parse(value));
  function validateEntry(e) {
    if(!e || !['income','expense'].includes(e.type)) throw new Error('نوع حركة غير صالح');
    if(typeof e.id!=='string'||!/^[-\w]{1,100}$/.test(e.id)) throw new Error('معرّف الحركة غير صالح');
    if(!Object.hasOwn(CURRENCIES,e.currency) || (e.type==='expense' && e.currency==='EUR')) throw new Error('عملة الحركة غير صالحة');
    if(typeof e.amount!=='number'||!Number.isFinite(e.amount)||e.amount<=0||e.amount>1e12) throw new Error('مبلغ الحركة غير صالح');
    if(!validDate(e.date)) throw new Error('تاريخ الحركة غير صالح');
    if(!CATEGORIES[e.type].includes(e.category)) throw new Error('تصنيف الحركة غير صالح');
    if(typeof e.note!=='string'||e.note.length>160) throw new Error('ملاحظة الحركة غير صالحة');
    if(!isoTime(e.createdAt)||!isoTime(e.updatedAt)) throw new Error('وقت حفظ الحركة غير صالح');
    return {id:e.id,type:e.type,amount:e.amount,currency:e.currency,date:e.date,category:e.category,note:e.note,createdAt:e.createdAt,updatedAt:e.updatedAt};
  }
  function validateState(input) {
    if(!input||input.version!==1||!Array.isArray(input.entries)||input.entries.length>50000) throw new Error('ملف النسخة الاحتياطية غير صالح أو إصداره غير مدعوم');
    const rates=validateRates(input.rates),entries=input.entries.map(validateEntry);
    if(new Set(entries.map(e=>e.id)).size!==entries.length) throw new Error('يوجد تكرار في معرّفات الحركات');
    const reports={};
    if(input.reports && typeof input.reports==='object') {
      for(const [month,r] of Object.entries(input.reports)) {
        if(!validMonth(month)||!r||!Array.isArray(r.entries)||r.entries.length>50000||!isoTime(r.generatedAt)) throw new Error('تقرير محفوظ غير صالح');
        const rows=r.entries.map(validateEntry);
        if(rows.some(e=>!e.date.startsWith(month))) throw new Error('حركة خارج شهر التقرير');
        if(new Set(rows.map(e=>e.id)).size!==rows.length) throw new Error('تكرار في حركات التقرير');
        const reportRates=validateRates(r.rates);
        if(requiredRates(rows,reportRates).length) throw new Error('أسعار صرف التقرير المحفوظ غير مكتملة');
        reports[month]={generatedAt:r.generatedAt,entries:rows,rates:reportRates,fingerprint:typeof r.fingerprint==='string'?r.fingerprint:''};
      }
    }
    return {version:1,entries,rates,ratesUpdatedAt:isoTime(input.ratesUpdatedAt)?input.ratesUpdatedAt:null,reports};
  }
  function toTRY(entry,rates) {
    const rate=rates[entry.currency];
    return typeof rate==='number'&&rate>0?entry.amount*rate:null;
  }
  function aggregate(entries,rates) {
    const result={income:{count:0,original:{},try:0,usd:null,missing:[]},expense:{count:0,original:{},try:0,usd:null,missing:[]},netTRY:null,netUSD:null};
    for(const e of entries) {
      const s=result[e.type];s.count++;
      s.original[e.currency]=(s.original[e.currency]||0)+e.amount;
      const amount=toTRY(e,rates);
      if(amount===null) {if(!s.missing.includes(e.currency)) s.missing.push(e.currency);}
      else s.try+=amount;
    }
    for(const type of ['income','expense']) {
      const s=result[type];
      if(s.missing.length) s.try=null;
      s.usd=s.try!==null && rates.USD>0?s.try/rates.USD:null;
    }
    if(result.income.try!==null && result.expense.try!==null) result.netTRY=result.income.try-result.expense.try;
    if(result.netTRY!==null && rates.USD>0) result.netUSD=result.netTRY/rates.USD;
    return result;
  }
  function requiredRates(entries,rates,withUSD=true) {
    const codes=new Set(entries.map(e=>e.currency));
    if(withUSD) codes.add('USD');
    return [...codes].filter(c=>!rates[c]);
  }
  function fingerprint(entries,rates) {
    return JSON.stringify({entries:[...entries].sort((a,b)=>a.id.localeCompare(b.id)),rates});
  }
  function makeReport(entries,rates,month) {
    const rows=monthEntries(entries,month);
    const missing=requiredRates(rows,rates);
    if(missing.length) throw new Error('أضف سعر صرف '+missing.map(c=>CURRENCIES[c].name).join('، ')+' أولاً');
    return {generatedAt:new Date().toISOString(),entries:structuredClone(rows),rates:{...rates},fingerprint:fingerprint(rows,rates)};
  }
  const api={CURRENCIES,CATEGORIES,freshState,parseNumber,validDate,validMonth,bounds,monthEntries,validateRates,validateEntry,validateState,toTRY,aggregate,requiredRates,fingerprint,makeReport};
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
  else root.BaytCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
