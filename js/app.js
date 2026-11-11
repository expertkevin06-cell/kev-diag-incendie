// js/app.js
(function(){
"use strict";
var D=document,W=window;
function $(s,r){return (r||D).querySelector(s);}
function $all(s,r){return Array.prototype.slice.call((r||D).querySelectorAll(s));}
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
function norm(s){return String(s==null?"":s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");}
function safeUrl(u){return /^https?:\/\//i.test(String(u||""))?u:"#";}
function uid(){return (W.crypto&&crypto.randomUUID)?crypto.randomUUID():"id-"+Date.now()+"-"+Math.random().toString(16).slice(2);}
function toast(msg){var t=D.createElement("div");t.className="toast";t.textContent=msg;$("#toasts").appendChild(t);setTimeout(function(){if(t.parentNode)t.parentNode.removeChild(t);},4700);}
function store(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
function read(k,d){try{var v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}}
function uniq(a){return a.filter(function(v,i){return a.indexOf(v)===i;});}
function listify(x){return Array.isArray(x)?x:(x?[x]:[]);}

var CFG={PASSWORD:"Kevin83600",TOPIC:"eik-incendie-x7Q9mW4pL2",NTFY:"https://ntfy.sh",LOCK_MIN:15,APK_URL:"https://github.com/expertkevin06-cell/etude-incendie-technique-by-kevin/releases"};
var LABEL={pending:"⏳ En attente",granted:"✅ Accordé",denied:"⛔ Refusé",revoked:"🔄 Révoqué"};
var myId=localStorage.getItem("eik-id")||uid();localStorage.setItem("eik-id",myId);
var isAdmin=sessionStorage.getItem("eik-admin")==="1";
var state=read("eik-state",{devices:{},refs:{},wp:null,stateTs:0});
var lockTimer=null,lastRebroadcast=0,currentAnalysis=null,currentHits=[],active=-1,INDEX=[],KB=[],EXPAND={},SYSTEMS=[],btDevice=null,deferredPrompt=null;
var deckChapters=[],deckIdx=0,slideIdx=0,touchX=null,autoTimer=null;

var FALLBACK_SYSTEMS=[
{id:"distribution",label:"⛓️ Distribution / courroie",kw:["courroie","distribution","puretech","ecoblue","calage","tendeur","chaîne","galet"]},
{id:"injection",label:"⛽ Injection / carburant",kw:["injecteur","rampe","carburant","gdi","common rail","pompe hp"]},
{id:"gpl",label:"⛽ GPL",kw:["gpl","multivalve","réservoir"]},
{id:"echappement",label:"🌫️ Échappement / FAP / cata",kw:["fap","dpf","catalyseur","cata","collecteur","échappement","regen"]},
{id:"egr",label:"♻️ EGR / dépollution",kw:["egr","vanne egr","refroidisseur egr","calamine"]},
{id:"adblue",label:"💧 AdBlue / SCR",kw:["adblue","scr","nox","urée","p20ee"]},
{id:"turbo",label:"🌀 Turbo",kw:["turbo","suralimentation","wastegate"]},
{id:"refroidissement",label:"🌡️ Refroidissement / surchauffe",kw:["surchauffe","ldr","glycol","pompe à eau","thermostat","grippage"]},
{id:"basse12",label:"🔋 12V / DC-DC / USB",kw:["12v","cosse","dc-dc","usb","chargeur","h2"]},
{id:"ht",label:"🔌 Pack HT / cellules",kw:["pack","cellule","runaway","nmc","lfp","bms","busbar","immersion"]},
{id:"charge",label:"🔌 Charge DC / OBC",kw:["charge","obc","contacteur","broches","wallbox","onduleur"]},
{id:"freins",label:"🛑 Freins",kw:["frein","étrier","disque","plaquette"]},
{id:"faisceau",label:"⚡ Faisceau / courts-circuits",kw:["faisceau","court","arc","gaine","rongeur","pcb"]},
{id:"habitacle",label:"🚬 Habitacle / usager",kw:["mégot","habitacle","siège","mousse"]},
{id:"transmission",label:"⚙️ Boîte / embrayage",kw:["boîte","bva","dsg","eat","mécatronic","embrayage","volant moteur"]}
];
var FALLBACK_EXPAND={
courroie:["distribution","courroie humide","wet belt","Stellantis 1.2 PureTech","Ford 1.5 EcoBlue","Ford 2.0 EcoBlue","EB2","délamination","crépine","pompe à vide","dilution essence","huile","lubrification","P0016","P0017","P0521","calage distribution"],
humide:["courroie humide","wet belt","distribution immergée","PureTech","EcoBlue"],
distribution:["courroie","chaîne","calage","P0016","PureTech","EcoBlue","tendeur","galet"],
puretech:["courroie humide","distribution","EB2","Stellantis","1.2 essence","dilution huile","rappel courroie"],
ecoblue:["courroie humide","distribution","Ford 1.5","Ford 2.0","wet belt"],
crepine:["crépine d'aspiration d'huile","colmatage","débris courroie","pression huile","lubrification"],
delamination:["délamination courroie","désagrégation","débris noirs","crépine","pression huile"],
fap:["DPF","filtre à particules","régénération","P2463","P244A","P2002","catalyseur","herbe sèche","paille"],
dpf:["FAP","filtre à particules","régénération","P2463"],
catalyseur:["cata","P0420","surchauffe","collecteur","échappement"],
egr:["vanne EGR","calamine","refroidisseur EGR","fuite glycol","P0400"],
adblue:["SCR","NOx","injecteur urée","P20EE","cristallisation"],
turbo:["suralimentation","huile turbo","reniflard","auto-inflammation","grippage"],
batterie:["12V","48V","HT","cosse","H2","DC-DC","P0562"],
"12v":["batterie plomb","cosse","arc","H2","DC-DC","P0562","chargeur USB"],
ht:["haute tension","pack","cellules","BMS","isolation","P0AA6","runaway"],
runaway:["emballement thermique","NMC","NCA","LFP","jet-fire","ré-ignition","BMS"],
lfp:["runaway","H2","CO","ré-ignition longue"],
nmc:["runaway","O2 cathode","jet-fire","Bolt","Kona"],
charge:["charge DC","contacteur","broches","arc DC","wallbox","OBC"],
obc:["chargeur embarqué","onduleur","glycol","PCB","codes isolation"],
glycol:["liquide refroidissement","LDR","fuite","OBC","pompe pack"],
freins:["disques","étrier grippé","descente","pneu","feu de roue"],
faisceau:["gaine","frottement","rongeurs","court-circuit","arc","perles primaires"],
gpl:["multivalve","réservoir","remplissage 80%","nappe lourde","flash retour"],
injection:["rampe commune","GDI","common rail","injecteur","P0087"],
surchauffe:["pompe à eau","thermostat","LDR","grippage","P0217"],
immersion:["crue","inondation","corrosion","court différé"],
rappel:["campagne constructeur","RappelConso","NHTSA","Safety Gate","L421-3"],
vice:["vice caché","article 1641","antériorité","expertise"],
boite:["boîte de vitesses","DSG","EAT","BVA","mécatronic","huile ATF","volant moteur"]
};
var FALLBACK_KB=[
{id:"wet-belt-puretech",t:"Courroie de distribution humide — 1.2 PureTech (EB2)",sys:"distribution",en:"Thermique",zone:"Bloc moteur / distribution",sev:"Critique",prio:100,kw:["courroie humide","courroie distribution","puretech","1.2 puretech","eb2","wet belt","delamination","crepine","pompe a vide","dilution essence","huile","lubrification","distribution"],eng:["1.2 PureTech EB2 / EB2DT / EB2DTS","Peugeot 208/308/2008/3008","Citroën C3/C4/Rifter","Opel Crossland/Corsa","DS3/DS4"],origin:"Courroie de distribution immergée dans l'huile moteur (architecture wet belt).",mech:"Détérioration de la courroie par délamination / désagrégation du caoutchouc sous contraintes thermiques et chimiques.",roots:["Huile non conforme à la spécification constructeur ou vidanges espacées","Dilution de l'huile par de l'essence (trajets courts, démarrages à froid, injection directe)","Oxydation de l'huile et contraintes thermiques","Qualité / lot de courroie selon millésimes"],cons:["Débris de courroie dans l'huile → obstruction de la crépine d'aspiration","Chute de pression d'huile → défaut de lubrification (coussinets, turbo, AAC)","Perte d'assistance au freinage (pompe à vide lubrifiée par l'huile)","Surchauffe / grippage turbo / casse moteur par serrage","Déphasage distribution → contact soupapes/pistons (moteur interférentiel)"],sym:["Voyant pression huile","Bruit anormal distribution","Perte de puissance","Perte d'assistance au freinage","Fumée anormale"],dtc:["P0016","P0017","P0521","P0522","P0523","P0011","P0014"],idx:["Courroie fissurée / délaminée visible par bouchon de remplissage","Débris noirs dans l'huile / carter","Crépine colmatée par débris de courroie","Largeur de courroie mesurée au gabarit constructeur","Analyse d'huile : dilution essence, suies, usure"],act:["Contrôle visuel + gabarit largeur courroie","Vidange filtre avec spécification exacte","Remplacement courroie + galets + pompe à vide si débris","Nettoyage crépine / circuits d'huile + contrôle pression","Contrôle turbo / coussinets / AAC si voyant pression huile"],legal:"Vice caché 1641 si antériorité ; produit défectueux L421-3 si défaut de conception ; obligation de conseil L421-2 sur spécification d'huile ; entretien selon carnet.",src:[{label:"RappelConso",url:"https://rappel.conso.gouv.fr/"},{label:"Légifrance 1641",url:"https://www.legifrance.gouv.fr/search/all?query=1641+vice+cache"}],rel:["wet-belt-ecoblue","turbo-oil-leak","overheat-seizure"]},
{id:"wet-belt-ecoblue",t:"Courroie humide — Ford 1.5 / 2.0 EcoBlue",sys:"distribution",en:"Thermique",zone:"Bloc moteur / distribution",sev:"Critique",prio:90,kw:["courroie humide","ecoblue","ford ecoblue","wet belt","distribution","delamination","crepine","huile"],eng:["Ford 1.5 EcoBlue","Ford 2.0 EcoBlue","Transit / Focus / Kuga"],origin:"Courroie de distribution / pompe à huile immergée selon version.",mech:"Vieillissement et délamination du matériau en contact huile ; débris dans le circuit de lubrification.",roots:["Spécification d'huile et intervalles d'entretien","Dilution carburant et suies","Contraintes thermiques"],cons:["Colmatage crépine → chute pression huile","Déphasage / rupture distribution → casse moteur","Débris vers turbo et paliers"],sym:["Voyant huile","Claquement distribution","Démarrage difficile"],dtc:["P0016","P0017","P0521"],idx:["Débris dans huile","Crépine chargée","Calage déphasé"],act:["Contrôle courroie selon procédure constructeur","Nettoyage circuit huile","Remplacement kit + pompe à huile si débris"],legal:"Vice caché / produit défectueux selon antériorité et défaut ; entretien opposable selon carnet.",src:[{label:"RappelConso",url:"https://rappel.conso.gouv.fr/"}],rel:["wet-belt-puretech","overheat-seizure"]},
{id:"fap-regen-fire",t:"FAP / catalyseur + végétation — origine feu sous caisse",sys:"echappement",en:"Thermique",zone:"Soubassement",sev:"Critique",prio:70,kw:["fap","dpf","catalyseur","herbe","paille","regen","regeneration","feu sous caisse","p2463"],eng:["Diesels modernes FAP", "Tous véhicules stationnés sur végétation"],origin:"Ligne d'échappement / FAP en régénération active (600–1200 °C selon zone).",mech:"Rayonnement / convection vers végétation sèche → pyrolyse → inflammation sous caisse.",roots:["Stationnement sur herbe / paille","Régénération active ou post-injection","Écran thermique absent / bouclier dégradé"],cons:["Feu sous caisse → réservoir / durites / bouclier PP","Propagation habitacle / compartiment moteur","Fonte boucliers et faisceaux sous plancher"],sym:["Odeur brûlé","Fumée sous véhicule","Régénération fréquente"],dtc:["P2463","P244A","P2002"],idx:["Végétation carbonisée alignée sous FAP","Boucliers fondus","Log ECU régénération"],act:["Ne pas stationner sur végétation sèche","Contrôle écrans thermiques","Lecture logs régénération"],legal:"Usage / conseil L421-2 ; origine externe si log regen + environnement documenté.",src:[{label:"Légifrance L421-2",url:"https://www.legifrance.gouv.fr/search/all?query=L421-2"}],rel:["turbo-oil-leak","egr-cooler-glycol"]},
{id:"egr-cooler-glycol",t:"Refroidisseur EGR — fuite glycol / calamine",sys:"egr",en:"Thermique",zone:"Compartiment moteur",sev:"Élevé",prio:65,kw:["egr","refroidisseur egr","glycol","calamine","fuite","p0400","feu moteur"],eng:["Diesels EGR refroidi","BMW/NHTSA campagnes EGR"],origin:"Refroidisseur EGR (échangeur eau/gaz d'échappement).",mech:"Fuite interne glycol + suies → dépôts conducteurs / inflam. → risque thermique ; fuite externe sur point chaud.",roots:["Corrosion / fissure échangeur","Qualité LDR / entretien","Cycles thermiques"],cons:["Perte LDR → surchauffe","Dépôts dans admission → perte puissance","Risque feu si fuite sur échappement"],sym:["Odeur sucrée","Baisse LDR","Fumée blanche","P0400"],dtc:["P0400","P0217","P0401","P0402"],idx:["Traces glycol autour échangeur","Baisse niveau sans fuite externe visible","Suies humides admission"],act:["Test étanchéité échangeur","Remplacement refroidisseur","Contrôle LDR / calorstat"],legal:"Vice caché / produit défectueux selon défaut d'origine ; rappel si campagne.",src:[{label:"NHTSA Recalls",url:"https://www.nhtsa.gov/recalls"}],rel:["fap-regen-fire","overheat-seizure"]},
{id:"hp-fuel-leak",t:"Fuite carburant HP — GDI / common rail",sys:"injection",en:"Thermique",zone:"Compartiment moteur",sev:"Critique",prio:70,kw:["fuite carburant","injecteur","rampe","gdi","common rail","p0087","flash","feu moteur"],eng:["Essence injection directe","Diesels common rail"],origin:"Ligne / rampe / injecteur haute pression.",mech:"Fuite sous pression → aérosol carburant sur turbo / collecteur → inflammation immédiate.",roots:["Joint / raccord défectueux","Vibration / fatigue ligne","Défaut de serrage / réparation"],cons:["Flash feu baie moteur","Fonte faisceau / durites","Propagation habitacle"],sym:["Odeur carburant","Démarrage difficile","P0087"],dtc:["P0087","P0089","P0190"],idx:["Résidus rampe","Flaque centrale","Odeur persistante après nettoyage"],act:["Contrôle étanchéité HP","Remplacement joints/raccords","Nettoyage sécurisé + contrôle"],legal:"Défaut fabrication L421-3 ; rappel si défaut série ; vice caché si antérieur.",src:[{label:"RappelConso",url:"https://rappel.conso.gouv.fr/"}],rel:["turbo-oil-leak","fap-regen-fire"]},
{id:"turbo-oil-leak",t:"Huile sur turbo / échappement — auto-inflammation",sys:"turbo",en:"Thermique",zone:"Compartiment moteur",sev:"Critique",prio:68,kw:["turbo","huile","echappement","auto inflammation","reniflard","joint cache culbut","feu baie"],eng:["Tous moteurs suralimentés"],origin:"Fuite huile (cache-culbuteurs, reniflard, turbo) sur pièce chaude.",mech:"Huile 300–350 °C sur collecteur 400–800 °C → auto-inflammation → flamme baie moteur.",roots:["Joint / reniflard défaillant","Pression carter excessive","Entretien / niveau huile"],cons:["Feu baie moteur → habitacle","Fonte Al local (660 °C)","Dommages faisceau / durites"],sym:["Odeur huile brûlée","Fumée échappement","Suintement huile"],dtc:["—"],idx:["Vernis brun orienté","Départ sous fuite","Al fondu localement"],act:["Réparation fuite + nettoyage dégraissant","Contrôle pression carter","Contrôle turbo (jeu axial/radial)"],legal:"Vice caché si antérieur ; rappel L421-3 ; expertise contradictoire.",src:[{label:"Légifrance 1641",url:"https://www.legifrance.gouv.fr/search/all?query=1641+vice+cache"}],rel:["hp-fuel-leak","overheat-seizure"]}
];
SYSTEMS=FALLBACK_SYSTEMS.slice();EXPAND=FALLBACK_EXPAND;KB=FALLBACK_KB.slice();

var DTC=[
{code:"P0016",txt:"Corrélation vilebrequin / arbre à cames — calage décalé (courroie, chaîne).",q:"courroie distribution",sys:"distribution"},
{code:"P0017",txt:"Corrélation vilebrequin / AAC échappement — déphasage distribution.",q:"courroie distribution",sys:"distribution"},
{code:"P0087",txt:"Pression rampe carburant trop basse — fuite HP, pompe, injecteur.",q:"injection fuite",sys:"injection"},
{code:"P0217",txt:"Surchauffe moteur — pompe à eau, thermostat, perte LDR.",q:"surchauffe refroidissement",sys:"refroidissement"},
{code:"P0300",txt:"Ratés d’allumage multiples — mélange pauvre, catalyseur chaud.",q:"echappement catalyseur",sys:"echappement"},
{code:"P0562",txt:"Tension système 12V basse — batterie, cosse, DC-DC.",q:"12v batterie",sys:"basse12"},
{code:"P2463",txt:"FAP : accumulation de suie — régénérations incomplètes.",q:"fap regeneration",sys:"echappement"},
{code:"P244A",txt:"FAP : pression différentielle trop basse — filtre fissuré / absent.",q:"fap",sys:"echappement"},
{code:"P0420",txt:"Rendement catalyseur sous seuil — cata dégradé / surchauffe.",q:"catalyseur",sys:"echappement"},
{code:"P0AA6",txt:"Défaut d’isolement HT — pack, OBC, câblage haute tension.",q:"ht isolation obc",sys:"ht"},
{code:"P20EE",txt:"Efficacité SCR NOx sous seuil — AdBlue, injecteur urée.",q:"adblue scr",sys:"adblue"},
{code:"P0400",txt:"Débit EGR incorrect — vanne encrassée, calamine.",q:"egr",sys:"egr"},
{code:"P0521","txt":"Pression / portée capteur pression huile — niveau, crépine, pompe.",q:"crepine huile lubrification",sys:"distribution"},
{code:"P0522","txt":"Capteur pression huile signal bas — crépine colmatée, pompe, capteur.",q:"crepine huile",sys:"distribution"},
{code:"P0089",txt:"Régulateur pression carburant — performance pompe HP.",q:"injection",sys:"injection"}
];
var LEGAL=[
{code:"Art. 1641 C. civ.",txt:"Vice caché antérieur à la vente — action rédhibitoire ou estimatoire.",q:"1641 vice cache"},
{code:"Art. L421-3 C. conso.",txt:"Responsabilité du fait des produits défectueux (10 ans) — défaut de fabrication.",q:"L421-3 produit defectueux"},
{code:"Art. L421-2 C. conso.",txt:"Obligation générale de sécurité et de conseil — usage, notices.",q:"L421-2 securite"},
{code:"Expertise CPC",txt:"Expertise contradictoire — mission, sapiteur, conservation des traces.",q:"expertise contradictoire sapiteur"},
{code:"Art. R4227-1 C. travail",txt:"Prévention incendie sur lieux de travail — extincteurs, alarmes, dégagements.",q:"R4227 travail incendie"},
{code:"Assurance / CATNAT",txt:"Immersion, crue, catastrophe naturelle : conservation, déclaration, expertise.",q:"catastrophe naturelle immersion"}
];
var METHOD=[["Reconnaissance du site","Sécurisation des énergies, périmètre, risques résiduels."],["Reconnaissance préliminaire","Zone d’origine macro, lecture générale des dommages."],["Documentation","Photos avant toute manipulation, relevés, croquis."],["Patterns","V, alligatoring, crazed glass, spalling : orientation et intensité."],["Zone d’origine","Convergence des traces et gradients."],["Point d’origine","Localisation précise du foyer initial."],["Recherche des causes","Élimination méthodique des hypothèses."],["Conclusion","Certain / probable / indéterminé — proportionné aux preuves."]];
var PATTERNS=[["V-pattern","Pointe basse = origine probable."],["Alligatoring","Écailles brillantes = feu rapide / intense."],["Crazed glass","Verre microfissuré = chauffe rapide."],["Spalling béton","Éclatement = zone de forte chaleur."]];
var PHENOM=[["Flashover","600–800 °C : généralisation embrasement de la pièce."],["Backdraft","Explosion de fumées lors d’un apport d’air."],["Rollover","Langues de feu au plafond, gaz imbrûlés."],["Auto-inflammation","Huile 300–350 °C, diesel ~210 °C, essence ~280 °C."]];
var GAZ=[["CO","Combustion incomplète","Mortel dès 0,1 %"],["HCN","Polyuréthane, laine","Toxique cellulaire"],["HF","Batteries Li-ion","Mortel, corrosif"],["HCl","PVC","Corrosif, irritant"],["NOx","Hautes températures","Œdème pulmonaire"]];
var ZONES=[["Compartiment moteur","Moteur, turbo, catalyseur, FAP, faisceau, alternateur, durites.","Huile / carburant sur chaud, B+, régénération."],["Habitacle","PU, ABS/PC, 12V, USB, sièges, console.","Mégots, chargeurs, résistances de siège."],["Coffre","12V, réservoir, pack HT, hayon.","Bornes, court hayon, dégazage H2."],["Soubassement","Échappement, catalyseur, FAP, pack HT.","Cata sur herbes, impact pack."],["Roues","Disques, pneus, étriers.","600–900 °C, étrier grippé."],["Extérieur","Peinture, pare-chocs PP, végétation.","Feu externe, volontaire, environnement."]];
var FUSION=[["Aluminium","660","Fusion locale = indice de point chaud."],["Zinc","420","Fusion précoce, zones modérées."],["Plomb","327","Très précoce (bornes, soudures)."],
["Magnésium","650","Réactif, combustion vive."],["Cuivre","1085","Arc électrique ou feu intense."],["Argent","962","Contacts électriques."],["Or","1064","Connectique fine."],["Acier","1370–1530","Feu très intense ou arc."],["Verre","~700 (ramollissement)","Chauffe rapide, crazed glass."],["Titane","1668","Très haute température."]];
var PORTALS=[["RappelConso","Rappels officiels France","https://rappel.conso.gouv.fr/"],["NHTSA Recalls","Rappels constructeurs US","https://www.nhtsa.gov/recalls"],["Safety Gate UE","Alertes produits dangereux","https://ec.europa.eu/safety-gate-alerts/screen/search"],["Légifrance","Textes juridiques français","https://www.legifrance.gouv.fr/"]];

var GENERIC={
distribution:{origin:"Organe de synchronisation moteur (courroie, chaîne, galet, tendeur).",mech:"Usure, décalage de calage ou rupture de transmission du mouvement.",roots:["Entretien / tension / alignement","Qualité de pièce ou lubrification","Âge / kilométrage / contraintes thermiques"],cons:["Déphasage AAC/vilebrequin → perte puissance","Contact soupapes/pistons si moteur interférentiel","Débris → contamination huile"],sym:["Bruits métalliques","Démarrage difficile","P0016/P0017"],dtc:["P0016","P0017"],idx:["Tension / usure courroie","Alignement repères de calage","Débris dans carter"],act:["Contrôle calage au gabarit","Remplacement kit selon préconisation","Contrôle pression huile"],legal:"Entretien opposable selon carnet ; vice caché / produit défectueux si défaut d'origine."},
injection:{origin:"Circuit carburant haute pression (pompe, rampe, injecteur).",mech:"Perte d'étanchéité ou défaut de pulvérisation → aérosol / mauvais mélange.",roots:["Fatigue joint / raccord","Qualité carburant / filtration","Vibrations / réparation antérieure"],cons:["Fuite sur point chaud → flash feu","Ratés → surchauffe catalyseur","Perte puissance / mode dégradé"],sym:["Odeur carburant","Claquement injecteur","P0087"],dtc:["P0087","P0089","P0190"],idx:["Test étanchéité HP","Résidus autour rampe","Correction débit"],act:["Contrôle pression rampe","Remplacement joints/raccords","Nettoyage sécurisé"],legal:"Défaut fabrication L421-3 ; vice caché si antérieur ; rappel si campagne."},
echappement:{origin:"Ligne d'échappement, catalyseur, FAP, collecteur.",mech:"Surchauffe locale par post-combustion ou rayonnement vers combustible externe.",roots:["Régénération active / post-injection","Mélange pauvre / ratés","Écran thermique dégradé"],cons:["Feu sous caisse si végétation","Fonte boucliers / faisceaux","Perte efficacité dépollution"],sym:["Odeur brûlé","Fumée sous véhicule","P2463"],dtc:["P2463","P244A","P0420","P0300"],idx:["Coloration thermique ligne","Végétation carbonisée alignée","Logs régénération"],act:["Contrôle écrans thermiques","Lecture logs regen","Éviter stationnement sur herbe"],legal:"Usage / conseil L421-2 ; origine externe documentée."},
egr:{origin:"Vanne / refroidisseur EGR (recyclage gaz d'échappement).",mech:"Encrassement calamine ou fuite glycol → mauvais débit / dépôts.",roots:["Suies / cycles thermiques","Qualité LDR","Usage urbain / trajets courts"],cons:["Perte puissance / fumées","Fuite LDR → surchauffe","Risque feu si glycol sur chaud"],sym:["Fumée noire","Baisse LDR","P0400"],dtc:["P0400","P0401","P0402"],idx:["Traces glycol","Dépôts admission","Test étanchéité échangeur"],act:["Test étanchéité / remplacement","Nettoyage admission","Contrôle LDR"],legal:"Vice caché / produit défectueux selon défaut ; rappel si campagne."},
adblue:{origin:"Système SCR / AdBlue (réduction NOx).",mech:"Cristallisation urée / défaut injecteur → obstruction / mauvais dosage.",roots:["Qualité AdBlue / stockage","Cycles thermiques","Défaut pompe / capteur NOx"],cons:["Mode dégradé / interdiction démarrage","Défaut dépollution","Fuite urée corrosive"],sym:["Voyant SCR","Cristaux blancs","P20EE"],dtc:["P20EE","P204F","P20E8"],idx:["Cristaux injecteur","Test débit pompe","Capteurs NOx"],act:["Nettoyage / remplacement injecteur","Contrôle pompe / réservoir","Calibration capteurs"],legal:"Entretien / qualité produit ; vice caché si défaut d'origine."},
turbo:{origin:"Turbo-compresseur / circuit de suralimentation.",mech:"Défaut lubrification ou fuite huile sur chaud → grippage / auto-inflammation.",roots:["Pression huile / crépine","Joint / reniflard","Arrêts à chaud répétés"],cons:["Casse turbo → débris admission","Feu baie moteur","Perte puissance"],sym:["Sifflement","Fumée bleue","Odeur huile"],dtc:["P0299","P0234"],idx:["Jeu axial/radial","Traces huile dans échangeur","Pression huile"],act:["Contrôle jeu / fuite","Nettoyage / remplacement turbo","Contrôle lubrification"],legal:"Entretien / lubrification ; vice caché si défaut pièce."},
refroidissement:{origin:"Circuit de refroidissement (pompe, thermostat, LDR, radiateur).",mech:"Perte de circulation ou fuite → élévation thermique non maîtrisée.",roots:["Fuite / niveau LDR","Défaut pompe / thermostat","Ventilation / GMV"],cons:["Surchauffe → joint de culasse","Grippage moteur","Fuite glycol sur chaud → feu"],sym:["Aiguille température","Odeur sucrée","P0217"],dtc:["P0217","P0128"],idx:["Pression circuit","Traces fuite","Test thermostat"],act:["Test étanchéité","Remplacement pompe/thermostat","Purge circuit"],legal:"Entretien ; vice caché si défaut pièce d'origine."},
basse12:{origin:"Réseau 12V (batterie, cosse, DC-DC, masse).",mech:"Résistance de contact → effet Joule → arc / chute de tension.",roots:["Serrage / corrosion cosse","Batterie vieillissante","Défaut DC-DC / alternateur"],cons:["Arc / explosion H2","Immobilisation","Feu local près batterie"],sym:["Voyant batterie","Démarrage impossible","P0562"],dtc:["P0562","P0560"],idx:["Sulfate / cosse fondue","Test chute tension","Test charge"],act:["Nettoyage / serrage cosse","Test batterie / alternateur","Contrôle masse"],legal:"Entretien / pose ; vice caché si défaut régulateur / DC-DC."},
ht:{origin:"Pack haute tension / cellules / BMS.",mech:"Court interne / surchauffe → emballement thermique (runaway) selon chimie.",roots:["Défaut cellule / séparateur","Choc / déformation","Surcharge / immersion"],cons:["Jet-fire / gaz toxiques HF","Ré-ignition 24–72 h","Propagation module à module"],sym:["Voyant HT","Codes isolation","Gonflement pack"],dtc:["P0AA6","P0A7D"],idx:["Logs BMS pré-feu","Suie interne pack","Caméra thermique"],act:["Mise en sécurité HT","Surveillance thermique 24–72 h","Expertise pack / cellules"],legal:"Produit défectueux L421-3 ; rappel si campagne ; cause externe si choc documenté."},
charge:{origin:"Charge AC/DC, OBC, contacteurs, broches, wallbox.",mech:"Résistance de contact / arc DC → échauffement trappe / électronique.",roots:["Contamination broches","Relais soudé / fatigue","Défaut installation wallbox"],cons:["Feu trappe charge → pack","Fonte connectique","Défaut isolement"],sym:["Charge interrompue","Odeur brûlé trappe","Codes isolation"],dtc:["P0AA6"],idx:["Broches picotées","Contacteurs soudés","Logs borne"],act:["Contrôle connectique","Test isolement","Contrôle installation wallbox"],legal:"Installation tierce responsable si défaut pose ; véhicule = rappel si défaut série."},
freins:{origin:"Freins à disque / étrier / pneu.",mech:"Frottement prolongé → disque 600–900 °C → échauffement pneu / graisse.",roots:["Étrier grippé","Descente sans frein moteur","Usage intensif"],cons:["Feu roue → passage roue → habitacle","Fonte disque / plaquette","Perte efficacité freinage"],sym:["Odeur frein brûlé","Vibration","Fumée roue"],dtc:["—"],idx:["Disque bleui","Pneu fondu côté intérieur","Départ zone roue"],act:["Contrôle étrier / coulisseaux","Remplacement disques/plaquettes","Contrôle flexibles"],legal:"Usage / entretien ; vice caché si étrier défectueux."},
faisceau:{origin:"Faisceau électrique / connectique / masse.",mech:"Gaine agressée → court à la masse → arc > 2000 °C / perles primaires.",roots:["Frottement / rongeurs","Réparation aftermarket","Vibrations / chaleur"],cons:["Feu faisceau → fluides voisins","Fonte connectique","Pannes multiples"],sym:["Odeur isolant brûlé","Pannes intermittentes","Fusibles fondus"],dtc:["—"],idx:["Perles cuivre brillantes","Œillet fondu","Marques dents / nid"],act:["Réfection faisceau / protection","Contrôle masses","Dépose repose protégée"],legal:"Réparation / aftermarket = cause ; vice caché si défaut d'origine."},
gpl:{origin:"Circuit GPL (réservoir, multivalve, injecteurs gaz).",mech:"Fuite gaz lourd → nappe au sol → flash retour réservoir.",roots:["Étanchéité multivalve","Remplissage > 80 %","Rétrofit non conforme"],cons:["Boule de feu / souffle","Dommages coffre / soubassement","Risque explosion en zone confinée"],sym:["Odeur gaz","Givre vanne","Démarrage difficile"],dtc:["—"],idx:["Irisation sol","Givre vanne","Souffle arrière"],act:["Test étanchéité installation","Contrôle multivalve","Conformité rétrofit"],legal:"Installateur responsable si rétrofit non conforme ; usine = rappel."},
habitacle:{origin:"Habitacle (sièges, mousse PU, console, USB, 12V).",mech:"Pyrolyse lente / couvaison → flamme siège / console.",roots:["Mégot vide-poche","Chargeur USB bas de gamme","Résistance siège chauffant"],cons:["Feu siège → plafond / tableau de bord","Fumées toxiques CO/HCN","Propagation rapide en espace clos"],sym:["Odeur brûlé tissu","Fumée habitacle","Prise fondue"],dtc:["—"],idx:["V-pattern siège","Mousse charbonnée","Prise fondue"],act:["Conservation traces","Analyse origine externe","Contrôle chargeurs / résistances"],legal:"Cause externe usager ; exclut vice caché sauf défaut résistance."},
transmission:{origin:"Boîte de vitesses, mécatronic, embrayage, volant moteur.",mech:"Usure / pression huile ATF / défaut commande → à-coups / patinage / casse.",roots:["Entretien ATF","Charge / usage","Défaut mécatronic / actionneur"],cons:["Perte motricité","Casse boîte / débris","Surchauffe huile ATF"],sym:["À-coups","Patinage","Voyant boîte"],dtc:["P0700","P17BF"],idx:["Limaille huile ATF","Analyse huile","Défauts actionneurs"],act:["Vidange ATF selon spec","Diagnostic actionneurs","Remplacement mécatronic si défaut"],legal:"Entretien / usage ; vice caché si défaut d'origine."},
generic:{origin:"Système technique du véhicule sollicité par le mot-clé.",mech:"Dégradation progressive ou brutale d'un organe sous contrainte thermique, mécanique ou chimique.",roots:["Entretien / spécification fluide","Défaut de pièce / conception","Usage / environnement"],cons:["Perte de fonction","Dégradation en cascade","Risque thermique / sécurité"],sym:["Voyant / bruit / fuite","Perte de performance","Odeur / fumée anormale"],dtc:["—"],idx:["Lecture DTC + paramètres","Contrôle visuel / mesures","Historique entretien"],act:["Diagnostic ciblé","Mesures conservatoires","Contrôle après réparation"],legal:"Qualification à affiner selon antériorité, défaut d'origine et entretien."}
};

function sysLabel(id){var s=SYSTEMS.find(function(x){return x.id===id;});return s?s.label:id;}
function sevClass(s){return norm(s).indexOf("crit")>=0?"sev":(norm(s).indexOf("eleve")>=0?"sev":"");}
function expandQuery(q){
  var tokens=norm(q).split(/[^a-z0-9]+/).filter(function(t){return t.length>1;});
  var terms=tokens.slice(),chips=[];
  tokens.forEach(function(tk){Object.keys(EXPAND).forEach(function(key){var k=norm(key);
    if(tk===k||(tk.length>3&&k.indexOf(tk)===0)||(k.length>3&&tk.indexOf(k)===0)){EXPAND[key].forEach(function(e){var n=norm(e);if(terms.indexOf(n)<0){terms.push(n);if(chips.indexOf(e)<0)chips.push(e);}});}
  });});
  return {terms:uniq(terms),chips:chips.slice(0,14)};
}
function kbBody(e){return [e.t,e.sys,e.en,e.zone,(e.kw||[]).join(" "),(e.eng||[]).join(" "),e.origin,e.mech,(e.roots||[]).join(" "),(e.cons||[]).join(" "),e.legal].join(" ");}
function inferSystem(terms){
  var best={id:"generic",score:0};
  SYSTEMS.forEach(function(s){var sc=0;(s.kw||[]).forEach(function(k){var kn=norm(k);terms.forEach(function(t){if(kn===t||kn.indexOf(t)>=0||t.indexOf(kn)>=0)sc+=3;});});if(sc>best.score)best={id:s.id,score:sc};});
  return best.id;
}
function analyze(q){
  var ex=expandQuery(q),terms=ex.terms;
  var scored=KB.map(function(e){
    var sc=0,kw=(e.kw||[]).map(norm),body=norm(kbBody(e)),ti=norm(e.t),eng=(e.eng||[]).map(norm);
    terms.forEach(function(t){
      if(kw.some(function(k){return k===t||k.indexOf(t)>=0||t.indexOf(k)>=0;}))sc+=30;
      if(ti.indexOf(t)>=0)sc+=22;
      if(norm(e.sys)===t)sc+=16;
      if(eng.some(function(x){return x.indexOf(t)>=0;}))sc+=14;
      if(body.indexOf(t)>=0)sc+=6;
    });
    return {e:e,sc:sc+(e.prio||0)/10};
  }).filter(function(x){return x.sc>0;}).sort(function(a,b){return b.sc-a.sc;});
  var related=scored.slice(1,4).map(function(x){return x.e;});
  if(scored.length&&scored[0].sc>=25){
    var e=scored[0].e;
    return {known:true,query:q,title:e.t,sys:e.sys,sysLabel:sysLabel(e.sys),en:e.en||"Thermique",sev:e.sev||"Élevé",confidence:"Base locale — panne connue",origin:e.origin,mech:e.mech,roots:e.roots||[],cons:e.cons||[],sym:e.sym||[],dtc:e.dtc||[],idx:e.idx||[],act:e.act||[],legal:e.legal||"",src:e.src||[],rel:related,eng:e.eng||[],id:e.id};
  }
  var sid=inferSystem(terms),g=GENERIC[sid]||GENERIC.generic;
  return {known:false,query:q,title:"Orientation générique — "+sysLabel(sid),sys:sid,sysLabel:sysLabel(sid),en:"Tous",sev:"À confirmer",confidence:"Orientation générique — diagnostic à confirmer",origin:g.origin,mech:g.mech,roots:g.roots,cons:g.cons,sym:g.sym,dtc:g.dtc,idx:g.idx,act:g.act,legal:g.legal,src:[{label:"RappelConso",url:"https://rappel.conso.gouv.fr/"},{label:"NHTSA",url:"https://www.nhtsa.gov/recalls"}],rel:KB.filter(function(e){return e.sys===sid;}).slice(0,3),eng:[],id:"generic-"+sid};
}
function detailCard(title,arr,cls){var a=listify(arr).filter(Boolean);if(!a.length)return "";return '<div class="detail"><h4>'+esc(title)+'</h4><ul>'+a.map(function(x){return "<li>"+esc(x)+"</li>";}).join("")+'</ul></div>';}
function renderAnalysis(a){
  currentAnalysis=a;
  var chain=[{k:"Origine",v:a.origin,c:"o"},{k:"Mécanisme",v:a.mech,c:"m"},{k:"Causes racines",l:a.roots,c:"r"},{k:"Conséquences",l:a.cons,c:"c"},{k:"Actions",l:a.act,c:"a"}];
  var nodes=chain.map(function(n){return '<div class="node '+n.c+'"><h4>'+esc(n.k)+'</h4>'+(n.v?'<p>'+esc(n.v)+'</p>':'<ul>'+listify(n.l).map(function(x){return "<li>"+esc(x)+"</li>";}).join("")+'</ul>')+'</div>';}).join("");
  var dtcHtml=a.dtc&&a.dtc.length?'<div class="detail"><h4>Codes DTC</h4><div class="chips">'+a.dtc.map(function(x){return '<span class="chip muted">'+esc(x)+'</span>';}).join("")+'</div></div>':"";
  var sources=(a.src||[]).map(function(s){return '<a href="'+esc(safeUrl(s.url))+'" target="_blank" rel="noopener">'+esc(s.label)+' ↗</a>';}).join("");
  var related=(a.rel||[]).map(function(e){return '<button data-rel="'+esc(e.id)+'">🔗 '+esc(e.t)+'</button>';}).join("");
  var engines=a.eng&&a.eng.length?'<div class="analysis-legal"><b>🚘 Motorisations / modèles concernés :</b> '+esc(a.eng.join(" · "))+'</div>':"";
  $("#analysisResult").innerHTML=
    '<div class="analysis-head"><div><div class="eyebrow">'+(a.known?"🧠 Panne connue identifiée":"🧭 Orientation générique")+'</div><h3>'+esc(a.title)+'</h3><div class="tags"><span class="tag">'+esc(a.sysLabel)+'</span><span class="tag">'+esc(a.en)+'</span><span class="tag sev">'+esc(a.sev)+'</span><span class="tag">'+esc(a.confidence)+'</span></div></div><div class="analysis-actions"><button data-aa="present">📽️ Présenter</button><button data-aa="copy">📋 Copier</button><button data-aa="print">🖨️ Imprimer</button><button data-aa="share">↗ Partager</button></div></div>'+
    engines+'<div class="chain">'+nodes+'</div><div class="analysis-details">'+detailCard("Symptômes rencontrés",a.sym)+dtcHtml+detailCard("Indices à vérifier",a.idx)+'</div><div class="analysis-legal"><b>⚖️ Qualification juridique :</b> '+esc(a.legal)+'</div><div class="analysis-sources">'+sources+'</div>'+(related?'<div class="analysis-related">'+related+'</div>':'');
}
function analysisText(a){
  return "ANALYSE TECHNIQUE — ÉTUDE INCENDIE BY KEVIN\n\nMot-clé : "+a.query+"\nRésultat : "+a.title+"\nNiveau : "+a.confidence+"\n\n1) ORIGINE\n"+a.origin+"\n\n2) MÉCANISME\n"+a.mech+"\n\n3) CAUSES RACINES\n"+(a.roots||[]).map(function(x){return "• "+x;}).join("\n")+"\n\n4) CONSÉQUENCES\n"+(a.cons||[]).map(function(x){return "• "+x;}).join("\n")+"\n\n5) SYMPTÔMES\n"+(a.sym||[]).map(function(x){return "• "+x;}).join("\n")+"\n\n6) DTC\n"+(a.dtc||[]).join(", ")+"\n\n7) INDICES À VÉRIFIER\n"+(a.idx||[]).map(function(x){return "• "+x;}).join("\n")+"\n\n8) ACTIONS CORRECTIVES\n"+(a.act||[]).map(function(x){return "• "+x;}).join("\n")+"\n\n9) JURIDIQUE\n"+a.legal+"\n\nSources : "+(a.src||[]).map(function(s){return s.label+" — "+s.url;}).join(" | ");
}
function runAnalysis(q,scroll){
  q=String(q||"").trim();if(q.length<2){toast("Saisissez un mot-clé à analyser");return;}
  $("#aInput").value=q;renderAnalysis(analyze(q));
  if(scroll!==false){location.hash="#analyse";setTimeout(function(){$("#analysisResult").scrollIntoView({behavior:"smooth",block:"start"});},80);}
}
function rebuildIndex(){
  INDEX=[];
  KB.forEach(function(e){INDEX.push({g:"kb",id:e.id,title:e.t,sub:sysLabel(e.sys)+" · "+(e.en||"")+" · "+(e.sev||""),body:kbBody(e),keys:(e.kw||[]).join(" "),ref:e});});
  DTC.forEach(function(d){INDEX.push({g:"dtc",id:d.code,title:d.code+" — "+d.txt,sub:"Code défaut · "+sysLabel(d.sys),body:d.q,keys:d.sys,ref:d});});
  LEGAL.forEach(function(l){INDEX.push({g:"legal",id:l.code,title:l.code+" — "+l.txt,sub:"Référence juridique",body:l.q,keys:"juridique",ref:l});});
  METHOD.forEach(function(m,i){INDEX.push({g:"tech",id:"m"+i,title:m[0],sub:"NFPA 921 · étape "+(i+1),body:m[1],keys:"methode nfpa",ref:m});});
  ZONES.forEach(function(z,i){INDEX.push({g:"tech",id:"z"+i,title:z[0],sub:"Zone véhicule",body:z[1]+" "+z[2],keys:"zone",ref:z});});
  PHENOM.forEach(function(p,i){INDEX.push({g:"tech",id:"p"+i,title:p[0],sub:"Phénomène thermique",body:p[1],keys:"chimie feu",ref:p});});
  FUSION.forEach(function(f,i){INDEX.push({g:"tech",id:"f"+i,title:f[0]+" — fusion "+f[1]+" °C",sub:"Cartographie de fusion",body:f[2],keys:"fusion temperature materiau",ref:f});});
  Object.keys(state.refs).forEach(function(k){var r=state.refs[k];INDEX.push({g:"veille",id:r.rid,title:r.title,sub:(r.cat==="juridique"?"⚖️":"🔧")+" Référence admin",body:r.note||"",keys:"veille rappel",ref:r});});
  $("#statFiches").textContent=KB.length;$("#statKB").textContent=KB.length;
}
function doSearch(q,scope){
  var ex=expandQuery(q),out=[];
  INDEX.forEach(function(d){
    if(scope&&scope!=="all"&&d.g!==scope)return;
    var sc=0,hits=0,ti=norm(d.title),bo=norm(d.body),ke=norm(d.keys);
    ex.terms.forEach(function(t){
      if(ti.indexOf(t)>=0){sc+=14;hits++;}
      else if(ke.indexOf(t)>=0){sc+=10;hits++;}
      else if(bo.indexOf(t)>=0){sc+=5;hits++;}
    });
    if(d.g==="kb")sc+=8;
    if(hits)out.push({d:d,sc:sc});
  });
  out.sort(function(a,b){return b.sc-a.sc;});
  return {ex:ex,hits:out.slice(0,32)};
}
function renderSearch(){
  var q=$("#q").value.trim(),scope=$("#qScope").value;
  if(q.length<2){$("#results").innerHTML="";$("#chips").innerHTML='<span class="chip muted">Suggestions : courroie humide · FAP herbe · runaway LFP · 12V cosse · GPL · freins · EGR glycol · crépine</span>';currentHits=[];active=-1;return;}
  var r=doSearch(q,scope);currentHits=r.hits;active=r.hits.length?0:-1;
  $("#chips").innerHTML=r.ex.chips.length?'<span class="chip muted">🧠 Extension :</span>'+r.ex.chips.map(function(c){return '<button type="button" class="chip" data-chip="'+esc(c)+'">'+esc(c)+'</button>';}).join(""):"";
  var groups={kb:"🧠 Pannes connues / analyse causale",dtc:"🔧 Codes DTC",legal:"⚖️ Juridique",tech:"🧭 Technique / méthode",veille:"📡 Veille & rappels"};
  var html="",last="";
  if(!r.hits.length)html='<div class="empty">Aucun résultat. Essayez « courroie humide », « FAP », « runaway », « 12V », « GPL », « crépine »…</div>';
  r.hits.forEach(function(h,i){
    if(h.d.g!==last){last=h.d.g;html+='<div class="result-group">'+groups[h.d.g]+'</div>';}
    html+='<div class="result'+(i===active?' active':'')+'" data-i="'+i+'"><div><b>'+esc(h.d.title)+'</b><small>'+esc(h.d.sub)+'</small></div><span class="tag">'+Math.round(h.sc)+' pts</span></div>';
  });
  $("#results").innerHTML=html;
}
function openResult(h){
  var d=h.d;
  if(d.g==="kb"){runAnalysis(d.ref.kw&&d.ref.kw[0]?d.ref.kw[0]:d.ref.t);return;}
  if(d.g==="dtc")return openDrawer("Code DTC",d.title,'<p>'+esc(d.ref.txt)+'</p><p class="hint">Piste : '+esc(d.ref.q)+'</p>',[{label:"Analyser ce système",fn:function(){closeDrawer();runAnalysis(d.ref.q);}}]);
  if(d.g==="legal")return openDrawer("Juridique",d.title,'<p>'+esc(d.ref.txt)+'</p>',[{label:"Légifrance ↗",fn:function(){window.open("https://www.legifrance.gouv.fr/search/all?query="+encodeURIComponent(d.ref.q),"_blank","noopener");}}]);
  if(d.g==="veille"){var u=safeUrl(d.ref.url);if(u!=="#")window.open(u,"_blank","noopener");else location.hash="#veille";return;}
  openDrawer("Technique",d.title,'<p>'+esc(d.ref[1]||d.ref[2]||"")+'</p>',[]);
}
function legalTags(e){var t=norm(e.legal),o=[];if(t.indexOf("vice cache")>=0)o.push("vice-cache");if(t.indexOf("rappel")>=0||t.indexOf("l421")>=0)o.push("rappel");if(t.indexOf("entretien")>=0||t.indexOf("usage")>=0)o.push("entretien");if(t.indexOf("externe")>=0||t.indexOf("force majeure")>=0||t.indexOf("usager")>=0)o.push("externe");return o;}
function fillFilters(){
  var z=uniq(KB.map(function(e){return e.zone;})).sort();
  $("#fZone").innerHTML='<option value="">📍 Zone : toutes</option>'+z.map(function(x){return '<option>'+esc(x)+'</option>';}).join("");
  $("#fSystem").innerHTML='<option value="">⚙️ Système : tous</option>'+SYSTEMS.map(function(s){return '<option value="'+s.id+'">'+esc(s.label)+'</option>';}).join("");
}
function filteredKB(){
  var list=KB.slice(),en=$("#fEnergy").value,zo=$("#fZone").value,sy=$("#fSystem").value,le=$("#fLegal").value,tx=$("#fText").value.trim(),so=$("#fSort").value;
  if(en)list=list.filter(function(e){return e.en===en;});
  if(zo)list=list.filter(function(e){return e.zone===zo;});
  if(sy)list=list.filter(function(e){return e.sys===sy;});
  if(le)list=list.filter(function(e){return legalTags(e).indexOf(le)>=0;});
  if(tx){var terms=expandQuery(tx).terms;list=list.map(function(e){var ti=norm(e.t),bo=norm(kbBody(e)),sc=0;terms.forEach(function(t){if(ti.indexOf(t)>=0)sc+=14;else if(bo.indexOf(t)>=0)sc+=5;});return {e:e,sc:sc};}).filter(function(x){return x.sc>0;}).sort(function(a,b){return b.sc-a.sc;}).map(function(x){return x.e;});}
  if(so==="az")list.sort(function(a,b){return a.t.localeCompare(b.t,"fr");});
  else if(so==="zone")list.sort(function(a,b){return a.zone.localeCompare(b.zone,"fr");});
  return list;
}
function renderCards(){
  var list=filteredKB(),grid=$("#proGrid");
  $("#fCount").textContent=list.length+" fiche"+(list.length>1?"s":"");
  $("#fEmpty").hidden=list.length>0;grid.hidden=!list.length;
  grid.innerHTML=list.map(function(e,i){
    return '<article class="fiche" data-id="'+esc(e.id)+'" style="animation-delay:'+Math.min(i*35,350)+'ms"><div class="fiche-top '+(e.en==="VE"?"ev":"th")+'"><span>'+(e.en==="VE"?"🔋 VE":"🔥 Thermique")+'</span><span>📍 '+esc(e.zone)+'</span></div><h3>'+esc(e.t)+'</h3><p class="cause">'+esc(e.origin)+'</p><div class="tags"><span class="tag">'+esc(sysLabel(e.sys))+'</span><span class="tag sev">'+esc(e.sev||"")+'</span>'+(e.dtc&&e.dtc.length?'<span class="tag dtc">🔧 '+esc(e.dtc.slice(0,2).join(" · "))+'</span>':'')+'</div><div class="fiche-actions"><button class="btn-fire" data-act="analyze">🧠 Analyser</button><button data-act="present">📽️ Présenter</button><button data-act="more">📋 Détails</button></div><div class="fiche-more" hidden><p><b>Mécanisme :</b> '+esc(e.mech)+'</p><p><b>Conséquences :</b> '+esc((e.cons||[]).slice(0,2).join(" ; "))+'</p><p><b>Indices :</b> '+esc((e.idx||[]).slice(0,2).join(" ; "))+'</p><p><b>Juridique :</b> '+esc(e.legal)+'</p></div></article>';
  }).join("");
}
function ficheSlides(e){return [{h:e.t,cover:true,sub:e.zone},{h:"1 · Origine",b:e.origin},{h:"2 · Mécanisme",b:e.mech},{h:"3 · Causes racines",l:e.roots},{h:"4 · Conséquences",l:e.cons},{h:"5 · Symptômes",l:e.sym},{h:"6 · Codes DTC",l:e.dtc},{h:"7 · Indices à vérifier",l:e.idx},{h:"8 · Actions correctives",l:e.act},{h:"9 · Juridique",b:e.legal},{h:"10 · Sources",src:e.src||[]}];}
function analysisSlides(a){return [{h:a.title,cover:true,sub:a.sysLabel+" · "+a.sev},{h:"1 · Origine",b:a.origin},{h:"2 · Mécanisme",b:a.mech},{h:"3 · Causes racines",l:a.roots},{h:"4 · Conséquences",l:a.cons},{h:"5 · Symptômes",l:a.sym},{h:"6 · Codes DTC",l:a.dtc},{h:"7 · Indices à vérifier",l:a.idx},{h:"8 · Actions correctives",l:a.act},{h:"9 · Juridique",b:a.legal},{h:"10 · Sources",src:a.src||[]}];}
function openFicheDeck(list,startId){
  deckChapters=list.map(function(e){return {title:e.t,en:e.en,slides:ficheSlides(e)};});
  deckIdx=Math.max(0,list.findIndex(function(e){return e.id===startId;}));slideIdx=0;showDeck();
}
function openAnalysisDeck(a){deckChapters=[{title:a.title,en:a.en,slides:analysisSlides(a)}];deckIdx=0;slideIdx=0;showDeck();}
function showDeck(){stopAuto();$("#deck").hidden=false;D.body.classList.add("locked");renderSlide();}
function closeDeck(){$("#deck").hidden=true;D.body.classList.remove("locked");stopAuto();$("#deckOverview").hidden=true;try{history.replaceState(null,"",location.pathname+location.search);}catch(e){}}
function curSlides(){return deckChapters[deckIdx].slides;}
function step(d){
  var n=curSlides().length;slideIdx+=d;
  if(slideIdx>=n){if(deckIdx<deckChapters.length-1){deckIdx++;slideIdx=0;}else slideIdx=n-1;}
  if(slideIdx<0){if(deckIdx>0){deckIdx--;slideIdx=curSlides().length-1;}else slideIdx=0;}
  renderSlide();
}
function renderSlide(){
  var ch=deckChapters[deckIdx];if(!ch)return closeDeck();
  var sl=ch.slides,s=sl[slideIdx],box=$("#deckSlide");
  $("#deckTitle").textContent="🔥 "+ch.title;
  box.classList.remove("anim");void box.offsetWidth;box.classList.add("anim");
  if(s.cover)box.innerHTML='<div class="deck-cover"><span class="energy-big '+(ch.en==="VE"?"ev":"th")+'">'+(ch.en==="VE"?"🔋 ÉLECTRIQUE":"🔥 THERMIQUE")+'</span><h2>'+esc(ch.title)+'</h2><p>'+esc(s.sub||"")+'</p><p class="hint">← → pour naviguer · Échap pour quitter</p></div>';
  else if(s.src!==undefined)box.innerHTML='<h3>'+esc(s.h)+'</h3><ul>'+s.src.map(function(x){return '<li><a href="'+esc(safeUrl(x.url))+'" target="_blank" rel="noopener">'+esc(x.label)+' ↗</a></li>';}).join("")+'</ul>';
  else if(s.l!==undefined)box.innerHTML='<h3>'+esc(s.h)+'</h3><ul>'+listify(s.l).map(function(x){return '<li>'+esc(x)+'</li>';}).join("")+'</ul>';
  else box.innerHTML='<h3>'+esc(s.h)+'</h3><p class="big">'+esc(s.b||"—")+'</p>';
  $("#deckProgress").style.width=Math.round((slideIdx+1)/sl.length*100)+"%";
  $("#deckDots").innerHTML=sl.map(function(x,i){return '<span class="dot'+(i===slideIdx?' on':'')+'"></span>';}).join("");
  $("#deckCount").textContent="Fiche "+(deckIdx+1)+"/"+deckChapters.length+" · Diapo "+(slideIdx+1)+"/"+sl.length;
}
function toggleOverview(){
  var g=$("#deckOverview");if(!g.hidden){g.hidden=true;return;}
  g.innerHTML=deckChapters.map(function(ch,i){return '<button class="ov'+(i===deckIdx?' active':'')+'" data-i="'+i+'"><b>'+esc(ch.title)+'</b><small>'+esc(ch.en)+' · '+ch.slides.length+' diapos</small></button>';}).join("");g.hidden=false;
}
function stopAuto(){clearInterval(autoTimer);autoTimer=null;$("#deckPlay").textContent="▶";}
function toggleAuto(){if(autoTimer){stopAuto();return;}$("#deckPlay").textContent="⏸";autoTimer=setInterval(function(){step(1);},6000);}
function openDrawer(kind,title,body,actions){$("#drawerKind").textContent=kind;$("#drawerTitle").textContent=title;$("#drawerBody").innerHTML=body;var a=$("#drawerActions");a.innerHTML="";(actions||[]).forEach(function(x){var b=D.createElement("button");b.textContent=x.label;b.onclick=x.fn;a.appendChild(b);});$("#drawer").hidden=false;}
function closeDrawer(){$("#drawer").hidden=true;}
function renderStatic(){
  $("#steps").innerHTML=METHOD.map(function(m,i){return '<div class="step" data-n="'+(i+1)+'"><b>'+esc(m[0])+'</b><span>'+esc(m[1])+'</span></div>';}).join("");
  $("#patterns").innerHTML=PATTERNS.map(function(p){return '<div class="pattern"><b>'+esc(p[0])+'</b><span>'+esc(p[1])+'</span></div>';}).join("");
  $("#phenom").innerHTML=PHENOM.map(function(p){return '<div class="card"><b>'+esc(p[0])+'</b><span>'+esc(p[1])+'</span></div>';}).join("");
  $("#gazBody").innerHTML=GAZ.map(function(g){return '<tr><td><b>'+esc(g[0])+'</b></td><td>'+esc(g[1])+'</td><td>'+esc(g[2])+'</td></tr>';}).join("");
  $("#zonesGrid").innerHTML=ZONES.map(function(z,i){return '<div class="zone" data-i="'+i+'"><b>📍 '+esc(z[0])+'</b><span>'+esc(z[1])+'</span><span style="margin-top:.4rem;color:var(--fire2)">⚠️ '+esc(z[2])+'</span></div>';}).join("");
  $("#dtcGrid").innerHTML=DTC.map(function(d,i){return '<div class="dtc" data-i="'+i+'"><b>'+esc(d.code)+'</b><span>'+esc(d.txt)+'</span></div>';}).join("");
  $("#legalGrid").innerHTML=LEGAL.map(function(l,i){return '<div class="legal" data-i="'+i+'"><b>'+esc(l.code)+'</b><span>'+esc(l.txt)+'</span><a href="https://www.legifrance.gouv.fr/search/all?query='+encodeURIComponent(l.q)+'" target="_blank" rel="noopener">Légifrance ↗</a></div>';}).join("");
  $("#portals").innerHTML=PORTALS.map(function(p){return '<a class="portal" href="'+esc(p[2])+'" target="_blank" rel="noopener"><b>'+esc(p[0])+' ↗</b><span>'+esc(p[1])+'</span></a>';}).join("");
  $("#aQuick").innerHTML=["courroie humide","crépine","FAP herbe","EGR glycol","runaway LFP","12V cosse","charge DC","GPL","freins descente","Boîte DSG"].map(function(k){return '<button class="chip" data-ak="'+esc(k)+'">'+esc(k)+'</button>';}).join("");
}
function renderRefs(){var list=Object.keys(state.refs).map(function(k){return state.refs[k];}).sort(function(a,b){return (b.ts||0)-(a.ts||0);});$("#refEmpty").hidden=list.length>0;$("#refList").innerHTML=list.map(function(r){return '<div class="ref"><div><a href="'+esc(safeUrl(r.url))+'" target="_blank" rel="noopener">'+esc(r.title)+'</a><small>'+esc(r.cat==="juridique"?"⚖️ Juridique":"🔧 Technique")+' · '+esc(r.note||"")+'</small></div>'+(isAdmin?'<button class="danger" data-refdel="'+esc(r.rid)+'">🗑️</button>':'')+'</div>';}).join("");var last=list.reduce(function(a,r){return Math.max(a,r.ts||0);},0);$("#refUpdated").textContent=last?"MAJ "+new Date(last).toLocaleString("fr-FR"):"Base locale chargée";}
function renderAdmin(){if(!isAdmin)return;var list=Object.keys(state.devices).map(function(id){return {id:id,d:state.devices[id]};}).sort(function(a,b){return (b.d.ts||0)-(a.d.ts||0);});$("#reqCount").textContent=list.length;$("#reqEmpty").hidden=list.length>0;$("#reqList").innerHTML=list.map(function(x){var d=x.d;return '<div class="req"><div class="req-head"><b>'+esc(d.name||"?")+'</b><span class="badge '+esc(d.status)+'">'+esc(LABEL[d.status]||d.status)+'</span><small>'+new Date(d.ts||0).toLocaleString("fr-FR")+'</small></div><div class="req-actions"><button data-id="'+esc(x.id)+'" data-s="granted">✅ Accès</button><button data-id="'+esc(x.id)+'" data-s="denied">⛔ Refus</button><button data-id="'+esc(x.id)+'" data-s="revoked">🔄 Révoquer</button><button class="danger" data-id="'+esc(x.id)+'" data-s="del">🗑️</button></div></div>';}).join("");}

/* Temps réel admin */
var BASE=CFG.NTFY+"/"+CFG.TOPIC,seen={},es=null,queue=read("eik-queue",[]);
function saveState(){store("eik-state",state);}
function saveQueue(){store("eik-queue",queue.slice(-60));}
function deliver(p,mirror){if(!p||!p.mid||seen[p.mid])return;seen[p.mid]=1;onMsg(p);if(mirror&&W.BroadcastChannel){var bc=new BroadcastChannel("eik-sync");bc.postMessage(p);bc.close();}}
function post(p){return fetch(BASE,{method:"POST",body:JSON.stringify(p)}).then(function(r){if(!r.ok)throw new Error(r.status);});}
function publish(obj){var p=Object.assign({mid:uid(),ts:Date.now()},obj);deliver(p,true);if(!navigator.onLine){queue.push(p);saveQueue();return;}post(p).catch(function(){queue.push(p);saveQueue();});}
function flush(){var q=queue.slice();queue=[];saveQueue();q.forEach(function(p){post(p).catch(function(){queue.push(p);saveQueue();});});}
function publishFile(blob,name){return fetch(BASE,{method:"PUT",headers:{"X-Filename":name},body:blob}).then(function(r){if(!r.ok)throw new Error(r.status);return r.json();}).then(function(j){return j.attachment&&j.attachment.url;});}
function connect(){if(es)es.close();es=new EventSource(BASE+"/sse");es.onopen=function(){syncBadge(true);};es.onerror=function(){syncBadge(false);};es.onmessage=function(ev){try{var m=JSON.parse(ev.data);if(m.event==="message"&&m.message)deliver(JSON.parse(m.message),true);}catch(e){}};}
function replay(){fetch(BASE+"/json?poll=1&since=12h").then(function(r){return r.text();}).then(function(txt){txt.split("\n").forEach(function(l){if(!l.trim())return;try{var m=JSON.parse(l);if(m.event==="message"&&m.message)deliver(JSON.parse(m.message),true);}catch(e){}});}).catch(function(){});}
function syncBadge(ok){var b=$("#syncBadge");b.textContent=ok?"☁️ Temps réel":"🔁 Reconnexion…";b.className="pill "+(ok?"ok":"warn");}
function publishState(){state.stateTs=Date.now();saveState();publish({t:"state",devices:state.devices,ts:state.stateTs});}
function rebroadcast(){if(!isAdmin||Date.now()-lastRebroadcast<60000)return;lastRebroadcast=Date.now();publishState();Object.keys(state.refs).forEach(function(k){publish(state.refs[k]);});if(state.wp){fetch(state.wp.img).then(function(r){return r.blob();}).then(function(b){return publishFile(b,"fond.jpg");}).then(function(url){publish({t:"wp",url:url,ts:state.wp.ts,opacity:state.wp.opacity});}).catch(function(){});}}
function onMsg(m){
  if(!m||!m.t)return;
  if(m.t==="hello"&&isAdmin){rebroadcast();return;}
  if(m.t==="req"&&isAdmin){var cur=state.devices[m.id];state.devices[m.id]={name:String(m.name||"?").slice(0,40),status:cur&&cur.status==="granted"?"granted":"pending",ts:m.ts};saveState();publishState();renderAdmin();toast("📨 Demande : "+String(m.name||"?").slice(0,40));return;}
  if(m.t==="state"){if((m.ts||0)>=state.stateTs){state.devices=m.devices||{};state.stateTs=m.ts||0;saveState();route();renderAdmin();}return;}
  if(m.t==="wp"){if(!state.wp||(m.ts||0)>state.wp.ts)fetchWp(m);return;}
  if(m.t==="wpdel"){state.wp=null;saveState();applyWp();return;}
  if(m.t==="note"){toast("📢 "+String(m.text||"").slice(0,300));return;}
  if(m.t==="ref"){if(m.rid){state.refs[m.rid]=m;saveState();renderRefs();rebuildIndex();}return;}
  if(m.t==="refdel"){if(m.rid){delete state.refs[m.rid];saveState();renderRefs();rebuildIndex();}return;}
}
function route(){var me=state.devices[myId];var granted=isAdmin||(me&&me.status==="granted");$("#gate").hidden=granted;D.body.classList.toggle("locked",!granted);$("#admin").hidden=!isAdmin;$("#navAdmin").hidden=!isAdmin;if(granted)return;if(me&&me.status==="pending")gateStatus("pending","⏳ Demande envoyée","En attente de validation admin. L’accès s’ouvre automatiquement.");else if(me&&me.status==="denied")gateStatus("denied","⛔ Accès refusé","L’administrateur a refusé cette demande.");else if(me&&me.status==="revoked")gateStatus("revoked","🔄 Accès révoqué","Votre accès a été révoqué en temps réel.");else if(localStorage.getItem("eik-asked")==="1")gateStatus("pending","⏳ Demande envoyée","En attente de validation admin.");else $("#gateStatus").hidden=true;}
function gateStatus(cls,title,msg){var s=$("#gateStatus");s.className="gate-status "+cls;s.innerHTML="<b>"+esc(title)+"</b>"+esc(msg);s.hidden=false;}
function showGateTab(which){$("#tabTiers").classList.toggle("active",which==="tiers");$("#tabAdmin").classList.toggle("active",which==="admin");$("#paneTiers").hidden=which!=="tiers";$("#paneAdmin").hidden=which!=="admin";if(which==="admin"){$("#adminPass").value="";setTimeout(function(){$("#adminPass").focus();},80);}}
function askAccess(){var n=$("#gateName").value.trim();if(n.length<2){toast("Prénom trop court");return;}localStorage.setItem("eik-name",n);localStorage.setItem("eik-asked","1");state.devices[myId]={name:n,status:"pending",ts:Date.now()};saveState();route();publish({t:"req",id:myId,name:n});toast("📨 Demande envoyée");}
function armLock(){clearTimeout(lockTimer);lockTimer=setTimeout(lockAdmin,CFG.LOCK_MIN*60000);}
function lockAdmin(){isAdmin=false;sessionStorage.removeItem("eik-admin");clearTimeout(lockTimer);route();toast("🔒 Session admin verrouillée");}
function loginAdmin(pass){$("#adminPass").value="";if(pass!==CFG.PASSWORD){$("#loginForm").classList.add("shake");setTimeout(function(){$("#loginForm").classList.remove("shake");},450);toast("⛔ Mot de passe incorrect");return;}isAdmin=true;sessionStorage.setItem("eik-admin","1");armLock();route();renderAdmin();publishState();toast("🛡️ Mode admin actif");setTimeout(function(){location.hash="#admin";},120);}
function applyWp(){var l=$("#wpLayer");if(state.wp){l.style.backgroundImage="url("+state.wp.img+")";l.style.opacity=state.wp.opacity;}else{l.style.backgroundImage="none";l.style.opacity=1;}var p=$("#wpPreview");if(state.wp){p.style.backgroundImage="url("+state.wp.img+")";p.textContent="";}else{p.style.backgroundImage="none";p.textContent="Aucun fond personnalisé";}}
function fetchWp(m){fetch(m.url).then(function(r){return r.blob();}).then(function(b){return new Promise(function(res){var fr=new FileReader();fr.onload=function(){res(fr.result);};fr.readAsDataURL(b);});}).then(function(img){state.wp={img:img,ts:m.ts,opacity:m.opacity||.25};saveState();applyWp();toast("🖼️ Fond d’écran mis à jour");}).catch(function(){});}
function compress(file,maxDim,q){return new Promise(function(res,rej){var img=new Image();img.onload=function(){var dim=maxDim,quality=q,out="";do{var sc=Math.min(1,dim/Math.max(img.width,img.height));var c=D.createElement("canvas");c.width=Math.round(img.width*sc);c.height=Math.round(img.height*sc);c.getContext("2d").drawImage(img,0,0,c.width,c.height);out=c.toDataURL("image/jpeg",quality);dim=Math.round(dim*.75);quality-=.12;}while(out.length>1400000&&quality>.3);URL.revokeObjectURL(img.src);res(out);};img.onerror=rej;img.src=URL.createObjectURL(file);});}
function netBadge(){var c=navigator.connection||{},type="";if(c.type==="wifi")type="Wi-Fi";else if(c.type==="cellular")type=(c.effectiveType||"4g").toUpperCase()+"/5G";else if(c.effectiveType)type=c.effectiveType.toUpperCase();var b=$("#netBadge");b.textContent=navigator.onLine?"🟢 En ligne"+(type?" · "+type:""):"🟠 Hors ligne · local";b.className="pill "+(navigator.onLine?"ok":"warn");}
function btConnect(){if(!navigator.bluetooth){toast("Bluetooth Web indisponible — utilisez Chrome Android ou l’APK.");return;}navigator.bluetooth.requestDevice({acceptAllDevices:true,optionalServices:["battery_service","device_information"]}).then(function(dev){btDevice=dev;dev.addEventListener("gattserverdisconnected",function(){$("#btBadge").hidden=true;toast("Bluetooth déconnecté");});return dev.gatt.connect().then(function(g){var label=dev.name||"Appareil";return g.getPrimaryService("battery_service").then(function(s){return s.getCharacteristic("battery_level");}).then(function(ch){return ch.readValue();}).then(function(v){label+=" 🔋"+v.getUint8(0)+"%";}).catch(function(){}).then(function(){$("#btBadge").hidden=false;$("#btBadge").textContent="🔵 "+label;toast("Bluetooth connecté : "+label);});});}).catch(function(e){if(e&&e.name!=="NotFoundError")toast("Bluetooth : "+e.message);});}
function install(){if(deferredPrompt){deferredPrompt.prompt();deferredPrompt=null;$("#installBtn").hidden=true;}else toast("Pour installer : menu du navigateur → « Ajouter à l’écran d’accueil ».");}
function share(){var data={title:D.title,text:"Étude incendie technique by Kevin",url:location.href};if(navigator.share)navigator.share(data).catch(function(){});else if(navigator.clipboard)navigator.clipboard.writeText(location.href).then(function(){toast("🔗 Lien copié");}).catch(function(){window.open(CFG.APK_URL,"_blank","noopener");});else window.open(CFG.APK_URL,"_blank","noopener");}
W.addEventListener("beforeinstallprompt",function(e){e.preventDefault();deferredPrompt=e;$("#installBtn").hidden=false;});
function embers(){if(W.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches)return;var c=$("#embers"),x=c.getContext("2d"),ps=[],raf=null;function size(){var d=Math.min(devicePixelRatio||1,1.5);c.width=innerWidth*d;c.height=innerHeight*d;x.setTransform(d,0,0,d,0,0);}size();W.addEventListener("resize",size);for(var i=0;i<26;i++)ps.push({x:Math.random()*innerWidth,y:Math.random()*innerHeight,r:1+Math.random()*2.2,s:.25+Math.random()*.7,a:.15+Math.random()*.5,d:Math.random()*6.28});function loop(){x.clearRect(0,0,innerWidth,innerHeight);ps.forEach(function(p){p.y-=p.s;p.x+=Math.sin(p.d+p.y*.01)*.3;if(p.y<-10){p.y=innerHeight+10;p.x=Math.random()*innerWidth;}x.beginPath();x.arc(p.x,p.y,p.r,0,6.28);var g=x.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r*3);g.addColorStop(0,"rgba(255,154,61,"+p.a+")");g.addColorStop(1,"rgba(255,107,53,0)");x.fillStyle=g;x.fill();});raf=requestAnimationFrame(loop);}loop();D.addEventListener("visibilitychange",function(){if(D.hidden){cancelAnimationFrame(raf);raf=null;}else if(!raf)loop();});}
function reveals(){var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target);}});},{threshold:.12});$all("main section").forEach(function(s){io.observe(s);});var links=$all("nav a"),spy=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){links.forEach(function(a){a.classList.toggle("active",a.getAttribute("href")==="#"+e.target.id);});}});},{rootMargin:"-40% 0px -55% 0px"});$all("main section").forEach(function(s){spy.observe(s);});}
function bind(){
  $("#menuBtn").onclick=function(){$("#nav").classList.toggle("open");};
  $all("nav a").forEach(function(a){a.onclick=function(){$("#nav").classList.remove("open");};});
  $("#heroSearch").onclick=function(){location.hash="#recherche";setTimeout(function(){$("#q").focus();},450);};
  $("#heroAnalyse").onclick=function(){runAnalysis("courroie humide");};
  $("#heroPresent").onclick=function(){var l=filteredKB();if(l.length)openFicheDeck(l,l[0].id);};
  $("#heroMethodo").onclick=function(){location.hash="#methodo";};
  $("#tabTiers").onclick=function(){showGateTab("tiers");};
  $("#tabAdmin").onclick=function(){showGateTab("admin");};
  $("#gateForm").onsubmit=function(e){e.preventDefault();askAccess();};
  $("#loginForm").onsubmit=function(e){e.preventDefault();loginAdmin($("#adminPass").value);};
  $("#adminBtn").onclick=function(){if(isAdmin){location.hash="#admin";return;}$("#gate").hidden=false;D.body.classList.add("locked");showGateTab("admin");};
  $("#lockBtn").onclick=lockAdmin;
  $("#admin").addEventListener("pointerdown",function(){if(isAdmin)armLock();});
  $("#reqList").onclick=function(e){var b=e.target.closest("button");if(!b||!isAdmin)return;var id=b.dataset.id,s=b.dataset.s;if(s==="del")delete state.devices[id];else if(state.devices[id])state.devices[id].status=s;saveState();publishState();renderAdmin();toast(s==="del"?"🗑️ Appareil supprimé":"Statut : "+(LABEL[s]||s));};
  $("#wpFile").onchange=function(e){var f=e.target.files[0];if(!f)return;$("#wpStatus").textContent="Compression…";compress(f,1600,.82).then(function(img){var op=parseFloat($("#wpOpacity").value);state.wp={img:img,ts:Date.now(),opacity:op};saveState();applyWp();return fetch(img).then(function(r){return r.blob();}).then(function(b){return publishFile(b,"fond.jpg");}).then(function(url){publish({t:"wp",url:url,ts:state.wp.ts,opacity:op});$("#wpStatus").textContent="🖼️ Fond diffusé en temps réel.";toast("🖼️ Fond d’écran diffusé");});}).catch(function(){$("#wpStatus").textContent="Fond appliqué localement (réseau indisponible).";});e.target.value="";};
  $("#wpOpacity").oninput=function(){if(state.wp){state.wp.opacity=parseFloat(this.value);saveState();applyWp();}};
  $("#wpClear").onclick=function(){state.wp=null;saveState();applyWp();publish({t:"wpdel"});toast("Fond retiré");};
  $("#pubBtn").onclick=function(){var title=$("#pubTitle").value.trim(),url=$("#pubUrl").value.trim();if(!title||!/^https?:\/\//i.test(url)){toast("Titre + URL https:// requis");return;}publish({t:"ref",rid:uid(),title:title,url:url,cat:$("#pubCat").value,note:$("#pubNote").value.trim().slice(0,200),ts:Date.now()});$("#pubTitle").value=$("#pubUrl").value=$("#pubNote").value="";toast("📚 Référence publiée");};
  $("#noteBtn").onclick=function(){var t=$("#noteTxt").value.trim();if(!t)return;publish({t:"note",text:t.slice(0,300)});$("#noteTxt").value="";};
  $("#syncTest").onclick=function(){publish({t:"note",text:"🧪 Test du canal temps réel — "+new Date().toLocaleTimeString("fr-FR")});};
  $("#refList").onclick=function(e){var b=e.target.closest("[data-refdel]");if(!b||!isAdmin)return;publish({t:"refdel",rid:b.dataset.refdel});};
  var qt=null;
  $("#q").addEventListener("input",function(){clearTimeout(qt);qt=setTimeout(renderSearch,120);});
  $("#q").addEventListener("keydown",function(e){if(e.key==="ArrowDown"||e.key==="ArrowUp"){if(!currentHits.length)return;e.preventDefault();active=(active+(e.key==="ArrowDown"?1:-1)+currentHits.length)%currentHits.length;updateActive();}else if(e.key==="Enter"){if(currentHits[active]){e.preventDefault();openResult(currentHits[active]);}}else if(e.key==="Escape"){$("#results").innerHTML="";currentHits=[];}});
  $("#qScope").onchange=renderSearch;
  $("#searchBtn").onclick=function(){var q=$("#q").value.trim();if(!q){toast("Saisissez un mot-clé");return;}runAnalysis(q);};
  $("#chips").onclick=function(e){var b=e.target.closest("[data-chip]");if(!b)return;$("#q").value=b.dataset.chip;renderSearch();$("#q").focus();};
  $("#results").onclick=function(e){var r=e.target.closest(".result");if(!r)return;openResult(currentHits[+r.dataset.i]);};
  $("#aBtn").onclick=function(){runAnalysis($("#aInput").value);};
  $("#aInput").addEventListener("keydown",function(e){if(e.key==="Enter"){e.preventDefault();runAnalysis(this.value);}});
  $("#aQuick").onclick=function(e){var b=e.target.closest("[data-ak]");if(!b)return;runAnalysis(b.dataset.ak);};
  $("#analysisResult").onclick=function(e){
    var b=e.target.closest("[data-aa],[data-rel]");if(!b)return;
    if(b.dataset.aa){
      var a=currentAnalysis;if(!a)return;
      if(b.dataset.aa==="present")openAnalysisDeck(a);
      else if(b.dataset.aa==="copy"){var txt=analysisText(a);if(navigator.clipboard)navigator.clipboard.writeText(txt).then(function(){toast("📋 Rapport copié");}).catch(function(){toast("Copie impossible");});else toast("Copie non supportée");}
      else if(b.dataset.aa==="print")window.print();
      else if(b.dataset.aa==="share"){var text=analysisText(a);if(navigator.share)navigator.share({title:a.title,text:text}).catch(function(){});else if(navigator.clipboard)navigator.clipboard.writeText(text).then(function(){toast("📋 Analyse copiée");});}
    } else if(b.dataset.rel){var rel=KB.find(function(x){return x.id===b.dataset.rel;});if(rel)runAnalysis(rel.kw[0]||rel.t);}
  };
  ["fEnergy","fZone","fSystem","fLegal","fSort"].forEach(function(id){$("#"+id).onchange=renderCards;});
  var ft=null;$("#fText").addEventListener("input",function(){clearTimeout(ft);ft=setTimeout(renderCards,150);});
  $("#resetFilters").onclick=$("#emptyReset").onclick=function(){["fEnergy","fZone","fSystem","fLegal"].forEach(function(id){$("#"+id).value="";});$("#fText").value="";$("#fSort").value="pert";renderCards();};
  $("#presentAll").onclick=function(){var l=filteredKB();if(l.length)openFicheDeck(l,l[0].id);else toast("Aucune fiche à présenter");};
  $("#proGrid").onclick=function(e){var b=e.target.closest("[data-act]");if(!b)return;var card=e.target.closest(".fiche"),id=card.dataset.id,en=KB.find(function(x){return x.id===id;});if(!en)return;if(b.dataset.act==="analyze")runAnalysis(en.kw[0]||en.t);else if(b.dataset.act==="present")openFicheDeck(filteredKB(),id);else{var m=card.querySelector(".fiche-more");m.hidden=!m.hidden;b.textContent=m.hidden?"📋 Détails":"▲ Réduire";}};
  $("#zonesGrid").onclick=function(e){var z=e.target.closest(".zone");if(!z)return;var d=ZONES[+z.dataset.i];openDrawer("Zone véhicule",d[0],'<p><b>Composants :</b> '+esc(d[1])+'</p><p><b>Risques :</b> '+esc(d[2])+'</p>',[]);};
  $("#dtcGrid").onclick=function(e){var d=e.target.closest(".dtc");if(!d)return;var x=DTC[+d.dataset.i];openDrawer("Code DTC",x.code,'<p>'+esc(x.txt)+'</p><p class="hint">Piste : '+esc(x.q)+'</p>',[{label:"Analyser ce système",fn:function(){closeDrawer();runAnalysis(x.q);}}]);};
  $("#legalGrid").onclick=function(e){var l=e.target.closest(".legal");if(!l||e.target.tagName==="A")return;var x=LEGAL[+l.dataset.i];openDrawer("Juridique",x.code,'<p>'+esc(x.txt)+'</p>',[{label:"Légifrance ↗",fn:function(){window.open("https://www.legifrance.gouv.fr/search/all?query="+encodeURIComponent(x.q),"_blank","noopener");}}]);};
  $("#deckClose").onclick=closeDeck;$("#deckPrev").onclick=function(){step(-1);};$("#deckNext").onclick=function(){step(1);};
  $("#deckPrevF").onclick=function(){deckIdx=(deckIdx-1+deckChapters.length)%deckChapters.length;slideIdx=0;renderSlide();};
  $("#deckNextF").onclick=function(){deckIdx=(deckIdx+1)%deckChapters.length;slideIdx=0;renderSlide();};
  $("#deckOverviewBtn").onclick=toggleOverview;$("#deckPlay").onclick=toggleAuto;
  $("#deckFull").onclick=function(){if(D.fullscreenElement)D.exitFullscreen();else if($("#deck").requestFullscreen)$("#deck").requestFullscreen();};
  $("#deckOverview").onclick=function(e){var b=e.target.closest(".ov");if(!b)return;deckIdx=+b.dataset.i;slideIdx=0;$("#deckOverview").hidden=true;renderSlide();};
  D.addEventListener("keydown",function(e){if(!$("#deck").hidden){if(e.key==="ArrowRight"||e.key===" "||e.key==="PageDown"){e.preventDefault();step(1);}else if(e.key==="ArrowLeft"||e.key==="PageUp"){e.preventDefault();step(-1);}else if(e.key==="Escape")closeDeck();else if(e.key.toLowerCase()==="f")$("#deckFull").click();return;}if(!$("#drawer").hidden&&e.key==="Escape")closeDrawer();});
  $("#deck").addEventListener("touchstart",function(e){touchX=e.touches[0].clientX;},{passive:true});
  $("#deck").addEventListener("touchend",function(e){if(touchX==null)return;var dx=e.changedTouches[0].clientX-touchX;touchX=null;if(Math.abs(dx)>50)step(dx<0?1:-1);},{passive:true});
  $("#drawerClose").onclick=closeDrawer;$("#drawer").onclick=function(e){if(e.target.id==="drawer")closeDrawer();};
  $("#btBtn").onclick=btConnect;$("#installBtn").onclick=install;$("#installBtn2").onclick=install;$("#shareBtn").onclick=share;$("#shareBtn2").onclick=share;
  W.addEventListener("online",function(){netBadge();connect();replay();flush();});
  W.addEventListener("offline",netBadge);
  if(navigator.connection)navigator.connection.addEventListener("change",netBadge);
}
function updateActive(){$all(".result").forEach(function(el,i){el.classList.toggle("active",i===active);});var el=$all(".result")[active];if(el)el.scrollIntoView({block:"nearest"});}
function loadLocalBase(){
  var cachedKB=read("eik-kb",null);if(cachedKB&&cachedKB.length){KB=cachedKB;store("eik-kb",KB);}
  var cachedKW=read("eik-keywords",null);if(cachedKW&&cachedKW.expand){EXPAND=cachedKW.expand;SYSTEMS=cachedKW.themes||SYSTEMS;store("eik-keywords",cachedKW);}
  rebuildIndex();fillFilters();renderCards();
  fetch("data/pannes-connues.json").then(function(r){return r.ok?r.json():null;}).then(function(j){if(j&&j.length){KB=j;store("eik-kb",KB);rebuildIndex();fillFilters();renderCards();runAnalysis("courroie humide",false);}}).catch(function(){});
  fetch("data/keywords.json").then(function(r){return r.ok?r.json():null;}).then(function(j){if(j&&j.expand){EXPAND=j.expand;if(j.themes)SYSTEMS=j.themes;store("eik-keywords",j);rebuildIndex();fillFilters();renderCards();renderSearch();}}).catch(function(){});
  fetch("data/recalls-feed.json").then(function(r){return r.ok?r.json():null;}).then(function(j){if(!j)return;var arr=Array.isArray(j)?j:(j.items||j.recalls||[]);arr.slice(0,120).forEach(function(r,i){var t=[r.brand||r.marque,r.model||r.modele,r.subject||r.titre||r.title].filter(Boolean).join(" ");if(t)INDEX.push({g:"veille",id:"recall"+i,title:t,sub:"🚨 Rappel / veille",body:String(r.description||r.detail||""),keys:"rappel",ref:r});});}).catch(function(){});
}
function boot(){
  renderStatic();rebuildIndex();fillFilters();renderCards();renderRefs();renderAdmin();applyWp();route();netBadge();syncBadge(false);
  $("#gateName").value=localStorage.getItem("eik-name")||"";$("#aInput").value="courroie humide";runAnalysis("courroie humide",false);renderSearch();
  $("#topicInfo").textContent="Canal : "+CFG.TOPIC+" · SSE + historique 12 h + file hors ligne.";
  bind();reveals();embers();
  if(W.BroadcastChannel){var bc=new BroadcastChannel("eik-sync");bc.onmessage=function(e){deliver(e.data,false);};}
  connect();replay();flush();setInterval(function(){if(es&&es.readyState===2)connect();},30000);
  if(isAdmin)armLock();else publish({t:"hello",id:myId});
  loadLocalBase();
  if("serviceWorker" in navigator)navigator.serviceWorker.register("service-worker.js").catch(function(){});
}
boot();
})();
