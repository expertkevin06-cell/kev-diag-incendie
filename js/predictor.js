window.EIK_PREDICTOR=(function(){
"use strict";
var VERSION="46.0.0",EIK=window.EIK;
function norm(s){return String(s==null?"":s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");}
function uniq(a){var o={},r=[];(a||[]).forEach(function(x){if(x&&!o[x]){o[x]=1;r.push(x);}});return r;}
function clone(o){return JSON.parse(JSON.stringify(o));}
var EMBED={
brands:[{name:"Peugeot",aliases:["psa"]},{name:"Citroën",aliases:["citroen"]},{name:"DS",aliases:["ds automobiles"]},{name:"Opel",aliases:["stellantis"]},{name:"Renault",aliases:["renault"]},{name:"Dacia",aliases:["dacia"]},{name:"Volkswagen",aliases:["vw","vag"]},{name:"Audi",aliases:["vag"]},{name:"SEAT",aliases:["seat"]},{name:"Škoda",aliases:["skoda"]},{name:"Ford",aliases:["ford"]},{name:"BMW",aliases:["bmw"]},{name:"Mercedes-Benz",aliases:["mercedes"]},{name:"Mini",aliases:["mini"]},{name:"Toyota",aliases:["toyota"]},{name:"Nissan",aliases:["nissan"]},{name:"Hyundai",aliases:["hyundai"]},{name:"Kia",aliases:["kia"]},{name:"Tesla",aliases:["tesla"]},{name:"Volvo",aliases:["volvo"]},{name:"Fiat",aliases:["fiat"]},{name:"Jeep",aliases:["jeep"]}],
models:[
{brand:"Peugeot",name:"208",aliases:["208"],years:"2012-2026",variants:[{engine:"1.2 PureTech",power:"82"},{engine:"1.2 PureTech",power:"110"},{engine:"1.2 PureTech",power:"130"},{engine:"e-208",power:"136",type:"VE"}]},
{brand:"Peugeot",name:"308",aliases:["308"],years:"2007-2026",variants:[{engine:"1.2 PureTech",power:"110"},{engine:"1.2 PureTech",power:"130"},{engine:"1.6 THP",power:"155"},{engine:"1.6 BlueHDi",power:"120"},{engine:"2.0 BlueHDi",power:"150"}]},
{brand:"Peugeot",name:"2008",aliases:["2008"],years:"2013-2026",variants:[{engine:"1.2 PureTech",power:"110"},{engine:"1.2 PureTech",power:"130"},{engine:"1.5 BlueHDi",power:"130"}]},
{brand:"Peugeot",name:"3008",aliases:["3008"],years:"2009-2026",variants:[{engine:"1.2 PureTech",power:"130"},{engine:"1.6 THP",power:"165"},{engine:"1.5 BlueHDi",power:"130"},{engine:"1.6 HDi",power:"115"},{engine:"2.0 BlueHDi",power:"180"}]},
{brand:"Peugeot",name:"5008",aliases:["5008"],years:"2009-2026",variants:[{engine:"1.6 THP",power:"165"},{engine:"1.5 BlueHDi",power:"130"},{engine:"1.6 HDi",power:"115"},{engine:"2.0 BlueHDi",power:"180"}]},
{brand:"Citroën",name:"C3",aliases:["c3"],years:"2002-2026",variants:[{engine:"1.2 PureTech",power:"82"},{engine:"1.2 PureTech",power:"110"}]},
{brand:"Citroën",name:"C4 Cactus",aliases:["c4 cactus","cactus"],years:"2014-2020",variants:[{engine:"1.2 PureTech",power:"110"},{engine:"1.6 BlueHDi",power:"100"}]},
{brand:"Citroën",name:"C5 Aircross",aliases:["c5 aircross"],years:"2018-2026",variants:[{engine:"1.5 BlueHDi",power:"130"},{engine:"1.6 THP",power:"180"}]},
{brand:"Volkswagen",name:"Golf",aliases:["golf","golf 7","golf 8"],years:"1974-2026",variants:[{engine:"1.0 TSI",power:"110"},{engine:"1.5 TSI",power:"150"},{engine:"2.0 TDI",power:"150"},{engine:"e-Golf",power:"136",type:"VE"}]},
{brand:"Volkswagen",name:"Passat",aliases:["passat"],years:"2010-2026",variants:[{engine:"EA888",power:"220"},{engine:"2.0 TDI",power:"150"}]},
{brand:"Volkswagen",name:"Tiguan",aliases:["tiguan"],years:"2007-2026",variants:[{engine:"1.5 TSI",power:"150"},{engine:"2.0 TDI",power:"150"}]},
{brand:"Ford",name:"Focus",aliases:["focus"],years:"1998-2026",variants:[{engine:"1.0 EcoBoost",power:"125"},{engine:"1.5 EcoBlue",power:"120"},{engine:"2.0 EcoBlue",power:"150"}]},
{brand:"Ford",name:"Kuga",aliases:["kuga"],years:"2008-2026",variants:[{engine:"1.5 EcoBlue",power:"120"},{engine:"2.0 EcoBlue",power:"150"}]},
{brand:"BMW",name:"Série 3",aliases:["serie 3","série 3","f30","e90"],years:"2005-2026",variants:[{engine:"N47",power:"184"},{engine:"N20",power:"184"}]},
{brand:"BMW",name:"X3",aliases:["x3"],years:"2010-2026",variants:[{engine:"N47",power:"184"}]},
{brand:"Renault",name:"Clio",aliases:["clio"],years:"1990-2026",variants:[{engine:"1.0 TCe",power:"100"},{engine:"1.5 Blue dCi",power:"115"}]},
{brand:"Renault",name:"Megane",aliases:["megane","mégane"],years:"1995-2026",variants:[{engine:"1.3 TCe",power:"140"},{engine:"1.5 Blue dCi",power:"115"}]},
{brand:"Hyundai",name:"Kona",aliases:["kona"],years:"2017-2026",variants:[{engine:"1.0 T-GDi",power:"120"},{engine:"Kona Electric",power:"204",type:"VE"}]},
{brand:"Tesla",name:"Model 3",aliases:["model 3"],years:"2017-2026",variants:[{engine:"Tesla LR",power:"346",type:"VE"}]},
{brand:"Tesla",name:"Model Y",aliases:["model y"],years:"2020-2026",variants:[{engine:"Tesla LR",power:"346",type:"VE"}]}
],
engines:[
{code:"EB2",names:["1.2 puretech","puretech","eb2"],type:"Essence",knownIssues:["Courroie humide","Délamination","Crépine"],brands:["Peugeot","Citroën","DS","Opel"]},
{code:"1.6 THP",names:["1.6 thp","thp","ep6","prince"],type:"Essence",knownIssues:["Chaîne distribution","Tendeur","Calamine"],brands:["Peugeot","Citroën","DS","Mini"]},
{code:"N47",names:["n47","bmw n47"],type:"Diesel",knownIssues:["Chaîne distribution","Tendeur","Casse chaîne"],brands:["BMW"]},
{code:"N20",names:["n20","bmw n20"],type:"Essence",knownIssues:["Chaîne distribution","Tendeur"],brands:["BMW"]},
{code:"EA888",names:["ea888","1.8 tsi","2.0 tsi"],type:"Essence",knownIssues:["Chaîne distribution","Tendeur","Consommation huile"],brands:["Volkswagen","Audi","SEAT","Škoda"]},
{code:"1.5 BlueHDi",names:["1.5 bluehdi","bluehdi"],type:"Diesel",knownIssues:["Courroie","FAP","AdBlue"],brands:["Peugeot","Citroën","Opel"]},
{code:"1.6 HDi",names:["1.6 hdi","hdi"],type:"Diesel",knownIssues:["Courroie","FAP","EGR"],brands:["Peugeot","Citroën"]},
{code:"1.6 BlueHDi",names:["1.6 bluehdi"],type:"Diesel",knownIssues:["FAP","EGR","AdBlue"],brands:["Peugeot","Citroën"]},
{code:"2.0 BlueHDi",names:["2.0 bluehdi"],type:"Diesel",knownIssues:["EGR","FAP","AdBlue","Turbo"],brands:["Peugeot","Citroën","DS","Opel"]},
{code:"1.5 EcoBlue",names:["1.5 ecoblue","ecoblue"],type:"Diesel",knownIssues:["Courroie humide","EGR","FAP"],brands:["Ford"]},
{code:"2.0 EcoBlue",names:["2.0 ecoblue"],type:"Diesel",knownIssues:["Courroie humide","EGR","FAP"],brands:["Ford"]},
{code:"1.0 TSI",names:["1.0 tsi","tsi"],type:"Essence",knownIssues:["Chaîne distribution","Turbo"],brands:["Volkswagen","SEAT","Škoda","Audi"]},
{code:"1.5 TSI",names:["1.5 tsi"],type:"Essence",knownIssues:["Injection","Turbo"],brands:["Volkswagen","SEAT","Škoda","Audi"]},
{code:"2.0 TDI",names:["2.0 tdi","tdi"],type:"Diesel",knownIssues:["EGR","FAP","Injecteurs"],brands:["Volkswagen","SEAT","Škoda","Audi"]},
{code:"1.0 EcoBoost",names:["1.0 ecoboost","ecoboost"],type:"Essence",knownIssues:["Refroidissement","Turbo"],brands:["Ford"]},
{code:"1.0 TCe",names:["1.0 tce","tce"],type:"Essence",knownIssues:["Injection","Turbo"],brands:["Renault","Dacia"]},
{code:"1.3 TCe",names:["1.3 tce"],type:"Essence",knownIssues:["Injection","Turbo"],brands:["Renault","Dacia"]},
{code:"1.5 Blue dCi",names:["1.5 dci","blue dci"],type:"Diesel",knownIssues:["EGR","FAP","Injecteurs"],brands:["Renault","Dacia"]},
{code:"Kona Electric",names:["kona electric","kona ev"],type:"Électrique",knownIssues:["Batterie","OBC","Charge"],brands:["Hyundai"]},
{code:"e-208",names:["e-208","e208"],type:"Électrique",knownIssues:["Batterie","Charge"],brands:["Peugeot"]},
{code:"e-Golf",names:["e-golf"],type:"Électrique",knownIssues:["Batterie","Charge"],brands:["Volkswagen"]},
{code:"Tesla LR",names:["long range","standard range"],type:"Électrique",knownIssues:["Batterie","Charge"],brands:["Tesla"]}
],
correlations:[
{brand:"Peugeot",model:"308",engine:"1.2 PureTech",failure:"Courroie humide délaminée",probability:9,severity:"Critique",system:"distribution",description:"Délamination courroie immergée EB2."},
{brand:"Peugeot",model:"208",engine:"1.2 PureTech",failure:"Courroie humide délaminée",probability:9,severity:"Critique",system:"distribution",description:"Délamination courroie EB2."},
{brand:"Peugeot",model:"2008",engine:"1.2 PureTech",failure:"Courroie humide délaminée",probability:9,severity:"Critique",system:"distribution",description:"Délamination courroie EB2."},
{brand:"Peugeot",model:"3008",engine:"1.2 PureTech",failure:"Courroie humide délaminée",probability:9,severity:"Critique",system:"distribution",description:"Délamination courroie EB2."},
{brand:"Peugeot",model:"3008",engine:"1.6 THP",failure:"Chaîne de distribution allongée",probability:8,severity:"Critique",system:"distribution",description:"Allongement chaîne / tendeur EP6."},
{brand:"Peugeot",model:"5008",engine:"1.6 THP",failure:"Chaîne de distribution allongée",probability:8,severity:"Critique",system:"distribution",description:"Allongement chaîne / tendeur EP6."},
{brand:"Peugeot",model:"3008",engine:"1.5 BlueHDi",failure:"Courroie distribution / accessoires",probability:6,severity:"Élevé",system:"distribution",description:"Usure courroie BlueHDi."},
{brand:"Peugeot",model:"5008",engine:"1.5 BlueHDi",failure:"Courroie distribution / accessoires",probability:6,severity:"Élevé",system:"distribution",description:"Usure courroie BlueHDi."},
{brand:"Citroën",model:"C3",engine:"1.2 PureTech",failure:"Courroie humide délaminée",probability:9,severity:"Critique",system:"distribution",description:"Délamination courroie EB2."},
{brand:"Citroën",model:"C4 Cactus",engine:"1.2 PureTech",failure:"Courroie humide délaminée",probability:9,severity:"Critique",system:"distribution",description:"Délamination courroie EB2."},
{brand:"BMW",model:"Série 3",engine:"N47",failure:"Chaîne de distribution / casse tendeur",probability:9,severity:"Critique",system:"distribution",description:"Usure chaîne côté volant moteur."},
{brand:"BMW",model:"X3",engine:"N47",failure:"Chaîne de distribution / casse tendeur",probability:9,severity:"Critique",system:"distribution",description:"Usure chaîne N47."},
{brand:"Volkswagen",model:"Passat",engine:"EA888",failure:"Chaîne de distribution / tendeur",probability:7,severity:"Critique",system:"distribution",description:"Tendeur chaîne gen1 EA888."},
{brand:"Volkswagen",model:"Golf",engine:"1.5 TSI",failure:"Injecteurs défectueux",probability:6,severity:"Élevé",system:"injection",description:"Défaut injecteurs TSI."},
{brand:"Volkswagen",model:"Golf",engine:"2.0 TDI",failure:"EGR encrassée",probability:7,severity:"Élevé",system:"egr",description:"Encrassement EGR TDI."},
{brand:"Volkswagen",model:"Tiguan",engine:"2.0 TDI",failure:"FAP colmaté",probability:7,severity:"Élevé",system:"echappement",description:"Colmatage FAP TDI."},
{brand:"Ford",model:"Focus",engine:"1.5 EcoBlue",failure:"Courroie humide délaminée",probability:8,severity:"Critique",system:"distribution",description:"Délamination courroie EcoBlue."},
{brand:"Ford",model:"Kuga",engine:"1.5 EcoBlue",failure:"Courroie humide délaminée",probability:8,severity:"Critique",system:"distribution",description:"Délamination courroie EcoBlue."},
{brand:"Hyundai",model:"Kona",engine:"Kona Electric",failure:"Runaway batterie HT",probability:5,severity:"Critique",system:"ht",description:"Emballement thermique batterie."},
{brand:"Tesla",model:"Model 3",engine:"Tesla LR",failure:"Runaway batterie HT",probability:4,severity:"Critique",system:"ht",description:"Emballement thermique batterie."},
{brand:"Renault",model:"Clio",engine:"1.5 Blue dCi",failure:"EGR encrassée",probability:6,severity:"Modéré",system:"egr",description:"Encrassement EGR dCi."},
{brand:"Renault",model:"Megane",engine:"1.3 TCe",failure:"Turbo défectueux",probability:5,severity:"Élevé",system:"turbo",description:"Défaut turbo TCe."},
{brand:"Peugeot",model:"308",engine:"1.6 BlueHDi",failure:"FAP colmaté",probability:7,severity:"Élevé",system:"echappement",description:"Colmatage FAP BlueHDi."},
{brand:"Peugeot",model:"3008",engine:"2.0 BlueHDi",failure:"AdBlue / SCR défaut",probability:6,severity:"Modéré",system:"adblue",description:"Cristallisation urée / défaut SCR."}
]};
var brands=clone(EMBED.brands),models=clone(EMBED.models),engines=clone(EMBED.engines),correlations=clone(EMBED.correlations);
function dBrands(l){var s={},o=[];l.forEach(function(b){if(!b||!b.name)return;var k=norm(b.name);if(!s[k]){s[k]=1;o.push(clone(b));}});return o;}
function dModels(l){var s={},o=[];l.forEach(function(m){if(!m||!m.name)return;var k=norm(m.brand)+"|"+norm(m.name);if(s[k]){var c=o[s[k]-1];c.variants=uVar((c.variants||[]).concat(m.variants||[]));if(m.years)c.years=m.years;c.aliases=uniq((c.aliases||[]).concat(m.aliases||[]));}else s[k]=o.push(clone(m));});return o;}
function uVar(v){var s={},o=[];(v||[]).forEach(function(x){if(!x||!x.engine)return;var k=norm(x.engine)+"|"+(x.power||"");if(!s[k]){s[k]=1;o.push(clone(x));}});return o;}
function dEngines(l){var s={},o=[];l.forEach(function(e){if(!e||!e.code)return;var k=norm(e.code);if(s[k]){var c=o[s[k]-1];c.names=uniq((c.names||[]).concat(e.names||[]));c.knownIssues=uniq((c.knownIssues||[]).concat(e.knownIssues||[]));c.brands=uniq((c.brands||[]).concat(e.brands||[]));}else o.push(clone(e));});return o;}
function dCorr(l){var s={},o=[];l.forEach(function(c){if(!c||!c.failure)return;var k=norm(c.brand)+"|"+norm(c.model)+"|"+norm(c.engine)+"|"+norm(c.failure);if(!s[k]){s[k]=1;o.push(clone(c));}});return o;}
function counts(){var powers={};models.forEach(function(m){(m.variants||[]).forEach(function(v){if(v.power)powers[norm(m.brand)+"|"+norm(m.name)+"|"+norm(v.engine)+"|"+v.power]=1;});});if(EIK){EIK.predictorVersion=VERSION;EIK.vehicleCount=models.length;EIK.engineCount=engines.length;EIK.powerCount=Object.keys(powers).length;EIK.corrCount=correlations.length;EIK.setCheck("pred","Catalogue prédictif","ok",brands.length+" marques · "+models.length+" modèles · "+engines.length+" motorisations · "+EIK.powerCount+" puissances");}}
function mergeCatalog(cat){if(!cat)return;brands=dBrands(brands.concat(cat.brands||[]));models=dModels(models.concat(cat.models||[]));engines=dEngines(engines.concat(cat.engines||[]));correlations=dCorr(correlations.concat(cat.correlations||[]));counts();try{localStorage.setItem("eik-catalog",JSON.stringify({brands:brands,models:models,engines:engines,correlations:correlations}));}catch(e){}try{W.dispatchEvent(new CustomEvent("eik-catalog",{detail:getStats()}));}catch(e){}}
function loadLocal(){try{var c=JSON.parse(localStorage.getItem("eik-catalog")||"null");if(c)mergeCatalog(c);}catch(e){}}
function loadRemote(){return Promise.all(["vehicles","engines","correlations"].map(function(n){return fetch("data/"+n+".json?v="+VERSION,{cache:"no-cache"}).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;});})).then(function(res){var cat={brands:[],models:[],engines:[],correlations:[]};res.forEach(function(j){if(!j)return;if(j.brands)cat.brands=cat.brands.concat(j.brands);if(j.models)cat.models=cat.models.concat(j.models);if(j.engines)cat.engines=cat.engines.concat(j.engines);if(j.correlations)cat.correlations=cat.correlations.concat(j.correlations);});mergeCatalog(cat);return true;});}
function inferVehicle(query){var q=norm(query),pm=String(query).match(/(\d{2,3})\s*(?:ch|hp|cv)\b/i),power=pm?pm[1]:null,b=null,m=null,e=null;brands.forEach(function(x){var n=norm(x.name);if(n.length>1&&q.indexOf(n)>=0)b=x.name;(x.aliases||[]).forEach(function(a){if(norm(a).length>2&&q.indexOf(norm(a))>=0)b=x.name;});});models.forEach(function(x){var hit=q.indexOf(norm(x.name))>=0;(x.aliases||[]).forEach(function(a){if(norm(a).length>1&&q.indexOf(norm(a))>=0)hit=true;});if(hit&&(!b||b===x.brand)){m=x;b=x.brand;}});engines.forEach(function(x){if(q.indexOf(norm(x.code))>=0)e=x;(x.names||[]).forEach(function(n){if(norm(n).length>3&&q.indexOf(norm(n))>=0)e=x;});});if(m){var best=null;(m.variants||[]).forEach(function(v){if(e&&norm(v.engine)===norm(e.code)&&(!power||String(v.power)===String(power)))best=v;else if(!best&&(!e||norm(v.engine)===norm(e.code)))best=v;});if(best){e=e||{code:best.engine};power=power||best.power;}}if(!b&&!m&&!e)return null;return{brand:b,model:m?m.name:null,engine:e?e.code:null,power:power,years:m?(m.years||""):"",confidence:(b&&m&&e)?"Élevé":(m||e)?"Moyen":"Partiel"};}
function findCorrelations(v){if(!v)return[];var b=norm(v.brand||""),m=norm(v.model||""),e=norm(v.engine||""),out=[];correlations.forEach(function(c){var s=0,cb=norm(c.brand||""),cm=norm(c.model||""),ce=norm(c.engine||"");if(b&&cb&&(b===cb||b.indexOf(cb)>=0||cb.indexOf(b)>=0))s+=40;if(m&&cm&&(m===cm||m.indexOf(cm)>=0||cm.indexOf(m)>=0))s+=50;if(e&&ce&&(e===ce||e.indexOf(ce)>=0||ce.indexOf(e)>=0))s+=60;if(s>0)out.push({failure:c.failure,probability:c.probability||Math.round(s/15),severity:c.severity||"Élevé",system:c.system||"generic",description:c.description||"",score:s,brand:c.brand,model:c.model,engine:c.engine});});return out.sort(function(x,y){return y.score-x.score;}).slice(0,30);}
function enginesFor(brand,model){var out=[];if(model){var m=models.find(function(x){return norm(x.name)===norm(model)&&(!brand||norm(x.brand)===norm(brand));});if(m)out=(m.variants||[]).map(function(v){return v.engine;});}if(!out.length&&brand)out=engines.filter(function(e){return(e.brands||[]).some(function(b){return norm(b)===norm(brand);});}).map(function(e){return e.code;});if(!out.length)out=engines.map(function(e){return e.code;});return uniq(out);}
function powersFor(brand,model,engine){var out=[];models.forEach(function(m){if(brand&&norm(m.brand)!==norm(brand))return;if(model&&norm(m.name)!==norm(model))return;(m.variants||[]).forEach(function(v){if(engine&&norm(v.engine)!==norm(engine))return;if(v.power)out.push(String(v.power));});});return uniq(out).sort(function(a,b){return parseInt(a,10)-parseInt(b,10);});}
function getStats(){var p={};models.forEach(function(m){(m.variants||[]).forEach(function(v){if(v.power)p[norm(m.brand)+"|"+norm(m.name)+"|"+norm(v.engine)+"|"+v.power]=1;});});return{brands:brands.length,models:models.length,engines:engines.length,powers:Object.keys(p).length,correlations:correlations.length};}
loadLocal();counts();var ready=loadRemote();
return{version:VERSION,ready:ready,mergeCatalog:mergeCatalog,inferVehicle:inferVehicle,findCorrelations:findCorrelations,analyzePredictive:function(q){var v=inferVehicle(q);return{vehicle:v,correlations:v?findCorrelations(v):[],confidence:v?v.confidence:"Aucun véhicule",query:q};},getStats:getStats,getBrands:function(){return clone(brands);},getModels:function(){return clone(models);},getEngines:function(){return clone(engines);},getCorrelations:function(){return clone(correlations);},enginesFor:enginesFor,powersFor:powersFor,exportCatalog:function(){return{brands:clone(brands),models:clone(models),engines:clone(engines),correlations:clone(correlations)};}};
})();
