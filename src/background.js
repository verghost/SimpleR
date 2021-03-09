'use strict';

// Default Settings: these cover things that can be changed in the settings menu, as well as other stuff.
var SimpleR_defaults = {
	"tools" : { // Tools in context menu
		"tool-dictdef": { title: "Dictionary Definition", contextstr: "selection", needs_resultbox: true },
		"tool-romanize": { title: "Romanize", contextstr: "selection", needs_resultbox: true }
	},
	"user": {
		"cm-doContentCache": true,
		"cmDD-doTryAudioPronunciation": true,
		"cmRM-doTryTTS": false
	},
	"extra": {
		"cm-doContentCache": {displayText: "Cache results from the context menu (right-click menu) actions", strictType: "boolean"},
		"cmDD-doTryAudioPronunciation": {displayText: "Try to grab audio pronunciations", strictType: "boolean"},
		"cmRM-doTryTTS": {displayText: "Try to grab text-to-speech audio", strictType: "boolean"}
	}
};

function onMenuCreated() { // Menu creation callback for debug purposes
	if (browser.runtime.lastError && SOURTOOLS_DEBUG) console.log(`[SimpleR] Error while creating a context menu: ${browser.runtime.lastError}`);
}

function onMenuClick(info, tab) { // Callback for context menu click
	browser.storage.local.get().then(function(obj) {
		let tool = obj["tools"][info.menuItemId];
		let data = { ...tool, menuItem: info.menuItemId.slice(5), url: tab.url, userSettings: obj["user"] };
		if(tool.contextstr == "selection")
			data.selText = info.selectionText;
		browser.tabs.sendMessage(tab.id, data);
	});
}

function tryInit(obj) { // attempt to initialize settings and context menus
	console.log("[SimpleR] Trying init...");
	try {
		let settings = obj;
		for(let toolName in obj["tools"]) { // Add content tools
			if(toolName == "tool-tts" && !obj["user"]["cm-enableTTS"]) continue;
			let tool = obj["tools"][toolName];
			browser.contextMenus.create({
				id: toolName,
				title: tool.title,
				contexts: [tool.contextstr]
			}, onMenuCreated);
		}
	} catch(e) {
		if(SOURTOOLS_DEBUG) console.log(`[SimpleR] Got error in tryInit: ${e}`);
		return 1;
	}
	return 0;
}

browser.storage.local.get().then(function(obj) { // Init cm and settings obj
	if(SOURTOOLS_DEBUG) console.log("[SimpleR] Initializing settings object in background.js");
	if(Object.entries(obj).length === 0) browser.storage.local.set(SimpleR_defaults).then(function() { tryInit(SimpleR_defaults); }, sourlib.errHandler("Second tryInit failed.", true));
	else tryInit(obj);
}, sourlib.errHandler("Failed to retrieve local storage object for tryInit."));

browser.contextMenus.onClicked.addListener(onMenuClick);
