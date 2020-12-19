'use strict';

// Default Settings: these cover things that can be changed in the settings menu, as well as other stuff.
var SimpleR_defaults = {
	"tools" : { // Tools in context menu
		"tool-dictdef": { on: true, title: "Dictionary Definition", contextstr: "selection", needs_resultbox: true },
		"tool-romanize": { on: true, title: "Romanize", contextstr: "selection", needs_resultbox: true }
	},
	"user": {
		"cm-doContentCache": true,
		"cmDD-doTryAudioPronunciation": true,
		"cmRM-doTryTTS": false
	},
	"extra": {
		// Extra data used for handling settings (stored seperately so they don't get saved by export)
		//	Current keys are: 
		//		-> displayText: Used for titles on settings page
		//		-> customControl: Forces use of custom type of setting control, otherwise "typeof value" is used
		//		-> strictType: Forces strict typing on setting values; some conversions will be tried (can't be a custom type)
		//		-> min and/or max: specify min/max to input values (must specify strictType: "number")
		//	NOTE: Some keys are type-specific or rely upon other keys being defined in a certain way; check settings.js
		"cm-doContentCache": {displayText: "Cache results from the context menu (right-click menu) actions", strictType: "boolean"},
		"cmDD-doTryAudioPronunciation": {displayText: "Try to grab audio pronunciations", strictType: "boolean"},
		"cmRM-doTryTTS": {displayText: "Try to grab text-to-speech audio", strictType: "boolean"}
	}
};
var settings, timeOfLastSettingsUpdate = 0;

function onMenuCreated() { // Menu creation callback for debug purposes
	if (browser.runtime.lastError && SOURTOOLS_DEBUG) console.log(`[Simple++] Error while creating a context menu: ${browser.runtime.lastError}`);
}

function onMenuClick(info, tab) { // Callback for context menu click
	if(info.menuItemId.slice(0, 5) === "tool-") {
		let tool = settings["tools"][info.menuItemId];
		let data = { ...tool, menuItem: info.menuItemId.slice(5), url: tab.url, userSettings: settings["user"] };
		if(tool.contextstr == "selection")
			data.selText = info.selectionText;
		browser.tabs.sendMessage(tab.id, data);
	}
}

function tryInit(obj) { // attempt to initialize settings and context menus
	try {
		settings = obj;
		for(let toolName in obj["tools"]) { // Add content tools
			let tool = obj["tools"][toolName];
			if(!tool["on"]) continue;
			browser.contextMenus.create({
				id: toolName,
				title: tool.title,
				contexts: [tool.contextstr]
			}, onMenuCreated);
		}
	} catch(e) {
		if(SOURTOOLS_DEBUG) console.log(`[Simple++] Got error in tryInit: ${e}`);
		return 1;
	}
	timeOfLastSettingsUpdate = new Date().getTime();
	return 0;
}

browser.storage.local.get().then(function(obj) { // Init cm and settings obj
	if(SOURTOOLS_DEBUG) console.log("[Simple++] Initializing settings object in background.js");
	if(Object.entries(obj).length === 0) browser.storage.local.set(SimpleR_defaults).then(function() { tryInit(SimpleR_defaults); }, sourlib.errHandler("Second tryInit failed.", true));
	else tryInit(obj);
}, sourlib.errHandler("Failed to retrieve local storage object for tryInit."));

browser.contextMenus.onClicked.addListener(onMenuClick);
