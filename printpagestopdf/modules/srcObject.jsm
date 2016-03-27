Components.utils.import("resource://printPages2PdfMod/printPages2PdfGlobal.jsm"); 

var EXPORTED_SYMBOLS = [ "_srcObject","_tocObject", "_coverObject",  ];

/** 
 * printPages2Pdf namespace. 
 */  
 
if (typeof printPages2Pdf == "undefined") {  
  var printPages2Pdf = {};  
};

Components.utils.import("resource://printPages2PdfMod/domLoader.jsm",printPages2Pdf);
Components.utils.import("resource://printPages2PdfMod/persistWin.jsm",printPages2Pdf);
Components.utils.import("resource://printPages2PdfMod/win2Image.jsm",printPages2Pdf);
Components.utils.import("resource://printPages2PdfMod/textOnly.jsm",printPages2Pdf);
Components.utils.import("resource://printPages2PdfMod/srcObjectLight.jsm",printPages2Pdf);
Components.utils.import("resource://printPages2PdfMod/editPage.jsm",printPages2Pdf);
Components.utils.import("resource://printPages2PdfMod/simpleDomSaver.jsm",printPages2Pdf);


var _srcObject = function(location,bTextOnly){
	
	this.init(location,bTextOnly);
/*
	if(bTextOnly) this.isTextOnly=bTextOnly;

	if (location instanceof printPages2Pdf._srcObjectLight)  { //Light srcObject
		for(var p in location){
			this[p]=location[p];
		}
		
		if(! location.originUrl) 
			this.setOriginUrl(this._initLocation);
	}				
	else {
		this._initLocation=location;
		this.setOriginUrl(this._initLocation);
	}
	
*/
}



_srcObject.prototype = {
	
	init : function(location,bTextOnly){
	if(bTextOnly) this.isTextOnly=bTextOnly;

	if (location instanceof printPages2Pdf._srcObjectLight)  { //Light srcObject
		for(var p in location){
			this[p]=location[p];
		}
		
		if(! location.originUrl) 
			this.setOriginUrl(this._initLocation);
	}				
	else {
		this._initLocation=location;
		this.setOriginUrl(this._initLocation);
	}
	
	if (RRprintPages2Pdf.prefs.getCharPref("wkhtml.iopt.pageload.minLocal") == "true")
		this._useMinLocal=true;	
		
	},
	
	_nsProxyService : Components.classes["@mozilla.org/network/protocol-proxy-service;1"]
              .getService(Components.interfaces.nsIProtocolProxyService),
	
	_useMinLocal:false,
	sourceType:"unknown",
	updatePrefs:null,
	_initLocation:null,
	originUrl:null,
	editUrl:null,
	imageUrl:null,
	originType:null,
	isImage:null,
	isTextOnly:false,
	_pageloadTimeout:null,
	_outlineTitleOnly:null,
	gPrefOptions:null,
	cropInfo : null,

	_localUrl:null,
	get localUrl(){
		
		this._useMinLocal=false;

		if(!this._localUrl)
			this.preProcess();
		
		if(this.editUrl)
			return this.editUrl;
		else
			return this._localUrl;
	},
	
	set localUrl(url){
		this._localUrl=url;	
	},

	_customObjectPrefs:null,

	set customObjectPrefs(obj){
		

		this._customObjectPrefs=obj;
		
		
	},

	get customObjectPrefs(){
		if(!this._customObjectPrefs)
			this._customObjectPrefs = {};
				
		return this._customObjectPrefs;
		
		
	},

	
	prepareCustomObjectsPref:function(){
		
		this._outlineTitleOnly=RRprintPages2Pdf.prefs.getCharPref("wkhtml.iopt.outline.titleOnly");
		this._pageloadTimeout=RRprintPages2Pdf.prefs.getCharPref("wkhtml.iopt.pageload.timeout");

		if(_srcObject.prototype.gPrefOptions){
			if(_srcObject.prototype.gPrefOptions["outline.titleOnly"])
				this._outlineTitleOnly=_srcObject.prototype.gPrefOptions["outline.titleOnly"];
			if(_srcObject.prototype.gPrefOptions["pageload.timeout"])
				this._pageloadTimeout=_srcObject.prototype.gPrefOptions["pageload.timeout"];
		}


		if (this._customObjectPrefs) {
			if(this._customObjectPrefs["outline.titleOnly"])
				this._outlineTitleOnly=this._customObjectPrefs["outline.titleOnly"];
		
			if(this._customObjectPrefs["pageload.timeout"])
				this._pageloadTimeout=this._customObjectPrefs["pageload.timeout"];
		}		
		
	},
	
	replaceWebpageTag:function(propName,propValue,content){
		
		
		var retVal=propValue;
		switch(propName){
			case "header.left":
			case "header.center":
			case "header.right":
			case "footer.left":
			case "footer.center":
			case "footer.right":
				retVal=propValue.replace(/\[webpage\]/,this.originUrl);
				break;
				
			case "header.htmlUrl":
			case "footer.htmlUrl":
				if(!content){
					var localFile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
					localFile.initWithPath(propValue);
					content = RRprintPages2Pdf.ReadTextFile(localFile);					
				}
				if (RegExp(/\[webpage\]/).test(content)) {
					var newHdrFile=this.workDir.clone();
					newHdrFile.append("DocHdrFtr.html");	
					newHdrFile.createUnique(retVal.NORMAL_FILE_TYPE,666);
					RRprintPages2Pdf.WriteTextFile(newHdrFile,content.replace(/\[webpage\]/,this.originUrl));
					retVal=newHdrFile.path;
				}
				//make the hdr/ftr path to a file url = no problems with unicode
				var tmpFile = Components.classes['@mozilla.org/file/local;1'].createInstance(Components.interfaces.nsILocalFile);
				tmpFile.initWithPath(retVal);
				var IO=Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService); 
				retVal = IO.newFileURI(tmpFile).spec;
								
				break;		
			
			default:
				break;
		}	
		
		return retVal;
	},
	
	getConverterPrefs:function(){
		var retVal={};

		for (var p in _srcObject.prototype.gPrefOptions) {
			retVal[p]=_srcObject.prototype.gPrefOptions[p];
		}


		if(this._customObjectPrefs){
			//copy object
			for (var p in this._customObjectPrefs) {
				retVal[p]=this._customObjectPrefs[p];
			}

			//remove all identical global defined properties
/*
			for(var p in retVal){
				if ((p in _srcObject.prototype.gPrefOptions) && retVal[p] == _srcObject.prototype.gPrefOptions[p]) {
					delete retVal[p];
				}
			}

*/
		}

		//remove internal props
		if(retVal["outline.titleOnly"])
			delete retVal["outline.titleOnly"];
			
		//change pageload timeout to load.timeout
		if(retVal["pageload.timeout"]) {
			retVal["load.loadTimeout"]=retVal["pageload.timeout"];
			delete retVal["pageload.timeout"];
		}

	
		for(var p in retVal){
			retVal[p]=this.replaceWebpageTag(p,retVal[p])
		}

		
		if(! _srcObject.prototype.updatePrefs ) return retVal;

				
		//add new update Props
		for(var p in _srcObject.prototype.updatePrefs){
			if(!(p in retVal) && !RegExp(/^__data/).test(p)){
				if(("__data." + p) in _srcObject.prototype.updatePrefs)
					retVal[p]= this.replaceWebpageTag(p,_srcObject.prototype.updatePrefs[p],_srcObject.prototype.updatePrefs["__data." + p]);
				else
					retVal[p]= this.replaceWebpageTag(p,_srcObject.prototype.updatePrefs[p]);
			}
		}

		return retVal;

	},
	
	_favIconUrl:null,
	set favIconUrl(url){
		this._favIconUrl=url;	
	},
	
	__faviconService:null,
	get faviconService(){
		if(!_srcObject.prototype.__faviconService){
			_srcObject.prototype.__faviconService=Components.classes["@mozilla.org/browser/favicon-service;1"]
                     .getService(Components.interfaces.nsIFaviconService);
		}
		return _srcObject.prototype.__faviconService;
	},
	
	get asyncFaviconService(){

		return this.faviconService.QueryInterface(Components.interfaces.mozIAsyncFavicons);;
	},	
	
	__ioService:null,
	get ioService(){
		if(!_srcObject.prototype.__ioService){
			_srcObject.prototype.__ioService = Components.classes["@mozilla.org/network/io-service;1"]  
                  .getService(Components.interfaces.nsIIOService);  
		}
		return _srcObject.prototype.__ioService;
	},
	
	//changed to async updateFavIcon
	get favIconUrl(){
		return this._favIconUrl;
	},
	

	
	_Description:null,
	get Description(){
		if(this._Description) return this._Description;

		if(this.originUrl) return this.originUrl;
		if(this.localUrl)return this.localUrl;
		return null;
	},
	set Description(txt){
		this._Description=txt;
	},
	
	_Title:null,
	get Title(){
		if(this._Title) return this._Title;
		var aktUrl=null;
		if(this.originUrl) aktUrl=this.originUrl;
		else if(this.localUrl)aktUrl=this.localUrl;
		
		if(aktUrl){
			try {
				var uri=printPages2Pdf.saver.CommonUtils.IO.newURI(aktUrl, null, null);
				var url = uri.QueryInterface(Components.interfaces.nsIURL); 
				return (url.host?url.host + " :: ":"") + url.fileName;
			}
			catch(e) {/*not a valid Url*/};
		}
		
		return "no Title";
	},
	get suggestedFileName(){
		return printPages2Pdf.saver.CommonUtils.validateFileName(this.Title);	
	},
	
	set Title(txt){
		this._Title=txt;
	},
	
	
	_workDir:null,
	set workDir(dir){
		_srcObject.prototype._workDir=dir;
	},
	
	get workDir(){
		return _srcObject.prototype._workDir;
	},
	
	_parentWindow:null,
	set parentWindow(win){
		printPages2Pdf.domLoader._parentWin=win;
		_srcObject.prototype._parentWindow=win;
	},
	
	get parentWindow(){
		return _srcObject.prototype._parentWindow;
	},
	
	
	_domLoadCallback:null,
	set domLoadCallback(cb){
		_srcObject.prototype._domLoadCallback=cb;
	},
	
	get domLoadCallback(){
		return _srcObject.prototype._domLoadCallback;
	},

	_persistCallback:null,
	set persistCallback(cb){
		printPages2Pdf.saver.ContentSaver.actualCallback=cb;
		_srcObject.prototype._persistCallback=cb;
	},
	
	get persistCallback(){
		return _srcObject.prototype._persistCallback;
	},
	
	_canvas:null,
	set canvas(c){
		_srcObject.prototype._canvas=c;		
	},
	get canvas(){
		return _srcObject.prototype._canvas;		
	},
	
	setOriginUrl:function(obj){
		if (typeof(obj) == "string") {
			this.originUrl=obj;
		}
		else if (obj instanceof Components.interfaces.nsIDOMWindow)  { //DOM window
			this.originUrl=obj.location.href;
/*
			var me=this;
			obj.addEventListener("beforeunload",function(){
				me.handleEvent();
			},false);
*/
			obj.addEventListener("beforeunload",this,false);
		}
		
	},
	
	//ansync update of favicon, cb is async callback
	updateFavIcon:function(cb){
		if(this._favIconUrl){
			cb(this._favIconUrl, null, null, null);
			return;	
		}
		
		if (this.originUrl) {
			var uri = this.ioService.newURI(this.originUrl, null, null);
			if (this.faviconService.getFaviconImageForPage) {
				this._favIconUrl = this.faviconService.getFaviconImageForPage(uri).spec;
				cb(this._favIconUrl, null, null, null);
				
			}
			else {
				cb(this.faviconService.defaultFavicon.spec, null, null, null);
				this.asyncFaviconService.getFaviconURLForPage(uri, cb);
			}
		}
	},
	
	
	handleEvent:function(event){
		this._initLocation=this._saveWinLocal(this._initLocation);
		event.target.removeEventListener("beforeunload",this,false);
	},
	
	preProcess: function(){
		if (typeof(this._initLocation) == "string") {
			if (this._initLocation.search(/^file:/) != -1) {
				this.localUrl = this._initLocation;

				if (this.fileMustBeImage(this.localUrl)) 
					this.isImage = true;
			}
			else 
				this.localUrl = this._saveUrlLocal(this._initLocation);
			
		}
		else if (this._initLocation instanceof Components.interfaces.nsIDOMWindow)  { //DOM window
			this.localUrl=this._saveWinLocal(this._initLocation);
			this._initLocation.removeEventListener("beforeunload",this,false);
			
		}				
	},
	
	winMustBeImage : function(win){
		//not longer used framesets are working correct
		return false;
		if(win.document){
			var framesets=win.document.getElementsByTagName("frameset");
			if( framesets && framesets.length > 0){
				return true;	
			}			
		}
		
		return false;
	},

	checkMustBeImage:function(){
		if (typeof(this._initLocation) == "string" && this.fileMustBeImage(this._initLocation)) {
			this.isImage = true;			
		}
		else if (this._initLocation instanceof Components.interfaces.nsIDOMWindow &&
									this.winMustBeImage(this._initLocation))  
		{ 
			this.isImage = true;											
		}						
	},
	
	fileMustBeImage : function(url){
		//not longer used framesets are working correct
		return false;		
		var req=null;
		try {
			 req = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance();
			 req.open('GET', url, false);
			 req.send('');
		} catch(e) {}
		
		if(!req.responseText) return false;
		
		if (req.responseText.search(/<\s*frameset/i) != -1) return true;
		
		return false;
		
	},
	
	_saveWinLocal : function(win){
		if(this.isImage == null) 
				this.isImage =this.winMustBeImage(win);

/*		
		if(this._useMinLocal)
			return printPages2Pdf.saver.ContentSaver.saveOuterHtml(this.workDir,win,true);	
		else
		*/
		return printPages2Pdf.saver.ContentSaver.captureWindowSync(this.workDir,win);
	},

	_saveUrlLocal:function(url){
		var win = printPages2Pdf.domLoader.getContentWindow(url,this.domLoadCallback, this._pageloadTimeout);

		if(this.isImage == null) 
				this.isImage =this.winMustBeImage(win);
/*		
		if(this._useMinLocal)
			return printPages2Pdf.saver.ContentSaver.saveOuterHtml(this.workDir,win,true);	
		else
		*/
			return printPages2Pdf.saver.ContentSaver.captureWindowSync(this.workDir,win);

	},
	
	_getEditWin : function(){
		var aktUrl=this.editUrl?this.editUrl:this.localUrl;
				
		//reset saved image, because its not longer valid
		this.imageUrl=null;
		var win= printPages2Pdf.domLoader.getContentWindow(aktUrl,this.domLoadCallback, this._pageloadTimeout);
			
		return win;		
		//return printPages2Pdf.saver.ContentSaver.captureWindowSync(this.workDir,win);
	},
	
	_saveEditWin:function(win){
				
		this.editUrl= printPages2Pdf.saver.ContentSaver.captureWindowSync(this.workDir,win);

	},
	
	
	_editCtrl:null,
	get editCtrl(){
		if(!this._editCtrl)
			this._editCtrl=new printPages2Pdf._editPage();
		
		return this._editCtrl;
	},
	
	_proxyReceived:false,
	_proxy : null,
	setProxy: function(url){
		if (this._proxy != null) return;
		
		var objUri=this.ioService.newURI(url,null,null);
		
		this._proxyReceived=false;
		_srcObject.prototype._nsProxyService.asyncResolve(objUri,0,this);
		
		 var thread = Components.classes["@mozilla.org/thread-manager;1"]
                        .getService(Components.interfaces.nsIThreadManager)
                        .currentThread;

		while (this._proxyReceived == false) {
			thread.processNextEvent(true);
		}
		
		
	},
	
	onProxyAvailable : function(aRequest,aURI,aProxyInfo, aStatus){
		this._proxyReceived = true;
		
		if(aProxyInfo)
		{
			var proxyUrl="";
			switch(aProxyInfo.type)
			{
				case "socks":
				case "socks4":
					proxyUrl="socks5://";
					break;
				
				case "http":
					proxyUrl="http://";
					break;
					
				default:
					return;
					break;
			}
			
			proxyUrl += aProxyInfo.host + ":" + aProxyInfo.port;
			
			this.customObjectPrefs["load.proxy"] = proxyUrl;
			
		}
	},
	
	createCropWrapper : function(win,basePage){

/*
		var nsiLocalFile=Components.classes["@mozilla.org/file/local;1"].
           createInstance(Components.interfaces.nsILocalFile);
		
		nsiLocalFile.initWithPath(basePage);
		
		var IO=Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService);
		
		var fileUrl=IO.newFileURI(nsiLocalFile).spec;
*/

		var doc = win.document.implementation.createHTMLDocument(this.Title);
		var div=doc.createElement("div");
		div.style.position="relative";
		div.style.overflow="hidden";
		div.style.height=(this.cropInfo.cropBottom - this.cropInfo.cropTop) + "px";
		div.style.width=(this.cropInfo.cropRight - this.cropInfo.cropLeft) + "px";
		
		var cropFrame=doc.createElement("iframe");
		cropFrame.setAttribute("id","pp2pdf-crop");
		cropFrame.setAttribute("height",this.cropInfo.docHeight);
		cropFrame.setAttribute("width",this.cropInfo.docWidth);
		cropFrame.setAttribute("scrolling","no");
		cropFrame.setAttribute("data-pp2pdf-local-path",basePage);
		cropFrame.setAttribute("data-pp2pdf-base-url",win.location);
		cropFrame.style.position="absolute";
		cropFrame.style.top ="-" + this.cropInfo.cropTop + "px";
		cropFrame.style.left ="-" + this.cropInfo.cropLeft + "px";

		//cropFrame.setAttribute("src",fileUrl);
		
		div.appendChild(cropFrame);
		doc.body.appendChild(div);
		
		doc.body.style.width =(this.cropInfo.cropRight - this.cropInfo.cropLeft) + "px";
		doc.body.style.height=(this.cropInfo.cropBottom - this.cropInfo.cropTop) + "px";
		doc.body.style.overflow="hidden";
		doc.body.style.position="relative";
/*
		doc.body.style.marginLeft="auto";
		doc.body.style.marginRight="auto";
	*/	
		return doc;

	},
	
	doCropPage:function(){
		if(this.sourceType != "cropwindow") return null;	
		
		var basePage=printPages2Pdf.simpleDomSaver.saveCropFrame(this._workDir,this._initLocation);
		
		var docCropWrapper=this.createCropWrapper(this._initLocation,basePage);
		this.customObjectPrefs["load.localIframe"] = "true";
		
		return printPages2Pdf.simpleDomSaver.saveDOMtoFile(null,docCropWrapper,"url");
	},
	
	
	getFinalUrl:function(){
		
		
		delete this.customObjectPrefs["load.replaceBody"];
		
		this.prepareCustomObjectsPref();		
		
		//if(!this.localUrl) this.preProcess();
		
		this.checkMustBeImage();
		var aktUrl=null;
		//if(this.editUrl) aktUrl=this.editUrl;
		if((aktUrl=this.doCropPage()) != null){
			this.setProxy(aktUrl);
			return aktUrl;
		}
		else if (this.isTextOnly == true || this.isImage == true || this._outlineTitleOnly == "true") {
			aktUrl = this.localUrl;
			var win = printPages2Pdf.domLoader.getContentWindow(aktUrl, this.domLoadCallback, this._pageloadTimeout);
			
			if (this.isTextOnly == true) 
				printPages2Pdf.textOnly.cleanWindow(win);
			
			if (this._outlineTitleOnly == "true" && !this.isImage) {
				this.editCtrl.cleanHeaders(win.document);
				this.editCtrl.setMainHeader(win.document, this.Title);
			}
			
			if (this.isImage == true) 
				aktUrl = printPages2Pdf.win2Image.saveCompleteWindow(this.workDir, win, this.canvas, this.Title);
			else 
				aktUrl = printPages2Pdf.saver.ContentSaver.captureWindowSync(this.workDir, win);
			
		}
	/*	else if(this.editUrl)
		{
			var url=this.ioService.newURI(this.editUrl,null,null);
			var file = url.QueryInterface(Components.interfaces.nsIFileURL).file;
			this.customObjectPrefs["load.replaceBody"] = file.path;
			aktUrl=this.editUrl;						
			
		}*/
		else if (this._useMinLocal) {
			if (this._initLocation instanceof Components.interfaces.nsIDOMWindow)
			{
//				this.customObjectPrefs["load.replaceBody"] = printPages2Pdf.saver.ContentSaver.saveOuterHtml(this.workDir,this._initLocation);
				this.customObjectPrefs["load.replaceBody"] = printPages2Pdf.simpleDomSaver.saveOuterHtml(this.workDir,this._initLocation);
				this._initLocation.removeEventListener("beforeunload",this,false);
				aktUrl=this._initLocation.location.href;				
			}
			else if (typeof(this._initLocation) == "string")
				aktUrl=this._initLocation;
			else
				aktUrl=this.localUrl;
		}
		else
			aktUrl=this.localUrl;
		
		this.setProxy(aktUrl);
			
		return aktUrl;		

	},
}

var _tocObject=function(location,bTextOnly){
	_tocObject.parent.init.call(this,location,bTextOnly);
	this._Title=this.getTocTitle();
}

_tocObject.prototype=new _srcObject();
_tocObject.prototype.constructor = _tocObject;

_tocObject.parent=_srcObject.prototype;

_tocObject.prototype.getTocTitle = function(){
//	var title=RRprintPages2Pdf.prefs.getCharPref("wkhtml.topt.toc.captionText");	
	var title=RRprintPages2Pdf.prefs.getComplexValue("wkhtml.topt.toc.captionText",
      Components.interfaces.nsISupportsString).data;	
	if(!title)
		title=RRprintPages2Pdf.strb.GetStringFromName("toc.default.captionText")
	
	return title;
}

_tocObject.prototype.getFinalUrl=function(){
	//return this.getTocTitle();
	return "toc";
}

_tocObject.prototype._favIconUrl="chrome://printPages2Pdf/skin/contentTree.png";
_tocObject.prototype.sourceType="toc";

_tocObject.prototype.getConverterPrefs = function(){
	var gPrefObj=_tocObject.parent.getConverterPrefs.call(this);

   var prefs = Components.classes["@mozilla.org/preferences-service;1"]  
     .getService(Components.interfaces.nsIPrefService)  
     .getBranch("extensions.RRprintPages2Pdf.wkhtml.topt.");

   
	var obj={};
	var children = prefs.getChildList("",obj) ;

	for (var i = 0; i < children.length; i++) {
//		var prefVal=prefs.getCharPref(children[i]);
		var prefVal=prefs.getComplexValue(children[i],
      			Components.interfaces.nsISupportsString).data;
		if (prefVal) {
			gPrefObj[children[i]] = prefVal;
		}
	}

	//must be set for TOC
	gPrefObj["isTableOfContent"]="true"
	//gPrefObj["web.printMediaType"]="true"
	
//	gPrefObj["pagesCount"]="false";
	
	if(!("tocXsl" in gPrefObj) || !gPrefObj.tocXsl){
		var defTocXsl = RRprintPages2Pdf.ExtensionDir.clone();
		defTocXsl.append(RRprintPages2Pdf.g_const.EXTENSION_TEMPLATEDIR);
		defTocXsl.append(RRprintPages2Pdf.g_const.DEFTOCXSL_NAME);
				
		gPrefObj.tocXsl=defTocXsl.path;
	}
	
	//make the toc path to a file url = no problems with unicode
	var tmpFile = Components.classes['@mozilla.org/file/local;1'].createInstance(Components.interfaces.nsILocalFile);
	tmpFile.initWithPath(gPrefObj.tocXsl);
	var IO=Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService); 
	gPrefObj.tocXsl = IO.newFileURI(tmpFile).spec;

	
	if(!gPrefObj["toc.captionText"])
		gPrefObj["toc.captionText"]=this.getTocTitle();
	
	//Set prefix, so that xsl transformation recognizes this as the configuration Title
	if(gPrefObj["toc.captionText"])
		gPrefObj["toc.captionText"] = RRprintPages2Pdf.g_const.TOC_DEFCAPTION_PREFIX +  gPrefObj["toc.captionText"]; 

		
	return gPrefObj;
}

var _coverObject=function(location,bTextOnly){
	_coverObject.parent.init.call(this,location,bTextOnly);
	this._Title=this.getTocTitle();
}

_coverObject.prototype={
 	pageList: null,	
	mainTitle: null,
};

_coverObject.prototype=new _srcObject();
_coverObject.prototype.constructor = _coverObject;

_coverObject.parent=_srcObject.prototype;

_coverObject.prototype.getCoverFile = function(){

	var strCoverFile=RRprintPages2Pdf.prefs.getCharPref("wkhtml.iopt.coverFile");
	var defCoverFile=null;
	if (!strCoverFile || strCoverFile == "") {
		defCoverFile = RRprintPages2Pdf.ExtensionDir.clone();
		defCoverFile.append(RRprintPages2Pdf.g_const.EXTENSION_TEMPLATEDIR);
		defCoverFile.append(RRprintPages2Pdf.g_const.DEFCOVER_DIR);
		defCoverFile.append(RRprintPages2Pdf.g_const.DEFCOVER_FILE);
	}
	else {
		defCoverFile=Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
		defCoverFile.initWithPath(strCoverFile);	
	}
	
	return defCoverFile;
}

_coverObject.prototype.getTocTitle = function(){

	var	title=RRprintPages2Pdf.strb.GetStringFromName("coverpage.default.captionText")

	return title;
}

_coverObject.prototype.copyCoverDir = function(){
	var nsiOrgCoverFile=this.getCoverFile();
	if(!nsiOrgCoverFile.exists()) return null;

	var nsiCoverDir=nsiOrgCoverFile.parent.clone();
	
	var targetDir=this.workDir.clone();
	targetDir.append("data");
	targetDir.createUnique(targetDir.DIRECTORY_TYPE,0777);

	nsiCoverDir.copyTo(targetDir,null);

	targetDir.append(nsiCoverDir.leafName);
	targetDir.append(nsiOrgCoverFile.leafName);


	return targetDir;

}

_coverObject.prototype.replaceCoverParams = function(data){
	
	var dt=new Date();
	data = data.replace(/\[date\]/g,dt.toLocaleDateString());
	data = data.replace(/\[time\]/g,dt.getHours() + ":" + dt.getMinutes());
	
	data = data.replace(/\[title\]/g,this.mainTitle.label);
	
	var webpages="<ul class='pagelist'>";

	for(var i=0;i < this.pageList.childNodes.length;i++)
	{
		var srcObject=this.pageList.childNodes[i].getUserData("srcObject");
		if(srcObject.sourceType == "cover" || srcObject.sourceType == "toc") continue;
		
		webpages += "<li><a href='" + srcObject.originUrl + "'>"  + srcObject.Title + "</a></li>";
	}
	webpages += "</ul>";

	data = data.replace(/\[pagelist\]/g,webpages);

	return data;	
}

_coverObject.prototype.updateCoverFile = function(){

	var coverFile = this.copyCoverDir();
	if (coverFile == null) 	return null;
	
	var data = "";
	var fstream = Components.classes["@mozilla.org/network/file-input-stream;1"].
	              createInstance(Components.interfaces.nsIFileInputStream);
	var cstream = Components.classes["@mozilla.org/intl/converter-input-stream;1"].
	              createInstance(Components.interfaces.nsIConverterInputStream);
	fstream.init(coverFile, -1, 0, 0);
	cstream.init(fstream, "UTF-8", 0, 0); // you can use another encoding here if you wish
	
	var str = {};
	var read = 0;
	do { 
	    read = cstream.readString(0xffffffff, str); // read as much as we can and put it in str.value
	    data += str.value;
	} while (read != 0);

	cstream.close(); // this closes fstream	
	
	data=this.replaceCoverParams(data);

	var UNICODE=Components.classes['@mozilla.org/intl/scriptableunicodeconverter'].getService(Components.interfaces.nsIScriptableUnicodeConverter);	

	UNICODE.charset = "UTF-8";
	data = UNICODE.ConvertFromUnicode(data);
	var ostream = Components.classes['@mozilla.org/network/file-output-stream;1'].createInstance(Components.interfaces.nsIFileOutputStream);
	ostream.init(coverFile, 2, 0x600, false);
	ostream.write(data, data.length);
	ostream.close();
		
	var IO=Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService); 
	var strCoverFile = IO.newFileURI(coverFile).spec;
	
	return strCoverFile
}

_coverObject.prototype.getFinalUrl=function(){

	return this.updateCoverFile();
}

_coverObject.prototype._favIconUrl="chrome://printPages2Pdf/skin/contentTree.png";
_coverObject.prototype.sourceType="cover";

_coverObject.prototype.getConverterPrefs = function(){
	var gPrefObj=_coverObject.parent.getConverterPrefs.call(this);

//	gPrefObj["pagesCount"]="false";
	gPrefObj["includeInOutline"]="false";

	gPrefObj["header.left"]= "" ;
	gPrefObj["header.center"]= "" ;
	gPrefObj["header.right"]= "" ;
	gPrefObj["header.line"]= "false" ;
	gPrefObj["header.spacing"]= "0" ;
	gPrefObj["header.htmlUrl"]= "" ;
	gPrefObj["footer.fontSize"]= "0" ;
	gPrefObj["footer.fontName"]= "" ;
	gPrefObj["footer.left"]= "" ;
	gPrefObj["footer.center"]= "" ;
	gPrefObj["footer.right"]= "" ;
	gPrefObj["footer.line"]= "false" ;
	gPrefObj["footer.spacing"]= "0" ;
	gPrefObj["footer.htmlUrl"]= "";

	gPrefObj["isCover"]="true"		
	return gPrefObj;
}
 
