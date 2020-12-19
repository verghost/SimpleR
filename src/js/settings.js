'use_strict';

const SOURTOOLS_NUM_LIMIT = 4000;
var d = document, ssettings = [];

// Just a bit of glue to dodge the "no innerHTML rule"
function replaceDiv(e, ih) {
	const c = (e.className == "")? `` : `class="${e.className}"`;
	e.replaceWith(sourlib.elemFromString(`<div id="${e.id}" ${c}>${ih}</div>`));
}

class SSetting {
	constructor(sName, sValue, sExtra) {
		this.name = sName.split("-")[1];
		this.hidden = typeof sExtra.hidden !== "undefined";
		this.extra = sExtra;
		this.fullName = sName;
		this.ctype = (sExtra.customControl)? sExtra.customControl : (function(t) {
			if(t === "boolean") return "switch";
			else if(t === "string" || t === "number" || t === "bignum") return "stinput";
			else return t;
		})((sExtra.strictType)? sExtra.strictType : typeof sValue);
		this.value = sValue;
		this.dom = null;
		this.parent = d.getElementById(`${sName.split("-")[0]}`);
		this.changed = false;
	}
	
	// Custom modifications can happen elsewhere, but we still want to update the object and settings page here
	modify(nVal, key=null, isCustom=false) {
		if(!isCustom) {
			if(this.extra.strictType && (typeof nVal != this.extra.strictType)) { // Do type check
				let st = this.extra.strictType; // Try some type conversions
				if(st == "number" && !sourlib.isItNaN(nVal)) {
					if(nVal > SOURTOOLS_NUM_LIMIT) alert(`Number is too high, must be <= ${SOURTOOLS_NUM_LIMIT}!`);
					else if(nVal < 0) alert("Must be a positive value!");
					else nVal = Number(nVal);
				} else if(st == "string") {
					nVal = String(nVal);
				} else if(st == "boolean" && (nVal == "true" || nVal == "on" || nVal == 1)) {
					nVal = true;
				} else if(st == "boolean" && (nVal == "false" || nVal == "off" || nVal == 0)) {
					nVal = false;
				} else {
					alert(`Bad type! Should be: "${this.extra.strictType}"`);
					return;
				}
			}
			if(nVal === this.value) 		 return;
			if(key == null) 					 this.value = nVal;
			else if(this.ctype == "object") this.value[key] = nVal;
		}
		this.changed = true;
		d.getElementById("settings-status-msg").innerText = "*There are unsaved changes";
	}
	
	static build(ss) { // "object" is not checked explicitly. Settings with object values should use extra.customControl
		if(!ss.hidden && (ss.changed || ss.dom == null)) {
			if(ss.dom !== null) { ss.dom.remove(); ss.dom = null; }
			let displayText = (ss.extra.displayText)? ss.extra.displayText : ss.name;
			switch(ss.ctype) {
				case "switch":
					ss.dom = sourlib.elemFromString(`<div class="switch-wrapper"><label class="settings-switch"><input id="${ss.fullName}-switch" class="settings-value" type="checkbox" ${(ss.value)? "checked" : ""}><span class="settings-slider round"></span></label> ${displayText}</div>`);
					ss.dom.getElementsByTagName("input")[0].oninput = function() { ss.modify(!ss.value); };
					break;
				case "stinput": // standard input tag
					ss.dom = sourlib.elemFromString(`<div id="${ss.fullName}" class="settings-wrapper"><input type="text" class="settings-input-basic" value="${ss.value}"> ${displayText}</div>`);
					ss.dom.getElementsByTagName("input")[0].onchange = function() { ss.modify(this.value); };
					break;
				case "file":
					let fullName = ss.fullName, displayValue = (ss.value)? (ss.value.name) : null;
					ss.dom = sourlib.elemFromString(`<div id="${fullName}"><h4 id="${fullName}-file-name">${displayText}: ${(displayValue)? ss.value.name : "no file selected"}</h4><a class="button-small tiny">Browse</a><input style="display: none;" type="file" id="${fullName}-picker" accept="text/plain"></div>`);
					ss.dom.getElementsByTagName("a")[0].onclick = function() { document.getElementById(`${fullName}-picker`).click(); }
					ss.dom.getElementsByTagName("input")[0].onchange = function() {
						if(this.files && this.files[0]) {
							ss.modify(this.files[0]);
							document.getElementById(`${fullName}-file-name`).innerText = `${displayText}` + ": " + this.files[0].name;
						}
					};
					break;
				case "cfetch":
					let dom = sourlib.elemFromString(`<div id="cfetch-settings-wrapper"><div class="cfetch-settings"></div><div class="cfetch-settings add"></div></div>`), 
					checkedFields = function(newVals) {
						let vals = [newVals[0].value, newVals[1].value, newVals[2].value.toUpperCase(), newVals[3].value.toLowerCase(), newVals[4].value.replace(/\s*,\s*/g, ",").split(","), newVals[5].value, newVals[6].value];
						if((sourlib.urlObj(vals[1]) !== null) && (["GET", "POST"].includes(vals[2])) && (["json", "html"].includes(vals[3])) && !(vals[4].includes("")))
							return vals;
						return null; 
					}, editFields = function(cf) {
						return `<b> Name</b><br><input type="text" id="cfetch-${cf.name}-name" class="edit-cfetch-value" value="${cf.name}"><br><b> URL</b><br><input type="text" id="cfetch-${cf.name}-url" class="edit-cfetch-value" value="${cf.url}"><br><b> Request Type (GET/POST)</b><br><input type="text" id="cfetch-${cf.name}-requestType" class="edit-cfetch-value" value="${cf.requestType}"><br><b> Response Type (json/html)</b><br><input type="text" id="cfetch-${cf.name}-responseType" class="edit-cfetch-value" value="${cf.responseType}"><br><b> Target(s) (ie. target1, target2)</b><br><input type="text" id="cfetch-${cf.name}-targets" class="edit-cfetch-value" value="${cf.targets.join(', ')}"><br><b> POST Data (ie. somedata=value&otherdata=value2)</b><br><input type="text" id="cfetch-${cf.name}-postdata" class="edit-cfetch-value" value="${cf.postdata}"><br><b> Description (Optional)</b><br><input type="text" id="cfetch-${cf.name}-description" class="edit-cfetch-value" value="${cf.description}">`;
					}, editDom = function(cf) { 
						return sourlib.elemFromString(`<div class="cfetch-setting"><b class="cfetch-title">${cf.name}</b><div class="cfetch-btns"><button id="cfetch-${cf.name}-edit" class="cfetch-btn">✏️</button><button id="cfetch-${cf.name}-remove" class="cfetch-btn">🗑️</button><label class="settings-switch"><input class="settings-input-cfetch" type="checkbox" ${(cf.on)? "checked" : ""}><span class="settings-slider"></span></label></div><div id="cfetch-${cf.name}-fields" class="cfetch-fields" hidden=true><div id="cfetch-${cf.name}-values">${editFields(cf)}</div><button id="cfetch-${cf.name}-conf" class="cfetch-btn">✔️</button><button id="cfetch-${cf.name}-cancel" class="cfetch-btn">❌</button></div></div>`);
					}, addELs = function(tempDom, cf, i, a) {
						tempDom.getElementsByClassName("settings-input-cfetch")[0].oninput = function() { // on/off switch
							cf.on = !cf.on;
							ss.modify(null, null, true);
						};
						tempDom.getElementsByClassName("cfetch-btn")[0].onclick = function() { document.getElementById(`cfetch-${cf.name}-fields`).hidden = false; };
						tempDom.getElementsByClassName("cfetch-btn")[1].onclick = function() { // remove
							a.splice(i, 1);
							ss.modify(null, null, true);
							tempDom.remove();
						};
						tempDom.getElementsByClassName("cfetch-btn")[2].onclick = function() { // save
							let vals, newVals = tempDom.getElementsByClassName("edit-cfetch-value");
							let cfChanged = false;
							if((vals = checkedFields(newVals)) !== null) {
								vals.forEach(function(v, i) { 
									let k = newVals[i].id.split("-")[2];
									if(String(cf[k]) !== String(v)) {
										cf[k] = v;
										cfChanged = true;
									}
								});
								if(cfChanged) ss.modify(null, null, true);
								document.getElementById(`cfetch-${cf.name}-fields`).hidden = true;
							} else alert("One or more of the values entered is invalid!");
						};
						tempDom.getElementsByClassName("cfetch-btn")[3].onclick = function() { // cancel
							replaceDiv(document.getElementById(`cfetch-${cf.name}-values`), `${editFields(cf)}`); 
							document.getElementById(`cfetch-${cf.name}-fields`).hidden = true;
						};
						return tempDom;
					}, addDefaults = `<b> Name</b><br><input type="text" id="add-cfetch-name" class="add-cfetch-value"><br><b> URL</b><br><input type="text" id="add-cfetch-url" class="add-cfetch-value"><br><b> Request Type (GET/POST)</b><br><input type="text" id="add-cfetch-requestType" class="add-cfetch-value"><br><b> Response Type (json/html)</b><br><input type="text" id="add-cfetch-responseType" class="add-cfetch-value"><br><b> Target(s) (ie. target1, target2)</b><br><input type="text" id="add-cfetch-targets" class="add-cfetch-value"><br><b> POST Data (ie. somedata=value&otherdata=value2)</b><br><input type="text" id="add-cfetch-postdata" class="add-cfetch-value"><br><b> Description (Optional)</b><br><input type="text" id="add-cfetch-description" class="add-cfetch-value">`;
					// Make existing cfetch settings
					ss.value.forEach(function(cf, i, a) { dom.children[0].appendChild(addELs(editDom(cf), cf, i, a)); });
					
					// Make add section
					dom.children[1].appendChild(sourlib.elemFromString(`<button id="add-cscan-btn" class="cfetch-btn">➕</button>`));
					dom.children[1].appendChild(sourlib.elemFromString(`<div id="add-cfetch" class="cfetch-fields" hidden=true><div id="add-cfetch-values">${addDefaults}</div><button id="add-cfetch-conf" class="cfetch-btn">✔️</button><button id="add-cfetch-cancel" class="cfetch-btn">❌</button></div>`));
					dom.children[1].lastChild.previousSibling.onclick = function() { document.getElementById("add-cfetch").hidden = false; };
					dom.children[1].lastChild.getElementsByClassName("cfetch-btn")[0].onclick = function() { // add
						let vals = [], newCFetch = {}, newVals = document.getElementsByClassName("add-cfetch-value");
						if((vals = checkedFields(newVals)) != null) {
							vals.forEach(function(v, i) { newCFetch[newVals[i].id.split("-")[2]] = v; });
							ss.value.push(newCFetch);
							ss.dom.children[0].appendChild(addELs(editDom(newCFetch), newCFetch, ss.value.length, ss.value));
							ss.modify(null, null, true);
							replaceDiv(document.getElementById("add-cfetch-values"), `${addDefaults}`);
							document.getElementById("add-cfetch").hidden = true;
						} else alert("One or more of the values entered is invalid!");
					};
					dom.children[1].lastChild.getElementsByClassName("cfetch-btn")[1].onclick = function() {  // cancel add
						replaceDiv(document.getElementById("add-cfetch-values"), `${addDefaults}`);
						document.getElementById("add-cfetch").hidden = true; 
					};
					ss.dom = dom;
					break;
				default:
					if(SOURTOOLS_DEBUG) throw `[SourTools] SSetting.build() fell through. Some settings type has not been implemented.`;
					return;
			}
		}
	}
}

/////////////////////////////////////////////////////////////////////////////////////////////////
// Save/Load Settings
/////////////////////////////////////////////////////////////////////////////////////////////////
function saveSettings(toFile) {
	function doSave(obj) {
		let nObj = {};
		if(d.getElementById("settings-status-msg").innerText != "") {
			for(let i=0; i < ssettings.length; i++) {
				nObj[ssettings[i].fullName] = ssettings[i].value;
				ssettings[i].changed = false;
			}
			if(function(keySet, nKeySet) {
				if(keySet.length === nKeySet.length) {
					for(let i=0; i < keySet.length; i++)
						if(keySet[i] != nKeySet[i]) return false;
					return true;
				}
				if(SOURTOOLS_DEBUG) console.log(`[SourTools] Keyset mismatch: Old: ${keySet}` + "\n!=\n" + `New: ${nKeySet}`);
				return false;
			}(Object.keys(obj["user"]), Object.keys(nObj))) {
				obj["user"] = nObj;
				browser.storage.local.set(obj);
				d.getElementById("settings-status-msg").innerText = "";
			} else {
				if(SOURTOOLS_DEBUG) throw "[Sourtools] Error: Setting inconsistency!";
				return;
			}
		}
		if(toFile) {
			// File blob object
			var data = js_beautify(JSON.stringify(obj["user"]));
			var file = new Blob([data], {type: 'application/json'});
			
			// Create a temporary donwload link and click it
			var a = d.createElement("a");
			var url = URL.createObjectURL(file);
			a.href = url;
			a.download = ('simpler_settings_' + (new Date().toLocaleString().replace(/[\,\/\:]/g,'.')) + ".json").replace(/\s/g,'');
			d.body.appendChild(a);
			a.click();
			setTimeout(function() {
				d.body.removeChild(a);
				window.URL.revokeObjectURL(url);  
			}, 0);
		}
	}
	browser.storage.local.get("user").then(doSave, sourlib.errHandler("Failed to retrieve storage object for saveSettings."));
}

function loadSettings(fromFile, file=null) {	
	function initSettings(obj) {
		ssettings = [];
		let userSettings = obj["user"];
		for(let sName in userSettings) {
			let sValue = userSettings[sName];
			ssettings.push(new SSetting(sName, sValue, obj["extra"][sName]));
		}
		
		// Display settings
		let settingTypes = d.getElementsByClassName("setting-type");
		for(let i=0; i < settingTypes.length; i++)
			settingTypes[i].childNodes.forEach(function(e) { e.remove(); });
		for(let i=0; i < ssettings.length; i++) {
			if(ssettings[i].hidden) continue;
			SSetting.build(ssettings[i]);
			ssettings[i].parent.appendChild(ssettings[i].dom);
		}
	}
	
	function loadFromFile(obj) {
		var r = new FileReader();
		r.onloadend = function() {
			try { // Update any settings in JSON matching those in obj so we keep stable version
				var jsonObj = JSON.parse(this.result);
				for(var setting in jsonObj)
					if(obj["user"][setting])
						obj["user"][setting] = jsonObj[setting];
				obj["user"] = jsonObj;
				loadFromStorage(obj);
				browser.storage.local.set(obj);
				initSettings(obj);
			} catch(e) {
				if(SOURTOOLS_DEBUG) alert("Something went wrong!: " + e.toString());
			}
		}
		r.readAsText(file);
	}
	
	if(fromFile) browser.storage.local.get().then(loadFromFile, sourlib.errHandler("Failed to retrieve local storage object for loadFromFile."));
	else 			 browser.storage.local.get().then(initSettings, sourlib.errHandler("Failed to retrieve local storage object for initSettings."));
}

////////////////////////////////////////////////////////////////
// Page code
////////////////////////////////////////////////////////////////
function c(e){
	switch (e.srcElement.id) {
		case 'btn-save':
			saveSettings(false);
			break;
		case 'btn-export':
			saveSettings(true);
			break;
		case 'btn-reset':
			if(confirm("This will reset all SourTools settings to their defaults. Are you sure?")) {
				let defaults = browser.extension.getBackgroundPage().sourtools_defaults;
				browser.storage.local.set(defaults).then(function() { window.location.href = window.location.href; /* refresh page */ });
			}
			break;
		case 'btn-cfetch-add':
			e.srcElement.hidden = true;
			document.getElementById("settings-cfetch-add").hidden = false;
			break;
		case 'btn-cfetch-conf':
			addCscan();
			break;
		case 'btn-cfetch-cancel':
			resetAdd();
			break;
		case 'list-load':
			document.getElementById("list-load-picker").click();
			break;
		case 'json-load':
			document.getElementById("json-load-picker").click();
			break;
		default:
			break;
	}
}

window.onload = function() {
	document.getElementById("json-load-picker").onchange = function() {
		if(this.files && this.files[0])
			loadSettings(true, this.files[0]);
	};
	loadSettings(false);
}

// Inform the user about any unsaved settings (chrome needs e.returnValue = '';)
window.onbeforeunload = function(e) {
	if(d.getElementById("settings-status-msg").innerText != "")
		e.preventDefault();
}

document.addEventListener("click", c);
