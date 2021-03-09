'use_strict';

// Globals
const SOURTOOLS_DEBUG = false;
const SOUTOOLS_REQ_TIMEOUT = 3000;

var sourlib = {
	isItNaN: function(x) { // version of isNaN(): where "", true/false, null, etc... are not numbers!
		const t = typeof x;
		if((t === "number" && x !== NaN) || (t === "bigint")) return false;
		else if(t === "string") {
			x = x.trim(); // pretty sure Number() does this to strings (e.g. Number("  4  ") === 4)
			if(x.length > 0 && (x.match(/^(-?|\+?)Infinity$/) !== null || x.match(/[^0-9]/g) === null) && !isNaN(x)) 
				return false;
		}
		return true;
	},
	req: function(reqObj) { // Make single immediate ajax requests
		var xhr = new XMLHttpRequest(); // Create a new req
		var fireCB = async function(cb, dbgMsg=null) { // fire a single callback and emit a debug message
			if(cb_fired) return;
			let headersObj = {};
			if(reqObj.getHeaders) xhr.getAllResponseHeaders()?.split?.(/\r\n|\r|\n/)?.forEach?.(h => {
				h = h.split(":");
				headersObj[h[0].toLowerCase()] = h[1];
			});
			if(reqObj.cb_any) cb = reqObj.cb_any; // if we recieved a "any" callback then use that no matter what
			if(cb && !cb_fired) { cb_fired = true; cb({
				"s": (reqObj.url == xhr.responseURL.slice(xhr.responseURL.indexOf(reqObj.url)).replace(/\/$/, ''))? xhr.status : "3xx", 
				"url": reqObj.url, 
				"r": xhr.response,
				"h": headersObj,
				"tel": (reqObj.useTimer)? performance.now() - tStart : undefined,
				"x": reqObj.cb_send_extra
			}); }
			if(SOURTOOLS_DEBUG && dbgMsg) console.log(`[SourTools] ${dbgMsg}`);
		}, cb_fired = false, tStart = 0;
		xhr.open(reqObj.method, reqObj.url, true);
		xhr.setRequestHeader("Content-Type", (reqObj.ct || "application/x-www-form-urlencoded;charset=utf-8")); // set headers
		xhr.responseType = reqObj.responseType || "text";
		xhr.timeout = reqObj.timeout || SOUTOOLS_REQ_TIMEOUT; // Set timeout
		xhr.ontimeout = function() { fireCB(reqObj.cb_err, `Connection to ${reqObj.url} timed out.`); };
		xhr.onload = function() { fireCB(reqObj.cb_ok); }; // Set load (success)
		xhr.onerror = function() { fireCB(reqObj.cb_err, `got status code: ${this.status}`); }; // Set onerror
		xhr.onabort = function() { fireCB(reqObj.cb_err, `Request to ${reqObj.url} was aborted!`); }; // Set onabort
		xhr.onprogress = reqObj.cb_onprog; // Set onprogress (even if it's undefined)
		xhr.withCredentials = reqObj.withCredentials || false;
		reqObj.addHeaders?.forEach?.(h => { xhr.setRequestHeader(h[0], h[1]); });
		if(reqObj.useTimer) tStart = performance.now(); // start timer
		xhr.send(reqObj.send_data);
	},
	countSub(str, sub) {
		let temp = str, i, cnt = 0;
		while((i = temp.indexOf(sub)) !== -1) { temp = temp.slice(i + 1); cnt++; }
		return cnt;
	},
	replaceNth: function (s, f, r, n) { 
		return s.replace(RegExp(`^(?:.*?${f}){${n}}`), x => x.replace(RegExp(f + "$"), r)); 
	},
	elemFromString: function(str) {
		return new DOMParser().parseFromString(str, "text/html").body.children[0];
	},
	sleep: function(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	},
	errHandler: function(t, showMoreInfo=false) {
		return SOURTOOLS_DEBUG ? function(e) { 
			console.log(`[SourTools] Error: ${t}` + (showMoreInfo ? "\n" + `[SourTools] More Info: ${e}` : ""));
		} : undefined;
	}
};