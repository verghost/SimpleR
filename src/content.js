'use_strict';
(function() {
var SIMPLER_DO_CONTEXT_CACHE = false,
	 SIMPLER_DO_DICTIONARY_AUDIO = false,
	 SIMPLER_DO_ROMANIZE_AUDIO = false;

var rBoxLastPos = null; // last position of result box
var c_cache = {
	"romanize": {},
	"tts": {},
	"dictdef": {}
}, fromSTCache = function(t, k) { return (SIMPLER_DO_CONTEXT_CACHE) ? c_cache[t][k] : null; },
	doSTCache 	= function(t, k, v) { return (SIMPLER_DO_CONTEXT_CACHE) ? (c_cache[t][k] = v) : v; };

function closeBox(e) {
	e = e || window.event;
	var target = e.target || e.srcElement;
	if (target.className.indexOf("resultbox") == -1) tryClose(true);
}

function spawnRBox(content) {
	if(!content) {
		if(SOURTOOLS_DEBUG) console.log(`[SimpleR] Error: spawnRBox got undefined or null.`);
		return;
	}
	const isText = (typeof content === "string");
	var rRoot = sourlib.elemFromString(`<div id="resultbox" class="resultbox"></div>`); // root element
	var rBox = document.createElement("div"); // actual box
	
	// Determine result box position
	const rbMinWidth = 300, rbMinHeight = 200;
	var pos = { x: (window.innerWidth - rbMinWidth) / 2, y: window.innerHeight / 2 }; // default postion is center-screen
	try {
		const element = document.activeElement; // Get position of selection
		let selectedRect = (element.tagName === "INPUT" || element.tagName === "TEXTAREA")? element.getBoundingClientRect() : window.getSelection().getRangeAt(0).getBoundingClientRect();
		const posX = selectedRect.left + ((selectedRect.width - rbMinWidth) / 2);
		if(posX > 0) pos = { x: posX, y: selectedRect.bottom }; // new calculated position (if valid)
		else if(rBoxLastPos) pos = rBoxLastPos; // last known position (if available)
	} catch(e) {}
	if((window.innerHeight - pos.y) < rbMinHeight) pos.y -= (rbMinHeight + 50) - (window.innerHeight - pos.y); // final position adjustments
	if((window.innerWidth - pos.x) < rbMinWidth) pos.x -= (rbMinWidth + 50) - (window.innerWidth - pos.x);
	
	rBox.style = `top: ${pos.y}px; left:${pos.x}px;`; // template literals ftw
	rBox.className = "resultbox-box";

	var dragWrap = document.createElement("div"); // draggable "top bar" of sorts
	dragWrap.className = "resultbox-drag";
	dragWrap.draggable = true;
	dragWrap.addEventListener("drag", (e) => {
		// Drag code? otherwise we're just giving top padding
	});
	
	rBox.appendChild(dragWrap);
	if(isText) {
		var textWrap = document.createElement("div"); // wrapper for the text because
		textWrap.className = "resultbox-result";
		var ptag = document.createElement("p"); // where the text goes
		ptag.id = "resultbox-p"; ptag.className = "resultbox-text";
		textWrap.appendChild(ptag);
		rBox.appendChild(textWrap);
	} else rBox.appendChild(content);
	rRoot.appendChild(rBox);
	document.body.appendChild(rRoot); // lots of appending
	if(isText) document.getElementById("resultbox-p").innerText = content;
	if (rBox.clientHeight >= 200 || rBox.offsetHeight >= 200) { // do we need a scroll bar?
		rBox.style.overflowY = "scroll";
	}
	rBox.className = "resultbox-box filled"; // tell the rbox it's been given the goods
	document.addEventListener('mouseup', closeBox); // add el to remove the box when the user clicks on trigger.
	return rBox;
}

// try to close the result box.
async function tryClose(fade_out) {
	let r = document.getElementById("resultbox");
	let isFilled = (document.getElementsByClassName("resultbox-box filled") != null) &&
					(document.getElementsByClassName("resultbox-box filled")[0] != null);
	if (r && isFilled) {
		if(SIMPLER_DO_ROMANIZE_AUDIO || SIMPLER_DO_DICTIONARY_AUDIO) { // Handle audio
			document.getElementById("simpleR-audio")?.remove?.();
			rmAudioIndex = -1;
		}
		document.getElementsByClassName("resultbox-box filled")[0].className = "resultbox-box";
		if(fade_out) await sourlib.sleep(80); // fade out
		r.remove();
		document.removeEventListener("click", closeBox); // remove el so we don't run pointless code every click
	}
}

// audio stuff
var rmAudioIndex = -1;
const playURL = browser.runtime.getURL("/img/play.gif"), pauseURL = browser.runtime.getURL("/img/pause.gif");
var getTTSFragments = function(t, arr=null, recurs=false) { // RE'd code from google tts; constructs text fragments for google's servers
	const cThreshVal = 200;
	let fragArr = [], puncRegex = /([?.,;:!][ ]+)|([\u3001\u3002\uff01\uff08\uff09\uff0c\uff0e\uff1a\uff1b\uff1f][ ]?)/g;
	for(var d = 0; puncRegex.test(t); ) {
		var e = puncRegex.lastIndex;
		if(e > d) fragArr.push(t.substr(d, e - d)); // push from loop var to found regex match
		d = e; // set loop var to the regex match (skip over the part we just pushed);
	}
	if(t.length > d) fragArr.push(t.substr(d)); // push anything left onto the end
	let tempStr = '', tempArr = (recurs)? arr : [];
	for(let i = 0; i < fragArr.length; i++) {
		var f = fragArr[i], temp = (tempStr + f).trim();
		if(temp.length <= cThreshVal) tempStr += f;
		else if(!(/^[\s\xa0]*$/.test(tempStr))) {
			tempArr.push(tempStr.trim()), tempStr = '', temp = f.trim();
			if(temp.length <= cThreshVal) tempStr = f;
			else tempArr = getTTSFragments(temp, tempArr, true); // recurs
		}
	}
	if(!(/^[\s\xa0]*$/.test(tempStr))) { tempArr.push(tempStr.trim()); }
	return tempArr;
}, tryTTS = async function(t, l, p, e="gtt") {
	const TTS_SPEED = 1;
	let elemArr = [], trying = true, succeeded = 0;
	let audioElem = sourlib.elemFromString(`<div id="simpleR-audio" style="display: none"></div>`);
	
	let fragArr, uf, pf, rparams = {};
	switch(e) {
		case "gtt":
			fragArr = getTTSFragments(t);
			uf = function(fr, fri) { return `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(fr)}&tl=${l}&total=${fragArr.length}&idx=${fri}&textlen=${fr.length}&client=gtx&ttsspeed=${TTS_SPEED}`; };
			pf = function(data) { return window.URL.createObjectURL(data.r); }; // currently, we wait for browser to call revokeObjectURL() (bad memory management)
			rparams = { method: "GET", responseType: "blob"  }; // get a blob to avoid csp problems
			break;
		case "wiki":
			fragArr = t.split(" ");
			uf = function(fr, fri) { return `https://en.wiktionary.org/w/index.php?title=${encodeURIComponent(fr)}&printable=yes`; };
			pf = function(data) {
				let sources = new DOMParser().parseFromString(data.r, "text/html").getElementsByTagName("source");
				for(let i = 0; i < sources.length; i++)
					if(/en-/i.test(sources[i].src)) return sources[i].src;
				return null;
			};
			rparams = { method: "GET" };
			break;
	}
	
	fragArr.forEach(function(frag, frag_i) {
		sourlib.req({ url: uf(frag, frag_i), ...rparams,
		cb_ok: function(data) { // parse audio element array
			let a_url;
			try {
				a_url = pf(data);
				if(!a_url) {
					trying = false;
					console.log(`[SimpleR] Engine ${e} failed at frag ${data.x}`);
				}
			} catch(e) { // fail
				console.log(`[SimpleR] Engine ${e} failed at frag ${data.x}`);
				trying = false;
			}
			// Janky way to create an audio stream from tts fragments
			let elem = sourlib.elemFromString(`<audio preload="none" myindex="${data.x}"><source src="${a_url}"></audio>`); // type="audio/mpeg"
			elem.onplay = function(e) { rmAudioIndex = data.x; };
			elem.onended = function(e) { this?.nextElementSibling?.play?.() || document.getElementsByClassName("resultbox-audiobtn")[0].click(); };
			elemArr[data.x] = elem;
			succeeded++;
		}, cb_err: function(data) {
			if(SOURTOOLS_DEBUG) console.log(`[SimpleR] Failed to create blob ${data.x} using URL ${data.url}`);
			trying = false;
		}, cb_send_extra: frag_i });
	});
	
	while(trying && succeeded < fragArr.length) await sourlib.sleep(100);
	if(trying) {
		elemArr.forEach(function(elem, i) { audioElem.appendChild(elem); });
		p.appendChild(audioElem);
	}
	return trying;
}, tryAudio = function(t, l, c, ou, e, backup) { // t = text, l = lang, c = content, ou = override url, e = engine
	let rBox, imgTag;
	if(!c || typeof c === "string") {
		c = c || t;
		rBox = sourlib.elemFromString(`<div class="resultbox-result"><img class="resultbox-audiobtn"></img><br><p id="resultbox-p" class="resultbox-text">${c}</p></div>`);	
	} else rBox = c;
	imgTag = rBox.getElementsByTagName("img")[0];
	imgTag.src = playURL;
	
	if(!!ou) { // Did we already get audio from the initial request? Then use that.
		let audioElem = sourlib.elemFromString(`<audio id="simpleR-audio" style="display: none"></audio>`);
		imgTag.appendChild(audioElem);
		
		// Set up media player
		imgTag.onclick = function(e) { if(this.src === playURL) { audioElem.play(); } else { audioElem.pause(); } };
		audioElem.onplay = function(e) { imgTag.src = pauseURL; };
		audioElem.onpause = function(e) { imgTag.src = playURL; };
		
		audioElem.appendChild(sourlib.elemFromString(`<source src="${ou}">`));
		spawnRBox(rBox);
		return;
	}
	
	imgTag.onclick = () => {
		const audioElem = document.getElementById("simpleR-audio");
		if(imgTag.src === playURL) {
			if(!audioElem) tryTTS(t, l, imgTag, e).then((ret) => {
				if(ret) document.getElementById("simpleR-audio").children[0].play();
				else if(backup) tryTTS(t, l, imgTag, backup).then((ret) => { (ret && document.getElementById("simpleR-audio").children[0].play()) || (imgTag.src = playURL); });
				else imgTag.src = playURL;
			});
			else if(rmAudioIndex > -1) audioElem.children[rmAudioIndex]?.play?.();
			imgTag.src = pauseURL;
		} else {
			if(rmAudioIndex !== -1) audioElem.children[rmAudioIndex]?.pause?.();
			imgTag.src = playURL;
		}
	};
	spawnRBox(rBox);
};

var c_tools = {
	"romanize": function(data) {
		let text = data.selText.trim(); // trim whitespace.
		text = text.replace(/\n/gm, ""); // remove newline.
		text = text.replace(/  +/g, ' '); // remove multiple spaces in between words.
		if(text.length > 1600) { // should prob. make this less arbitrary
			spawnRBox("Too big!");
			return;
		}
		
		const temp = fromSTCache("romanize", text); // Check for cached result
		if(temp) {
			tryAudio(text, temp[1], temp[0], null, "gtt");
			return;
		}
		
		sourlib.req({ // send request to google api
			url: "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&dt=rm" + "&q=" + encodeURIComponent(text),
			method: "GET", 
			cb_ok: function(data) {
				const gapi = JSON.parse(data.r);
				if (gapi[0]) {
					// GTL puts the romanized text at the 3rd index of the last element of the 0th index.
					// It also puts the language in two seperate places (for the params used) so we check them both.
					const lang = (gapi[2])? gapi[2] : gapi[8]?.[0]?.[0];
					const answer = gapi[0]?.[gapi[0].length - 1]?.[3];
					if(answer && lang && lang != "en") {
						doSTCache("romanize", text, [answer, lang]); // cache if we get an answer
						tryAudio(text, lang, answer, null, "gtt");
						return;
					}
				}
				spawnRBox("No romanization available / necessary!"); // Fallthrough response.
			}
		});
	},
	"dictdef": function(data) {
		var word = data.selText.replace(/^\s+|\s+$|\n/gm, ""); // remove unnecessary spaces and newlines
		if(!word.match(/\s/g)) { // Single word
			word = word.replace(/[^A-Za-z-]/g, ""); // Test for non-english chars and do formatting (ie. remove '.', '!', etc...)
			if(word == "") {
				spawnRBox("No results!");
				return;
			}
			word = word.toLowerCase();
			const temp = fromSTCache("dictdef", word);
			if(temp) {
				spawnRBox(temp);
				return;
			}
			var apis = { // a few apis so that we have backups, but we also shouldn't take too long to exhaust the chain
				"MW_v1": {
					name: "Merriam-Webster",
					next: "GAPI",
					url: `https://api.dictionaryapi.dev/api/v3/entries/en/${encodeURIComponent(word)}`,
					callback: function(data) {
						let obj = JSON.parse(data.r)[0], w = obj["word"], m = obj["meaning"], ph = obj["phonetics"]?.[0];
						let k = Object.keys(m), v = Object.values(m), deflist = [];
						for(let j = 0, count = 0; j < k.length; j++) {
							v[j].forEach(function(d) { deflist[count++] = {
								type: k[j], 
								definition: d["definition"], 
								example: d["example"], 
								synonyms: (d["synonyms"])? d["synonyms"].join(", ") : null 
							}});
						}
						dictAction("display", "MW_v1", { word: w, phonetic: ph?.["text"], audio: ph?.["audio"], deflist: deflist }); // display dictionary data
					}
				},
				"GAPI": { 
					name: "Google",
					next: "WK",
					url: `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&dt=md&dt=ss&dt=rm&q=${encodeURIComponent(word)}`,
					callback: function(data) {
						let obj = JSON.parse(data.r), defs = obj[12], syns, deflist = [];
						for(let i = 0, count = 0; i < defs.length; i++) {
							defs[i][1].forEach(function(d) {
								// ID string assigned to individual word results. This is needed because synonyms aren't
								// broken up the same way that definitions are. They seem to come in groups limited to 16.
								let wid = d[1];
								deflist[count++] = { type: defs[i][0], definition: d[0], example: null, synonyms: (function(syns) {
									// TODO: Should we always treat syns / syns[j][0] as arrays? Check a word that gives 1 synonym.
									if(syns && typeof syns === "object") {
										let ret = [];
										for(let j = 0; j < syns.length; j++) {
											let synId = syns[j][1];
											if(synId == wid && typeof syns[j][0] === "object") ret = ret.concat(syns[j][0]);
										}
										if(ret.length > 0) return ret;
									}
									return null;
								})(obj[11]?.[i]?.[1]) };
							});
						}
						dictAction("display", "GAPI", { word: obj[12][0][obj[12][0].length-1], phonetic: obj[0]?.[obj[0].length - 1]?.[3], audio: null, deflist: deflist });
					}
				},
				"WK": {
					name: "Wiktionary",
					next: null, 
					url: `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`,
					callback: function(data) {
						let dtypes = JSON.parse(data.r)["en"], deflist = [], c = 0;
						dtypes.forEach(function(dt) {
							let t = dt["partOfSpeech"];
							dt["definitions"].forEach(function(d) {
								deflist[c++] = { type: t, definition: sourlib.elemFromString(`<p>${d["definition"]}</p>`).innerText, example: null, synonyms:null };
							});
						});
						dictAction("display", "WK", { word: word, phonetic: null, audio: null, deflist: deflist });
					}
				},
				"first": "MW_v1" // our first choice
			};
			dictAction("try", apis["first"]);
		} else {
			spawnRBox("No results!");
			return;
		}
		async function dictAction(action, key, params=null) {
			let api = apis[key];
			switch(action) {
				case "try":
					sourlib.req({url: api.url, method: "GET", cb_ok: function(data) {
						try { api.callback(data); return; } catch(e) { if(SOURTOOLS_DEBUG) console.log(`[SimpleR] Got an error in ${key}: ${e}`); }
						dictAction("fail", key); // fail
					}, cb_err: function() { dictAction("fail", key); }});
					break;
				case "fail": // If we failed, then try the next api, else show error message
					if(api.next) dictAction("try", api.next);
					else spawnRBox("No results!");
					break;
				case "display": // construct the document and inject it
					if(params.deflist.length > 0) {
						let result = sourlib.elemFromString( // Base html string
							`<div class="resultbox-result">
								<p class="resultbox-dictdef-word">${params.word}${(params.phonetic) ? " (" + params.phonetic + ")" : ""}` + ((SIMPLER_DO_DICTIONARY_AUDIO && `<img class="resultbox-audiobtn"></img>`) || "") + `</p>
								<ol class="resultbox-dictdef-defs">
								</ol>
							</div>`), defOL = result.getElementsByClassName("resultbox-dictdef-defs")[0], dl = params.deflist, syns;
						for(let i = 0; i < dl.length; i++) { // Fill in result object
							let li = document.createElement("li");
							li.appendChild(sourlib.elemFromString(`<p class="resultbox-dictdef-def"><b class="resultbox-dictdef-type">${dl[i].type}:</b> ${dl[i].definition}</p>`));
							if(syns = dl[i].synonyms)
								li.appendChild(sourlib.elemFromString(`<p class="resultbox-dictdef-synonyms"><b>Synonyms:</b> ${Array.isArray(syns)? syns.join(", ") : syns}</p>`));
							defOL.appendChild(li);
						}
						result.appendChild(sourlib.elemFromString(`<p class="resultbox-dictdef-attrib">Taken from ${api.name}</p>`));
						doSTCache("dictdef", params.word, result); // Cache
						if(SIMPLER_DO_DICTIONARY_AUDIO) tryAudio(word, "en", result, params.audio, "wiki", "gtt"); // Try to add audio
						else spawnRBox(result);
					} else dictAction("fail", key);
					break;
				default: break;
			}
		}
	}
};



browser.runtime.onMessage.addListener(function(data, sender) {
	if(data.selText) { // Is this running on a selection context?
		const element = document.activeElement, inTF = (element.tagName === "INPUT" || element.tagName === "TEXTAREA"), wsel = window.getSelection();
		if(!(data.selText != "" && wsel != null && (inTF || (!inTF && `${wsel}` != "")))) return;
	}
	
	SIMPLER_DO_CONTEXT_CACHE = data.userSettings["cm-doContentCache"];
	SIMPLER_DO_DICTIONARY_AUDIO = data.userSettings["cmDD-doTryAudioPronunciation"];
	SIMPLER_DO_ROMANIZE_AUDIO = data.userSettings["cmRM-doTryTTS"];
	
	if(data.needs_resultbox)
		tryClose(false).then(() => { c_tools[data.menuItem](data); });
	else 
		c_tools[data.menuItem](data);
});
})();