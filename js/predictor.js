/* Moteur prédictif — inférence marques, modèles, motorisations, puissances, corrélations de pannes. */
window.EIK_PREDICTOR = (function () {
  "use strict";
  var VERSION = "43.0.0";
  var EIK = window.EIK;
  var D = document, W = window;
  var brands = [], models = [], engines = [], correlations = [], powerMap = {};
  
  function norm(s) { return String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
  function uid() { return (W.crypto && crypto.randomUUID) ? crypto.randomUUID() : "p-" + Date.now() + "-" + Math.random().toString(16).slice(2); }
  function uniq(a) { var o = {}, r = []; (a || []).forEach(function (x) { if (x && !o[x]) { o[x] = 1; r.push(x); } }); return r; }
  function safeUrl(u) { return /^https?:\/\//i.test(String(u || "")) ? String(u) : ""; }
  
  function loadBase() {
    return Promise.all([
      fetch("data/vehicles.json?v=" + VERSION, { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : { brands: [], models: [] }; }).catch(function () { return { brands: [], models: [] }; }),
      fetch("data/engines.json?v=" + VERSION, { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : { engines: [] }; }).catch(function () { return { engines: [] }; }),
      fetch("data/correlations.json?v=" + VERSION, { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : { correlations: [] }; }).catch(function () { return { correlations: [] }; })
    ]).then(function (results) {
      brands = results[0].brands || [];
      models = results[0].models || [];
      engines = results[1].engines || [];
      correlations = results[2].correlations || [];
      powerMap = {};
      models.forEach(function (m) {
        (m.variants || []).forEach(function (v) {
          var key = norm(m.brand + " " + m.name + " " + (v.engine || "") + " " + (v.power || ""));
          powerMap[key] = { brand: m.brand, model: m.name, engine: v.engine, power: v.power, years: v.years || m.years || "" };
        });
      });
      if (EIK) {
        EIK.predictorVersion = VERSION;
        EIK.vehicleCount = models.length;
        EIK.engineCount = engines.length;
        EIK.corrCount = correlations.length;
        EIK.setCheck("predictor", "Moteur prédictif", "ok", VERSION + " · " + models.length + " modèles");
      }
    });
  }
  
  function inferVehicle(query) {
    var q = norm(query);
    var tokens = q.split(/[^a-z0-9]+/).filter(function (t) { return t.length > 1; });
    var matches = [];
    
    // Détection de puissance (ex: "110", "110ch", "150hp")
    var power = null;
    var powerMatch = query.match(/(\d+)\s*(?:ch|hp|cv|kw)/i);
    if (powerMatch) power = powerMatch[1];
    
    // Détection de marque
    var detectedBrand = null;
    brands.forEach(function (b) {
      var bn = norm(b.name);
      if (q.indexOf(bn) >= 0 || tokens.indexOf(bn) >= 0) {
        detectedBrand = b.name;
      }
      (b.aliases || []).forEach(function (a) {
        if (q.indexOf(norm(a)) >= 0) detectedBrand = b.name;
      });
    });
    
    // Détection de modèle
    var detectedModel = null;
    models.forEach(function (m) {
      var mn = norm(m.name);
      if (q.indexOf(mn) >= 0) {
        if (!detectedBrand || detectedBrand === m.brand) {
          detectedModel = m;
          detectedBrand = m.brand;
        }
      }
      (m.aliases || []).forEach(function (a) {
        if (q.indexOf(norm(a)) >= 0) {
          if (!detectedBrand || detectedBrand === m.brand) {
            detectedModel = m;
            detectedBrand = m.brand;
          }
        }
      });
    });
    
    // Détection de motorisation
    var detectedEngine = null;
    engines.forEach(function (e) {
      var en = norm(e.code);
      if (q.indexOf(en) >= 0 || tokens.indexOf(en) >= 0) {
        detectedEngine = e;
      }
      (e.names || []).forEach(function (n) {
        if (q.indexOf(norm(n)) >= 0) detectedEngine = e;
      });
    });
    
    // Recherche dans powerMap
    if (detectedBrand && detectedModel) {
      var key = norm(detectedBrand + " " + detectedModel.name + " " + (detectedEngine ? detectedEngine.code : "") + " " + (power || ""));
      var exact = powerMap[key];
      if (!exact) {
        Object.keys(powerMap).forEach(function (k) {
          if (k.indexOf(norm(detectedBrand)) >= 0 && k.indexOf(norm(detectedModel.name)) >= 0) {
            if (!detectedEngine || k.indexOf(norm(detectedEngine.code)) >= 0) {
              if (!power || k.indexOf(power) >= 0) {
                exact = powerMap[k];
              }
            }
          }
        });
      }
      if (exact) {
        return {
          brand: exact.brand,
          model: exact.model,
          engine: exact.engine,
          power: exact.power,
          years: exact.years,
          confidence: "Élevé"
        };
      }
    }
    
    // Retour partiel
    if (detectedBrand || detectedModel || detectedEngine) {
      return {
        brand: detectedBrand || null,
        model: detectedModel ? detectedModel.name : null,
        engine: detectedEngine ? detectedEngine.code : null,
        power: power || null,
        years: detectedModel ? (detectedModel.years || "") : "",
        confidence: "Partiel"
      };
    }
    
    return null;
  }
  
  function findCorrelations(vehicle) {
    if (!vehicle) return [];
    var results = [];
    var brand = norm(vehicle.brand || "");
    var model = norm(vehicle.model || "");
    var engine = norm(vehicle.engine || "");
    
    correlations.forEach(function (c) {
      var score = 0;
      var cBrand = norm(c.brand || "");
      var cModel = norm(c.model || "");
      var cEngine = norm(c.engine || "");
      
      if (brand && cBrand && (brand === cBrand || brand.indexOf(cBrand) >= 0 || cBrand.indexOf(brand) >= 0)) score += 40;
      if (model && cModel && (model === cModel || model.indexOf(cModel) >= 0 || cModel.indexOf(model) >= 0)) score += 50;
      if (engine && cEngine && (engine === cEngine || engine.indexOf(cEngine) >= 0 || cEngine.indexOf(engine) >= 0)) score += 60;
      
      if (score > 0) {
        results.push({
          failure: c.failure,
          probability: c.probability || score / 10,
          severity: c.severity || "Élevé",
          system: c.system || "generic",
          description: c.description || "",
          score: score
        });
      }
    });
    
    return results.sort(function (a, b) { return b.score - a.score; }).slice(0, 20);
  }
  
  function analyzePredictive(query) {
    var vehicle = inferVehicle(query);
    var correlations = vehicle ? findCorrelations(vehicle) : [];
    
    return {
      vehicle: vehicle,
      correlations: correlations,
      confidence: vehicle ? vehicle.confidence : "Aucun véhicule détecté",
      query: query
    };
  }
  
  function getStats() {
    return {
      brands: brands.length,
      models: models.length,
      engines: engines.length,
      correlations: correlations.length
    };
  }
  
  loadBase();
  
  return {
    version: VERSION,
    inferVehicle: inferVehicle,
    findCorrelations: findCorrelations,
    analyzePredictive: analyzePredictive,
    getStats: getStats,
    getBrands: function () { return brands.slice(); },
    getModels: function () { return models.slice(); },
    getEngines: function () { return engines.slice(); },
    getCorrelations: function () { return correlations.slice(); }
  };
})();
