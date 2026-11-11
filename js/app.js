(function(){
"use strict";

var D=document,W=window;
function $(s,r){return (r||D).querySelector(s);}
function $all(s,r){return Array.prototype.slice.call((r||D).querySelectorAll(s));}
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
function norm(s){return String(s==null?"":s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");}
function safeUrl(u){return /^https?:\/\//i.test(String(u||""))?String(u):"#";}
function uid(){return (W.crypto&&crypto.randomUUID)?crypto.randomUUID():"id-"+Date.now()+"-"+Math.random().toString(16).slice(2);}
function listify(x){return Array.isArray(x)?x.filter(Boolean):(x?[x]:[]);}
function lines(x){return String(x||"").split(/\n+/).map(function(s){return s.trim();}).filter(Boolean);}
function csv(x){return String(x||"").split(/[,;]/).map(function(s){return s.trim();}).filter(Boolean);}
function uniq(a){var o={},r=[];a.forEach(function(x){if(!o[x]){o[x]=1;r.push(x);}});return r;}
function store(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){toast("Stockage local saturé");}}
function read(k,d){try{var v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch(e){return d;}}
function toast(msg,kind){var t=D.createElement("div");t.className="toast"+(kind?" "+kind:"");t.textContent=msg;$("#toasts").appendChild(t);setTimeout(function(){if(t.parentNode)t.parentNode.removeChild(t);},4700);}
function download(name,text,type){var b=new Blob([text],{type:type||"application/json"});var a=D.createElement("a");a.href=URL.createObjectURL(b);a.download=name;a.click();setTimeout(function(){URL.revokeObjectURL(a.href);},1500);}

var CFG={PASSWORD:"Kevin83600",TOPIC:"eik-incendie-x7Q9mW4pL2",NTFY:"https://ntfy.sh",LOCK_MIN:15};
var LABEL={pending:"⏳ En attente",granted:"✅ Accordé",denied:"⛔ Refusé",revoked:"🔄 Révoqué"};
var myId=localStorage.getItem("eik-id")||uid();localStorage.setItem("eik-id",myId);
var isAdmin=sessionStorage.getItem("eik-admin")==="1";
var state=read("eik-state",{devices:{},refs:{},wp:null,stateTs:0});
var local=read("eik-local",{overrides:{},deleted:{},order:[],views:{}});
var baseKB=[],KB=[],SYSTEMS=[],EXPAND={},INDEX=[],currentAnalysis=null,currentHits=[],active=-1;
var selected={},undoStack=[],lockTimer=null,lastRebroadcast=0,deferredPrompt=null;
var deckChapters=[],deckIdx=0,slideIdx=0,touchX=null,autoTimer=null,dragId=null;

var FALLBACK_SYSTEMS=[
{id:"distribution",label:"⛓️ Distribution / courroie",kw:["courroie","distribution","puretech","ecoblue","calage","tendeur","chaine","galet","crepine","pompe a vide"]},
{id:"lubrification",label:"🛢️ Lubrification / huile",kw:["huile","lubrification","crepine","pression huile","pompe a huile","coussinet","dilution"]},
{id:"injection",label:"⛽ Injection / carburant",kw:["injecteur","rampe","carburant","gdi","common rail","pompe hp","essence","diesel"]},
{id:"echappement",label:"🌫️ Échappement / FAP / cata",kw:["fap","dpf","catalyseur","cata","collecteur","echappement","regen","vegetation"]},
{id:"egr",label:"♻️ EGR / dépollution",kw:["egr","vanne egr","refroidisseur egr","calamine"]},
{id:"adblue",label:"💧 AdBlue / SCR",kw:["adblue","scr","nox","uree","p20ee"]},
{id:"turbo",label:"🌀 Turbo / suralimentation",kw:["turbo","suralimentation","wastegate","reniflard"]},
{id:"refroidissement",label:"🌡️ Refroidissement / surchauffe",kw:["surchauffe","ldr","glycol","pompe a eau","thermostat","grippage","radiateur"]},
{id:"basse12",label:"🔋 12V / DC-DC / USB",kw:["12v","cosse","dc-dc","usb","chargeur","h2","alternateur"]},
{id:"ht",label:"🔌 Pack HT / cellules",kw:["pack","cellule","runaway","nmc","lfp","bms","busbar","immersion","isolation"]},
{id:"charge",label:"🔌 Charge AC/DC / OBC",kw:["charge","obc","contacteur","broches","wallbox","onduleur","trappe"]},
{id:"freins",label:"🛑 Freins / roues",kw:["frein","etrier","disque","plaquette","pneu","roulement"]},
{id:"faisceau",label:"⚡ Faisceau / courts-circuits",kw:["faisceau","court","arc","gaine","rongeur","pcb","connectique"]},
{id:"habitacle",label:"🚬 Habitacle / usager",kw:["megot","habitacle","siege","mousse","chargeur"]},
{id:"gpl",label:"⛽ GPL / gaz",kw:["gpl","multivalve","reservoir","gaz"]},
{id:"transmission",label:"⚙️ Boîte / embrayage",kw:["boite","bva","dsg","eat","mecatronic","embrayage","volant moteur","atf"]}
];

var FALLBACK_EXPAND={
courroie:["distribution","courroie humide","wet belt","Stellantis 1.2 PureTech","Ford 1.5 EcoBlue","Ford 2.0 EcoBlue","EB2","délamination","crépine","pompe à vide","dilution essence","huile","lubrification","P0016","P0017","P0521"],
humide:["courroie humide","wet belt","distribution immergée","PureTech","EcoBlue"],
distribution:["courroie","chaîne","calage","P0016","PureTech","EcoBlue","tendeur","galet"],
puretech:["courroie humide","distribution","EB2","Stellantis","1.2 essence","dilution huile","crépine"],
ecoblue:["courroie humide","distribution","Ford 1.5","Ford 2.0","wet belt"],
crepine:["crépine d'aspiration d'huile","colmatage","débris courroie","pression huile","lubrification","P0521","P0522"],
delamination:["délamination courroie","désagrégation","débris noirs","crépine","pression huile"],
huile:["lubrification","pression huile","crépine","dilution essence","P0521","P0522","courroie humide"],
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
{id:"wet-belt-puretech",title:"Courroie de distribution humide — 1.2 PureTech (EB2)",system:"distribution",energy:"Thermique",zone:"Bloc moteur / distribution",severity:"Critique",priority:100,keywords:["courroie humide","courroie distribution","puretech","1.2 puretech","eb2","wet belt","delamination","crepine","pompe a vide","dilution essence","huile","lubrification"],engines:["1.2 PureTech EB2","Peugeot 208/308/2008/3008","Citroën C3/C4","Opel Crossland/Corsa"],origin:"Courroie de distribution immergée dans l'huile moteur.",mechanism:"Détérioration par délamination / désagrégation du caoutchouc sous contraintes thermiques et chimiques.",roots:["Huile non conforme ou vidanges espacées","Dilution de l'huile par l'essence","Oxydation huile / contraintes thermiques","Qualité / lot courroie selon millésime"],consequences:["Débris dans l'huile → obstruction crépine","Chute pression huile → défaut lubrification","Perte assistance freinage via pompe à vide","Grippage turbo / coussinets / casse moteur","Déphasage distribution → contact soupapes/pistons"],symptoms:["Voyant pression huile","Bruit distribution","Perte puissance","Assistance freinage réduite"],dtc:["P0016","P0017","P0521","P0522","P0011"],evidence:["Courroie fissurée/délaminée visible","Débris noirs dans huile/carter","Crépine colmatée","Largeur courroie hors gabarit","Analyse huile : dilution essence / usure"],tests:["Contrôle visuel + gabarit largeur","Mesure pression huile à chaud","Dépose carter/crépine si débris suspectés","Analyse huile : carburant, suies, métaux","Lecture DTC et paramètres de calage"],actions:["Remplacer courroie + galets selon procédure","Nettoyer crépine et circuits d'huile","Contrôler turbo/coussinets/AAC","Utiliser huile à la spécification exacte"],safety:["Ne pas rouler si voyant pression huile","Contrôle freinage avant remise en circulation"],legal:"Vice caché 1641 si antériorité ; produit défectueux L421-3 ; conseil L421-2 sur huile ; entretien selon carnet.",sources:[{label:"RappelConso",url:"https://rappel.conso.gouv.fr/"},{label:"Légifrance 1641",url:"https://www.legifrance.gouv.fr/search/all?query=1641+vice+cache"}],related:["wet-belt-ecoblue","overheat-seizure"]},
{id:"fap-vegetation",title:"FAP / catalyseur + végétation — feu sous caisse",system:"echappement",energy:"Thermique",zone:"Soubassement",severity:"Critique",priority:80,keywords:["fap","dpf","catalyseur","herbe","paille","regen","feu sous caisse","p2463"],engines:["Diesels FAP","Véhicule stationné sur végétation"],origin:"Ligne échappement / FAP en régénération active.",mechanism:"Rayonnement/convection vers végétation sèche → pyrolyse → inflammation sous caisse.",roots:["Stationnement sur herbe/paille","Régénération active","Écran thermique absent/dégradé"],consequences:["Feu sous caisse → réservoir/durites/bouclier","Propagation habitacle/moteur","Fonte faisceaux sous plancher"],symptoms:["Odeur brûlé","Fumée sous véhicule","Régénération fréquente"],dtc:["P2463","P244A","P2002"],evidence:["Végétation carbonisée alignée sous FAP","Boucliers fondus","Log ECU régénération"],tests:["Relever logs régénération","Inspecter écrans thermiques","Cartographier traces sous caisse"],actions:["Éviter stationnement sur végétation sèche","Restaurer écrans thermiques","Contrôle ligne/FAP"],safety:["Refroidissement surveillé","Extincteur adapté à proximité"],legal:"Usage/conseil L421-2 ; origine externe si environnement + log documentés.",sources:[{label:"Légifrance L421-2",url:"https://www.legifrance.gouv.fr/search/all?query=L421-2"}],related:["turbo-oil-leak"]},
{id:"ev-runaway-nmc",title:"Runaway interne NMC/NCA — pack HT",system:"ht",energy:"VE",zone:"Plancher / pack HT",severity:"Critique",priority:85,keywords:["runaway","nmc","nca","emballement","jet fire","bms","cellule","p0aa6"],engines:["VE NMC/NCA"],origin:"Cellule Li-ion NMC/NCA.",mechanism:"Court interne → échauffement → dégazage → jet-fire et propagation.",roots:["Défaut cellule/séparateur","Choc/déformation","Surcharge/gestion thermique"],consequences:["Propagation module à module","Gaz toxiques HF/CO","Ré-ignition 24–72 h"],symptoms:["Voyant HT","Codes isolation","Gonflement pack","Odeur âcre"],dtc:["P0AA6","P0A7D"],evidence:["Suie interne pack","Busbars internes","Logs BMS pré-feu"],tests:["Mise en sécurité HT","Lecture BMS","Surveillance thermique prolongée"],actions:["Isolement véhicule","Stockage extérieur surveillé","Expertise pack/cellules"],safety:["Distance de sécurité","Pas de réintervention sans protocole HT"],legal:"Produit défectueux L421-3 ; rappel si campagne ; cause externe si choc documenté.",sources:[{label:"NHTSA",url:"https://www.nhtsa.gov/recalls"}],related:["ev-reignition"]}
];

var GENERIC={
distribution:{origin:"Organe de synchronisation moteur.",mechanism:"Usure, décalage de calage ou rupture de transmission du mouvement.",roots:["Entretien/tension/alignement","Qualité pièce ou lubrification","Âge/kilométrage/contraintes thermiques"],consequences:["Déphasage AAC/vilebrequin","Contact soupapes/pistons si interférentiel","Débris vers lubrification"],symptoms:["Bruits métalliques","Démarrage difficile","P0016/P0017"],dtc:["P0016","P0017"],evidence:["Repères calage","Tension/usure courroie","Débris carter"],tests:["Contrôle calage gabarit","Compression/étanchéité","Inspection débris"],actions:["Remplacement kit selon préconisation","Contrôle pression huile"],safety:["Arrêt moteur si bruit anormal ou voyant huile"],legal:"Entretien opposable ; vice caché/produit défectueux si défaut d'origine."},
lubrification:{origin:"Circuit de lubrification moteur.",mechanism:"Colmatage, pompage insuffisant ou huile dégradée → rupture film d'huile.",roots:["Crépine obstruée","Huile non conforme/diluée","Pompe à huile usée"],consequences:["Coussinets/turbo/AAC endommagés","Serrage moteur","Perte assistance vide"],symptoms:["Voyant huile","Claquement","P0521/P0522"],dtc:["P0521","P0522","P0523"],evidence:["Pression huile basse","Débris/crépine","Analyse huile"],tests:["Mesure pression huile","Dépose crépine","Analyse huile"],actions:["Nettoyage circuit","Remplacement pompe/crépine","Huile spécification exacte"],safety:["Arrêt immédiat si pression huile insuffisante"],legal:"Entretien ; vice caché si défaut conception lubrification."},
injection:{origin:"Circuit carburant haute pression.",mechanism:"Perte étanchéité ou pulvérisation défaut → aérosol / mauvais mélange.",roots:["Joint/raccord défectueux","Qualité carburant/filtration","Vibrations/réparation"],consequences:["Fuite sur chaud → flash","Ratés → surchauffe cata","Perte puissance"],symptoms:["Odeur carburant","Claquement","P0087"],dtc:["P0087","P0089","P0190"],evidence:["Test étanchéité HP","Résidus rampe","Correction débit"],tests:["Pression rampe","Test injecteurs","Inspection lignes"],actions:["Remplacer joints/raccords","Nettoyage sécurisé"],safety:["Pas de démarrage si fuite active"],legal:"Défaut fabrication L421-3 ; vice caché si antérieur."},
echappement:{origin:"Ligne échappement / catalyseur / FAP.",mechanism:"Surchauffe par post-combustion ou rayonnement vers combustible.",roots:["Régénération/post-injection","Mélange pauvre/ratés","Écran thermique dégradé"],consequences:["Feu sous caisse","Fonte boucliers/faisceaux","Perte dépollution"],symptoms:["Odeur brûlé","Fumée","P2463"],dtc:["P2463","P244A","P0420","P0300"],evidence:["Coloration thermique","Végétation carbonisée","Logs regen"],tests:["Logs régénération","Inspection écrans","Contrôle ratés"],actions:["Restaurer écrans","Contrôle FAP/cata"],safety:["Éviter végétation sèche"],legal:"Usage/conseil L421-2 ; origine externe documentée."},
egr:{origin:"Vanne/refroidisseur EGR.",mechanism:"Encrassement calamine ou fuite glycol → débit défaut / dépôts.",roots:["Suies/cycles thermiques","Qualité LDR","Usage urbain"],consequences:["Perte puissance/fumées","Perte LDR → surchauffe","Risque feu si glycol sur chaud"],symptoms:["Fumée","Baisse LDR","P0400"],dtc:["P0400","P0401","P0402"],evidence:["Traces glycol","Dépôts admission","Test étanchéité"],tests:["Test étanchéité échangeur","Contrôle débit EGR"],actions:["Nettoyage/remplacement","Contrôle LDR"],safety:["Surveiller température si fuite LDR"],legal:"Vice caché/produit défectueux ; rappel si campagne."},
adblue:{origin:"Système SCR/AdBlue.",mechanism:"Cristallisation urée / dosage défaut → obstruction / dépollution.",roots:["Qualité AdBlue/stockage","Cycles thermiques","Pompe/capteur NOx"],consequences:["Mode dégradé / anti-démarrage","Défaut dépollution","Fuite urée corrosive"],symptoms:["Voyant SCR","Cristaux blancs","P20EE"],dtc:["P20EE","P204F","P20E8"],evidence:["Cristaux injecteur","Débit pompe","Capteurs NOx"],tests:["Test débit","Contrôle capteurs"],actions:["Nettoyage/remplacement injecteur","Calibration"],safety:["Produit corrosif : protection"],legal:"Entretien/qualité produit ; vice caché si défaut origine."},
turbo:{origin:"Turbo / circuit suralimentation.",mechanism:"Défaut lubrification ou fuite huile sur chaud → grippage / inflammation.",roots:["Pression huile/crépine","Joint/reniflard","Arrêts à chaud"],consequences:["Casse turbo → débris admission","Feu baie moteur","Perte puissance"],symptoms:["Sifflement","Fumée bleue","Odeur huile"],dtc:["P0299","P0234"],evidence:["Jeu axial/radial","Huile dans échangeur","Pression huile"],tests:["Contrôle jeu","Test pression huile"],actions:["Remplacement turbo si jeu","Réparation fuite"],safety:["Arrêt si fumée huile importante"],legal:"Entretien/lubrification ; vice caché si défaut pièce."},
refroidissement:{origin:"Circuit refroidissement.",mechanism:"Perte circulation/fuite → élévation thermique non maîtrisée.",roots:["Fuite/niveau LDR","Pompe/thermostat","GMV/radiateur"],consequences:["Joint de culasse","Grippage","Glycol sur chaud → feu"],symptoms:["Température haute","Odeur sucrée","P0217"],dtc:["P0217","P0128"],evidence:["Pression circuit","Traces fuite","Test thermostat"],tests:["Test étanchéité","Test GMV"],actions:["Remplacer pompe/thermostat","Purge"],safety:["Arrêt si surchauffe"],legal:"Entretien ; vice caché si défaut pièce."},
basse12:{origin:"Réseau 12V.",mechanism:"Résistance contact → effet Joule → arc / chute tension.",roots:["Serrage/corrosion","Batterie vieillissante","DC-DC/alternateur"],consequences:["Arc/explosion H2","Immobilisation","Feu local"],symptoms:["Voyant batterie","Démarrage impossible","P0562"],dtc:["P0562","P0560"],evidence:["Cosse fondue/sulfate","Chute tension","Test charge"],tests:["Test batterie","Test alternateur/DC-DC"],actions:["Nettoyage/serrage cosse","Contrôle masses"],safety:["Ventilation battery / pas d'étincelle"],legal:"Entretien/pose ; vice caché si défaut régulateur."},
ht:{origin:"Pack HT / cellules / BMS.",mechanism:"Court interne / surchauffe → emballement thermique selon chimie.",roots:["Défaut cellule/séparateur","Choc/déformation","Surcharge/immersion"],consequences:["Jet-fire / gaz HF","Ré-ignition","Propagation modules"],symptoms:["Voyant HT","Codes isolation","Gonflement"],dtc:["P0AA6","P0A7D"],evidence:["Logs BMS","Suie interne","Caméra thermique"],tests:["Mise en sécurité HT","Surveillance thermique"],actions:["Isolement stockage","Expertise pack"],safety:["Distance / protocole HT"],legal:"Produit défectueux L421-3 ; rappel ; cause externe si choc."},
charge:{origin:"Charge AC/DC / OBC / wallbox.",mechanism:"Résistance contact / arc DC → échauffement trappe / électronique.",roots:["Contamination broches","Relais soudé","Défaut wallbox"],consequences:["Feu trappe → pack","Fonte connectique","Défaut isolement"],symptoms:["Charge interrompue","Odeur brûlé","Codes isolation"],dtc:["P0AA6"],evidence:["Broches picotées","Contacteurs soudés","Logs borne"],tests:["Contrôle connectique","Test isolement"],actions:["Remplacement connectique","Contrôle installation"],safety:["Couper charge avant inspection"],legal:"Installation tierce responsable ; véhicule = rappel si défaut série."},
freins:{origin:"Freins / roue / pneu.",mechanism:"Frottement prolongé → disque chaud → échauffement pneu/graisse.",roots:["Étrier grippé","Descente sans frein moteur","Surcharge"],consequences:["Feu roue → habitacle","Perte freinage"],symptoms:["Odeur frein","Vibration","Fumée roue"],dtc:[],evidence:["Disque bleui","Pneu fondu intérieur","Départ roue"],tests:["Contrôle étrier/coulisseaux","Test roulement"],actions:["Remplacement disques/plaquettes","Contrôle flexibles"],safety:["Ne pas stationner sur combustible après descente"],legal:"Usage/entretien ; vice caché si étrier défectueux."},
faisceau:{origin:"Faisceau / connectique / masse.",mechanism:"Gaine agressée → court masse → arc / perles primaires.",roots:["Frottement/rongeurs","Réparation aftermarket","Vibrations/chaleur"],consequences:["Feu faisceau → fluides voisins","Fonte connectique","Pannes multiples"],symptoms:["Odeur isolant","Pannes intermittentes","Fusibles fondus"],dtc:[],evidence:["Perles cuivre","Œillet fondu","Marques dents/nid"],tests:["Inspection visuelle","Contrôle continuité/isolement"],actions:["Réfection protégée","Contrôle masses"],safety:["Déconnecter batterie avant intervention"],legal:"Réparation/aftermarket ; vice caché si défaut origine."},
gpl:{origin:"Circuit GPL.",mechanism:"Fuite gaz lourd → nappe → flash retour réservoir.",roots:["Étanchéité multivalve","Remplissage >80%","Rétrofit non conforme"],consequences:["Boule de feu/souffle","Dommages coffre/soubassement"],symptoms:["Odeur gaz","Givre vanne"],dtc:[],evidence:["Irisation sol","Givre vanne","Souffle arrière"],tests:["Test étanchéité","Conformité rétrofit"],actions:["Réparation multivalve/lignes"],safety:["Ventilation / pas d'étincelle"],legal:"Installateur responsable si rétrofit non conforme ; usine = rappel."},
habitacle:{origin:"Habitacle / mousse / console.",mechanism:"Pyrolyse lente / couvaison → flamme siège/console.",roots:["Mégot","Chargeur USB bas de gamme","Résistance siège"],consequences:["Feu siège → plafond","Fumées CO/HCN"],symptoms:["Odeur tissu brûlé","Fumée habitacle"],dtc:[],evidence:["V-pattern siège","Mousse charbonnée","Prise fondue"],tests:["Conservation traces","Contrôle chargeurs/résistances"],actions:["Analyse origine externe"],safety:["Évacuation / fumées toxiques"],legal:"Cause externe usager ; vice caché seulement si défaut résistance."},
transmission:{origin:"Boîte / mécatronic / embrayage.",mechanism:"Usure / pression ATF / commande défaut → patinage / casse.",roots:["Entretien ATF","Usage intensif","Mécatronic/actionneur"],consequences:["Perte motricité","Débris métalliques","Surchauffe ATF"],symptoms:["À-coups","Patinage","Voyant boîte"],dtc:["P0700","P17BF"],evidence:["Limaille ATF","Défauts actionneurs"],tests:["Analyse huile","Diagnostic actionneurs"],actions:["Vidange ATF spec","Remplacement mécatronic"],safety:["Éviter roulage si patinage sévère"],legal:"Entretien/usage ; vice caché si défaut origine."},
generic:{origin:"Système technique sollicité par le mot-clé.",mechanism:"Dégradation progressive ou brutale sous contrainte thermique, mécanique ou chimique.",roots:["Entretien/spécification fluide","Défaut pièce/conception","Usage/environnement"],consequences:["Perte fonction","Dégradation cascade","Risque thermique/sécurité"],symptoms:["Voyant/bruit/fuite","Perte performance","Odeur/fumée"],dtc:[],evidence:["DTC + paramètres","Contrôle visuel/mesures","Historique entretien"],tests:["Diagnostic ciblé","Mesures conservatoires","Contrôle après réparation"],actions:["Diagnostic ciblé","Mesures conservatoires"],safety:["Mise en sécurité avant essai"],legal:"Qualification à affiner selon antériorité, défaut origine, entretien."}
};

var METHOD=[
["Qualifier","Symptôme, système, énergie, zone, conditions d'apparition."],
["Étendre","Aliases, motorisations, DTC, mécanismes, pannes connues."],
["Observer","Traces, fuites, débris, coloration, logs, mesures."],
["Mécanisme","Chaîne physique/chimique reliant cause et effet."],
["Comparer","Pannes connues, campagnes, cas similaires, alternatives."],
["Tester","Mesures, étanchéité, pression, isolement, logs, analyse fluide."],
["Éliminer","Hypothèses alternatives non compatibles avec les preuves."],
["Conclure","Certain / probable / possible / indéterminé + limites."]
];
var EVIDENCE=[
["Certain","Preuves convergentes + mécanisme compatible + alternatives éliminées.","Cause établie avec éléments objectifs concordants."],
["Probable","Faisceau d'indices cohérent, mesure/log disponible, alternative moins probable.","Cause probable au vu des éléments disponibles."],
["Possible","Mécanisme plausible mais preuves partielles ou non discriminantes.","Hypothèse possible nécessitant vérification complémentaire."],
["Indéterminé","Données insuffisantes ou traces détruites/ambiguës.","Origine indéterminée en l'état des éléments transmis."]
];
var DTC=[
{code:"P0016",txt:"Corrélation vilebrequin/AAC — calage décalé.",q:"courroie distribution"},
{code:"P0017",txt:"Corrélation vilebrequin/AAC échappement.",q:"courroie distribution"},
{code:"P0521",txt:"Pression huile — portée/performance.",q:"crepine huile lubrification"},
{code:"P0522",txt:"Pression huile signal bas.",q:"crepine huile"},
{code:"P0087",txt:"Pression rampe carburant trop basse.",q:"injection fuite"},
{code:"P0217",txt:"Surchauffe moteur.",q:"surchauffe refroidissement"},
{code:"P2463",txt:"FAP accumulation suie.",q:"fap regeneration"},
{code:"P0420",txt:"Rendement catalyseur sous seuil.",q:"catalyseur"},
{code:"P0AA6",txt:"Défaut isolement HT.",q:"ht isolation obc"},
{code:"P0562",txt:"Tension 12V basse.",q:"12v batterie"},
{code:"P20EE",txt:"Efficacité SCR NOx sous seuil.",q:"adblue scr"},
{code:"P0400",txt:"Débit EGR incorrect.",q:"egr"}
];
var PORTALS=[
["RappelConso","Rappels officiels France","https://rappel.conso.gouv.fr/"],
["NHTSA Recalls","Rappels constructeurs US","https://www.nhtsa.gov/recalls"],
["Safety Gate UE","Alertes produits dangereux","https://ec.europa.eu/safety-gate-alerts/screen/search"],
["Légifrance","Textes juridiques français","https://www.legifrance.gouv.fr/"]
];

function sysLabel(id){var s=SYSTEMS.find(function(x){return x.id===id;});return s?s.label:id;}
function sevRank(s){s=norm(s);return s.indexOf("crit")>=0?3:s.indexOf("elev")>=0?2:s.indexOf("mod")>=0?1:0;}
function computeKB(){
  var map={};
  baseKB.forEach(function(e){map[e.id]=e;});
  Object.keys(local.overrides||{}).forEach(function(id){map[id]=local.overrides[id];});
  var arr=Object.keys(map).map(function(id){return map[id];}).filter(function(e){return e&&!local.deleted[e.id];});
  var order=local.order||[];
  arr.sort(function(a,b){
    var ia=order.indexOf(a.id),ib=order.indexOf(b.id);
    if(ia>=0&&ib>=0)return ia-ib;
    if(ia>=0)return -1;
    if(ib>=0)return 1;
    return (b.priority||50)-(a.priority||50)||a.title.localeCompare(b.title,"fr");
  });
  return arr;
}
function saveLocal(){store("eik-local",local);}
function refreshKB(){KB=computeKB();rebuildIndex();fillFilters();renderLibrary();renderStats();}
function expandQuery(q){
  var tokens=norm(q).split(/[^a-z0-9]+/).filter(function(t){return t.length>1;});
  var terms=tokens.slice(),chips=[];
  tokens.forEach(function(tk){
    Object.keys(EXPAND).forEach(function(key){
      var k=norm(key);
      if(tk===k||(tk.length>3&&k.indexOf(tk)===0)||(k.length>3&&tk.indexOf(k)===0)){
        EXPAND[key].forEach(function(e){var n=norm(e);if(terms.indexOf(n)<0){terms.push(n);if(chips.indexOf(e)<0)chips.push(e);}});
      }
    });
  });
  return {terms:uniq(terms),chips:chips.slice(0,14)};
}
function recordBody(e){return [e.title,e.system,e.energy,e.zone,e.mode,(e.keywords||[]).join(" "),(e.engines||[]).join(" "),e.origin,e.mechanism,(e.roots||[]).join(" "),(e.consequences||[]).join(" "),(e.symptoms||[]).join(" "),(e.dtc||[]).join(" "),e.legal].join(" ");}
function inferSystem(terms){
  var best={id:"generic",score:0};
  SYSTEMS.forEach(function(s){
    var sc=0;
    (s.kw||[]).forEach(function(k){var kn=norm(k);terms.forEach(function(t){if(kn===t||kn.indexOf(t)>=0||t.indexOf(kn)>=0)sc+=3;});});
    if(sc>best.score)best={id:s.id,score:sc};
  });
  return best.id;
}
function analyze(q){
  var ex=expandQuery(q),terms=ex.terms;
  var scored=KB.map(function(e){
    var sc=0,coverage=0,kw=(e.keywords||[]).map(norm),body=norm(recordBody(e)),ti=norm(e.title),eng=(e.engines||[]).map(norm);
    terms.forEach(function(t){
      var hit=false;
      if(kw.some(function(k){return k===t||k.indexOf(t)>=0||t.indexOf(k)>=0;})){sc+=34;hit=true;}
      if(ti.indexOf(t)>=0){sc+=24;hit=true;}
      if(norm(e.system)===t){sc+=16;hit=true;}
      if(eng.some(function(x){return x.indexOf(t)>=0;})){sc+=16;hit=true;}
      if(body.indexOf(t)>=0){sc+=7;hit=true;}
      if(hit)coverage++;
    });
    return {e:e,sc:sc+(e.priority||0)/10,coverage:coverage};
  }).filter(function(x){return x.sc>0;}).sort(function(a,b){return b.sc-a.sc;});
  var top=scored[0],alts=scored.slice(1,4).map(function(x){return x.e;});
  if(top&&top.sc>=40&&top.coverage>=1){
    var e=top.e;
    var level=top.coverage>=3&&top.sc>=90?"Probable à élevé":top.coverage>=2?"Probable":"Possible";
    return {known:true,query:q,title:e.title,system:e.system,systemLabel:sysLabel(e.system),energy:e.energy||"Thermique",severity:e.severity||"Élevé",level:level,score:Math.round(top.sc),confidence:"Base locale — panne connue documentée",origin:e.origin,mechanism:e.mechanism,roots:e.roots||[],consequences:e.consequences||[],symptoms:e.symptoms||[],dtc:e.dtc||[],evidence:e.evidence||[],tests:e.tests||[],actions:e.actions||[],safety:e.safety||[],legal:e.legal||"",sources:e.sources||[],related:alts,engines:e.engines||[],id:e.id};
  }
  var sid=inferSystem(terms),g=GENERIC[sid]||GENERIC.generic;
  return {known:false,query:q,title:"Orientation générique — "+sysLabel(sid),system:sid,systemLabel:sysLabel(sid),energy:"Tous",severity:"À confirmer",level:"Possible / indéterminé",score:0,confidence:"Hypothèse générique — diagnostic à confirmer",origin:g.origin,mechanism:g.mechanism,roots:g.roots,consequences:g.consequences,symptoms:g.symptoms,dtc:g.dtc,evidence:g.evidence,tests:g.tests,actions:g.actions,safety:g.safety,legal:g.legal,sources:[{label:"RappelConso",url:"https://rappel.conso.gouv.fr/"},{label:"NHTSA",url:"https://www.nhtsa.gov/recalls"}],related:KB.filter(function(e){return e.system===sid;}).slice(0,3),engines:[],id:"generic-"+sid};
}
function detailCard(title,arr){var a=listify(arr);if(!a.length)return "";return '<div class="detail"><h4>'+esc(title)+'</h4><ul>'+a.map(function(x){return "<li>"+esc(x)+"</li>";}).join("")+'</ul></div>';}
function renderAnalysis(a){
  currentAnalysis=a;
  var chain=[{k:"Origine",v:a.origin,c:"o"},{k:"Mécanisme",v:a.mechanism,c:"m"},{k:"Causes racines",l:a.roots,c:"r"},{k:"Conséquences",l:a.consequences,c:"c"},{k:"Actions",l:a.actions,c:"a"}];
  var nodes=chain.map(function(n){return '<div class="node '+n.c+'"><h4>'+esc(n.k)+'</h4>'+(n.v?'<p>'+esc(n.v)+'</p>':'<ul>'+listify(n.l).map(function(x){return "<li>"+esc(x)+"</li>";}).join("")+'</ul>')+'</div>';}).join("");
  var dtcHtml=a.dtc&&a.dtc.length?'<div class="detail"><h4>DTC / marqueurs</h4><div class="chips">'+a.dtc.map(function(x){return '<span class="chip muted">'+esc(x)+'</span>';}).join("")+'</div></div>':"";
  var sources=(a.sources||[]).map(function(s){return '<a href="'+esc(safeUrl(s.url))+'" target="_blank" rel="noopener">'+esc(s.label)+' ↗</a>';}).join("");
  var related=(a.related||[]).map(function(e){return '<button data-rel="'+esc(e.id)+'">🔗 '+esc(e.title)+'</button>';}).join("");
  var engines=a.engines&&a.engines.length?'<div class="analysis-note"><b>🚘 Motorisations / modèles :</b> '+esc(a.engines.join(" · "))+'</div>':"";
  var safety=a.safety&&a.safety.length?'<div class="analysis-note warn"><b>🛡️ Sécurité immédiate :</b> '+esc(a.safety.join(" · "))+'</div>':"";
  $("#analysisResult").innerHTML=
    '<div class="analysis-head"><div><div class="eyebrow">'+(a.known?"🧠 Panne connue identifiée":"🧭 Orientation générique")+'</div><h3>'+esc(a.title)+'</h3><div class="tags"><span class="tag">'+esc(a.systemLabel)+'</span><span class="tag">'+esc(a.energy)+'</span><span class="tag sev">'+esc(a.severity)+'</span><span class="tag ok">'+esc(a.confidence)+'</span></div></div><div class="analysis-actions"><button data-aa="present">📽️ Présenter</button><button data-aa="copy">📋 Copier</button><button data-aa="print">🖨️ Imprimer</button><button data-aa="share">↗ Partager</button></div></div>'+
    '<div class="verdict"><div><b>Niveau preuve</b><span>'+esc(a.level)+'</span></div><div><b>Score moteur</b><span>'+esc(a.score)+'</span></div><div><b>Système</b><span>'+esc(a.systemLabel)+'</span></div><div><b>Gravité</b><span>'+esc(a.severity)+'</span></div></div>'+
    engines+safety+'<div class="chain">'+nodes+'</div><div class="analysis-details">'+detailCard("Symptômes rencontrés",a.symptoms)+dtcHtml+detailCard("Preuves attendues / indices",a.evidence)+detailCard("Plan de vérification / tests",a.tests)+'</div><div class="analysis-note"><b>⚖️ Orientation juridique :</b> '+esc(a.legal)+'</div><div class="analysis-sources">'+sources+'</div>'+(related?'<div class="analysis-related">'+related+'</div>':'');
}
function analysisText(a){
  function block(t,arr){return t+"\n"+listify(arr).map(function(x){return "• "+x;}).join("\n");}
  return "ANALYSE TECHNIQUE — ÉTUDE INCENDIE BY KEVIN\n\nMot-clé : "+a.query+"\nRésultat : "+a.title+"\nNiveau : "+a.level+" · "+a.confidence+"\n\n"+block("1) ORIGINE",[a.origin])+"\n\n"+block("2) MÉCANISME",[a.mechanism])+"\n\n"+block("3) CAUSES RACINES",a.roots)+"\n\n"+block("4) CONSÉQUENCES",a.consequences)+"\n\n"+block("5) SYMPTÔMES",a.symptoms)+"\n\nDTC : "+(a.dtc||[]).join(", ")+"\n\n"+block("6) PREUVES ATTENDUES",a.evidence)+"\n\n"+block("7) PLAN DE VÉRIFICATION",a.tests)+"\n\n"+block("8) ACTIONS",a.actions)+"\n\n"+block("9) SÉCURITÉ",a.safety)+"\n\n10) JURIDIQUE\n"+a.legal+"\n\nSources : "+(a.sources||[]).map(function(s){return s.label+" — "+s.url;}).join(" | ");
}
function runAnalysis(q,scroll){
  q=String(q||"").trim();if(q.length<2){toast("Saisissez un mot-clé à analyser");return;}
  $("#aInput").value=q;renderAnalysis(analyze(q));
  if(scroll!==false){location.hash="#analyse";setTimeout(function(){var el=$("#analysisResult");if(el)el.scrollIntoView({behavior:"smooth",block:"start"});},80);}
}
function rebuildIndex(){
  INDEX=[];
  KB.forEach(function(e){INDEX.push({g:"record",id:e.id,title:e.title,sub:sysLabel(e.system)+" · "+e.energy+" · "+e.severity,body:recordBody(e),keys:(e.keywords||[]).join(" "),ref:e});});
  DTC.forEach(function(d){INDEX.push({g:"dtc",id:d.code,title:d.code+" — "+d.txt,sub:"DTC / marqueur",body:d.q,keys:"dtc",ref:d});});
  METHOD.forEach(function(m,i){INDEX.push({g:"method",id:"m"+i,title:m[0],sub:"Méthode scientifique",body:m[1],keys:"methode preuve",ref:m});});
  Object.keys(state.refs||{}).forEach(function(k){var r=state.refs[k];INDEX.push({g:"ref",id:r.rid,title:r.title,sub:(r.cat==="juridique"?"⚖️":"🔧")+" Référence admin",body:r.note||"",keys:"veille rappel",ref:r});});
}
function renderStats(){
  $("#statRecords").textContent=KB.length;
  $("#statSystems").textContent=uniq(KB.map(function(e){return e.system;})).length;
  $("#statDtc").textContent=uniq(KB.reduce(function(a,e){return a.concat(e.dtc||[]);},[])).length;
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
    if(d.g==="record")sc+=8;
    if(hits)out.push({d:d,sc:sc});
  });
  out.sort(function(a,b){return b.sc-a.sc;});
  return {ex:ex,hits:out.slice(0,32)};
}
function renderSearch(){
  var q=$("#q").value.trim(),scope=$("#qScope").value;
  if(q.length<2){$("#results").innerHTML="";$("#chips").innerHTML='<span class="chip muted">Suggestions : courroie humide · crépine · FAP herbe · runaway LFP · 12V cosse · EGR glycol · charge DC</span>';currentHits=[];active=-1;return;}
  var r=doSearch(q,scope);currentHits=r.hits;active=r.hits.length?0:-1;
  $("#chips").innerHTML=r.ex.chips.length?'<span class="chip muted">🧠 Extension :</span>'+r.ex.chips.map(function(c){return '<button type="button" class="chip" data-chip="'+esc(c)+'">'+esc(c)+'</button>';}).join(""):"";
  var groups={record:"🧠 Pannes connues / analyse causale",dtc:"🔧 DTC / marqueurs",method:"🧭 Méthode scientifique",ref:"📡 Veille & références"};
  var html="",last="";
  if(!r.hits.length)html='<div class="empty">Aucun résultat. Essayez « courroie humide », « crépine », « FAP », « runaway », « 12V »…</div>';
  r.hits.forEach(function(h,i){
    if(h.d.g!==last){last=h.d.g;html+='<div class="result-group">'+groups[h.d.g]+'</div>';}
    html+='<div class="result'+(i===active?' active':'')+'" data-i="'+i+'"><div><b>'+esc(h.d.title)+'</b><small>'+esc(h.d.sub)+'</small></div><span class="tag">'+Math.round(h.sc)+' pts</span></div>';
  });
  $("#results").innerHTML=html;
}
function updateActive(){$all(".result").forEach(function(el,i){el.classList.toggle("active",i===active);});var el=$all(".result")[active];if(el)el.scrollIntoView({block:"nearest"});}
function openResult(h){
  var d=h.d;
  if(d.g==="record"){runAnalysis((d.ref.keywords&&d.ref.keywords[0])||d.ref.title);return;}
  if(d.g==="dtc"){openDrawer("DTC / marqueur",d.title,'<p>'+esc(d.ref.txt)+'</p><p class="hint">Piste : '+esc(d.ref.q)+'</p>',[{label:"Analyser ce système",fn:function(){closeDrawer();runAnalysis(d.ref.q);}}]);return;}
  if(d.g==="ref"){var u=safeUrl(d.ref.url);if(u!=="#")window.open(u,"_blank","noopener");else location.hash="#veille";return;}
  openDrawer("Méthode",d.title,'<p>'+esc(d.ref[1]||"")+'</p>',[]);
}
function fillFilters(){
  var z=uniq(KB.map(function(e){return e.zone;})).sort();
  $("#libZone").innerHTML='<option value="">📍 Zone : toutes</option>'+z.map(function(x){return '<option>'+esc(x)+'</option>';}).join("");
  $("#libSystem").innerHTML='<option value="">⚙️ Système : tous</option>'+SYSTEMS.map(function(s){return '<option value="'+s.id+'">'+esc(s.label)+'</option>';}).join("");
  $("#f_system").innerHTML=SYSTEMS.map(function(s){return '<option value="'+s.id+'">'+esc(s.label)+'</option>';}).join("");
  var views=local.views||{};
  $("#savedViewSelect").innerHTML='<option value="">📌 Vue enregistrée</option>'+Object.keys(views).map(function(n){return '<option>'+esc(n)+'</option>';}).join("");
}
function libState(){return {q:$("#libSearch").value,system:$("#libSystem").value,energy:$("#libEnergy").value,zone:$("#libZone").value,severity:$("#libSeverity").value,sort:$("#libSort").value};}
function applyLibState(s){$("#libSearch").value=s.q||"";$("#libSystem").value=s.system||"";$("#libEnergy").value=s.energy||"";$("#libZone").value=s.zone||"";$("#libSeverity").value=s.severity||"";$("#libSort").value=s.sort||"priority";renderLibrary();}
function filteredKB(){
  var s=libState(),list=KB.slice();
  if(s.q){var terms=expandQuery(s.q).terms;list=list.map(function(e){var ti=norm(e.title),bo=norm(recordBody(e)),sc=0;terms.forEach(function(t){if(ti.indexOf(t)>=0)sc+=14;else if(bo.indexOf(t)>=0)sc+=5;});return {e:e,sc:sc};}).filter(function(x){return x.sc>0;}).sort(function(a,b){return b.sc-a.sc;}).map(function(x){return x.e;});}
  if(s.system)list=list.filter(function(e){return e.system===s.system;});
  if(s.energy)list=list.filter(function(e){return e.energy===s.energy;});
  if(s.zone)list=list.filter(function(e){return e.zone===s.zone;});
  if(s.severity)list=list.filter(function(e){return e.severity===s.severity;});
  if(s.sort==="az")list.sort(function(a,b){return a.title.localeCompare(b.title,"fr");});
  else if(s.sort==="zone")list.sort(function(a,b){return a.zone.localeCompare(b.zone,"fr");});
  else if(s.sort==="severity")list.sort(function(a,b){return sevRank(b.severity)-sevRank(a.severity);});
  else if(s.sort==="manual")list.sort(function(a,b){var o=local.order||[],ia=o.indexOf(a.id),ib=o.indexOf(b.id);if(ia<0)ia=9999;if(ib<0)ib=9999;return ia-ib;});
  return list;
}
function renderLibrary(){
  var list=filteredKB(),grid=$("#libGrid");
  $("#libCount").textContent=list.length+" fiche"+(list.length>1?"s":"");
  $("#libEmpty").hidden=list.length>0;grid.hidden=!list.length;
  $("#bulkBar").hidden=!isAdmin;
  $("#addRecordBtn").hidden=!isAdmin;$("#importBtn").hidden=!isAdmin;
  grid.innerHTML=list.map(function(e,i){
    var sel=!!selected[e.id];
    return '<article class="record'+(sel?' selected':'')+'" draggable="'+(isAdmin?'true':'false')+'" data-id="'+esc(e.id)+'" style="animation-delay:'+Math.min(i*30,300)+'ms">'+
      '<div class="record-top '+(e.energy==="VE"?"ev":"th")+'"><span>'+(e.energy==="VE"?"🔋 VE":"🔥 "+esc(e.energy))+'</span><span>📍 '+esc(e.zone)+'</span></div>'+
      '<h3>'+esc(e.title)+'</h3><p class="cause">'+esc(e.origin)+'</p>'+
      '<div class="tags"><span class="tag">'+esc(sysLabel(e.system))+'</span><span class="tag sev">'+esc(e.severity)+'</span>'+(e.dtc&&e.dtc.length?'<span class="tag dtc">🔧 '+esc(e.dtc.slice(0,2).join(" · "))+'</span>':'')+'</div>'+
      '<div class="record-actions"><button class="btn-fire" data-act="analyze">🧠 Analyser</button><button data-act="details">📋 Détails</button><button data-act="present">📽️ Présenter</button>'+(isAdmin?'<button data-act="edit">✏️ Éditer</button>':'')+'</div>'+
      '<div class="record-tools">'+(isAdmin?'<label class="row"><input type="checkbox" data-select="'+esc(e.id)+'" '+(sel?'checked':'')+'> Sélection</label><span class="drag" title="Glisser pour réordonner">⠿</span>':'')+'</div>'+
      '<div class="record-more" hidden><p><b>Mécanisme :</b> '+esc(e.mechanism)+'</p><p><b>Conséquences :</b> '+esc((e.consequences||[]).slice(0,2).join(" ; "))+'</p><p><b>Preuves :</b> '+esc((e.evidence||[]).slice(0,2).join(" ; "))+'</p><p><b>Juridique :</b> '+esc(e.legal)+'</p></div></article>';
  }).join("");
  var n=Object.keys(selected).filter(function(k){return selected[k];}).length;
  $("#selCount").textContent=n+" sélectionné"+(n>1?"s":"");
  $("#selectAll").checked=list.length>0&&list.every(function(e){return selected[e.id];});
  $("#undoBtn").disabled=undoStack.length===0;
}
function openRecordDrawer(e){
  var body='<p><b>Origine :</b> '+esc(e.origin)+'</p><p><b>Mécanisme :</b> '+esc(e.mechanism)+'</p>'+
    '<p><b>Causes racines :</b></p><ul>'+listify(e.roots).map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul>'+
    '<p><b>Conséquences :</b></p><ul>'+listify(e.consequences).map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul>'+
    '<p><b>Preuves attendues :</b></p><ul>'+listify(e.evidence).map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul>'+
    '<p><b>Tests :</b></p><ul>'+listify(e.tests).map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul>'+
    '<p><b>Sécurité :</b> '+esc(listify(e.safety).join(" · "))+'</p><p><b>Juridique :</b> '+esc(e.legal)+'</p>';
  var actions=[{label:"🧠 Analyser",fn:function(){closeDrawer();runAnalysis((e.keywords&&e.keywords[0])||e.title);}},{label:"📽️ Présenter",fn:function(){closeDrawer();openRecordDeck([e],e.id);}}];
  if(isAdmin)actions.push({label:"✏️ Éditer",fn:function(){closeDrawer();openEditor(e);}});
  openDrawer("Fiche causale locale",e.title,body,actions);
}
function openEditor(e){
  if(!isAdmin)return;
  $("#editorTitle").textContent=e?"Modifier la fiche":"Nouvelle fiche";
  $("#f_id").value=e?e.id:"";
  $("#f_title").value=e?e.title:"";
  $("#f_system").value=e?e.system:(SYSTEMS[0]&&SYSTEMS[0].id);
  $("#f_energy").value=e?e.energy:"Thermique";
  $("#f_zone").value=e?e.zone:"";
  $("#f_severity").value=e?e.severity:"Élevé";
  $("#f_keywords").value=e?(e.keywords||[]).join(", "):"";
  $("#f_engines").value=e?(e.engines||[]).join("\n"):"";
  $("#f_origin").value=e?e.origin:"";
  $("#f_mechanism").value=e?e.mechanism:"";
  $("#f_roots").value=e?(e.roots||[]).join("\n"):"";
  $("#f_consequences").value=e?(e.consequences||[]).join("\n"):"";
  $("#f_symptoms").value=e?(e.symptoms||[]).join("\n"):"";
  $("#f_dtc").value=e?(e.dtc||[]).join(", "):"";
  $("#f_evidence").value=e?(e.evidence||[]).join("\n"):"";
  $("#f_tests").value=e?(e.tests||[]).join("\n"):"";
  $("#f_actions").value=e?(e.actions||[]).join("\n"):"";
  $("#f_safety").value=e?(e.safety||[]).join("\n"):"";
  $("#f_legal").value=e?e.legal:"";
  $("#f_sources").value=e?(e.sources||[]).map(function(s){return s.label+" | "+s.url;}).join("\n"):"";
  $("#editor").hidden=false;
}
function closeEditor(){$("#editor").hidden=true;}
function saveRecordFromForm(){
  var id=$("#f_id").value||uid();
  var sources=lines($("#f_sources").value).map(function(l){var p=l.split("|");return {label:(p[0]||"Source").trim(),url:(p[1]||"").trim()};}).filter(function(s){return /^https?:\/\//i.test(s.url);});
  var rec={id:id,title:$("#f_title").value.trim(),system:$("#f_system").value,energy:$("#f_energy").value,zone:$("#f_zone").value.trim(),severity:$("#f_severity").value,priority:80,keywords:csv($("#f_keywords").value),engines:lines($("#f_engines").value),origin:$("#f_origin").value.trim(),mechanism:$("#f_mechanism").value.trim(),roots:lines($("#f_roots").value),consequences:lines($("#f_consequences").value),symptoms:lines($("#f_symptoms").value),dtc:csv($("#f_dtc").value),evidence:lines($("#f_evidence").value),tests:lines($("#f_tests").value),actions:lines($("#f_actions").value),safety:lines($("#f_safety").value),legal:$("#f_legal").value.trim(),sources:sources,related:[],updated:new Date().toISOString()};
  if(!rec.title||!rec.origin||!rec.mechanism){toast("Titre, origine et mécanisme requis");return;}
  local.overrides[id]=rec;delete local.deleted[id];saveLocal();refreshKB();closeEditor();toast("💾 Fiche enregistrée en base locale");
}
function deleteRecords(ids){
  if(!isAdmin||!ids.length)return;
  var backup={overrides:JSON.parse(JSON.stringify(local.overrides)),deleted:JSON.parse(JSON.stringify(local.deleted)),order:(local.order||[]).slice()};
  ids.forEach(function(id){var rec=KB.find(function(e){return e.id===id;});if(rec){local.deleted[id]=rec;delete local.overrides[id];}delete selected[id];});
  undoStack.push(backup);saveLocal();refreshKB();toast("🗑️ "+ids.length+" fiche(s) supprimée(s) — Annuler disponible","undo");
}
function undo(){
  var b=undoStack.pop();if(!b)return;
  local.overrides=b.overrides;local.deleted=b.deleted;local.order=b.order;saveLocal();refreshKB();toast("↩️ Suppression annulée");
}
function importJSON(file){
  var fr=new FileReader();
  fr.onload=function(){
    try{
      var arr=JSON.parse(fr.result);
      if(!Array.isArray(arr))throw new Error("format");
      var count=0;
      arr.forEach(function(e){
        if(e&&e.id&&e.title&&e.origin&&e.mechanism){local.overrides[e.id]=e;delete local.deleted[e.id];count++;}
      });
      saveLocal();refreshKB();toast("⬆️ "+count+" fiche(s) importée(s)");
    }catch(err){toast("Import invalide : tableau JSON de fiches attendu");}
  };
  fr.readAsText(file);
}
function recordSlides(e){return [{h:e.title,cover:true,sub:e.zone},{h:"1 · Origine",b:e.origin},{h:"2 · Mécanisme",b:e.mechanism},{h:"3 · Causes racines",l:e.roots},{h:"4 · Conséquences",l:e.consequences},{h:"5 · Symptômes",l:e.symptoms},{h:"6 · DTC / marqueurs",l:e.dtc},{h:"7 · Preuves attendues",l:e.evidence},{h:"8 · Plan de vérification",l:e.tests},{h:"9 · Actions correctives",l:e.actions},{h:"10 · Sécurité",l:e.safety},{h:"11 · Juridique",b:e.legal},{h:"12 · Sources",src:e.sources||[]}];}
function analysisSlides(a){return [{h:a.title,cover:true,sub:a.systemLabel+" · "+a.level},{h:"1 · Origine",b:a.origin},{h:"2 · Mécanisme",b:a.mechanism},{h:"3 · Causes racines",l:a.roots},{h:"4 · Conséquences",l:a.consequences},{h:"5 · Symptômes",l:a.symptoms},{h:"6 · DTC / marqueurs",l:a.dtc},{h:"7 · Preuves attendues",l:a.evidence},{h:"8 · Plan de vérification",l:a.tests},{h:"9 · Actions",l:a.actions},{h:"10 · Sécurité",l:a.safety},{h:"11 · Juridique",b:a.legal},{h:"12 · Sources",src:a.sources||[]}];}
function openRecordDeck(list,startId){deckChapters=list.map(function(e){return {title:e.title,en:e.energy,slides:recordSlides(e)};});deckIdx=Math.max(0,list.findIndex(function(e){return e.id===startId;}));slideIdx=0;showDeck();}
function openAnalysisDeck(a){deckChapters=[{title:a.title,en:a.energy,slides:analysisSlides(a)}];deckIdx=0;slideIdx=0;showDeck();}
function showDeck(){stopAuto();$("#deck").hidden=false;D.body.classList.add("locked");renderSlide();}
function closeDeck(){$("#deck").hidden=true;D.body.classList.remove("locked");stopAuto();$("#deckOverview").hidden=true;}
function curSlides(){return deckChapters[deckIdx].slides;}
function step(d){var n=curSlides().length;slideIdx+=d;if(slideIdx>=n){if(deckIdx<deckChapters.length-1){deckIdx++;slideIdx=0;}else slideIdx=n-1;}if(slideIdx<0){if(deckIdx>0){deckIdx--;slideIdx=curSlides().length-1;}else slideIdx=0;}renderSlide();}
function renderSlide(){
  var ch=deckChapters[deckIdx];if(!ch)return closeDeck();
  var sl=ch.slides,s=sl[slideIdx],box=$("#deckSlide");
  $("#deckTitle").textContent="🔥 "+ch.title;
  box.classList.remove("anim");void box.offsetWidth;box.classList.add("anim");
  if(s.cover)box.innerHTML='<div class="deck-cover"><span class="energy-big '+(ch.en==="VE"?"ev":"th")+'">'+(ch.en==="VE"?"🔋 ÉLECTRIQUE":"🔥 THERMIQUE")+'</span><h2>'+esc(ch.title)+'</h2><p>'+esc(s.sub||"")+'</p><p class="hint">← → pour naviguer · Échap pour quitter</p></div>';
  else if(s.src!==undefined)box.innerHTML='<h3>'+esc(s.h)+'</h3><ul>'+listify(s.src).map(function(x){return '<li><a href="'+esc(safeUrl(x.url))+'" target="_blank" rel="noopener">'+esc(x.label)+' ↗</a></li>';}).join("")+'</ul>';
  else if(s.l!==undefined)box.innerHTML='<h3>'+esc(s.h)+'</h3><ul>'+listify(s.l).map(function(x){return '<li>'+esc(x)+'</li>';}).join("")+'</ul>';
  else box.innerHTML='<h3>'+esc(s.h)+'</h3><p class="big">'+esc(s.b||"—")+'</p>';
  $("#deckProgress").style.width=Math.round((slideIdx+1)/sl.length*100)+"%";
  $("#deckDots").innerHTML=sl.map(function(x,i){return '<span class="dot'+(i===slideIdx?' on':'')+'"></span>';}).join("");
  $("#deckCount").textContent="Fiche "+(deckIdx+1)+"/"+deckChapters.length+" · Diapo "+(slideIdx+1)+"/"+sl.length;
}
function toggleOverview(){var g=$("#deckOverview");if(!g.hidden){g.hidden=true;return;}g.innerHTML=deckChapters.map(function(ch,i){return '<button class="ov'+(i===deckIdx?' active':'')+'" data-i="'+i+'"><b>'+esc(ch.title)+'</b><small>'+esc(ch.en)+' · '+ch.slides.length+' diapos</small></button>';}).join("");g.hidden=false;}
function stopAuto(){clearInterval(autoTimer);autoTimer=null;$("#deckPlay").textContent="▶";}
function toggleAuto(){if(autoTimer){stopAuto();return;}$("#deckPlay").textContent="⏸";autoTimer=setInterval(function(){step(1);},6000);}
function openDrawer(kind,title,body,actions){$("#drawerKind").textContent=kind;$("#drawerTitle").textContent=title;$("#drawerBody").innerHTML=body;var a=$("#drawerActions");a.innerHTML="";(actions||[]).forEach(function(x){var b=D.createElement("button");b.textContent=x.label;b.onclick=x.fn;a.appendChild(b);});$("#drawer").hidden=false;}
function closeDrawer(){$("#drawer").hidden=true;}
function renderStatic(){
  $("#methodGrid").innerHTML=METHOD.map(function(m,i){return '<div class="step" data-n="'+(i+1)+'"><b>'+esc(m[0])+'</b><span>'+esc(m[1])+'</span></div>';}).join("");
  $("#evidenceGrid").innerHTML=EVIDENCE.map(function(e){return '<tr><td><b>'+esc(e[0])+'</b></td><td>'+esc(e[1])+'</td><td>'+esc(e[2])+'</td></tr>';}).join("");
  $("#portals").innerHTML=PORTALS.map(function(p){return '<a class="portal" href="'+esc(p[2])+'" target="_blank" rel="noopener"><b>'+esc(p[0])+' ↗</b><span>'+esc(p[1])+'</span></a>';}).join("");
  $("#aQuick").innerHTML=["courroie humide","crépine","FAP herbe","EGR glycol","runaway LFP","12V cosse","charge DC","GPL","freins descente","Boîte DSG"].map(function(k){return '<button class="chip" data-ak="'+esc(k)+'">'+esc(k)+'</button>';}).join("");
}
function renderRefs(){
  var list=Object.keys(state.refs||{}).map(function(k){return state.refs[k];}).sort(function(a,b){return (b.ts||0)-(a.ts||0);});
  $("#refEmpty").hidden=list.length>0;
  $("#refList").innerHTML=list.map(function(r){return '<div class="ref"><div><a href="'+esc(safeUrl(r.url))+'" target="_blank" rel="noopener">'+esc(r.title)+'</a><small>'+esc(r.cat==="juridique"?"⚖️ Juridique":"🔧 Technique")+' · '+esc(r.note||"")+'</small></div>'+(isAdmin?'<button class="danger" data-refdel="'+esc(r.rid)+'">🗑️</button>':'')+'</div>';}).join("");
  var last=list.reduce(function(a,r){return Math.max(a,r.ts||0);},0);
  $("#refUpdated").textContent=last?"MAJ "+new Date(last).toLocaleString("fr-FR"):"Base locale";
}
function renderAdmin(){
  if(!isAdmin)return;
  var list=Object.keys(state.devices||{}).map(function(id){return {id:id,d:state.devices[id]};}).sort(function(a,b){return (b.d.ts||0)-(a.d.ts||0);});
  $("#reqCount").textContent=list.length;$("#reqEmpty").hidden=list.length>0;
  $("#reqList").innerHTML=list.map(function(x){var d=x.d;return '<div class="req"><div class="req-head"><b>'+esc(d.name||"?")+'</b><span class="badge '+esc(d.status)+'">'+esc(LABEL[d.status]||d.status)+'</span><small>'+new Date(d.ts||0).toLocaleString("fr-FR")+'</small></div><div class="req-actions"><button data-id="'+esc(x.id)+'" data-s="granted">✅ Accès</button><button data-id="'+esc(x.id)+'" data-s="denied">⛔ Refus</button><button data-id="'+esc(x.id)+'" data-s="revoked">🔄 Révoquer</button><button class="danger" data-id="'+esc(x.id)+'" data-s="del">🗑️</button></div></div>';}).join("");
}

/* Temps réel */
var BASE=CFG.NTFY+"/"+CFG.TOPIC,seen={},es=null,queue=read("eik-queue",[]);
function saveState(){store("eik-state",state);}
function saveQueue(){store("eik-queue",queue.slice(-60));}
function deliver(p,mirror){if(!p||!p.mid||seen[p.mid])return;seen[p.mid]=1;onMsg(p);if(mirror&&W.BroadcastChannel){var bc=new BroadcastChannel("eik-sync");bc.postMessage(p);bc.close();}}
function post(p){return fetch(BASE,{method:"POST",body:JSON.stringify(p)}).then(function(r){if(!r.ok)throw new Error(r.status);});}
function publish(obj){var p=Object.assign({mid:uid(),ts:Date.now()},obj);deliver(p,true);if(!navigator.onLine){queue.push(p);saveQueue();return;}post(p).catch(function(){queue.push(p);saveQueue();});}
function flush(){var q=queue.slice();queue=[];saveQueue();q.forEach(function(p){post(p).catch(function(){queue.push(p);saveQueue();});});}
function publishFile(blob,name){return fetch(BASE,{method:"PUT",headers:{"X-Filename":name},body:blob}).then(function(r){if(!r.ok)throw new Error(r.status);return r.json();}).then(function(j){return j.attachment&&j.attachment.url;});}
function connect(){if(!W.EventSource)return;if(es)es.close();es=new EventSource(BASE+"/sse");es.onopen=function(){syncBadge(true);};es.onerror=function(){syncBadge(false);};es.onmessage=function(ev){try{var m=JSON.parse(ev.data);if(m.event==="message"&&m.message)deliver(JSON.parse(m.message),true);}catch(e){}};}
function replay(){fetch(BASE+"/json?poll=1&since=12h").then(function(r){return r.text();}).then(function(txt){txt.split("\n").forEach(function(l){if(!l.trim())return;try{var m=JSON.parse(l);if(m.event==="message"&&m.message)deliver(JSON.parse(m.message),true);}catch(e){}});}).catch(function(){});}
function syncBadge(ok){var b=$("#syncBadge");b.textContent=ok?"☁️ Temps réel":"🔁 Reconnexion…";b.className="pill "+(ok?"ok":"warn");}
function publishState(){state.stateTs=Date.now();saveState();publish({t:"state",devices:state.devices,ts:state.stateTs});}
function rebroadcast(){if(!isAdmin||Date.now()-lastRebroadcast<60000)return;lastRebroadcast=Date.now();publishState();Object.keys(state.refs||{}).forEach(function(k){publish(state.refs[k]);});if(state.wp){fetch(state.wp.img).then(function(r){return r.blob();}).then(function(b){return publishFile(b,"fond.jpg");}).then(function(url){publish({t:"wp",url:url,ts:state.wp.ts,opacity:state.wp.opacity});}).catch(function(){});}}
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
function route(){
  var me=state.devices[myId],granted=isAdmin||(me&&me.status==="granted");
  $("#gate").hidden=granted;D.body.classList.toggle("locked",!granted);
  $("#admin").hidden=!isAdmin;$("#navAdmin").hidden=!isAdmin;
  $("#bulkBar").hidden=!isAdmin;$("#addRecordBtn").hidden=!isAdmin;$("#importBtn").hidden=!isAdmin;
  if(granted){renderLibrary();return;}
  if(me&&me.status==="pending")gateStatus("pending","⏳ Demande envoyée","En attente de validation admin.");
  else if(me&&me.status==="denied")gateStatus("denied","⛔ Accès refusé","L’administrateur a refusé cette demande.");
  else if(me&&me.status==="revoked")gateStatus("revoked","🔄 Accès révoqué","Votre accès a été révoqué.");
  else if(localStorage.getItem("eik-asked")==="1")gateStatus("pending","⏳ Demande envoyée","En attente de validation admin.");
  else $("#gateStatus").hidden=true;
}
function gateStatus(cls,title,msg){var s=$("#gateStatus");s.className="gate-status "+cls;s.innerHTML="<b>"+esc(title)+"</b>"+esc(msg);s.hidden=false;}
function showGateTab(which){$("#tabTiers").classList.toggle("active",which==="tiers");$("#tabAdmin").classList.toggle("active",which==="admin");$("#paneTiers").hidden=which!=="tiers";$("#paneAdmin").hidden=which!=="admin";if(which==="admin"){$("#adminPass").value="";setTimeout(function(){$("#adminPass").focus();},80);}}
function askAccess(){var n=$("#gateName").value.trim();if(n.length<2){toast("Prénom trop court");return;}localStorage.setItem("eik-name",n);localStorage.setItem("eik-asked","1");state.devices[myId]={name:n,status:"pending",ts:Date.now()};saveState();route();publish({t:"req",id:myId,name:n});toast("📨 Demande envoyée");}
function armLock(){clearTimeout(lockTimer);lockTimer=setTimeout(lockAdmin,CFG.LOCK_MIN*60000);}
function lockAdmin(){isAdmin=false;sessionStorage.removeItem("eik-admin");clearTimeout(lockTimer);route();toast("🔒 Session admin verrouillée");}
function loginAdmin(pass){$("#adminPass").value="";if(pass!==CFG.PASSWORD){$("#loginForm").classList.add("shake");setTimeout(function(){$("#loginForm").classList.remove("shake");},450);toast("⛔ Mot de passe incorrect");return;}isAdmin=true;sessionStorage.setItem("eik-admin","1");armLock();route();renderAdmin();publishState();toast("🛡️ Mode admin actif");setTimeout(function(){location.hash="#admin";},120);}
function applyWp(){var l=$("#wpLayer");if(state.wp){l.style.backgroundImage="url("+state.wp.img+")";l.style.opacity=state.wp.opacity;}else{l.style.backgroundImage="none";l.style.opacity=1;}var p=$("#wpPreview");if(state.wp){p.style.backgroundImage="url("+state.wp.img+")";p.textContent="";}else{p.style.backgroundImage="none";p.textContent="Aucun fond personnalisé";}}
function fetchWp(m){fetch(m.url).then(function(r){return r.blob();}).then(function(b){return new Promise(function(res){var fr=new FileReader();fr.onload=function(){res(fr.result);};fr.readAsDataURL(b);});}).then(function(img){state.wp={img:img,ts:m.ts,opacity:m.opacity||.25};saveState();applyWp();toast("🖼️ Fond mis à jour");}).catch(function(){});}
function compress(file,maxDim,q){return new Promise(function(res,rej){var img=new Image();img.onload=function(){var dim=maxDim,quality=q,out="";do{var sc=Math.min(1,dim/Math.max(img.width,img.height));var c=D.createElement("canvas");c.width=Math.round(img.width*sc);c.height=Math.round(img.height*sc);c.getContext("2d").drawImage(img,0,0,c.width,c.height);out=c.toDataURL("image/jpeg",quality);dim=Math.round(dim*.75);quality-=.12;}while(out.length>1400000&&quality>.3);URL.revokeObjectURL(img.src);res(out);};img.onerror=rej;img.src=URL.createObjectURL(file);});}
function netBadge(){var c=navigator.connection||{},type="";if(c.type==="wifi")type="Wi-Fi";else if(c.type==="cellular")type=(c.effectiveType||"4g").toUpperCase()+"/5G";else if(c.effectiveType)type=c.effectiveType.toUpperCase();var b=$("#netBadge");b.textContent=navigator.onLine?"🟢 En ligne"+(type?" · "+type:""):"🟠 Hors ligne · local";b.className="pill "+(navigator.onLine?"ok":"warn");}
function btConnect(){if(!navigator.bluetooth){toast("Bluetooth Web indisponible — Chrome Android / APK requis.");return;}navigator.bluetooth.requestDevice({acceptAllDevices:true,optionalServices:["battery_service","device_information"]}).then(function(dev){dev.addEventListener("gattserverdisconnected",function(){$("#btBadge").hidden=true;toast("Bluetooth déconnecté");});return dev.gatt.connect().then(function(g){var label=dev.name||"Appareil";return g.getPrimaryService("battery_service").then(function(s){return s.getCharacteristic("battery_level");}).then(function(ch){return ch.readValue();}).then(function(v){label+=" 🔋"+v.getUint8(0)+"%";}).catch(function(){}).then(function(){$("#btBadge").hidden=false;$("#btBadge").textContent="🔵 "+label;toast("Bluetooth connecté : "+label);});});}).catch(function(e){if(e&&e.name!=="NotFoundError")toast("Bluetooth : "+e.message);});}
function install(){if(deferredPrompt){deferredPrompt.prompt();deferredPrompt=null;$("#installBtn").hidden=true;}else toast("Menu navigateur → Ajouter à l’écran d’accueil.");}
function share(){var data={title:D.title,text:"Étude incendie technique by Kevin",url:location.href};if(navigator.share)navigator.share(data).catch(function(){});else if(navigator.clipboard)navigator.clipboard.writeText(location.href).then(function(){toast("🔗 Lien copié");});}
W.addEventListener("beforeinstallprompt",function(e){e.preventDefault();deferredPrompt=e;$("#installBtn").hidden=false;});
function embers(){if(W.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches)return;var c=$("#embers"),x=c.getContext("2d"),ps=[],raf=null;function size(){var d=Math.min(devicePixelRatio||1,1.5);c.width=innerWidth*d;c.height=innerHeight*d;x.setTransform(d,0,0,d,0,0);}size();W.addEventListener("resize",size);for(var i=0;i<26;i++)ps.push({x:Math.random()*innerWidth,y:Math.random()*innerHeight,r:1+Math.random()*2.2,s:.25+Math.random()*.7,a:.15+Math.random()*.5,d:Math.random()*6.28});function loop(){x.clearRect(0,0,innerWidth,innerHeight);ps.forEach(function(p){p.y-=p.s;p.x+=Math.sin(p.d+p.y*.01)*.3;if(p.y<-10){p.y=innerHeight+10;p.x=Math.random()*innerWidth;}x.beginPath();x.arc(p.x,p.y,p.r,0,6.28);var g=x.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r*3);g.addColorStop(0,"rgba(255,154,61,"+p.a+")");g.addColorStop(1,"rgba(255,107,53,0)");x.fillStyle=g;x.fill();});raf=requestAnimationFrame(loop);}loop();D.addEventListener("visibilitychange",function(){if(D.hidden){cancelAnimationFrame(raf);raf=null;}else if(!raf)loop();});}
function reveals(){if(!W.IntersectionObserver){$all("main section").forEach(function(s){s.classList.add("in");});return;}var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target);}});},{threshold:.12});$all("main section").forEach(function(s){io.observe(s);});var links=$all("nav a"),spy=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){links.forEach(function(a){a.classList.toggle("active",a.getAttribute("href")==="#"+e.target.id);});}});},{rootMargin:"-40% 0px -55% 0px"});$all("main section").forEach(function(s){spy.observe(s);});}
function bind(){
  $("#menuBtn").onclick=function(){$("#nav").classList.toggle("open");};
  $all("nav a").forEach(function(a){a.onclick=function(){$("#nav").classList.remove("open");};});
  $("#heroSearch").onclick=function(){location.hash="#recherche";setTimeout(function(){$("#q").focus();},450);};
  $("#heroAnalyze").onclick=function(){runAnalysis("courroie humide");};
  $("#heroPresent").onclick=function(){var l=filteredKB();if(l.length)openRecordDeck(l,l[0].id);};
  $("#heroMethod").onclick=function(){location.hash="#methode";};
  $("#tabTiers").onclick=function(){showGateTab("tiers");};
  $("#tabAdmin").onclick=function(){showGateTab("admin");};
  $("#gateForm").onsubmit=function(e){e.preventDefault();askAccess();};
  $("#loginForm").onsubmit=function(e){e.preventDefault();loginAdmin($("#adminPass").value);};
  $("#adminBtn").onclick=function(){if(isAdmin){location.hash="#admin";return;}$("#gate").hidden=false;D.body.classList.add("locked");showGateTab("admin");};
  $("#lockBtn").onclick=lockAdmin;
  $("#admin").addEventListener("pointerdown",function(){if(isAdmin)armLock();});
  $("#reqList").onclick=function(e){var b=e.target.closest("button");if(!b||!isAdmin)return;var id=b.dataset.id,s=b.dataset.s;if(s==="del")delete state.devices[id];else if(state.devices[id])state.devices[id].status=s;saveState();publishState();renderAdmin();toast(s==="del"?"🗑️ Appareil supprimé":"Statut : "+(LABEL[s]||s));};
  $("#wpFile").onchange=function(e){var f=e.target.files[0];if(!f)return;$("#wpStatus").textContent="Compression…";compress(f,1600,.82).then(function(img){var op=parseFloat($("#wpOpacity").value);state.wp={img:img,ts:Date.now(),opacity:op};saveState();applyWp();return fetch(img).then(function(r){return r.blob();}).then(function(b){return publishFile(b,"fond.jpg");}).then(function(url){publish({t:"wp",url:url,ts:state.wp.ts,opacity:op});$("#wpStatus").textContent="🖼️ Fond diffusé.";toast("🖼️ Fond diffusé");});}).catch(function(){$("#wpStatus").textContent="Fond local (réseau indisponible).";});e.target.value="";};
  $("#wpOpacity").oninput=function(){if(state.wp){state.wp.opacity=parseFloat(this.value);saveState();applyWp();}};
  $("#wpClear").onclick=function(){state.wp=null;saveState();applyWp();publish({t:"wpdel"});toast("Fond retiré");};
  $("#pubBtn").onclick=function(){var title=$("#pubTitle").value.trim(),url=$("#pubUrl").value.trim();if(!title||!/^https?:\/\//i.test(url)){toast("Titre + URL https:// requis");return;}publish({t:"ref",rid:uid(),title:title,url:url,cat:$("#pubCat").value,note:$("#pubNote").value.trim().slice(0,200),ts:Date.now()});$("#pubTitle").value=$("#pubUrl").value=$("#pubNote").value="";toast("📚 Référence publiée");};
  $("#noteBtn").onclick=function(){var t=$("#noteTxt").value.trim();if(!t)return;publish({t:"note",text:t.slice(0,300)});$("#noteTxt").value="";};
  $("#syncTest").onclick=function(){publish({t:"note",text:"🧪 Test canal — "+new Date().toLocaleTimeString("fr-FR")});};
  $("#refList").onclick=function(e){var b=e.target.closest("[data-refdel]");if(!b||!isAdmin)return;publish({t:"refdel",rid:b.dataset.refdel});};
  var qt=null;
  $("#q").addEventListener("input",function(){clearTimeout(qt);qt=setTimeout(renderSearch,120);});
  $("#q").addEventListener("keydown",function(e){if(e.key==="ArrowDown"||e.key==="ArrowUp"){if(!currentHits.length)return;e.preventDefault();active=(active+(e.key==="ArrowDown"?1:-1)+currentHits.length)%currentHits.length;updateActive();}else if(e.key==="Enter"){if(currentHits[active]){e.preventDefault();openResult(currentHits[active]);}}else if(e.key==="Escape"){$("#results").innerHTML="";currentHits=[];}});
  $("#qScope").onchange=renderSearch;
  $("#searchBtn").onclick=function(){renderSearch();var q=$("#q").value.trim();if(q&&currentHits[0])openResult(currentHits[0]);};
  $("#analyzeSearchBtn").onclick=function(){runAnalysis($("#q").value);};
  $("#chips").onclick=function(e){var b=e.target.closest("[data-chip]");if(!b)return;$("#q").value=b.dataset.chip;renderSearch();$("#q").focus();};
  $("#results").onclick=function(e){var r=e.target.closest(".result");if(!r)return;openResult(currentHits[+r.dataset.i]);};
  $("#aBtn").onclick=function(){runAnalysis($("#aInput").value);};
  $("#aInput").addEventListener("keydown",function(e){if(e.key==="Enter"){e.preventDefault();runAnalysis(this.value);}});
  $("#aQuick").onclick=function(e){var b=e.target.closest("[data-ak]");if(!b)return;runAnalysis(b.dataset.ak);};
  $("#analysisResult").onclick=function(e){
    var b=e.target.closest("[data-aa],[data-rel]");if(!b)return;
    if(b.dataset.aa){var a=currentAnalysis;if(!a)return;if(b.dataset.aa==="present")openAnalysisDeck(a);else if(b.dataset.aa==="copy"){if(navigator.clipboard)navigator.clipboard.writeText(analysisText(a)).then(function(){toast("📋 Rapport copié");});}else if(b.dataset.aa==="print")window.print();else if(b.dataset.aa==="share"){if(navigator.share)navigator.share({title:a.title,text:analysisText(a)}).catch(function(){});else if(navigator.clipboard)navigator.clipboard.writeText(analysisText(a)).then(function(){toast("📋 Analyse copiée");});}}
    else if(b.dataset.rel){var rel=KB.find(function(x){return x.id===b.dataset.rel;});if(rel)runAnalysis((rel.keywords&&rel.keywords[0])||rel.title);}
  };
  ["libSearch","libSystem","libEnergy","libZone","libSeverity","libSort"].forEach(function(id){$("#"+id).addEventListener(id==="libSearch"?"input":"change",function(){clearTimeout(this._t);this._t=setTimeout(renderLibrary,120);});});
  $("#resetLib").onclick=$("#emptyReset").onclick=function(){applyLibState({sort:"priority"});};
  $("#presentLib").onclick=function(){var l=filteredKB();if(l.length)openRecordDeck(l,l[0].id);else toast("Aucune fiche à présenter");};
  $("#exportBtn").onclick=function(){download("base-pannes-etude-incendie.json",JSON.stringify(KB,null,2));toast("⬇️ Base exportée");};
  $("#importBtn").onclick=function(){if(isAdmin)$("#importFile").click();};
  $("#importFile").onchange=function(e){var f=e.target.files[0];if(f&&isAdmin)importJSON(f);e.target.value="";};
  $("#addRecordBtn").onclick=function(){openEditor(null);};
  $("#saveViewBtn").onclick=function(){var n=prompt("Nom de la vue :");if(!n)return;local.views[n]=libState();saveLocal();fillFilters();toast("💾 Vue enregistrée");};
  $("#deleteViewBtn").onclick=function(){var n=$("#savedViewSelect").value;if(!n)return;delete local.views[n];saveLocal();fillFilters();toast("Vue supprimée");};
  $("#savedViewSelect").onchange=function(){var n=this.value;if(n&&local.views[n])applyLibState(local.views[n]);};
  $("#selectAll").onchange=function(){var list=filteredKB(),v=this.checked;list.forEach(function(e){selected[e.id]=v;});renderLibrary();};
  $("#deleteSelected").onclick=function(){var ids=Object.keys(selected).filter(function(k){return selected[k];});deleteRecords(ids);};
  $("#undoBtn").onclick=undo;
  $("#libGrid").onclick=function(e){
    var card=e.target.closest(".record");if(!card)return;var id=card.dataset.id,rec=KB.find(function(x){return x.id===id;});
    if(e.target.dataset.select){selected[id]=e.target.checked;renderLibrary();return;}
    var b=e.target.closest("[data-act]");if(!b||!rec)return;
    if(b.dataset.act==="analyze")runAnalysis((rec.keywords&&rec.keywords[0])||rec.title);
    else if(b.dataset.act==="details")openRecordDrawer(rec);
    else if(b.dataset.act==="present")openRecordDeck(filteredKB(),id);
    else if(b.dataset.act==="edit"&&isAdmin)openEditor(rec);
    else{var m=card.querySelector(".record-more");if(m){m.hidden=!m.hidden;b.textContent=m.hidden?"📋 Détails":"▲ Réduire";}}
  };
  $("#libGrid").addEventListener("dragstart",function(e){var card=e.target.closest(".record");if(!card||!isAdmin)return;dragId=card.dataset.id;card.classList.add("dragging");e.dataTransfer.effectAllowed="move";});
  $("#libGrid").addEventListener("dragend",function(e){var card=e.target.closest(".record");if(card)card.classList.remove("dragging");dragId=null;});
  $("#libGrid").addEventListener("dragover",function(e){if(!isAdmin||!dragId)return;e.preventDefault();});
  $("#libGrid").addEventListener("drop",function(e){if(!isAdmin||!dragId)return;e.preventDefault();var card=e.target.closest(".record");if(!card||card.dataset.id===dragId)return;var order=KB.map(function(x){return x.id;});var from=order.indexOf(dragId),to=order.indexOf(card.dataset.id);if(from<0||to<0)return;order.splice(from,1);order.splice(to,0,dragId);local.order=order;saveLocal();$("#libSort").value="manual";refreshKB();toast("⠿ Ordre manuel enregistré");});
  $("#recordForm").onsubmit=function(e){e.preventDefault();saveRecordFromForm();};
  $("#cancelRecord").onclick=closeEditor;$("#editorClose").onclick=closeEditor;
  $("#editor").onclick=function(e){if(e.target.id==="editor")closeEditor();};
  $("#deckClose").onclick=closeDeck;$("#deckPrev").onclick=function(){step(-1);};$("#deckNext").onclick=function(){step(1);};
  $("#deckPrevF").onclick=function(){deckIdx=(deckIdx-1+deckChapters.length)%deckChapters.length;slideIdx=0;renderSlide();};
  $("#deckNextF").onclick=function(){deckIdx=(deckIdx+1)%deckChapters.length;slideIdx=0;renderSlide();};
  $("#deckOverviewBtn").onclick=toggleOverview;$("#deckPlay").onclick=toggleAuto;
  $("#deckFull").onclick=function(){if(D.fullscreenElement)D.exitFullscreen();else if($("#deck").requestFullscreen)$("#deck").requestFullscreen();};
  $("#deckOverview").onclick=function(e){var b=e.target.closest(".ov");if(!b)return;deckIdx=+b.dataset.i;slideIdx=0;$("#deckOverview").hidden=true;renderSlide();};
  D.addEventListener("keydown",function(e){if(!$("#deck").hidden){if(e.key==="ArrowRight"||e.key===" "||e.key==="PageDown"){e.preventDefault();step(1);}else if(e.key==="ArrowLeft"||e.key==="PageUp"){e.preventDefault();step(-1);}else if(e.key==="Escape")closeDeck();else if(e.key.toLowerCase()==="f")$("#deckFull").click();return;}if(!$("#drawer").hidden&&e.key==="Escape")closeDrawer();if(!$("#editor").hidden&&e.key==="Escape")closeEditor();});
  $("#deck").addEventListener("touchstart",function(e){touchX=e.touches[0].clientX;},{passive:true});
  $("#deck").addEventListener("touchend",function(e){if(touchX==null)return;var dx=e.changedTouches[0].clientX-touchX;touchX=null;if(Math.abs(dx)>50)step(dx<0?1:-1);},{passive:true});
  $("#drawerClose").onclick=closeDrawer;$("#drawer").onclick=function(e){if(e.target.id==="drawer")closeDrawer();};
  $("#btBtn").onclick=btConnect;$("#installBtn").onclick=install;$("#installBtn2").onclick=install;$("#shareBtn").onclick=share;$("#shareBtn2").onclick=share;
  W.addEventListener("online",function(){netBadge();connect();replay();flush();});
  W.addEventListener("offline",netBadge);
  if(navigator.connection)navigator.connection.addEventListener("change",netBadge);
}
function loadBase(){
  SYSTEMS=FALLBACK_SYSTEMS.slice();EXPAND=FALLBACK_EXPAND;
  var cachedKB=read("eik-kb",null);baseKB=(cachedKB&&cachedKB.length)?cachedKB:FALLBACK_KB.slice();
  var cachedKW=read("eik-keywords",null);if(cachedKW&&cachedKW.expand){EXPAND=cachedKW.expand;if(cachedKW.themes)SYSTEMS=cachedKW.themes;}
  refreshKB();
  fetch("data/pannes-connues.json",{cache:"no-cache"}).then(function(r){return r.ok?r.json():null;}).then(function(j){if(Array.isArray(j)&&j.length){baseKB=j;store("eik-kb",j);refreshKB();runAnalysis("courroie humide",false);}}).catch(function(){});
  fetch("data/keywords.json",{cache:"no-cache"}).then(function(r){return r.ok?r.json():null;}).then(function(j){if(j&&j.expand){EXPAND=j.expand;if(j.themes)SYSTEMS=j.themes;store("eik-keywords",j);refreshKB();renderSearch();}}).catch(function(){});
}
function boot(){
  renderStatic();loadBase();renderRefs();renderAdmin();applyWp();route();netBadge();syncBadge(false);
  $("#gateName").value=localStorage.getItem("eik-name")||"";
  $("#aInput").value="courroie humide";runAnalysis("courroie humide",false);renderSearch();
  $("#topicInfo").textContent="Canal : "+CFG.TOPIC+" · SSE + historique 12 h + file hors ligne.";
  bind();reveals();embers();
  if(W.BroadcastChannel){var bc=new BroadcastChannel("eik-sync");bc.onmessage=function(e){deliver(e.data,false);};}
  connect();replay();flush();setInterval(function(){if(es&&es.readyState===2)connect();},30000);
  if(isAdmin)armLock();else publish({t:"hello",id:myId});
  if("serviceWorker" in navigator)navigator.serviceWorker.register("service-worker.js").catch(function(){});
  var sp=new URLSearchParams(location.search);var qa=sp.get("analyse")||sp.get("q");if(qa)setTimeout(function(){runAnalysis(qa);},500);
}
boot();
})();
