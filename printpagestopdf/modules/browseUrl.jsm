Components.utils.import("resource://printPages2PdfMod/printPages2PdfGlobal.jsm"); 
Components.utils.import("resource://printPages2PdfMod/pageDimensions.jsm"); 

var EXPORTED_SYMBOLS = [ ];


RRprintPages2Pdf._browseUrl=function(parent,callback,url,pageloadTimeout){
	if(pageloadTimeout)
		this._maxWaitIntervall=pageloadTimeout;
		
	this._win=parent.ownerDocument.defaultView,
	this._doc=parent.ownerDocument;
	this._parent=parent;
	
	this._cbFinished=callback;
	this._url=url;
	
	this.createBrowser();

	if (url) {
		this.status=RRprintPages2Pdf.RUNNING;
		this._url=url;
		this.loadPage();
	}

}

/*
RRprintPages2Pdf._browseUrl.prototype.processing = function(){
	this._browser=this._hiddenBrowserWin.document.getElementById("contentbrowser");
	this.loadPage();	
}
*/

RRprintPages2Pdf._browseUrl.prototype = {
	_status:null,
	_win:null,
	_cbFinished:null,
	_doc:null,
	_browser:null,
	_url:null,
	_maxWaitIntervall:1000,
	_curWaitCounter:0,
	_hIntervall:null,
	_isTimerProcessing:false,
	_hiddenBrowserWin:null,
	observerCache:{},
	get loadedWin(){
		return this._browser.contentWindow;
	},
	
}
      
RRprintPages2Pdf._browseUrl.prototype.QueryInterface = function(aIID)  
      {  
       if (aIID.equals(Components.interfaces.nsIWebProgressListener) ||  
           aIID.equals(Components.interfaces.nsISupportsWeakReference) ||  
           aIID.equals(Components.interfaces.nsISupports))  
         return this;  
       throw Components.results.NS_NOINTERFACE;  
}  

//WebProgrssListener Methods      
RRprintPages2Pdf._browseUrl.prototype.onStateChange = function(aWebProgress, aRequest, aStateFlags, aStatus)  
{  

/*
	if (aStateFlags & (Components.interfaces.nsIWebProgressListener.STATE_REDIRECTING)) {
		RRprintPages2Pdf.cs.logStringMessage("REDIRECTED");
		this.resetWaitTimer();
	}

*/

	if (aStateFlags & (Components.interfaces.nsIWebProgressListener.STATE_START | Components.interfaces.nsIWebProgress.NOTIFY_STATE_WINDOW)) {
		if (aRequest && aRequest.name) {
			this.observerCache[aRequest.name] = 1;
		}
	}
	if(aStateFlags & (Components.interfaces.nsIWebProgressListener.STATE_STOP |Components.interfaces.nsIWebProgress.NOTIFY_STATE_WINDOW)){
		
		if(aRequest && aRequest.name){
			try {
				delete this.observerCache[aRequest.name];
			}catch(e){}
		}
			

		if ((Object.keys(this.observerCache).length == 0  || this._browser.contentWindow.location == aRequest.name) &&
				!this._browser.webProgress.isLoadingDocument	) {

//		if ((Object.keys(this.observerCache).length == 0  || this._browser.contentWindow.location == aRequest.name)) {
			this._win.clearTimeout(this._hIntervall);
			this.observerCache = {};
  			this._browser.removeProgressListener(this);   	
			if(this._cbFinished) this._cbFinished("finished",{"win":this._browser.contentWindow});	
			this.status=RRprintPages2Pdf.SUCCESS;
		}
			
	}

}  
      
RRprintPages2Pdf._browseUrl.prototype.onLocationChange = function(aProgress, aRequest, aURI) {
} 
      
      // For definitions of the remaining functions see related documentation  
RRprintPages2Pdf._browseUrl.prototype.onProgressChange = function(aWebProgress, aRequest, curSelf, maxSelf, curTot, maxTot){
	this.resetWaitTimer();
	if(this._cbFinished) this._cbFinished("progress",{"aWebProgress":aWebProgress, "aRequest":aRequest, "curSelf":curSelf, 
														"maxSelf":maxSelf, "curTot":curTot, "maxTot":maxTot,"browser":this._browser,})	
}

RRprintPages2Pdf._browseUrl.prototype.onStatusChange = function(aWebProgress, aRequest, aStatus, aMessage) {
	this.resetWaitTimer();
	if(this._cbFinished) this._cbFinished("status",{"main":"Hallo","aWebProgress":aWebProgress, "aRequest":aRequest, "aMessage":aMessage,})	
} 

RRprintPages2Pdf._browseUrl.prototype.onSecurityChange = function(aWebProgress, aRequest, aState) { }  
//End of WebProgrssListener Methods	

RRprintPages2Pdf._browseUrl.prototype.resetWaitTimer = function(){
	if(this._isTimerProcessing == true) return;
	this._isTimerProcessing=true;
	
	if(this._hIntervall)
		this._win.clearTimeout(this._hIntervall);
	
	var me=this;	
	this._hIntervall=this._win.setTimeout(function(){me.onLoadTimeout();},this._maxWaitIntervall);
	
	this._isTimerProcessing=false;
}

RRprintPages2Pdf._browseUrl.prototype.onLoadTimeout=function(){
	
	this._browser.removeProgressListener(this);   	
	if(this._cbFinished) this._cbFinished("timeout",{"win":this._browser.contentWindow});	
	this.status=(RRprintPages2Pdf.TIMEOUT );
//	this.status=(RRprintPages2Pdf.TIMEOUT | RRprintPages2Pdf.ERROR);
		
}

RRprintPages2Pdf._browseUrl.prototype.createBrowser = function(){

	this._browser=this._doc.createElement("browser");
	this._browser.setAttribute("type","content");

	this._parent.appendChild(this._browser);


	this._browser.setAttribute("flex","0");
	this._browser.flex=0;
	
/*
var domWindowUtils = this._win.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                     .getInterface(Components.interfaces.nsIDOMWindowUtils);
	var widthPx=(210 * domWindowUtils.displayDPI) / (domWindowUtils.screenPixelsPerCSSPixel * 25.4);	
	var heightPx=(297 * domWindowUtils.displayDPI) / (domWindowUtils.screenPixelsPerCSSPixel * 25.4);	
*/
	
	
	this._browser.style.width=(pageDimensions.width ) + "mm";
//	this._browser.style.width=(pageDimensions.width * 1.17) + "mm";
	this._browser.style.height=(pageDimensions.height) + "mm";
//	this._browser.style.height=(pageDimensions.height * 1.17) + "mm";
/*
	this._browser.style.minWidth=(pageDimensions.width * 1.17) + "mm";
	this._browser.style.minHeight=(pageDimensions.height * 1.17) + "mm";

	this._browser.style.overflow="scroll";
	
/*
	this._browser.docShell.allowMetaRedirects=true;
	this._browser.docShell.allowJavascript=false;

*/

}


RRprintPages2Pdf._browseUrl.prototype.loadPage = function(url){
	this.reset();	

	if(url) this._url=url;

	try{
		this._browser.webProgress.removeProgressListener(this);
	}
	catch(e){}


	this._browser.webProgress.addProgressListener(this, Components.interfaces.nsIWebProgress.NOTIFY_STATUS |
														Components.interfaces.nsIWebProgress.NOTIFY_PROGRESS |
														Components.interfaces.nsIWebProgress.NOTIFY_STATE_WINDOW);


	try {
		if(this._cbFinished) this._cbFinished("start",{"url":this._url,});
		this._browser.webNavigation.loadURI(this._url, Components.interfaces.nsIWebNavigation.LOAD_FLAGS_NONE, null, null, null);
		this.resetWaitTimer();
	}
	catch(e){
		this._browser.removeProgressListener(this);   	
		this.status=RRprintPages2Pdf.ERROR;
		if(this._cbFinished) this._cbFinished("loaderror",{"win":this._browser.contentWindow});
	}

}

RRprintPages2Pdf._browseUrl.prototype.reset = function(){
	this._win.clearInterval(this._hIntervall);

	try {
		this._browser.removeProgressListener(this);
	} catch(e) {}  
	
	if(this._browser && this._browser.webNavigation)
		this._browser.webNavigation.stop(3);

	this._curWaitCounter = 0;
	this._hIntervall = null;
	this._isTimerProcessing = false;

}

RRprintPages2Pdf._browseUrl.prototype.deleteObject = function(){

	
	this.reset();
	if (this._parent && this._browser) {
		this._parent.removeChild(this._browser);
		this._browser=null;
	}
	
	//delete this;
	
}
