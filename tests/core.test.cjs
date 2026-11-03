const test=require('node:test');
const assert=require('node:assert/strict');
const C=require('../core.js');
const rates={TRY:1,USD:40,EUR:44,SYP:0.004};
const entry=(id,type,amount,currency,date='2026-11-03')=>({id,type,amount,currency,date,category:C.CATEGORIES[type][0],note:'',createdAt:'2026-11-03T12:00:00Z',updatedAt:'2026-11-03T12:00:00Z'});
test('calculates all four currencies through TRY and converts final totals to USD',()=>{
  const entries=[entry('a','income',100,'USD'),entry('b','income',100,'EUR'),entry('c','income',100000,'SYP'),entry('d','income',1200,'TRY'),entry('e','expense',50,'USD'),entry('f','expense',100000,'SYP'),entry('g','expense',300,'TRY')];
  const a=C.aggregate(entries,rates);
  assert.equal(a.income.try,10000);assert.equal(a.income.usd,250);
  assert.equal(a.expense.try,2700);assert.equal(a.expense.usd,67.5);
  assert.equal(a.netTRY,7300);assert.equal(a.netUSD,182.5);
  assert.deepEqual(a.income.original,{USD:100,EUR:100,SYP:100000,TRY:1200});
});
test('does not present partial totals when a used exchange rate is missing',()=>{
  const a=C.aggregate([entry('a','income',100,'TRY'),entry('b','income',20,'EUR'),entry('c','expense',10,'TRY')],{TRY:1,USD:40,EUR:null,SYP:null});
  assert.equal(a.income.try,null);assert.equal(a.income.usd,null);assert.equal(a.netTRY,null);assert.equal(a.expense.try,10);
  assert.deepEqual(a.income.missing,['EUR']);
});
test('TRY totals work without USD while dollar totals remain unavailable',()=>{
  const a=C.aggregate([entry('a','income',100,'TRY')],C.freshState().rates);
  assert.equal(a.netTRY,100);assert.equal(a.netUSD,null);
  assert.throws(()=>C.makeReport([entry('a','income',100,'TRY')],C.freshState().rates,'2026-11'),/سعر صرف/);
});
test('includes month start and end, excludes the next first day and previous month',()=>{
  const entries=['2026-10-31','2026-11-01','2026-11-30','2026-12-01'].map((d,i)=>entry('r'+i,'expense',10,'TRY',d));
  assert.deepEqual(C.monthEntries(entries,'2026-11').map(e=>e.date),['2026-11-30','2026-11-01']);
  assert.deepEqual(C.bounds('2026-12'),{start:'2026-12-01',end:'2027-01-01'});
  assert.deepEqual(C.bounds('2028-02'),{start:'2028-02-01',end:'2028-03-01'});
  assert.equal(C.validDate('2028-02-29'),true);assert.equal(C.validDate('2026-02-29'),false);
});
test('accepts Arabic and Persian digits, decimal and grouping separators',()=>{
  for(const [s,n] of [['١٬٢٣٤٫٥٠',1234.5],['۱۲۳٫۵',123.5],['1,234.50',1234.5],['1,25',1.25],['42',42]])assert.equal(C.parseNumber(s),n);
  for(const s of ['', '-10','Infinity','1e9','1x','1,2,3'])assert.ok(Number.isNaN(C.parseNumber(s)));
});
test('income supports EUR but expense rejects it, with valid amounts and dates',()=>{
  assert.equal(C.validateEntry(entry('a','income',100,'EUR')).currency,'EUR');
  assert.throws(()=>C.validateEntry(entry('a','expense',100,'EUR')),/عملة/);
  for(const v of [0,-1,Infinity,NaN,1e13])assert.throws(()=>C.validateEntry(entry('a','income',v,'TRY')),/مبلغ/);
  assert.throws(()=>C.validateEntry(entry('a','income',10,'TRY','2026-02-30')),/تاريخ/);
});
test('report snapshots stay stable after entry and rate edits and can detect changes',()=>{
  const entries=[entry('a','income',100,'USD')],r=C.makeReport(entries,rates,'2026-11');
  const original=C.fingerprint(entries,rates);
  entries[0].amount=200;rates.USD=50;
  assert.equal(r.entries[0].amount,100);assert.equal(r.rates.USD,40);assert.equal(r.fingerprint,original);
  assert.notEqual(r.fingerprint,C.fingerprint(entries,rates));
  assert.equal(C.aggregate(r.entries,r.rates).income.try,4000);
});
test('backup validates schema, reports, duplicates, and currency rates',()=>{
  const s=C.freshState();s.rates={TRY:1,USD:40,EUR:44,SYP:.004};s.entries=[entry('a','income',100,'USD')];s.reports['2026-11']=C.makeReport(s.entries,s.rates,'2026-11');
  assert.deepEqual(C.validateState(JSON.parse(JSON.stringify(s))),s);
  assert.throws(()=>C.validateState({...s,version:2}),/إصداره/);
  assert.throws(()=>C.validateState({...s,entries:[...s.entries,...s.entries]}),/تكرار/);
  assert.throws(()=>C.validateState({...s,rates:{...s.rates,USD:0}}),/سعر صرف/);
  const bad=structuredClone(s);bad.reports['2026-11'].rates.USD=null;
  assert.throws(()=>C.validateState(bad),/غير مكتملة/);
});
