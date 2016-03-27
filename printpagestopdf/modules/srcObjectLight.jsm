Components.utils.import("resource://printPages2PdfMod/printPages2PdfGlobal.jsm"); 

var EXPORTED_SYMBOLS = [ "_srcObjectLight", ];



var _srcObjectLight = function(location,bTextOnly){
	if(bTextOnly) this.isTextOnly=bTextOnly;
	this._initLocation=location;
	
	
}

_srcObjectLight.prototype = {
	favIconUrl:null,
	sourceType:"unknown",
	_initLocation:null,
	originUrl:null,
	localUrl:null,
	isImage:null,
	isTextOnly:false,
	Title:null,
	Description:null,
	cropInfo:null,	
}
 
