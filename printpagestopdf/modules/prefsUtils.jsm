Components.utils.import("resource://printPages2PdfMod/printPages2PdfGlobal.jsm"); 

/** 
 * printPages2Pdf namespace. 
 */  
if (typeof printPages2Pdf == "undefined") {  
  var printPages2Pdf = {};  
};

var EXPORTED_SYMBOLS = ["prefsUtils",];

prefsUtils = {
	addHdrFooterMenu:function(event,men){
		var ctxPopupMain=event.originalTarget;
		if(ctxPopupMain.className != "textbox-contextmenu" || ctxPopupMain.getElementsByAttribute("role","ctxmenHdrFtr").length > 0)return;
		
		var sep=ctxPopupMain.ownerDocument.createElement("menuseparator");
		ctxPopupMain.appendChild(sep);
		ctxPopupMain.appendChild(men);
	},	
	
	insertHdrFtrTag:function(event){
		var txt=event.originalTarget.value;
		var input=event.currentTarget.menupopup.triggerNode;
		
		input.value=input.value.substring(0,input.selectionStart) + txt + input.value.substring(input.selectionEnd);
	},

	getExistingDirectory:function(nd,title){
		var filePicker = Components.classes["@mozilla.org/filepicker;1"]
	                 .createInstance(Components.interfaces.nsIFilePicker);
		var mode=filePicker.modeGetFolder;
		
		var path=null;
		if (!nd.previousSibling.value) 
			path = RRprintPages2Pdf.HomeDir;
		else {		
			path = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
			path.initWithPath(nd.previousSibling.value);
		}			
		filePicker.displayDirectory=path;
			
		filePicker.init(nd.ownerDocument.defaultView,title,mode);
		
		var retVal=filePicker.show();
		
		if(retVal == filePicker.returnCancel || filePicker.file == null ) return null;
		
		var prefId=nd.previousSibling.getAttribute("preference");
		if(prefId){
			var ndPref=nd.ownerDocument.getElementById(prefId);
			if(ndPref){
				ndPref.value=filePicker.file.path;
			}		
		}
	},

	
	getExistingFileName:function(nd,extInf,title,bSave){
		var filePicker = Components.classes["@mozilla.org/filepicker;1"]
	                 .createInstance(Components.interfaces.nsIFilePicker);
		var mode=filePicker.modeOpen;
		if(bSave && bSave == true){
			mode=filePicker.modeSave;
		}
		filePicker.init(nd.ownerDocument.defaultView,title,mode);
		if(extInf[0].search(/^filter/) != -1){
			filePicker.appendFilters(filePicker[extInf[0]]);
		}
		else{
			filePicker.defaultExtension=extInf[0];
			filePicker.appendFilter(extInf[1],"*." + extInf[0]);
		}

		filePicker.appendFilters(filePicker.filterAll);
		filePicker.filterIndex=0;
		
		var retVal=filePicker.show();
		
		if(retVal == filePicker.returnCancel || filePicker.file == null ) return null;
		
		var prefId=nd.previousSibling.getAttribute("preference");
		if(prefId){
			var ndPref=nd.ownerDocument.getElementById(prefId);
			if(ndPref){
				ndPref.value=filePicker.file.path;
			}		
		}

		
	},
	
	getPrefsObject : function(doc){
		this._ndPrefPane=doc.getElementById("docWkhtmlObject");
		var ndPrefs=this._ndPrefPane.getElementsByAttribute("preference","*");
		
		var oPrefAr={};
		for (var k = 0; k < ndPrefs.length; k++) {			
			//var prefVal=ndPrefs[k].value;
			var prefVal=this.onSyncToPreference(ndPrefs[k]);
			if (prefVal) {			
				var prefName=ndPrefs[k].getAttribute("preference");
				oPrefAr[prefName]=prefVal;
			}	 
		}
		return oPrefAr;
	},	
	
	setPrefsFromObject:function(doc,prefsObj){
		this._ndPrefPane=doc.getElementById("docWkhtmlObject");
		var ndPrefs=this._ndPrefPane.getElementsByAttribute("preference","*");
		
		for (var k = 0; k < ndPrefs.length; k++) {
			var prefName=ndPrefs[k].getAttribute("preference");
			if(prefName in prefsObj){
				this._setNodeValue(ndPrefs[k],this._onSyncFromPreferenceValue(ndPrefs[k],prefsObj[prefName]));				
			}
			else {
				this._setNodeValue(ndPrefs[k],this.onSyncFromPreference(ndPrefs[k],true));				
			}			
		}
		
	},
	
	_setNodeValue:function(nd,val){
		switch(nd.nodeName){
			case "checkbox":
				nd.checked=val;				
				break;
			default:
				nd.value=val;				
				break;
		}
	},
	
	setPrefsFromSys:function(doc){
		this._ndPrefPane=doc.getElementById("docWkhtmlObject");
		var ndPrefs=this._ndPrefPane.getElementsByAttribute("preference","*");
		
		for (var k = 0; k < ndPrefs.length; k++) {
			this._setNodeValue(ndPrefs[k],this.onSyncFromPreference(ndPrefs[k],true));				
		}
		
	},
	
	_onSyncFromPreferenceValue:function(nd,actualValue){
		switch(nd.nodeName){
			case "checkbox":
				return actualValue == "true";				
				break;
			case "textbox":
				var appendix=nd.getAttribute("realvalue");	
				if (appendix) {
					return actualValue.replace(/[\D|!,|!\.]*$/, "");
				}
				else {
					return actualValue;
				}
				break;	
			case "menulist":
				if(!actualValue) actualValue="[os_default]";
				var menuitems=nd.getElementsByAttribute("value",actualValue);
				if (menuitems.length > 0) {
					nd.setAttribute("realvalue", actualValue);
					return menuitems[0].label;
				}
				else {
					nd.removeAttribute("realvalue");
					return actualValue;
				}
				break;
			default:
				return actualValue;
				break;			
		}
	},
	
	onSyncFromPreference:function(nd,real){
		var preference = nd.ownerDocument.getElementById(nd.getAttribute("preference"));
		
		var actualValue=null;
		if (real) {
			actualValue = preference.value !== undefined ? preference.valueFromPreferences : preference.defaultValue;
		}
		else {
			actualValue = preference.value !== undefined ? preference.value : preference.defaultValue;
		}
		return this._onSyncFromPreferenceValue(nd,actualValue);
	},

	onSyncToPreference:function(nd){
		var defNull=nd.ownerDocument.getElementById(nd.getAttribute("preference")).getAttribute("defnull");

		if(nd.value == defNull) return null;
		
		switch(nd.nodeName){
			case "checkbox":
				var ret=nd.checked?"true":"false";
				if(ret == defNull) return null;
				return ret;
				break;
			case "menulist":
				var realvalue=nd.getAttribute("realvalue");
				if(realvalue)
					return realvalue;
				else
					return nd.value;
				break;
			case "textbox":
				var type=nd.getAttribute("type");
				if(type == "number"){
					if(nd.value == 0 && !defNull) return null;
				}
				var appendix=nd.getAttribute("realvalue");	
				if(appendix){
					return nd.value + appendix;
				}
				else
					return nd.value;	
			default:
				return nd.value;
				break;			
		}
	},
	
	onPageUnitsSelect:function(nd){
		var broadcaster=nd.ownerDocument.getElementById('bc_pageunits');
		broadcaster.setAttribute('value',nd.selectedItem.label);		
		broadcaster.setAttribute('realvalue',nd.selectedItem.value);
	},

}
