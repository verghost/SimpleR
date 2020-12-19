'use_strict';
(function() {
const playURL = browser.runtime.getURL("/img/play.gif"), pauseURL = browser.runtime.getURL("/img/pause.gif");
var SIMPLER_DO_CONTEXT_CACHE = false,
	 SIMPLER_DO_DICTIONARY_AUDIO = false,
	 SIMPLER_DO_ROMANIZE_AUDIO = false;

var c_cache = {
	"romanize": {},
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
		if(SOURTOOLS_DEBUG) console.log(`[SourTools] Error: spawnRBox got undefined or null.`);
		return;
	}
	const isText = (typeof content === "string");
	var rRoot = sourlib.elemFromString(`<div id="resultbox" class="resultbox"></div>`); // root element
	var rBox = document.createElement("div"); // actual box
	
	var pos;
	try {
		const element = document.activeElement; // Get position of selection
		let selectedRect = (element.tagName === "INPUT" || element.tagName === "TEXTAREA")? element.getBoundingClientRect() : window.getSelection().getRangeAt(0).getBoundingClientRect();
		const posX = (selectedRect.left + selectedRect.width / 2) - 150;
		pos = {
			x: (posX < 0) ? (posX + 150) : posX,
			y: selectedRect.bottom
		};
	} catch(e) {
		pos = { // default postion is center-screen if something goes wrong
			x: content.innerWidth,
			y: window.innerHeight
		};
	}
	
	if((window.innerHeight - pos.y) < 200) pos.y -= 250 - (window.innerHeight - pos.y);
	if((window.innerWidth - pos.x) < 300) pos.x -= 350 - (window.innerWidth - pos.x);
	
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
	document.addEventListener('click', closeBox); // add el to remove the box when the user clicks on trigger.
	return rBox;
}

// try to close the result box.
async function tryClose(fade_out) {
	let r = document.getElementById("resultbox");
	let isFilled = (document.getElementsByClassName("resultbox-box filled") != null) &&
					(document.getElementsByClassName("resultbox-box filled")[0] != null);
	if (r && isFilled) {
		if(SIMPLER_DO_ROMANIZE_AUDIO || SIMPLER_DO_DICTIONARY_AUDIO) { // Handle audio
			document.getElementById("sourtools-audio")?.remove?.();
			rmAudioIndex = -1;
		}
		document.getElementsByClassName("resultbox-box filled")[0].className = "resultbox-box";
		if(fade_out) await sourlib.sleep(80); // fade out
		r.remove();
		document.removeEventListener("click", closeBox); // remove el so we don't run pointless code every click
	}
}

// romanize audio
var rmAudioIndex = -1;
var getTTSFragments = function(t, arr=null, recurs=false) {
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
}, tryTTSAudio = async function (a, t, lang) {
	const TTS_SPEED = 1, fragArr = getTTSFragments(t);
	let elemArr = [], trying = true;
	let blobElem = sourlib.elemFromString(`<div id="sourtools-audio" style="display: none"></div>`);
	fragArr.forEach(function(frag, i) {
		let url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(frag)}&tl=${lang}&total=${fragArr.length}&idx=${i}&textlen=${frag.length}&client=gtx&ttsspeed=${TTS_SPEED}`;
		sourlib.req({ url: url, method: "GET", responseType: "blob", cb_ok: function(data) { // get a blob to avoid csp problems
			let blobURL = window.URL.createObjectURL(data.r);
			let elem = sourlib.elemFromString(`<audio preload="none" myindex="${i}"><source src="${blobURL}" type="audio/mpeg"></audio>`);
			// Janky way to create an audio stream from tts fragments
			elem.onplay = function(e) { rmAudioIndex = i; };
			elem.onended = function(e) { this.nextElementSibling && this.nextElementSibling.play && this.nextElementSibling.play(); };
			elemArr[data.x] = elem;
		}, cb_err: function(data) { 
			if(SOURTOOLS_DEBUG) console.log(`[SourTools] Failed to create blob ${data.x} using URL ${data.url}`);
			trying = false; 
		}, cb_send_extra: i });
	});
	while(trying && elemArr.length !== fragArr.length) await sourlib.sleep(100);
	if(trying) {
		elemArr.forEach(function(elem) { blobElem.appendChild(elem); });
		document.body.appendChild(blobElem);
		blobElem.children[0].play();
	}
}, answerResult = function(a, t, l) {
	if(SIMPLER_DO_ROMANIZE_AUDIO) {
		const answerElem = sourlib.elemFromString(`<main class="resultbox-romanization"><img class="resultbox-romanization-audiobtn" src="${playURL}"></img><br>${a}</main>`);						
		const imgTag = answerElem.children[0];
		imgTag.onclick = () => {
			const audioElem = document.getElementById("sourtools-audio");
			if(imgTag.src === playURL) {
				if(!audioElem) tryTTSAudio(a, t, l);
				else if(rmAudioIndex !== -1) audioElem.children[rmAudioIndex]?.play?.();
				imgTag.src = pauseURL;
			} else {
				if(rmAudioIndex !== -1) audioElem.children[rmAudioIndex]?.pause?.();
				imgTag.src = playURL;
			}
		};
		spawnRBox(answerElem);
	} else spawnRBox(a);
};

// dictdef audio
var tryAudio = function(word, result, url=null) {
	let imgTag = sourlib.elemFromString(`<img class="resultbox-dictdef-audio" src="${playURL}"></img>`);
	let audioElem = sourlib.elemFromString(`<audio id="sourtools-audio" style="display: none"></audio>`);
	imgTag.appendChild(audioElem);
	result.children[0].appendChild(imgTag);
	
	// Set up janky custom media player
	imgTag.onclick = function(e) { if(this.src === playURL) { audioElem.play(); } else { audioElem.pause(); } };
	audioElem.onplay = function(e) { imgTag.src = pauseURL; };
	audioElem.onpause = function(e) { imgTag.src = playURL; };
	
	if(!!url) { // Did we already get audio from the initial request? Then use that.
		audioElem.appendChild(sourlib.elemFromString(`<source src="${url}">`));
		spawnRBox(result);
		return;
	}
	
	// For audio, we just grab it first since it's just a single request.
	sourlib.req({ // First we try wiktionary for (potentially) human-recorded pronunciations
		url: "https://en.wiktionary.org/w/index.php?title=${encodeURIComponent(word)}&printable=yes",
		method: "GET",
		cb_ok: function(data) {
			let sources = new DOMParser().parseFromString(data.r, "text/html").getElementsByTagName("source");
			for(let i = 0; i < sources.length; i++) {
				if(/en-/i.test(sources[i].src)) {
					audioElem.appendChild(sourlib.elemFromString(`<source src="${sources[i].src}">`));
					break;
				}
			}
			if(audioElem.children.length === 0) { // If that fails, then we go google automated TTS.
				sourlib.req({url: `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(word)}&tl=en&total=1&idx=0&textlen=${word.length}&client=gtx&ttsspeed=1`, method: "GET", responseType: "blob", cb_ok: function(_data) {
					audioElem.appendChild(sourlib.elemFromString(`<source src="${window.URL.createObjectURL(_data.r)}">`));
					spawnRBox(result);
				}});
			} else spawnRBox(result);
		}
	});
};

var c_tools = {
	"romanize": function(data) {
		let text = data.selText.trim() // trim whitespace.
		text = text.replace(/\n/gm, ""); // remove newline.
		text = text.replace(/  +/g, ' '); // remove multiple spaces in between words.
		if(text.length > 1600) { // should prob. make this less arbitrary
			spawnRBox("Too big!");
			return;
		}
		const temp = fromSTCache("romanize", text); // Check for cached result
		if(temp) {
			answerResult(temp[0], text, temp[1]);
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
						answerResult(answer, text, lang);
						return;
					}
				}
				spawnRBox("No romanization available / necessary!"); // Fallthrough response.
			}
		});
	},
	"dictdef": function(data) {
		var word = data.selText.replace(/^\s+|\s+$|\n/gm, "");
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
									// Should we always treat syns / syns[j][0] as arrays? Check a word that gives 1 synonym.
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
						try { api.callback(data); return; } catch(e) { if(SOURTOOLS_DEBUG) console.log(`[SourTools] Got an error in ${key}: ${e}`); }
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
								<p class="resultbox-dictdef-word">${params.word}${(params.phonetic) ? " (" + params.phonetic + ")" : ""}</p>
								<ol class="resultbox-dictdef-defs">
								</ol>
							</div>`), defOL = result.children[1], dl = params.deflist, syns;
						for(let i = 0; i < dl.length; i++) { // Fill in result object
							let li = document.createElement("li");
							li.appendChild(sourlib.elemFromString(`<p class="resultbox-dictdef-def"><b class="resultbox-dictdef-type">${dl[i].type}:</b> ${dl[i].definition}</p>`));
							if(syns = dl[i].synonyms)
								li.appendChild(sourlib.elemFromString(`<p class="resultbox-dictdef-synonyms"><b>Synonyms:</b> ${Array.isArray(syns)? syns.join(", ") : syns}</p>`));
							defOL.appendChild(li);
						}
						result.appendChild(sourlib.elemFromString(`<p class="resultbox-dictdef-attrib">Taken from ${api.name}</p>`));
						doSTCache("dictdef", params.word, result); // Cache
						if(SIMPLER_DO_DICTIONARY_AUDIO) tryAudio(word, result, params.audio); // Try to add audio
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