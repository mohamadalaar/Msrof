/* مصروف بيتنا — browser-local household ledger. No financial data is sent to a server. */
(() => {
  'use strict';
  const C=window.BaytCore, $=id=>document.getElementById(id);
  const KEY='baytna-ledger-v1',COLORS=['#779b80','#dba183','#c8bf9a','#a3b498','#466e58','#e4c7a4','#b2bfa8','#c38b75'];
  const titles={overview:['نظرة عامة','حسابات البيت، بكل بساطة.','مدخولك ومصروفك بمكان واحد، وبالعملة اللي بتناسبك.'],income:['المدخول','كل دخل، وخطوة لقدّام.','سجّل مدخولك بالتركي أو الدولار أو اليورو أو الليرة السورية.'],expense:['المصروف','مصروف البيت، تحت عينك.','كل مصروف بتسجّله، بيخلّي حسابك أوضح.'],report:['التقرير الشهري','شهر كامل، بحساب واضح.','احسب مدخولك ومصروفك والمتبقي بالليرة التركية والدولار.'],rates:['أسعار الصرف','عملات مختلفة، حساب واحد.','حدّد أسعارك مقابل الليرة التركية، وخلي التحويل علينا.']};
  const nf=new Intl.NumberFormat('en-US',{maximumFractionDigits:2,minimumFractionDigits:2});
  const shortNF=new Intl.NumberFormat('en-US',{maximumFractionDigits:0,notation:'compact'});
  const esc=s=>String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const icon=(name,cls='')=>`<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const fmt=v=>nf.format(Math.abs(v)<.005?0:v);
  const localDate=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const monthName=m=>new Intl.DateTimeFormat('ar',{month:'long',year:'numeric',numberingSystem:'latn'}).format(new Date(m+'-15T12:00:00'));
  const displayDate=d=>new Intl.DateTimeFormat('ar',{day:'numeric',month:'short',numberingSystem:'latn'}).format(new Date(d+'T12:00:00'));
  const displayTime=d=>new Intl.DateTimeFormat('ar',{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit',numberingSystem:'latn'}).format(new Date(d));
  let state=C.freshState(),readError=false,month=localDate().slice(0,7),page='overview',toastTimer,confirmation=null;
  try {const raw=localStorage.getItem(KEY);if(raw) state=C.validateState(JSON.parse(raw));} catch(e) {readError=true;}
  function commit(next,{recovery=false}={}) {
    if(readError&&!recovery) {toast('تعذّر قراءة البيانات السابقة. استعد نسخة احتياطية قبل الحفظ.',true);return false;}
    try {localStorage.setItem(KEY,JSON.stringify(next));state=next;readError=false;return true;}
    catch(e) {toast('ما قدرنا نحفظ. تأكّد إن المتصفح بيسمح بالتخزين وفي مساحة كافية.',true);return false;}
  }
  function toast(message,error=false) {
    clearTimeout(toastTimer);$('toast').classList.toggle('error',error);$('toast').querySelector('span').textContent=message;$('toast').classList.add('show');toastTimer=setTimeout(()=>$('toast').classList.remove('show'),5500);
  }
  function currentRows(){return C.monthEntries(state.entries,month);}
  function money(v,unit='₺'){return v===null?'<span class="missing-amount">—</span>':`<span class="money"><span>${fmt(v)}</span><span class="money-unit">${unit}</span></span>`;}
  function secondary(v){return v===null?'بانتظار سعر الصرف':`$ ${fmt(v)}`;}
  function renderSummary(rows) {
    const a=C.aggregate(rows,state.rates);
    $('summary-cards').innerHTML=`<article class="summary-card balance"><div class="summary-top"><h2>المتبقي من دخلك</h2><span class="summary-icon">${icon('wallet')}</span></div>${money(a.netTRY)}<span class="secondary-money">${secondary(a.netUSD)}</span><div class="summary-bottom">${icon('check')}<span>${a.netTRY===null?'حدّد أسعار الصرف لإكمال الحساب':a.netTRY<0?'المصروف تجاوز المدخول هذا الشهر':'المدخول ناقص المصروف، والصورة صارت أوضح'}</span></div></article>
      <article class="summary-card income"><div class="summary-top"><h2>إجمالي المدخول</h2><span class="summary-icon">${icon('in')}</span></div>${money(a.income.try)}<span class="secondary-money">${secondary(a.income.usd)}</span><div class="summary-bottom"><b>${a.income.count} حركة دخل</b><span>•</span><span>خلال هذا الشهر</span></div></article>
      <article class="summary-card expense"><div class="summary-top"><h2>إجمالي المصروف</h2><span class="summary-icon">${icon('out')}</span></div>${money(a.expense.try)}<span class="secondary-money">${secondary(a.expense.usd)}</span><div class="summary-bottom"><b>${a.expense.count} حركة صرف</b><span>•</span><span>خلال هذا الشهر</span></div></article>`;
  }
  function renderMovement(rows) {
    const days=new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate();
    const incomplete=C.requiredRates(rows,state.rates,false).length>0;
    const values={income:Array(days).fill(0),expense:Array(days).fill(0)};
    if(!incomplete) for(const e of rows) values[e.type][Number(e.date.slice(8))-1]+=C.toTRY(e,state.rates);
    const max=Math.max(100,...values.income,...values.expense)*1.15;
    const left=48,right=585,top=18,bottom=151;
    let svg='';
    for(let i=0;i<=3;i++){const y=top+(bottom-top)*i/3;svg+=`<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" stroke="#edf0e8" stroke-width="1" stroke-dasharray="3 4"/><text x="37" y="${y+3}" text-anchor="end">${shortNF.format(max*(1-i/3))}</text>`;}
    const x=d=>left+(right-left)*d/(days-1),y=v=>bottom-(v/max)*(bottom-top);
    for(const d of [1,5,10,15,20,25,days]) svg+=`<text x="${x(d-1)}" y="175" text-anchor="middle">${d.toString().padStart(2,'0')}</text>`;
    svg+='<defs><linearGradient id="income-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#82a58b" stop-opacity=".19"/><stop offset="100%" stop-color="#82a58b" stop-opacity=".01"/></linearGradient><linearGradient id="expense-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#d99a79" stop-opacity=".14"/><stop offset="100%" stop-color="#d99a79" stop-opacity=".01"/></linearGradient></defs>';
    for(const type of ['income','expense']) {
      const points=values[type].map((v,i)=>`${i?'L':'M'} ${x(i).toFixed(2)} ${y(v).toFixed(2)}`).join(' ');
      svg+=`<path d="${points} L ${right} ${bottom} L ${left} ${bottom} Z" fill="url(#${type}-fill)"/><path d="${points}" stroke="${type==='income'?'#81a18a':'#dca082'}" stroke-width="2" fill="none"/>`;
      for(let i=0;i<days;i++) if(values[type][i]>0) svg+=`<circle cx="${x(i)}" cy="${y(values[type][i])}" r="3" fill="${type==='income'?'#81a18a':'#dca082'}"><title>${i+1}: ${fmt(values[type][i])} ليرة تركية</title></circle>`;
    }
    $('movement-chart').innerHTML=`<svg viewBox="0 0 600 185" preserveAspectRatio="none" role="img" aria-label="رسم المدخول والمصروف اليومي بالليرة التركية">${svg}</svg>${!rows.length||incomplete?`<span class="chart-empty-label">${incomplete?'أضف أسعار الصرف لعرض حركة الشهر':'حركاتك رح تظهر هون أول ما تسجّلها'}</span>`:''}`;
  }
  function renderCategories(rows) {
    const expenses=rows.filter(e=>e.type==='expense'),incomplete=C.requiredRates(expenses,state.rates,false).length>0;
    let grouped=[];
    if(!incomplete) {
      const map={};for(const e of expenses)map[e.category]=(map[e.category]||0)+C.toTRY(e,state.rates);
      grouped=Object.entries(map).sort((a,b)=>b[1]-a[1]);
    }
    const total=grouped.reduce((s,e)=>s+e[1],0);let pos=0;
    const segments=grouped.map((e,i)=>{const start=pos;pos+=e[1]/total*100;return `${COLORS[i]} ${start}% ${pos}%`;});
    const legend=grouped.length?grouped.map((e,i)=>`<div><i style="background:${COLORS[i]}"></i><span>${esc(e[0])}</span><b>${Math.round(e[1]/total*100)}%</b></div>`).join(''):['مشتريات البيت','إيجار وسكن','فواتير','مصروف آخر'].map((s,i)=>`<div><i style="background:${COLORS[i]};opacity:.6"></i><span>${s}</span><b>—</b></div>`).join('');
    $('category-chart').innerHTML=`<div class="donut-area"><div class="donut" style="${segments.length?'background:conic-gradient('+segments.join(',')+')':''}" role="img" aria-label="توزيع المصروف على التصنيفات"><div class="donut-center"><strong>${incomplete?'—':shortNF.format(total)}</strong><small>إجمالي المصروف ₺</small></div></div><div class="donut-legend">${legend}</div></div><p class="category-caption">${incomplete?'أكمل أسعار الصرف لتشوف توزيع مصروفك.':!expenses.length?'لسّه ما في مصروف مسجّل. بداية جديدة ومرتّبة.':`أكثر صرف هالشهر: ${esc(grouped[0][0])}`}</p>`;
  }
  function renderTransactions(rows) {
    const search=$('search').value.trim().toLowerCase(),filter=page==='income'||page==='expense'?page:$('type-filter').value;
    const shown=rows.filter(e=>(filter==='all'||e.type===filter)&&(!search||(e.note+' '+e.category+' '+C.CURRENCIES[e.currency].name).toLowerCase().includes(search)));
    $('transactions-title').textContent=page==='income'?'حركات المدخول':page==='expense'?'حركات المصروف':'آخر الحركات';
    $('transactions-subtitle').textContent=page==='income'?'كل مبلغ وصل، محفوظ بتفاصيله.':page==='expense'?'مصروف البيت، حركة بحركة.':'تفاصيل بسيطة، وحسابات أوضح.';
    $('type-filter').hidden=page!=='overview';
    $('transactions-body').innerHTML=shown.map(e=>{
      const amount=C.toTRY(e,state.rates),cur=C.CURRENCIES[e.currency];
      return `<tr><td><div class="transaction-description"><span class="transaction-icon ${e.type}">${icon(e.type==='income'?'in':'bag')}</span><div><strong>${esc(e.note||e.category)}</strong>${e.note?`<small>${esc(e.category)}</small>`:''}</div></div></td><td>${displayDate(e.date)}</td><td class="amount-cell ${e.type}-text"><bdi>${fmt(e.amount)} <small>${cur.short}</small></bdi></td><td class="amount-cell"><bdi>${amount===null?'—':fmt(amount)+' ₺'}</bdi></td><td><span class="type-badge ${e.type}">${e.type==='income'?'دخل':'مصروف'}</span></td><td><div class="row-actions"><button class="icon-btn" data-edit="${e.id}" aria-label="تعديل ${esc(e.note||e.category)}">${icon('edit')}</button><button class="icon-btn delete-btn" data-delete="${e.id}" aria-label="حذف ${esc(e.note||e.category)}">${icon('trash')}</button></div></td></tr>`;
    }).join('');
    $('transactions-empty').hidden=shown.length>0;
    const empty=$('transactions-empty');
    if(search||(!shown.length&&rows.length)) {
      empty.querySelector('h3').textContent='ما في حركات مطابقة.';empty.querySelector('p').textContent='جرّب كلمة تانية أو غيّر الفلتر.';empty.querySelector('button').hidden=true;
    } else {
      const type=page==='income'?'income':'expense';
      empty.querySelector('h3').textContent='أول خطوة، سجّل أول حركة.';empty.querySelector('p').textContent='أضف دخلك أو مصروفك، وخلي الباقي علينا.';
      const b=empty.querySelector('button');b.hidden=false;b.dataset.add=type;b.innerHTML=icon('plus')+(type==='income'?'إضافة أول دخل':'إضافة أول مصروف');
    }
    $('transaction-total').textContent=`${shown.length} حركة${shown.length!==rows.length?' من أصل '+rows.length:''} هذا الشهر`;
  }
  function renderRates() {
    $('rates-view').innerHTML=`<div class="rates-layout"><form id="rates-form" class="card rates-form"><div class="rates-form-intro"><h2>سعر الصرف اللي بيعتمد عليه حسابك</h2><p>اكتب كم ليرة تركية بتساوي كل عملة. الأسعار يدوية وبتقدر تعدّلها بأي وقت.</p></div>
      ${['USD','EUR','SYP'].map(c=>`<div class="rate-row"><span class="rate-currency-symbol ${c==='SYP'?'syp':''}">${C.CURRENCIES[c].symbol}</span><div class="rate-currency-label"><strong>${c==='SYP'?'1,000 ليرة سورية':c==='EUR'?'1 يورو':'1 دولار أمريكي'}</strong><small>${c==='SYP'?'1,000':'1'} ${c} = ? TRY</small></div><label class="rate-value"><input id="rate-${c}" inputmode="decimal" autocomplete="off" dir="ltr" placeholder="0.00" aria-label="سعر ${c==='SYP'?'ألف ليرة سورية':C.CURRENCIES[c].name} مقابل الليرة التركية" value="${state.rates[c]===null?'':Number((state.rates[c]*(c==='SYP'?1000:1)).toPrecision(12))}"><span>ليرة تركية</span></label></div>`).join('')}
      <div class="rate-base">${icon('check')}<span>الليرة التركية هي العملة الأساسية: <bdi>1 TRY = 1 TRY</bdi></span></div><div class="form-error" id="rates-error" role="alert"></div><div class="rates-save-row"><button class="btn btn-green" type="submit">${icon('check')}حفظ أسعار الصرف</button><small>${state.ratesUpdatedAt?'آخر تحديث: '+displayTime(state.ratesUpdatedAt):'ما تم تحديد أسعار بعد'}</small></div></form>
      <aside class="card rate-help"><span class="help-icon">${icon('exchange')}</span><h2>كيف بينحسب المجموع؟</h2><p>كل مبلغ بيتحوّل أولاً لليرة التركية. بعدها بيتحوّل الإجمالي للدولار حسب سعر الدولار اللي حفظته.</p><div class="example-conversion"><span>مثال توضيحي فقط — مو سعر صرف حالي</span><strong>100 USD × 40 TRY = 4,000 TRY</strong></div><p>للسوري، اكتب سعر <strong>ألف ليرة سورية</strong> لتكون الأرقام أسهل. التطبيق بيحوّل أي مبلغ سوري تلقائياً.</p><p class="small-help">تعديل الأسعار بيحدّث الملخص الحالي. التقرير المحسوب بيحتفظ بأسعاره لحدّ ما تضغط «إعادة الحساب». الأسعار مو مرتبطة تلقائياً بالسوق.</p></aside></div>`;
    $('rates-form').addEventListener('submit',saveRates);
  }
  function saveRates(event) {
    event.preventDefault();const rates={TRY:1};
    for(const code of ['USD','EUR','SYP']) {
      const value=$('rate-'+code).value.trim(),n=C.parseNumber(value);
      if(value && (!Number.isFinite(n)||n<=0||n>1e9)){$('rates-error').textContent='أدخل سعر صرف أكبر من الصفر وصالح لكل عملة، أو اترك الحقل فارغاً.';$('rate-'+code).focus();return;}
      rates[code]=value?n/(code==='SYP'?1000:1):null;
    }
    if(commit({...state,rates,ratesUpdatedAt:new Date().toISOString()})){render();toast('تم حفظ أسعار الصرف وتحديث الحسابات.');}
  }
  function renderReport() {
    const r=state.reports[month];
    if(!r){
      $('report-view').innerHTML=`<div class="card report-empty empty-state"><span class="empty-icon">${icon('report')}</span><h3>خلّينا نشوف حساب ${esc(monthName(month))}.</h3><p>من أول يوم بالشهر لقبل أول يوم بالشهر اللي بعده. الدخل، المصروف، والمتبقي… كله بالتركي والدولار.</p><button class="btn btn-green" data-generate>${icon('report')}احسب التقرير الشهري</button></div>`;return;
    }
    const a=C.aggregate(r.entries,r.rates),stale=r.fingerprint!==C.fingerprint(currentRows(),state.rates);
    const currencies=['TRY','USD','EUR','SYP'].filter(c=>a.income.original[c]||a.expense.original[c]);
    $('report-view').innerHTML=`${stale?'<div class="stale-notice">في حركات أو أسعار تغيّرت بعد حساب هالتقرير. اضغط «إعادة الحساب» ليشمل آخر التغييرات.</div>':''}<div class="report-intro"><span class="report-symbol">${icon('report')}</span><div class="report-intro-content"><h2>تقرير ${esc(monthName(month))}</h2><p>الفترة: <bdi>${C.bounds(month).start}</bdi> إلى قبل <bdi>${C.bounds(month).end}</bdi></p><div class="report-status">${icon('check')}آخر حساب: ${displayTime(r.generatedAt)} · ${r.entries.length} حركة</div></div><div class="report-buttons"><button class="btn btn-white" id="export-report">${icon('save')}تنزيل التقرير</button><button class="btn btn-green" data-generate>${icon('exchange')}إعادة الحساب</button></div></div>
      <div class="report-summary">${[['إجمالي المدخول',a.income.try,a.income.usd],['إجمالي المصروف',a.expense.try,a.expense.usd],['المتبقي من الدخل',a.netTRY,a.netUSD]].map(([label,t,u])=>`<article class="report-stat"><small>${label}</small><strong>${t===null?'—':fmt(t)+' ₺'}</strong><span>${u===null?'سعر الدولار غير محدّد':'$ '+fmt(u)}</span></article>`).join('')}</div>
      <div class="report-detail-grid"><article class="card"><h2>تفاصيل كل عملة قبل التحويل</h2><div class="table-wrap"><table><thead><tr><th>العملة</th><th>المدخول</th><th>المصروف</th><th>المتبقي</th></tr></thead><tbody>${currencies.length?currencies.map(c=>`<tr><td>${C.CURRENCIES[c].name}</td><td class="amount-cell">${fmt(a.income.original[c]||0)}</td><td class="amount-cell">${fmt(a.expense.original[c]||0)}</td><td class="amount-cell">${fmt((a.income.original[c]||0)-(a.expense.original[c]||0))}</td></tr>`).join(''):'<tr><td colspan="4">لا توجد حركات لهذا الشهر.</td></tr>'}</tbody></table></div></article><article class="card"><h2>أسعار الصرف المستخدمة بالتقرير</h2><div class="rate-list">${['USD','EUR','SYP'].map(c=>`<div><span>${c==='SYP'?'1,000 ليرة سورية':c==='EUR'?'1 يورو':'1 دولار'}</span><b>${r.rates[c]===null?'—':fmt(r.rates[c]*(c==='SYP'?1000:1))+' TRY'}</b></div>`).join('')}</div></article></div><p class="report-footnote">كل الإجماليات تمثّل نفس الحساب بعملتين؛ ما منجمع إجمالي التركي مع إجمالي الدولار. هذا التقرير محفوظ بأسعار الصرف وقت آخر حساب.</p>`;
    $('export-report').addEventListener('click',exportReport);
  }
  function generateReport() {
    try {
      const r=C.makeReport(state.entries,state.rates,month);
      if(commit({...state,reports:{...state.reports,[month]:r}})) {if(location.hash!=='#report')location.hash='report';else render();toast('تم حساب الشهر وحفظ التقرير.');}
    } catch(e) {location.hash='rates';toast(e.message,true);}
  }
  function render() {
    const target=location.hash.slice(1);page=Object.hasOwn(titles,target)?target:'overview';
    const [label,title,subtitle]=titles[page],rows=currentRows();
    document.querySelectorAll('[data-page]').forEach(el=>{const active=el.dataset.page===page;el.classList.toggle('active',active);if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
    $('breadcrumb-title').textContent=label;$('page-title').textContent=title;$('page-subtitle').textContent=subtitle;document.title=label+' — مصروف بيتنا';
    $('month-picker').value=month;$('month-label').textContent=monthName(month);
    const b=C.bounds(month);$('period-label').textContent=`من 1 الشهر إلى قبل 1 الشهر التالي`;
    $('prev-month').disabled=month==='1900-01';$('next-month').disabled=month==='2100-12';
    $('income-count').textContent=rows.filter(e=>e.type==='income').length;$('expense-count').textContent=rows.filter(e=>e.type==='expense').length;
    $('overview-view').hidden=page!=='overview';$('transactions-view').hidden=!['overview','income','expense'].includes(page);$('summary-cards').hidden=!['overview','income','expense'].includes(page);$('report-view').hidden=page!=='report';$('rates-view').hidden=page!=='rates';$('month-toolbar').hidden=page==='rates';
    $('rates-notice').hidden=page==='rates'||page==='report'||C.requiredRates(rows,state.rates).length===0;
    if(['overview','income','expense'].includes(page)){renderSummary(rows);renderTransactions(rows);}
    if(page==='overview'){renderMovement(rows);renderCategories(rows);}
    if(page==='rates')renderRates();if(page==='report')renderReport();
    closeSidebar();
  }
  function openEntry(type,id=null) {
    const e=id?state.entries.find(e=>e.id===id):null;if(id&&!e)return;
    const form=$('entry-form');form.reset();$('entry-error').textContent='';$('entry-id').value=e?.id||'';$('entry-type').value=type;
    $('entry-title').textContent=e?'تعديل '+(type==='income'?'الدخل':'المصروف'):type==='income'?'خلّينا نسجّل دخل جديد.':'خلّينا نسجّل مصروف جديد.';
    $('entry-eyebrow').textContent=type==='income'?'كل دخل بيفرق':'تفاصيل صغيرة، حساب واضح';
    $('entry-currency').innerHTML=Object.entries(C.CURRENCIES).filter(([c])=>type==='income'||c!=='EUR').map(([c,v])=>`<option value="${c}">${v.symbol} ${v.name}</option>`).join('');
    $('entry-category').innerHTML=C.CATEGORIES[type].map(c=>`<option>${c}</option>`).join('');
    const today=localDate();$('entry-date').value=e?.date||(today.startsWith(month)?today:month+'-01');
    if(e){$('entry-amount').value=e.amount;$('entry-currency').value=e.currency;$('entry-category').value=e.category;$('entry-note').value=e.note;}
    $('entry-submit').innerHTML=icon('check')+(e?'حفظ التعديل':type==='income'?'حفظ الدخل':'حفظ المصروف');
    $('entry-submit').className='btn '+(type==='income'?'btn-green':'btn-coral');
    updateEntryConversion();$('entry-dialog').showModal();requestAnimationFrame(()=>$('entry-amount').focus());
  }
  function updateEntryConversion() {
    const amount=C.parseNumber($('entry-amount').value),currency=$('entry-currency').value,rate=state.rates[currency];
    $('entry-conversion').textContent=!Number.isFinite(amount)||amount<=0?'':rate?'≈ '+fmt(amount*rate)+' ليرة تركية'+(state.rates.USD?' / '+fmt(amount*rate/state.rates.USD)+' دولار':''):'سجّل المبلغ الآن وحدّد سعر الصرف لاحقاً لإكمال الإجمالي.';
  }
  function saveEntry(event) {
    event.preventDefault();const amount=C.parseNumber($('entry-amount').value),type=$('entry-type').value,date=$('entry-date').value;
    if(!Number.isFinite(amount)||amount<=0||amount>1e12){$('entry-error').textContent='أدخل مبلغاً أكبر من الصفر، وبحد أقصى تريليون.';$('entry-amount').focus();return;}
    if(!C.validDate(date)){$('entry-error').textContent='اختر تاريخاً صحيحاً بين 1900 و2100.';return;}
    const id=$('entry-id').value,old=state.entries.find(e=>e.id===id),now=new Date().toISOString();
    const e={id:id||crypto.randomUUID(),type,amount,currency:$('entry-currency').value,category:$('entry-category').value,date,note:$('entry-note').value.trim(),createdAt:old?.createdAt||now,updatedAt:now};
    try {C.validateEntry(e);} catch(err){$('entry-error').textContent=err.message;return;}
    const entries=id?state.entries.map(row=>row.id===id?e:row):[...state.entries,e];
    if(commit({...state,entries})){month=date.slice(0,7);$('entry-dialog').close();render();toast(id?'تم حفظ التعديل.':type==='income'?'تم تسجيل الدخل. يعطيك العافية!':'تم تسجيل المصروف.');}
  }
  function confirmAction({title,text,label='تأكيد',onConfirm}) {
    $('confirm-title').textContent=title;$('confirm-text').textContent=text;$('confirm-yes').textContent=label;confirmation=onConfirm;$('confirm-dialog').showModal();
  }
  function deleteEntry(id) {
    const e=state.entries.find(e=>e.id===id);if(!e)return;
    confirmAction({title:'حذف الحركة؟',text:`رح تنحذف حركة «${e.note||e.category}» بقيمة ${fmt(e.amount)} ${C.CURRENCIES[e.currency].name} من الدفتر.`,label:'حذف الحركة',onConfirm:()=>{if(commit({...state,entries:state.entries.filter(e=>e.id!==id)})){render();toast('تم حذف الحركة.');}}});
  }
  function download(content,type,name) {
    const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function exportReport() {
    const r=state.reports[month];if(!r)return;const a=C.aggregate(r.entries,r.rates);
    const cell=v=>{let s=String(v??'');if(typeof v!=='number'&&/^[\s]*[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
    const data=[['تقرير مصروف بيتنا',month],['من',C.bounds(month).start,'إلى قبل',C.bounds(month).end],['وقت الحساب',r.generatedAt],[],['الملخص','الليرة التركية','الدولار'],['المدخول',a.income.try,a.income.usd],['المصروف',a.expense.try,a.expense.usd],['المتبقي',a.netTRY,a.netUSD],[],['أسعار الصرف','القيمة بالليرة التركية'],['1 USD',r.rates.USD],['1 EUR',r.rates.EUR],['1000 SYP',r.rates.SYP===null?'':r.rates.SYP*1000],[],['التاريخ','النوع','التصنيف','الملاحظة','المبلغ','العملة','المعادل بالتركي','المعادل بالدولار'],...r.entries.map(e=>{const t=C.toTRY(e,r.rates);return [e.date,e.type==='income'?'دخل':'مصروف',e.category,e.note,e.amount,e.currency,t,t/r.rates.USD];})];
    download('\ufeff'+data.map(row=>row.map(cell).join(',')).join('\r\n'),'text/csv;charset=utf-8',`masroof-baytna-${month}.csv`);toast('تم تجهيز التقرير للتنزيل.');
  }
  async function importBackup(file) {
    if(!file)return;
    try {
      if(file.size>20*1024*1024)throw new Error('حجم الملف أكبر من المسموح (20 ميغابايت).');
      const imported=C.validateState(JSON.parse(await file.text()));
      confirmAction({title:'استعادة النسخة الاحتياطية؟',label:'استعادة ودمج البيانات',text:`الملف فيه ${imported.entries.length} حركة. رح ندمج الحركات، ونحتفظ بآخر تعديل عند التكرار، ونستعيد أسعار الصرف والتقارير من الملف.`,onConfirm:()=>{
        const merged=new Map(state.entries.map(e=>[e.id,e]));for(const e of imported.entries){const old=merged.get(e.id);if(!old||Date.parse(e.updatedAt)>Date.parse(old.updatedAt))merged.set(e.id,e);}
        const next={...state,entries:[...merged.values()],rates:imported.rates,ratesUpdatedAt:imported.ratesUpdatedAt,reports:{...state.reports,...imported.reports}};
        if(commit(next,{recovery:true})){$('backup-dialog').close();render();toast('تمت استعادة النسخة ودمج الحركات.');}
      }});
    }catch(e){toast(e instanceof SyntaxError?'الملف مو نسخة احتياطية صالحة.':e.message,true);}
    finally{$('backup-file').value='';}
  }
  function closeSidebar(){$('sidebar').classList.remove('open');$('sidebar-scrim').classList.remove('open');$('menu-button').setAttribute('aria-expanded','false');}
  document.addEventListener('click',event=>{
    const add=event.target.closest('[data-add]');if(add)openEntry(add.dataset.add);
    const edit=event.target.closest('[data-edit]');if(edit){const e=state.entries.find(e=>e.id===edit.dataset.edit);if(e)openEntry(e.type,e.id);}
    const del=event.target.closest('[data-delete]');if(del)deleteEntry(del.dataset.delete);
    if(event.target.closest('[data-close]'))event.target.closest('dialog').close();
    if(event.target.closest('[data-action="backup"]'))$('backup-dialog').showModal();
    if(event.target.closest('[data-generate]'))generateReport();
  });
  $('entry-form').addEventListener('submit',saveEntry);$('entry-amount').addEventListener('input',updateEntryConversion);$('entry-currency').addEventListener('change',updateEntryConversion);
  $('calculate-month').addEventListener('click',generateReport);
  $('month-picker').min='1900-01';$('month-picker').max='2100-12';
  $('month-picker').addEventListener('change',e=>{if(C.validMonth(e.target.value)){month=e.target.value;render();}});
  for(const [id,delta]of [['prev-month',-1],['next-month',1]])$(id).addEventListener('click',()=>{const [y,m]=month.split('-').map(Number);const next=new Date(Date.UTC(y,m-1+delta,15)).toISOString().slice(0,7);if(C.validMonth(next)){month=next;render();}});
  $('search').addEventListener('input',()=>renderTransactions(currentRows()));$('type-filter').addEventListener('change',()=>renderTransactions(currentRows()));
  $('menu-button').addEventListener('click',()=>{const open=$('sidebar').classList.toggle('open');$('sidebar-scrim').classList.toggle('open',open);$('menu-button').setAttribute('aria-expanded',String(open));});$('sidebar-scrim').addEventListener('click',closeSidebar);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSidebar();});
  $('download-backup').addEventListener('click',()=>{download(JSON.stringify(state,null,2),'application/json',`masroof-baytna-backup-${localDate()}.json`);toast('تم تجهيز النسخة الاحتياطية للتنزيل.');});
  $('import-backup').addEventListener('click',()=>$('backup-file').click());$('backup-file').addEventListener('change',e=>importBackup(e.target.files[0]));
  $('confirm-yes').addEventListener('click',()=>{const fn=confirmation;confirmation=null;$('confirm-dialog').close();if(fn)fn();});$('confirm-dialog').addEventListener('close',()=>{confirmation=null;});
  window.addEventListener('hashchange',()=>{$('search').value='';$('type-filter').value='all';render();});
  window.addEventListener('storage',e=>{if(e.key===KEY){try{if(!e.newValue){toast('تم حذف بيانات المتصفح في نافذة ثانية. نزّل نسخة احتياطية من الحركات المفتوحة.',true);return;}state=C.validateState(JSON.parse(e.newValue));readError=false;render();toast('تم تحديث البيانات من نافذة ثانية.');}catch(err){toast('تعذّر قراءة تحديث البيانات من النافذة الثانية.',true);}}});
  render();
  if(readError){document.querySelector('.local-status').textContent='تعذّر قراءة البيانات';toast('تعذّر قراءة البيانات المحفوظة. استعد نسخة احتياطية من «بياناتي».',true);}
})();
